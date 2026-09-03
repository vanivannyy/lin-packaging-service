import { prisma } from "@/lib/prisma";
import { formatRupiah, formatPercent, formatDate } from "@/lib/format";
import { getReportByCustomer, getReportByProduct, getReportBySales } from "@/server/laporan";
import { PrintButton } from "@/app/invoice/[id]/PrintButton";
import { requireModule } from "@/lib/require-session";

export default async function LaporanPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  await requireModule("laporan");
  const { view } = await searchParams;
  const activeView = view === "produk" || view === "sales" ? view : "customer";
  const [rows, settings] = await Promise.all([
    activeView === "produk" ? getReportByProduct() : activeView === "sales" ? getReportBySales() : getReportByCustomer(),
    prisma.companySettings.findFirst(),
  ]);

  const viewLabel = activeView === "produk" ? "Per Produk" : activeView === "sales" ? "Per Sales" : "Per Customer";

  return (
    <div className="mx-auto max-w-3xl bg-white p-10 text-sm text-gray-800">
      <div className="mb-6">
        <p className="text-lg font-bold">{settings?.companyName ?? "PT Lin Packaging Jakarta"}</p>
        <p className="text-xs text-gray-500">Laporan Manajemen - {viewLabel}</p>
        <p className="text-xs text-gray-400">Dicetak {formatDate(new Date())}</p>
      </div>

      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-300 text-[11px] uppercase text-gray-500">
            <th className="py-2">Nama</th>
            <th className="py-2 text-right">Order</th>
            <th className="py-2 text-right">Revenue</th>
            <th className="py-2 text-right">Gross Profit</th>
            <th className="py-2 text-right">Margin</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name} className="border-b border-gray-100">
              <td className="py-2">{r.name}</td>
              <td className="py-2 text-right">{r.orderCount}</td>
              <td className="py-2 text-right">{formatRupiah(r.revenue)}</td>
              <td className="py-2 text-right">{formatRupiah(r.grossProfit)}</td>
              <td className="py-2 text-right">{formatPercent(r.margin)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-8 print:hidden">
        <PrintButton />
      </div>
    </div>
  );
}
