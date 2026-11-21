"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { notifyStatusChange } from "@/lib/notify";
import { requireModule } from "@/lib/require-session";
import { recordInvoicePayment } from "@/lib/payment";

const paymentSchema = z.object({
  invoiceId: z.string(),
  amount: z.coerce.number().positive(),
  method: z.enum(["CASH", "TRANSFER", "QRIS", "CARD"]),
  reference: z.string().optional(),
});

export async function recordPaymentAction(formData: FormData) {
  const session = await requireModule("invoice");
  const parsed = paymentSchema.parse({
    invoiceId: formData.get("invoiceId"),
    amount: formData.get("amount"),
    method: formData.get("method"),
    reference: formData.get("reference") || undefined,
  });

  const { invoice, newPaidAmount, newStatus } = await recordInvoicePayment(parsed);

  await logAudit({
    userId: session.userId,
    module: "finance",
    action: "STATUS_CHANGE",
    referenceCode: invoice.code,
    oldValue: { paidAmount: invoice.paidAmount.toString(), status: invoice.status },
    newValue: { paidAmount: newPaidAmount, status: newStatus },
  });
  await notifyStatusChange({
    excludeUserId: session.userId,
    moduleKeys: newStatus === "PAID" ? ["invoice", "sales-order"] : ["invoice"],
    module: "invoice",
    type: "STATUS",
    href: "/invoice",
    referenceCode: invoice.code,
    title: newStatus === "PAID" ? "Invoice lunas" : "Pembayaran invoice diterima",
    message:
      newStatus === "PAID"
        ? `${session.name} menandai ${invoice.code} lunas.`
        : `${session.name} mencatat pembayaran ${invoice.code}. Status sekarang ${newStatus}.`,
  });
  revalidatePath("/invoice");
}

const dueDateSchema = z.object({
  invoiceId: z.string().min(1),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal jatuh tempo tidak valid"),
});

// Jatuh tempo default mengikuti CustomerTerm, tetapi boleh disesuaikan (tercatat di audit old/new).
export async function updateInvoiceDueDateAction(formData: FormData) {
  const session = await requireModule("invoice");
  const parsed = dueDateSchema.parse({
    invoiceId: formData.get("invoiceId"),
    dueDate: formData.get("dueDate"),
  });

  const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: parsed.invoiceId } });
  if (invoice.isDeleted || invoice.status === "PAID") return;

  const dueDate = new Date(`${parsed.dueDate}T00:00:00`);
  await prisma.invoice.update({ where: { id: invoice.id }, data: { dueDate } });

  await logAudit({
    userId: session.userId,
    module: "finance",
    action: "UPDATE",
    referenceCode: invoice.code,
    oldValue: { dueDate: invoice.dueDate?.toISOString() ?? null },
    newValue: { dueDate: dueDate.toISOString() },
  });
  revalidatePath("/invoice");
}
