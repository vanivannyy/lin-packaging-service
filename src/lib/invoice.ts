import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { generateCode } from "@/lib/codegen";

import { termToDays } from "@/lib/payment-terms";

/** Buat Invoice UNPAID untuk Sales Order bila belum ada (idempoten). Jatuh tempo default = tanggal terbit + term customer; bisa diubah di halaman Invoice. */
export async function ensureInvoiceForSalesOrder(salesOrderId: string, db: Prisma.TransactionClient | typeof prisma = prisma) {
  const existing = await db.invoice.findUnique({ where: { salesOrderId } });
  if (existing) return existing;

  const salesOrder = await db.salesOrder.findUniqueOrThrow({
    where: { id: salesOrderId },
    include: { customer: { select: { term: true } } },
  });
  const code = await generateCode("invoice");
  // createMany + skipDuplicates (INSERT ... ON CONFLICT DO NOTHING): aman untuk panggilan bersamaan
  // dan tidak membatalkan transaksi pemanggil bila invoice sudah dibuat proses lain.
  await db.invoice.createMany({
    data: [
      {
        code,
        salesOrderId,
        customerId: salesOrder.customerId,
        totalAmount: salesOrder.totalAmount,
        dueDate: new Date(Date.now() + termToDays(salesOrder.customer.term) * 24 * 60 * 60 * 1000),
        status: "UNPAID",
      },
    ],
    skipDuplicates: true,
  });
  return db.invoice.findUniqueOrThrow({ where: { salesOrderId } });
}
