import { prisma } from "@/lib/prisma";
import { notifyStatusChange } from "@/lib/notify";
import { notifyClientAccounts } from "@/lib/client-notify";
import type { ClientStockMovementType, ClientStockSide } from "@prisma/client";

function toNum(v: unknown): number {
  return v === null || v === undefined ? 0 : Number(v);
}

/**
 * Cari (atau buat baru) ClientFinishedGoodsItem untuk kombinasi customer+product
 * dari sebuah Sales Order. Dipanggil otomatis setiap kali Work Order milik SO
 * tersebut selesai produksi, supaya admin tidak perlu bikin master item manual
 * dulu - item barang jadi klien baru otomatis muncul begitu order pertamanya jadi.
 */
export async function ensureClientItemForSalesOrder(salesOrderId: string) {
  const salesOrder = await prisma.salesOrder.findUniqueOrThrow({
    where: { id: salesOrderId },
    include: { product: true },
  });

  const itemName = salesOrder.product?.name ?? salesOrder.productNote ?? "Barang Tanpa Nama";
  const unit = salesOrder.product?.unit ?? "PCS";

  const existing = await prisma.clientFinishedGoodsItem.findFirst({
    where: {
      customerId: salesOrder.customerId,
      isDeleted: false,
      ...(salesOrder.productId ? { productId: salesOrder.productId } : { productId: null, itemName }),
    },
  });
  if (existing) return existing;

  return prisma.clientFinishedGoodsItem.create({
    data: {
      customerId: salesOrder.customerId,
      productId: salesOrder.productId,
      itemName,
      unit,
    },
  });
}

type Db = Pick<typeof prisma, "clientFinishedGoodsItem" | "clientStockMovement">;

async function createMovement(params: {
  itemId: string;
  side: ClientStockSide;
  type: ClientStockMovementType;
  quantity: number; // signed delta
  resultingQty: number;
  note?: string | null;
  referenceCode?: string | null;
  actorUserId?: string | null;
  actorClientAccountId?: string | null;
  db?: Db;
}) {
  await (params.db ?? prisma).clientStockMovement.create({
    data: {
      itemId: params.itemId,
      side: params.side,
      type: params.type,
      quantity: params.quantity,
      resultingQty: params.resultingQty,
      note: params.note ?? undefined,
      referenceCode: params.referenceCode ?? undefined,
      actorUserId: params.actorUserId ?? undefined,
      actorClientAccountId: params.actorClientAccountId ?? undefined,
    },
  });
}

/**
 * Qty barang jadi yang dihitung ke stok klien: qty GOOD hasil produksi (WorkOrder.goodQtyTotal).
 * Fallback ke qty Sales Order bila belum ada log produksi (goodQtyTotal = 0) agar stok tidak nol
 * pada WO lama / operator yang tidak mengisi log.
 */
async function resolveFinishedQty(salesOrderId: string, orderQty: number): Promise<number> {
  const wo = await prisma.workOrder.findUnique({ where: { salesOrderId }, select: { goodQtyTotal: true } });
  return wo && wo.goodQtyTotal > 0 ? wo.goodQtyTotal : orderQty;
}

/** Otomatis: dipanggil saat Work Order klien selesai produksi (stage -> DONE). */
export async function recordProductionIn(salesOrderId: string, referenceCode?: string) {
  const salesOrder = await prisma.salesOrder.findUniqueOrThrow({ where: { id: salesOrderId } });
  const item = await ensureClientItemForSalesOrder(salesOrderId);
  const qty = await resolveFinishedQty(salesOrderId, salesOrder.qty);

  // Update stok + catat movement atomik.
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.clientFinishedGoodsItem.update({
      where: { id: item.id },
      data: { linWarehouseQty: { increment: qty } },
    });
    await createMovement({
      itemId: item.id,
      side: "LIN_WAREHOUSE",
      type: "PRODUCTION_IN",
      quantity: qty,
      resultingQty: toNum(row.linWarehouseQty),
      note: "Produksi selesai, barang masuk gudang Lin Packaging",
      referenceCode,
      db: tx,
    });
    return row;
  });

  await notifyClientAccounts({
    customerId: salesOrder.customerId,
    title: `Stok ${updated.itemName} bertambah`,
    message: `Produksi selesai. Stok ${updated.itemName} di gudang Lin Packaging sekarang ${toNum(updated.linWarehouseQty)} ${updated.unit}.`,
    href: `/items/${updated.id}`,
    type: "STATUS",
    referenceCode,
  });

  return updated;
}

/** Otomatis: dipanggil saat Delivery Order klien sampai (stage -> DELIVERED). */
export async function recordDeliveryOut(salesOrderId: string, referenceCode?: string) {
  const salesOrder = await prisma.salesOrder.findUniqueOrThrow({ where: { id: salesOrderId } });
  const item = await ensureClientItemForSalesOrder(salesOrderId);
  const qty = await resolveFinishedQty(salesOrderId, salesOrder.qty);

  // Update stok + movement atomik; stok gudang tidak boleh negatif (dikurangi maksimal sebesar stok yang ada).
  const updated = await prisma.$transaction(async (tx) => {
    const current = await tx.clientFinishedGoodsItem.findUniqueOrThrow({ where: { id: item.id } });
    const outQty = Math.min(qty, Math.max(0, toNum(current.linWarehouseQty)));
    const row =
      outQty > 0
        ? await tx.clientFinishedGoodsItem.update({
            where: { id: item.id },
            data: { linWarehouseQty: { decrement: outQty } },
          })
        : current;
    await createMovement({
      itemId: item.id,
      side: "LIN_WAREHOUSE",
      type: "DELIVERY_OUT",
      quantity: -outQty,
      resultingQty: toNum(row.linWarehouseQty),
      note:
        outQty < qty
          ? `Pengiriman sampai tujuan (dikurangi ${outQty} dari ${qty}; stok gudang tidak mencukupi)`
          : "Pengiriman sampai tujuan, barang keluar dari gudang Lin Packaging",
      referenceCode,
      db: tx,
    });
    return row;
  });

  await notifyClientAccounts({
    customerId: salesOrder.customerId,
    title: `${updated.itemName} sudah dikirim`,
    message: `Pengiriman sampai. Stok ${updated.itemName} di gudang Lin Packaging sekarang ${toNum(updated.linWarehouseQty)} ${updated.unit}. Silakan update stok gudang Anda.`,
    href: `/items/${updated.id}`,
    type: "STATUS",
    referenceCode,
  });

  return updated;
}

