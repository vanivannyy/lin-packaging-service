import { prisma } from "@/lib/prisma";
import { generateCode } from "@/lib/codegen";
import { recordProductionIn } from "@/lib/client-stock";

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
  const deliveryOrder = await prisma.deliveryOrder.create({
    data: { code, salesOrderId, stage: "READY" },
  });

  // Sinkron ke app mobile klien: barang jadi sudah masuk gudang Lin Packaging,
  // siap dikirim. Dibungkus try/catch supaya kegagalan sinkron stok klien
  // (fitur sekunder) tidak sampai menggagalkan proses produksi utama.
  try {
    await recordProductionIn(salesOrderId, deliveryOrder.code);
  } catch (error) {
    console.error("Gagal sinkron stok klien (production in):", error);
  }

  return deliveryOrder;
}
