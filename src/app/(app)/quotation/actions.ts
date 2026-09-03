"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { generateCode } from "@/lib/codegen";
import { logAudit } from "@/lib/audit";
import { notifyStatusChange } from "@/lib/notify";
import { requireModule } from "@/lib/require-session";
import type { QuotationStatus } from "@prisma/client";

const quotationSchema = z.object({
  customerId: z.string().min(1, "Customer wajib dipilih"),
  productId: z.string().optional(),
  productNote: z.string().optional(),
  qty: z.coerce.number().int().min(1),
  hppAmount: z.coerce.number().min(0),
  marginPercent: z.coerce.number().min(0).max(500),
});

export async function createQuotationAction(formData: FormData) {
  const session = await requireModule("quotation");
  const parsed = quotationSchema.parse({
    customerId: formData.get("customerId"),
    productId: formData.get("productId") || undefined,
    productNote: formData.get("productNote") || undefined,
    qty: formData.get("qty"),
    hppAmount: formData.get("hppAmount"),
    marginPercent: formData.get("marginPercent"),
  });

  const totalAmount = Math.round(parsed.hppAmount * (1 + parsed.marginPercent / 100));
  const quotationCode = await generateCode("quotation");

  const quotation = await prisma.quotation.create({
    data: { ...parsed, totalAmount, code: quotationCode, salesId: session.userId, status: "DRAFT" },
  });

  await logAudit({ userId: session.userId, module: "quotations", action: "CREATE", referenceCode: quotation.code, newValue: parsed });
  await notifyStatusChange({
    excludeUserId: session.userId,
    moduleKeys: ["quotation"],
    module: "quotation",
    type: "ACTION",
    href: `/quotation/${quotation.id}`,
    referenceCode: quotation.code,
    title: "Quotation baru menunggu dikirim",
    message: `${session.name} membuat ${quotation.code}. Silakan kirim ke customer.`,
  });
  revalidatePath("/quotation");
  revalidatePath(`/quotation/${quotation.id}`);
}

export async function updateQuotationStatusAction(formData: FormData) {
  const session = await requireModule("quotation");
  const quotationId = formData.get("quotationId") as string;
  const status = formData.get("status") as QuotationStatus;

  const quotation = await prisma.quotation.findUniqueOrThrow({ where: { id: quotationId } });
  await prisma.quotation.update({ where: { id: quotationId }, data: { status } });

  await logAudit({
    userId: session.userId,
    module: "quotations",
    action: "STATUS_CHANGE",
    referenceCode: quotation.code,
    oldValue: { status: quotation.status },
    newValue: { status },
  });

  if (status === "SENT") {
    await notifyStatusChange({
      excludeUserId: session.userId,
      moduleKeys: ["quotation"],
      extraUserIds: [quotation.salesId],
      module: "quotation",
      type: "APPROVAL",
      href: `/quotation/${quotation.id}`,
      referenceCode: quotation.code,
      title: "Quotation menunggu accept/reject",
      message: `${session.name} mengirim ${quotation.code}. Silakan accept atau reject.`,
    });
  } else if (status === "ACCEPTED") {
    await notifyStatusChange({
      excludeUserId: session.userId,
      moduleKeys: ["quotation"],
      extraUserIds: [quotation.salesId],
      module: "quotation",
      type: "STATUS",
      href: `/quotation/${quotation.id}`,
      referenceCode: quotation.code,
      title: "Quotation diterima",
      message: `${session.name} menerima ${quotation.code}. Silakan convert ke Sales Order.`,
    });
  } else if (status === "REJECTED") {
    await notifyStatusChange({
      excludeUserId: session.userId,
      moduleKeys: ["quotation"],
      extraUserIds: [quotation.salesId],
      module: "quotation",
      type: "STATUS",
      href: `/quotation/${quotation.id}`,
      referenceCode: quotation.code,
      title: "Quotation ditolak",
      message: `${session.name} menolak ${quotation.code}.`,
    });
  }

  revalidatePath("/quotation");
  revalidatePath(`/quotation/${quotationId}`);
}

export async function convertQuotationToSalesOrderAction(formData: FormData) {
  const session = await requireModule("quotation");
  const quotationId = formData.get("quotationId") as string;

  const quotation = await prisma.quotation.findUniqueOrThrow({ where: { id: quotationId } });
  if (quotation.status !== "ACCEPTED") return;

  const existing = await prisma.salesOrder.findUnique({ where: { quotationId } });
  if (existing) return;

  const customerId = String(formData.get("customerId") ?? "").trim() || quotation.customerId;
  if (!customerId) return;

  if (!quotation.customerId) {
    await prisma.quotation.update({ where: { id: quotationId }, data: { customerId } });
  }

  const soCode = await generateCode("salesOrder");
  const salesOrder = await prisma.salesOrder.create({
    data: {
      code: soCode,
      quotationId: quotation.id,
      customerId,
      productId: quotation.productId,
      productNote: quotation.productNote,
      qty: quotation.qty,
      totalAmount: quotation.totalAmount,
      marginPercent: quotation.marginPercent,
      requestedDeliveryDate: quotation.requestedDeliveryDate,
      status: "MATERIAL_CHECK",
    },
  });

  const woCode = await generateCode("workOrder");
  await prisma.workOrder.create({
    data: {
      code: woCode,
      salesOrderId: salesOrder.id,
      stage: "WAITING",
      process: "PREPRESS",
      deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  await logAudit({ userId: session.userId, module: "quotations", action: "CREATE", referenceCode: salesOrder.code, newValue: { fromQuotation: quotation.code } });
  await notifyStatusChange({
    excludeUserId: session.userId,
    moduleKeys: ["sales-order", "produksi", "material-stok"],
    extraUserIds: [quotation.salesId],
    module: "sales-order",
    type: "ACTION",
    href: "/sales-order",
    referenceCode: salesOrder.code,
    title: "Sales Order baru — cek material",
    message: `${session.name} membuat ${salesOrder.code} dari ${quotation.code}. Silakan cek material lalu mulai produksi.`,
  });
  revalidatePath("/quotation");
  revalidatePath(`/quotation/${quotation.id}`);
  revalidatePath("/sales-order");
  revalidatePath("/produksi");
}
