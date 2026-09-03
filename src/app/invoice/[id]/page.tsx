import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatRupiah, formatDate } from "@/lib/format";
import { PrintButton } from "./PrintButton";
import { requireModule } from "@/lib/require-session";

export default async function InvoicePdfPage({ params }: { params: Promise<{ id: string }> }) {
  await requireModule("invoice");
  const { id } = await params;
  const [invoice, settings] = await Promise.all([
    prisma.invoice.findUnique({
      where: { id },
      include: { customer: true, salesOrder: { include: { product: true } }, payments: true },
    }),
    prisma.companySettings.findFirst(),
  ]);

  if (!invoice) notFound();

  const remaining = Number(invoice.totalAmount) - Number(invoice.paidAmount);

  return (
    <div className="mx-auto max-w-2xl bg-white p-10 text-sm text-gray-800 print:p-0">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <p className="text-lg font-bold">{settings?.companyName ?? "PT Lin Packaging Jakarta"}</p>
          <p className="max-w-xs text-xs text-gray-500">{settings?.address}</p>
          <p className="text-xs text-gray-500">{settings?.phone} · {settings?.email}</p>
        </div>
        <div className="text-right">
          <p className="text-xl font-bold uppercase text-gray-900">Invoice</p>
          <p className="text-sm text-blue-600">{invoice.code}</p>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-gray-400">Ditagihkan Kepada</p>
          <p className="font-semibold">{invoice.customer.name}</p>
          <p className="text-xs text-gray-500">{invoice.customer.address ?? ""}</p>
          {invoice.customer.npwp ? <p className="text-xs text-gray-500">NPWP: {invoice.customer.npwp}</p> : null}
        </div>
        <div className="text-right">
          <p>
            <span className="text-[11px] uppercase tracking-wide text-gray-400">Tanggal Terbit: </span>
            {formatDate(invoice.issuedAt)}
          </p>
          <p>
            <span className="text-[11px] uppercase tracking-wide text-gray-400">Jatuh Tempo: </span>
            {invoice.dueDate ? formatDate(invoice.dueDate) : "-"}
          </p>
          <p>
            <span className="text-[11px] uppercase tracking-wide text-gray-400">No. SO: </span>
            {invoice.salesOrder.code}
          </p>
        </div>
      </div>

      <table className="mb-6 w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-[11px] uppercase text-gray-400">
            <th className="py-2">Deskripsi</th>
            <th className="py-2 text-right">Qty</th>
            <th className="py-2 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-gray-100">
            <td className="py-2">{invoice.salesOrder.product?.name ?? invoice.salesOrder.productNote ?? "Produk"}</td>
            <td className="py-2 text-right">{invoice.salesOrder.qty.toLocaleString("id-ID")}</td>
            <td className="py-2 text-right">{formatRupiah(Number(invoice.totalAmount))}</td>
          </tr>
        </tbody>
      </table>

      <div className="ml-auto w-56 space-y-1 text-right">
        <div className="flex justify-between">
          <span className="text-gray-500">Total</span>
          <span className="font-semibold">{formatRupiah(Number(invoice.totalAmount))}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Dibayar</span>
          <span className="text-emerald-600">{formatRupiah(Number(invoice.paidAmount))}</span>
        </div>
        <div className="flex justify-between border-t border-gray-200 pt-1 font-bold">
          <span>Sisa</span>
          <span>{formatRupiah(remaining)}</span>
        </div>
      </div>

      {settings?.bankName ? (
        <div className="mt-8 rounded-md bg-gray-50 p-3 text-xs">
          <p className="font-semibold text-gray-600">Pembayaran transfer ke:</p>
          <p>
            {settings.bankName} - {settings.bankAccountNo} a.n {settings.bankAccountName}
          </p>
        </div>
      ) : null}

      <div className="mt-8 print:hidden">
        <PrintButton />
      </div>
    </div>
  );
}
