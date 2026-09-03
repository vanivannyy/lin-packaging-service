import { Download, FileText, Mail } from "lucide-react";
import Link from "next/link";
import clsx from "clsx";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Card, Table, Thead, Th, Tbody, Tr, Td, EmptyRow } from "@/components/ui/Table";
import { formatRupiah, formatRupiahCompact, formatPercent, formatDateTime, formatDate } from "@/lib/format";
import { getReportByCustomer, getReportByProduct, getReportBySales } from "@/server/laporan";
import { sendDailyRecapNowAction } from "./actions";
import { requireModule } from "@/lib/require-session";

type ViewKey = "customer" | "produk" | "sales";

export default async function LaporanPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  await requireModule("laporan");
  const { view } = await searchParams;
  const activeView: ViewKey = view === "produk" || view === "sales" ? view : "customer";

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const yesterday = new Date(startOfDay.getTime() - 24 * 60 * 60 * 1000);

  const [rows, ordersYesterday, inProgress, lateWorkOrders, overdueAgg, recapLogs] = await Promise.all([
    activeView === "customer" ? getReportByCustomer() : activeView === "produk" ? getReportByProduct() : getReportBySales(),
    prisma.salesOrder.aggregate({
      _count: { _all: true },
      _sum: { totalAmount: true },
      where: { isDeleted: false, createdAt: { gte: yesterday, lt: startOfDay } },
    }),
    prisma.workOrder.count({ where: { isDeleted: false, stage: { in: ["IN_PRODUCTION", "QC", "REWORK"] } } }),
    prisma.workOrder.count({ where: { isDeleted: false, stage: { not: "DONE" }, deadline: { lt: new Date() } } }),
    prisma.invoice.aggregate({
      _sum: { totalAmount: true, paidAmount: true },
      where: { isDeleted: false, status: "OVERDUE" },
    }),
    prisma.dailyRecapLog.findMany({ orderBy: { sentAt: "desc" }, take: 6 }),
  ]);

  const overdueOutstanding = Number(overdueAgg._sum.totalAmount ?? 0) - Number(overdueAgg._sum.paidAmount ?? 0);

  const tabs: { key: ViewKey; label: string }[] = [
    { key: "customer", label: "Per Customer" },
    { key: "produk", label: "Per Produk" },
    { key: "sales", label: "Per Sales" },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="Business Intelligence"
        title="Laporan Manajemen"
        actions={
          <>
            {tabs.map((tab) => (
              <Link
                key={tab.key}
                href={`/laporan?view=${tab.key}`}
                className={clsx(
                  "rounded-md px-3.5 py-2 text-sm font-semibold",
                  activeView === tab.key ? "bg-blue-600 text-white" : "border border-gray-200 text-gray-600 hover:bg-gray-50"
                )}
              >
                {tab.label}
              </Link>
            ))}
            <a
              href={`/api/export/laporan?view=${activeView}`}
              className="flex items-center gap-1.5 rounded-md border border-gray-200 px-3.5 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
            >
              <Download size={14} /> Excel
            </a>
            <a
              href={`/laporan/print?view=${activeView}`}
              target="_blank"
              className="flex items-center gap-1.5 rounded-md border border-gray-200 px-3.5 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
            >
              <FileText size={14} /> PDF
            </a>
          </>
        }
      />

      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">
          Rekap Harian Owner - Terkirim Otomatis 07:00 WIB
        </p>
        <form action={sendDailyRecapNowAction}>
          <button className="flex items-center gap-1.5 rounded-md bg-navy-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-navy-800">
            <Mail size={12} /> Kirim Rekap Sekarang
          </button>
        </form>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Order Baru (H-1)" value={ordersYesterday._count._all} sublabel={formatRupiah(Number(ordersYesterday._sum.totalAmount ?? 0))} />
        <StatCard label="Sedang Produksi / QC" value={inProgress} />
        <StatCard label="WO Terlambat" value={lateWorkOrders} valueColor="red" />
        <StatCard label="Piutang Jatuh Tempo" value={formatRupiahCompact(overdueOutstanding)} valueColor="red" />
      </div>

      <Card className="mb-5 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Riwayat Pengiriman Rekap</p>
        <Table>
          <Thead>
            <tr>
              <Th>Waktu</Th>
              <Th>Tanggal Rekap</Th>
              <Th>Penerima</Th>
              <Th>Status</Th>
            </tr>
          </Thead>
          <Tbody>
            {recapLogs.length === 0 ? (
              <EmptyRow colSpan={4} />
            ) : (
              recapLogs.map((log) => (
                <Tr key={log.id}>
                  <Td>{formatDateTime(log.sentAt)}</Td>
                  <Td>{formatDate(log.recapDate)}</Td>
                  <Td>{log.recipientEmail}</Td>
                  <Td>
                    <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                      {log.status}
                    </span>
                  </Td>
                </Tr>
              ))
            )}
          </Tbody>
        </Table>
      </Card>

      <Card>
        <p className="p-4 pb-0 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Penjualan &amp; Profitabilitas — {tabs.find((t) => t.key === activeView)?.label}
        </p>
        <Table>
          <Thead>
            <tr>
              <Th>Nama</Th>
              <Th>Jumlah Order</Th>
              <Th>Revenue</Th>
              <Th>Gross Profit</Th>
              <Th>Margin</Th>
            </tr>
          </Thead>
          <Tbody>
            {rows.length === 0 ? (
              <EmptyRow colSpan={5} />
            ) : (
              rows.map((r) => (
                <Tr key={r.name}>
                  <Td className="font-medium text-gray-900">{r.name}</Td>
                  <Td>{r.orderCount}</Td>
                  <Td className="font-semibold">{formatRupiah(r.revenue)}</Td>
                  <Td className="text-emerald-600">{formatRupiah(r.grossProfit)}</Td>
                  <Td>{formatPercent(r.margin)}</Td>
                </Tr>
              ))
            )}
          </Tbody>
        </Table>
      </Card>
    </div>
  );
}
