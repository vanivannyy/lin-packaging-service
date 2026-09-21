import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { autoCreatePurchaseRequestIfNeeded } from "@/lib/purchase-auto";

interface AdjustStockParams {
  materialId: string;
  quantity: number;
  note?: string;
  userId: string;
  /** Nomor SO/WO/DO tujuan pemakaian/pengembalian material — supaya pengurangan
   *  stok bisa dilacak dipakai untuk order/produksi/pengiriman mana. */
  referenceCode?: string;
}

export async function adjustMaterialStock({
  materialId,
  quantity,
  note,
  userId,
  referenceCode,
}: AdjustStockParams) {
  const material = await prisma.material.findUniqueOrThrow({ where: { id: materialId } });
  const cleanReference = referenceCode?.trim().toUpperCase() || undefined;
  // Ada referensi + stok berkurang = dipakai produksi untuk SO/WO tertentu.
  // Ada referensi + stok bertambah = mis. retur dari SO/WO tertentu.
  // Tanpa referensi = penyesuaian stok manual biasa.
  const movementType = cleanReference ? (quantity < 0 ? "PRODUCTION_OUT" : "RETURN_IN") : "ADJUSTMENT";

  await prisma.$transaction([
    prisma.material.update({
      where: { id: materialId },
      data: { stockQty: { increment: quantity } },
    }),
    prisma.stockMovement.create({
      data: {
        materialId,
        quantity,
        type: movementType,
        referenceCode: cleanReference,
        note: note ?? "Penyesuaian stok manual",
      },
    }),
  ]);

  await logAudit({
    userId,
    module: "material",
    action: "UPDATE",
    referenceCode: cleanReference ?? material.sku,
    oldValue: { stockQty: material.stockQty.toString() },
    newValue: { adjustment: quantity, referenceCode: cleanReference ?? null },
  });

  await autoCreatePurchaseRequestIfNeeded(materialId);

  return prisma.material.findUniqueOrThrow({
    where: { id: materialId },
    include: { supplier: true },
  });
}