/** Manual: admin/staff koreksi stok gudang Lin Packaging lewat web app. */
export async function adminAdjustLinStock(params: {
  itemId: string;
  newQty: number;
  note?: string;
  userId: string;
}) {
  if (params.newQty < 0) throw new Error("Stok tidak boleh negatif.");
  const { item, updated } = await prisma.$transaction(async (tx) => {
    const item = await tx.clientFinishedGoodsItem.findUniqueOrThrow({ where: { id: params.itemId } });
    const delta = params.newQty - toNum(item.linWarehouseQty);
    const updated = await tx.clientFinishedGoodsItem.update({
      where: { id: params.itemId },
      data: { linWarehouseQty: params.newQty },
    });
    await createMovement({
      itemId: item.id,
      side: "LIN_WAREHOUSE",
      type: "ADMIN_ADJUSTMENT",
      quantity: delta,
      resultingQty: params.newQty,
      note: params.note ?? "Koreksi stok manual oleh admin",
      actorUserId: params.userId,
      db: tx,
    });
    return { item, updated };
  });

  await notifyClientAccounts({
    customerId: item.customerId,
    title: `Stok Lin Packaging: ${updated.itemName}`,
    message: `Admin memperbarui stok ${updated.itemName} di gudang Lin Packaging menjadi ${params.newQty} ${updated.unit}.`,
    href: `/items/${updated.id}`,
  });

  return updated;
}

/** Manual: admin/staff koreksi angka stok gudang klien (mis. hasil konfirmasi telepon). */
export async function adminAdjustClientStock(params: {
  itemId: string;
  newQty: number;
  note?: string;
  userId: string;
}) {
  if (params.newQty < 0) throw new Error("Stok tidak boleh negatif.");
  const updated = await prisma.$transaction(async (tx) => {
    const item = await tx.clientFinishedGoodsItem.findUniqueOrThrow({ where: { id: params.itemId } });
    const delta = params.newQty - toNum(item.clientWarehouseQty);
    const row = await tx.clientFinishedGoodsItem.update({
      where: { id: params.itemId },
      data: { clientWarehouseQty: params.newQty, clientReportedAt: new Date() },
    });
    await createMovement({
      itemId: item.id,
      side: "CLIENT_WAREHOUSE",
      type: "ADMIN_ADJUSTMENT",
      quantity: delta,
      resultingQty: params.newQty,
      note: params.note ?? "Koreksi stok manual oleh admin",
      actorUserId: params.userId,
      db: tx,
    });
    return row;
  });

  await notifyIfClientStockLow(updated.id);

  return updated;
}

/** Manual: klien lapor sendiri stok terkini di gudangnya lewat app mobile klien. */
export async function clientReportStock(params: {
  itemId: string;
  newQty: number;
  note?: string;
  clientAccountId: string;
}) {
  if (params.newQty < 0) throw new Error("Stok tidak boleh negatif.");
  const updated = await prisma.$transaction(async (tx) => {
    const item = await tx.clientFinishedGoodsItem.findUniqueOrThrow({ where: { id: params.itemId } });
    const delta = params.newQty - toNum(item.clientWarehouseQty);
    const row = await tx.clientFinishedGoodsItem.update({
      where: { id: params.itemId },
      data: { clientWarehouseQty: params.newQty, clientReportedAt: new Date() },
    });
    await createMovement({
      itemId: item.id,
      side: "CLIENT_WAREHOUSE",
      type: "CLIENT_REPORT",
      quantity: delta,
      resultingQty: params.newQty,
      note: params.note ?? "Dilaporkan klien lewat app mobile",
      actorClientAccountId: params.clientAccountId,
      db: tx,
    });
    return row;
  });

  await notifyIfClientStockLow(updated.id);

  return updated;
}

/**
 * Kalau stok yang dilaporkan klien sudah <= batas minimum, kirim notifikasi ke
 * staff internal (Sales & Production Planner) supaya bisa siap-siap jadwalkan
 * produksi tambahan sebelum klien benar-benar kehabisan stok.
 */
async function notifyIfClientStockLow(itemId: string) {
  const item = await prisma.clientFinishedGoodsItem.findUniqueOrThrow({
    where: { id: itemId },
    include: { customer: true },
  });
  if (toNum(item.clientWarehouseQty) > toNum(item.minStockQty)) return;

  await notifyStatusChange({
    moduleKeys: ["client-stock", "sales-order", "produksi"],
    module: "client-stock",
    type: "ACTION",
    href: "/stok-klien",
    referenceCode: item.sku ?? item.id,
    title: `Stok klien menipis: ${item.customer.name}`,
    message: `${item.itemName} di gudang ${item.customer.name} tersisa ${toNum(item.clientWarehouseQty)} ${item.unit} (min. ${toNum(
      item.minStockQty,
    )}). Siapkan produksi tambahan.`,
  });
}
