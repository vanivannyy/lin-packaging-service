import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { autoCreatePurchaseRequestIfNeeded } from "@/lib/purchase-auto";

// BOM multi-material per Sales Order (model SalesOrderMaterial). Siklus tiap baris:
//   RESERVED --(WO mulai produksi)--> CONSUMED
//   RESERVED --(SO dibatalkan / baris dihapus)--> RELEASED
// Transisi status memakai updateMany bersyarat (status = RESERVED) di dalam transaksi,
// sehingga klik ganda / panggilan konkuren tidak menggandakan pengurangan stok.
// Reservasi boleh melebihi stok: available (stock - reserved) <= min memicu Auto PR.

import { parseBomFromSpec, type BomLineInput } from "@/lib/bom-spec";
export { parseBomFromSpec };
export type { BomLineInput };

function roundQty(qty: number): number {
  return Math.ceil(qty * 1000) / 1000;
}

/** Tambah satu baris BOM + reservasi. Digabung (qty ditambah) bila material yang sama masih RESERVED. */
export async function addBomLine(params: {
  salesOrderId: string;
  line: BomLineInput;
  userId: string;
}) {
  const qty = roundQty(params.line.qty);
  if (!(qty > 0)) return null;

  const so = await prisma.salesOrder.findUniqueOrThrow({ where: { id: params.salesOrderId } });
  const material = await prisma.material.findFirst({ where: { id: params.line.materialId, isDeleted: false } });
  if (!material) throw new Error("Material tidak ditemukan.");

  const row = await prisma.$transaction(async (tx) => {
    const existing = await tx.salesOrderMaterial.findFirst({
      where: { salesOrderId: so.id, materialId: material.id, status: "RESERVED" },
    });
    const saved = existing
      ? await tx.salesOrderMaterial.update({
          where: { id: existing.id },
          data: { qty: { increment: qty }, reservedQty: { increment: qty } },
        })
      : await tx.salesOrderMaterial.create({
          data: {
            salesOrderId: so.id,
            materialId: material.id,
            qty,
            reservedQty: qty,
            status: "RESERVED",
            source: params.line.source ?? "MANUAL",
            note: params.line.note,
          },
        });
    await tx.material.update({ where: { id: material.id }, data: { reservedQty: { increment: qty } } });
    return saved;
  });

  await logAudit({
    userId: params.userId,
    module: "material",
    action: "UPDATE",
    referenceCode: so.code,
    newValue: { event: "RESERVE", materialId: material.id, sku: material.sku, qty },
  });
  await autoCreatePurchaseRequestIfNeeded(material.id);
  return row;
}

/** Reservasi seluruh BOM saat SO dibuat. */
export async function reserveBomForSalesOrder(params: {
  salesOrderId: string;
  lines: BomLineInput[];
  userId: string;
}) {
  for (const line of params.lines) {
    await addBomLine({ salesOrderId: params.salesOrderId, line, userId: params.userId });
  }
}

/** Konsumsi: kurangi stok & reservasi tiap baris RESERVED, catat StockMovement PRODUCTION_OUT. */
export async function consumeBomForSalesOrder(salesOrderId: string, userId: string) {
  const so = await prisma.salesOrder.findUniqueOrThrow({ where: { id: salesOrderId } });
  const lines = await prisma.salesOrderMaterial.findMany({ where: { salesOrderId, status: "RESERVED" } });

  for (const line of lines) {
    const qty = Number(line.reservedQty);
    const done = await prisma.$transaction(async (tx) => {
      const claimed = await tx.salesOrderMaterial.updateMany({
        where: { id: line.id, status: "RESERVED" },
        data: { status: "CONSUMED", reservedQty: 0 },
      });
      if (claimed.count === 0) return false; // sudah diproses panggilan lain
      await tx.material.update({
        where: { id: line.materialId },
        data: { stockQty: { decrement: qty }, reservedQty: { decrement: qty } },
      });
      await tx.stockMovement.create({
        data: {
          materialId: line.materialId,
          quantity: -qty,
          type: "PRODUCTION_OUT",
          referenceCode: so.code,
          note: `Pemakaian material produksi ${so.code}`,
          source: "WEB",
          userId,
        },
      });
      return true;
    });
    if (!done) continue;
    await logAudit({
      userId,
      module: "material",
      action: "UPDATE",
      referenceCode: so.code,
      newValue: { event: "CONSUME", materialId: line.materialId, qty },
    });
    await autoCreatePurchaseRequestIfNeeded(line.materialId);
  }
}

async function releaseLines(where: { salesOrderId?: string; id?: string }, userId: string, referenceCode: string) {
  const lines = await prisma.salesOrderMaterial.findMany({ where: { ...where, status: "RESERVED" } });
  for (const line of lines) {
    const qty = Number(line.reservedQty);
    const done = await prisma.$transaction(async (tx) => {
      const claimed = await tx.salesOrderMaterial.updateMany({
        where: { id: line.id, status: "RESERVED" },
        data: { status: "RELEASED", reservedQty: 0 },
      });
      if (claimed.count === 0) return false;
      await tx.material.update({ where: { id: line.materialId }, data: { reservedQty: { decrement: qty } } });
      return true;
    });
    if (!done) continue;
    await logAudit({
      userId,
      module: "material",
      action: "UPDATE",
      referenceCode,
      newValue: { event: "RELEASE", materialId: line.materialId, qty },
    });
  }
}

/** Lepas semua reservasi (SO dibatalkan) tanpa mengubah stok fisik. */
export async function releaseBomForSalesOrder(salesOrderId: string, userId: string) {
  const so = await prisma.salesOrder.findUniqueOrThrow({ where: { id: salesOrderId } });
  await releaseLines({ salesOrderId }, userId, so.code);
}

/** Hapus satu baris BOM yang masih RESERVED (melepas reservasinya). */
export async function removeBomLine(lineId: string, userId: string) {
  const line = await prisma.salesOrderMaterial.findUniqueOrThrow({
    where: { id: lineId },
    include: { salesOrder: true },
  });
  await releaseLines({ id: lineId }, userId, line.salesOrder.code);
}
