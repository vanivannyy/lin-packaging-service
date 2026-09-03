import { prisma } from "@/lib/prisma";
import { generateCode } from "@/lib/codegen";

// Dipanggil saat Work Order selesai packing (papan produksi) - otomatis siapkan
// Sales Order untuk pengiriman & buat kartu di papan Delivery (stage READY).
export async function ensureDeliveryOrderForSalesOrder(salesOrderId: string) {
  const existing = await prisma.deliveryOrder.findUnique({ where: { salesOrderId } });
  if (existing) return existing;

  const salesOrder = await prisma.salesOrder.findUniqueOrThrow({ where: { id: salesOrderId } });
  if (salesOrder.status === "MATERIAL_CHECK" || salesOrder.status === "PRODUCTION") {
    await prisma.salesOrder.update({ where: { id: salesOrderId }, data: { status: "READY_DELIVERY" } });
  }

  const code = await generateCode("deliveryOrder");
  return prisma.deliveryOrder.create({
    data: { code, salesOrderId, stage: "READY" },
  });
}
