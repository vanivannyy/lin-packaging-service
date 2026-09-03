"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { generateCode } from "@/lib/codegen";
import { logAudit } from "@/lib/audit";
import { notifyStatusChange } from "@/lib/notify";
import { requireModule } from "@/lib/require-session";
import type { SalesOrderStatus } from "@prisma/client";

export async function updateSalesOrderStatusAction(formData: FormData) {
  const session = await requireModule("sales-order");
  const salesOrderId = formData.get("salesOrderId") as string;
  const status = formData.get("status") as SalesOrderStatus;

  const salesOrder = await prisma.salesOrder.findUniqueOrThrow({ where: { id: salesOrderId } });

  await prisma.salesOrder.update({
    where: { id: salesOrderId },
    data: {
      status,
      deliveredAt: status === "DELIVERED" ? new Date() : salesOrder.deliveredAt,
    },
  });

  if (status === "DELIVERED") {
    const existingInvoice = await prisma.invoice.findUnique({ where: { salesOrderId } });
    if (!existingInvoice) {
      const invoiceCode = await generateCode("invoice");
      await prisma.invoice.create({
        data: {
          code: invoiceCode,
          salesOrderId,
          customerId: salesOrder.customerId,
          totalAmount: salesOrder.totalAmount,
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          status: "UNPAID",
        },
      });
      revalidatePath("/invoice");
    }
  }

  await logAudit({
    userId: session.userId,
    module: "sales-order",
    action: "STATUS_CHANGE",
    referenceCode: salesOrder.code,
    oldValue: { status: salesOrder.status },
    newValue: { status },
  });

  if (status === "PRODUCTION") {
    await notifyStatusChange({
      excludeUserId: session.userId,
      moduleKeys: ["produksi"],
      module: "sales-order",
      type: "ACTION",
      href: "/produksi",
      referenceCode: salesOrder.code,
      title: "Sales Order masuk produksi",
      message: `${session.name} memulai produksi ${salesOrder.code}. Silakan proses work order.`,
    });
  } else if (status === "READY_DELIVERY") {
    await notifyStatusChange({
      excludeUserId: session.userId,
      moduleKeys: ["sales-order"],
      module: "sales-order",
      type: "ACTION",
      href: "/sales-order",
      referenceCode: salesOrder.code,
      title: "Sales Order siap dikirim",
      message: `${session.name} menandai ${salesOrder.code} siap kirim. Silakan proses pengiriman.`,
    });
  } else if (status === "DELIVERED") {
    await notifyStatusChange({
      excludeUserId: session.userId,
      moduleKeys: ["invoice"],
      module: "sales-order",
      type: "STATUS",
      href: "/invoice",
      referenceCode: salesOrder.code,
      title: "Barang terkirim — invoice baru",
      message: `${session.name} mengirim ${salesOrder.code}. Invoice menunggu pembayaran.`,
    });
  } else if (status === "CANCELLED") {
    await notifyStatusChange({
      excludeUserId: session.userId,
      moduleKeys: ["sales-order", "produksi"],
      module: "sales-order",
      type: "STATUS",
      href: "/sales-order",
      referenceCode: salesOrder.code,
      title: "Sales Order dibatalkan",
      message: `${session.name} membatalkan ${salesOrder.code}.`,
    });
  }

  revalidatePath("/sales-order");
  revalidatePath("/produksi");
}
