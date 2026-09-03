"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { notifyStatusChange } from "@/lib/notify";
import { requireModule } from "@/lib/require-session";

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

  const invoice = await prisma.invoice.findUniqueOrThrow({ where: { id: parsed.invoiceId } });
  const newPaidAmount = Number(invoice.paidAmount) + parsed.amount;
  const newStatus = newPaidAmount >= Number(invoice.totalAmount) ? "PAID" : "PARTIAL";

  await prisma.$transaction([
    prisma.payment.create({
      data: {
        invoiceId: parsed.invoiceId,
        amount: parsed.amount,
        method: parsed.method,
        reference: parsed.reference,
      },
    }),
    prisma.invoice.update({
      where: { id: parsed.invoiceId },
      data: { paidAmount: newPaidAmount, status: newStatus },
    }),
  ]);

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
