"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { formId } from "@/lib/form";
import { ensureInvoiceForSalesOrder } from "@/lib/invoice";
import { logAudit } from "@/lib/audit";
import { notifyStatusChange } from "@/lib/notify";
import { addBomLine, releaseBomForSalesOrder, removeBomLine } from "@/lib/material-reservation";
import { requireModule } from "@/lib/require-session";
import {
  SALES_ORDER_TRANSITIONS,
  canTransition,
  parseSalesOrderStatus,
} from "@/lib/status-transitions";

export async function updateSalesOrderStatusAction(formData: FormData) {
  const session = await requireModule("sales-order");
  const salesOrderId = formId(formData, "salesOrderId");
  const status = parseSalesOrderStatus(formData.get("status"));

  const salesOrder = await prisma.salesOrder.findUniqueOrThrow({ where: { id: salesOrderId } });
  if (salesOrder.isDeleted) return;
  if (salesOrder.status === status) return;
  if (!canTransition(SALES_ORDER_TRANSITIONS, salesOrder.status, status)) {
    throw new Error(`Status Sales Order tidak bisa diubah dari ${salesOrder.status} ke ${status}.`);
  }

  // Status SO + pembuatan Invoice (saat DELIVERED) atomik.
  await prisma.$transaction(async (tx) => {
    await tx.salesOrder.update({
      where: { id: salesOrderId },
      data: {
        status,
        deliveredAt: status === "DELIVERED" ? new Date() : salesOrder.deliveredAt,
      },
    });
    if (status === "DELIVERED") {
      await ensureInvoiceForSalesOrder(salesOrderId, tx);
    }
  });
  if (status === "DELIVERED") revalidatePath("/invoice");

  if (status === "CANCELLED") {
    await releaseBomForSalesOrder(salesOrderId, session.userId);
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

  revalidatePath("/sales-order", "layout");
  revalidatePath(`/sales-order/${salesOrderId}`);
  revalidatePath("/produksi");
}

// BOM manual: tambah/hapus kebutuhan material selama SO masih MATERIAL_CHECK.
export async function addSalesOrderMaterialAction(formData: FormData) {
  const session = await requireModule("sales-order");
  const salesOrderId = formId(formData, "salesOrderId");
  const materialId = formId(formData, "materialId");
  const qty = z.coerce
    .number({ message: "Qty tidak valid" })
    .positive("Qty harus lebih dari 0")
    .finite()
    .max(1_000_000_000)
    .parse(formData.get("qty"));

  const so = await prisma.salesOrder.findUniqueOrThrow({ where: { id: salesOrderId } });
  if (so.isDeleted || so.status !== "MATERIAL_CHECK") {
    throw new Error("Material hanya bisa diubah saat status Sales Order Material Check.");
  }
  await addBomLine({ salesOrderId, line: { materialId, qty, source: "MANUAL" }, userId: session.userId });
  revalidatePath(`/sales-order/${salesOrderId}`);
  revalidatePath("/material-stok", "layout");
  revalidatePath("/purchase-request");
}

export async function removeSalesOrderMaterialAction(formData: FormData) {
  const session = await requireModule("sales-order");
  const lineId = formId(formData, "lineId");
  if (!lineId) return;

  const line = await prisma.salesOrderMaterial.findUniqueOrThrow({
    where: { id: lineId },
    include: { salesOrder: true },
  });
  if (line.salesOrder.status !== "MATERIAL_CHECK") {
    throw new Error("Material hanya bisa diubah saat status Sales Order Material Check.");
  }
  await removeBomLine(lineId, session.userId);
  revalidatePath(`/sales-order/${line.salesOrderId}`);
  revalidatePath("/material-stok", "layout");
}
