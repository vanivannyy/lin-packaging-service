import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { autoCreatePurchaseRequestIfNeeded } from "@/lib/purchase-auto";

interface AdjustStockParams {
  materialId: string;
  quantity: number;
  note?: string;
  userId: string;
}

export async function adjustMaterialStock({ materialId, quantity, note, userId }: AdjustStockParams) {
  const material = await prisma.material.findUniqueOrThrow({ where: { id: materialId } });

  await prisma.$transaction([
    prisma.material.update({
      where: { id: materialId },
      data: { stockQty: { increment: quantity } },
    }),
    prisma.stockMovement.create({
      data: {
        materialId,
        quantity,
        type: "ADJUSTMENT",
        note: note ?? "Penyesuaian stok manual",
      },
    }),
  ]);

  await logAudit({
    userId,
    module: "material",
    action: "UPDATE",
    referenceCode: material.sku,
    oldValue: { stockQty: material.stockQty.toString() },
    newValue: { adjustment: quantity },
  });

  await autoCreatePurchaseRequestIfNeeded(materialId);

  return prisma.material.findUniqueOrThrow({
    where: { id: materialId },
    include: { supplier: true },
  });
}
