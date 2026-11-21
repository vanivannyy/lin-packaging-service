import { prisma } from "@/lib/prisma";

export type PaymentMethod = "CASH" | "TRANSFER" | "QRIS" | "CARD";

/**
 * Catat pembayaran invoice dalam satu transaksi dengan optimistic lock pada paidAmount:
 * dua pembayaran bersamaan tidak saling menimpa, dan pembayaran melebihi sisa tagihan ditolak.
 */
export async function recordInvoicePayment(params: {
  invoiceId: string;
  amount: number;
  method: PaymentMethod;
  reference?: string;
}) {
  return prisma.$transaction(async (tx) => {
    const inv = await tx.invoice.findUniqueOrThrow({ where: { id: params.invoiceId } });
    if (inv.isDeleted) throw new Error("Invoice tidak ditemukan.");
    const total = Number(inv.totalAmount);
    const remaining = Math.round((total - Number(inv.paidAmount)) * 100) / 100;
    if (remaining <= 0) throw new Error("Invoice sudah lunas.");
    if (params.amount > remaining + 0.005) {
      throw new Error(`Jumlah bayar melebihi sisa tagihan (${remaining}).`);
    }

    const paid = Math.round((Number(inv.paidAmount) + params.amount) * 100) / 100;
    const status = paid >= total ? "PAID" : "PARTIAL";
    const updated = await tx.invoice.updateMany({
      where: { id: inv.id, paidAmount: inv.paidAmount },
      data: { paidAmount: paid, status },
    });
    if (updated.count === 0) {
      throw new Error("Invoice baru saja diperbarui oleh pengguna lain. Muat ulang halaman lalu coba lagi.");
    }
    await tx.payment.create({
      data: {
        invoiceId: inv.id,
        amount: params.amount,
        method: params.method,
        reference: params.reference,
      },
    });
    return { invoice: inv, newPaidAmount: paid, newStatus: status as "PAID" | "PARTIAL" };
  });
}
