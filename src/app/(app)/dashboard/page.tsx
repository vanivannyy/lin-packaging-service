import { AlertTriangle, Folder, TrendingUp, Users2, CheckCircle2 } from "lucide-react";
import { getDashboardData } from "@/server/dashboard";
import { formatRupiahCompact, formatPercent, formatNumber } from "@/lib/format";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Table";
import { RevenueTrendChart } from "@/components/dashboard/RevenueTrendChart";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/require-session";

const ALERT_BADGE: Record<string, { label: string; className: string }> = {
  LOW_STOCK: { label: "LOW STOCK", className: "border-amber-200 bg-amber-50 text-amber-700" },
  OVERDUE: { label: "OVERDUE", className: "border-red-200 bg-red-50 text-red-700" },
  DELAY: { label: "DELAY", className: "border-amber-200 bg-amber-50 text-amber-700" },
  PRODUCTION_ISSUE: { label: "PRODUCTION ISSUE", className: "border-red-200 bg-red-50 text-red-700" },
};

const STAGE_LABEL: Record<string, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  MEETING: "Meeting",
  QUOTATION: "Quotation",
  NEGOTIATION: "Negotiation",
  WON: "Won",
  LOST: "Lost",
};

export default async function DashboardPage() {
  await requireModule("dashboard");
  const data = await getDashboardData();
  const settings = await prisma.companySettings.findFirst();

  return (
    <div>
      <div className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
          {settings?.companyName ?? "PT Lin Packaging Jakarta"}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">Management Dashboard</h1>
          {data.prPending > 0 ? (
            <span className="flex items-center gap-1.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">
              <AlertTriangle size={14} />
              {data.prPending} Menunggu Approval
            </span>
          ) : null}
        </div>
      </div>

      <SectionLabel text="Keuangan" />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Revenue Bulan Ini" value={formatRupiahCompact(data.revenueThisMonth)} />
        <StatCard label="Revenue Tahun Ini" value={formatRupiahCompact(data.revenueThisYear)} />
        <StatCard label="Gross Profit" value={formatRupiahCompact(data.grossProfit)} valueColor="green" />
        <StatCard label="Gross Margin" value={formatPercent(data.grossMargin)} />
        <StatCard
          label="Piutang Outstanding"
          value={formatRupiahCompact(data.receivableOutstanding)}
          valueColor="red"
          sublabel={`Jatuh tempo ${formatRupiahCompact(data.receivableOverdue)}`}
        />
      </div>

      <SectionLabel text="Produksi & Purchasing" />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Work Order" value={formatNumber(data.workOrderTotal)} icon={Folder} sublabel={`${data.workOrderInProduction} sedang produksi`} />
        <StatCard label="WO Terlambat" value={formatNumber(data.workOrderLate)} valueColor="red" />
        <StatCard label="Rata-rata Reject" value={formatPercent(data.avgRejectRate)} />
        <StatCard label="PR Menunggu Approval" value={formatNumber(data.prPending)} valueColor="amber" />
      </div>

      <SectionLabel text="Penjualan & Produksi" />
      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Lead Baru" value={formatNumber(data.leadsNewCount)} icon={Users2} sublabel={`${formatNumber(data.leadsTotalValue > 0 ? 1 : 0)} total lead`} />
        <StatCard
          label="Quotation Aktif"
          value={formatNumber(data.quotationActiveCount)}
          sublabel={formatRupiahCompact(data.quotationActiveValue)}
        />
        <StatCard
          label="Conversion Rate"
          value={formatPercent(data.conversionRate)}
          sublabel={`${data.quotationWon} won / ${data.quotationLost} lost`}
        />
        <StatCard label="Order dalam Produksi" value={formatNumber(data.salesOrderInProductionCount)} icon={Folder} />
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Siap Kirim" value={formatNumber(data.salesOrderReadyCount)} icon={CheckCircle2} />
        <StatCard label="Order Selesai" value={formatNumber(data.salesOrderDeliveredThisMonth)} valueColor="green" />
        <StatCard label="Nilai Stok" value={formatRupiahCompact(data.stockValue)} icon={TrendingUp} />
        <StatCard label="Stok di Bawah Minimum" value={formatNumber(data.belowMinStock)} valueColor="red" />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Tren Revenue &amp; Profit</p>
          <RevenueTrendChart data={data.monthlyTrend} />
        </Card>

        <Card className="p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Pipeline CRM</p>
          <div className="space-y-2.5">
            {data.pipeline.length === 0 ? (
              <p className="py-8 text-center text-sm text-gray-400">Belum ada data pipeline</p>
            ) : (
              data.pipeline.map((p) => {
                const max = Math.max(...data.pipeline.map((x) => x._count._all), 1);
                const width = (p._count._all / max) * 100;
                return (
                  <div key={p.stage} className="flex items-center gap-3">
                    <span className="w-24 shrink-0 text-xs font-medium text-gray-600">{STAGE_LABEL[p.stage] ?? p.stage}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                      <div className="h-full rounded-full bg-blue-500" style={{ width: `${width}%` }} />
                    </div>
                    <span className="w-8 shrink-0 text-right text-xs font-semibold text-gray-700">{p._count._all}</span>
                    <span className="w-20 shrink-0 text-right text-xs text-gray-400">
                      {formatRupiahCompact(Number(p._sum.estimatedValue ?? 0))}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Customer Paling Profitable</p>
          {data.topProfitableCustomers.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">Belum ada data penjualan tahun ini</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                    <th className="pb-2">Customer</th>
                    <th className="pb-2 text-right">Revenue</th>
                    <th className="pb-2 text-right">Profit</th>
                    <th className="pb-2 text-right">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topProfitableCustomers.map((c) => (
                    <tr key={c.name} className="border-t border-gray-100">
                      <td className="py-2 pr-2 font-medium text-gray-900">{c.name}</td>
                      <td className="py-2 text-right text-gray-700">{formatRupiahCompact(c.revenue)}</td>
                      <td className="py-2 text-right font-semibold text-emerald-600">{formatRupiahCompact(c.profit)}</td>
                      <td className="py-2 text-right text-gray-500">{formatPercent(c.margin, 1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Business Alerts</p>
          {data.businessAlerts.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-400">Tidak ada alert saat ini</p>
          ) : (
            <div className="max-h-[360px] space-y-2.5 overflow-y-auto pr-1">
              {data.businessAlerts.map((alert, idx) => {
                const badge = ALERT_BADGE[alert.type];
                return (
                  <div key={idx} className="flex items-start gap-2.5">
                    <span className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-bold ${badge.className}`}>
                      {badge.label}
                    </span>
                    <p className="text-sm text-gray-700">{alert.text}</p>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function SectionLabel({ text }: { text: string }) {
  return <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-gray-400">{text}</p>;
}
