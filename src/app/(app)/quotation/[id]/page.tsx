import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/Table";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDate, formatDateTime, formatNumber, formatPercent, formatRupiah } from "@/lib/format";
import { requireModule } from "@/lib/require-session";
import { Select } from "@/components/ui/FormField";
import {
  convertQuotationToSalesOrderAction,
  updateQuotationStatusAction,
} from "../actions";
import { PrintActions } from "./PrintActions";

function InfoItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-gray-900">{value || "-"}</p>
    </div>
  );
}

export default async function QuotationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireModule("quotation");
  const { id } = await params;

  const quotation = await prisma.quotation.findFirst({
    where: { id, isDeleted: false },
    include: {
      customer: true,
      product: { include: { defaultMaterial: true } },
      sales: true,
      salesOrder: true,
    },
  });
  if (!quotation) notFound();

  const [logs, customers] = await Promise.all([
    prisma.auditTrail.findMany({
      where: { referenceCode: quotation.code, module: "quotations" },
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.customer.findMany({
      where: { isDeleted: false, isActive: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const hpp = Number(quotation.hppAmount);
  const hargaJual = Number(quotation.totalAmount);
  const grossProfit = hargaJual - hpp;
  const grossMargin = hargaJual > 0 ? (grossProfit / hargaJual) * 100 : 0;
  const productName = quotation.product?.name ?? quotation.productNote ?? "-";
  const fromHpp = logs.some((log) => {
    const value = log.newValue as { fromHppCalculator?: boolean } | null;
    return Boolean(value?.fromHppCalculator);
  });

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
            Quotation · {quotation.customer?.name ?? "Belum ada customer"}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">{quotation.code}</h1>
            <StatusBadge status={quotation.status} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {quotation.status === "DRAFT" ? (
            <form action={updateQuotationStatusAction}>
              <input type="hidden" name="quotationId" value={quotation.id} />
              <input type="hidden" name="status" value="SENT" />
              <button className="rounded-md border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50">
                → Sent
              </button>
            </form>
          ) : null}
          {quotation.status === "SENT" ? (
            <>
              <form action={updateQuotationStatusAction}>
                <input type="hidden" name="quotationId" value={quotation.id} />
                <input type="hidden" name="status" value="ACCEPTED" />
                <button className="rounded-md border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50">
                  → Accepted
                </button>
              </form>
              <form action={updateQuotationStatusAction}>
                <input type="hidden" name="quotationId" value={quotation.id} />
                <input type="hidden" name="status" value="REJECTED" />
                <button className="rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50">
                  → Rejected
                </button>
              </form>
            </>
          ) : null}
          {quotation.status === "ACCEPTED" && !quotation.salesOrder ? (
            <form action={convertQuotationToSalesOrderAction} className="flex items-center gap-2">
              <input type="hidden" name="quotationId" value={quotation.id} />
              {!quotation.customerId ? (
                <Select name="customerId" required defaultValue="" className="h-9 w-52">
                  <option value="" disabled>
                    - pilih customer -
                  </option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              ) : null}
              <button className="rounded-md border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50">
                Buat SO
              </button>
            </form>
          ) : null}
          <PrintActions />
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total HPP" value={formatRupiah(hpp)} />
        <StatCard label="Harga Jual" value={formatRupiah(hargaJual)} />
        <StatCard label="Gross Profit" value={formatRupiah(grossProfit)} valueColor="green" />
        <StatCard label="Gross Margin" value={formatPercent(grossMargin)} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Detail Quotation</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-3">
              <InfoItem
                label="Customer"
                value={quotation.customer ? `${quotation.customer.name} (${quotation.customer.code})` : "-"}
              />
              <InfoItem label="Berlaku Sampai" value="-" />
              <InfoItem label="Produk" value={productName} />
              <InfoItem label="Material" value={quotation.product?.defaultMaterial?.name ?? "-"} />
              <InfoItem label="Spesifikasi" value={quotation.product?.specification ?? quotation.product?.category ?? "-"} />
              <InfoItem label="Tanggal" value={formatDate(quotation.date)} />
              <InfoItem label="Sales" value={quotation.sales?.name ?? "-"} />
              <InfoItem label="Quantity" value={`${formatNumber(quotation.qty)} pcs`} />
              <InfoItem
                label="Catatan"
                value={fromHpp ? "Dibuat dari Kalkulator HPP" : quotation.productNote ?? "-"}
              />
            </div>
          </Card>

          <Card className="p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Rincian Biaya (HPP)</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-3">
              <InfoItem label="HPP" value={formatRupiah(hpp)} />
              <InfoItem label="Margin Markup" value={formatPercent(Number(quotation.marginPercent))} />
              <InfoItem label="Harga Jual" value={formatRupiah(hargaJual)} />
            </div>
          </Card>
        </div>

        <Card className="p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Timeline</p>
          {logs.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">Belum ada aktivitas</p>
          ) : (
            <ol className="space-y-3">
              {logs.map((log) => {
                const oldValue = log.oldValue as { status?: string } | null;
                const newValue = log.newValue as { status?: string } | null;
                const title =
                  log.action === "STATUS_CHANGE" && oldValue?.status && newValue?.status
                    ? `Status: ${oldValue.status} → ${newValue.status}`
                    : log.action === "CREATE"
                      ? `Quotation dibuat${quotation.customer ? ` untuk ${quotation.customer.name}` : ""} · ${productName}`
                      : log.action.replaceAll("_", " ");
                return (
                  <li key={log.id} className="border-l-2 border-blue-200 pl-3">
                    <p className="text-[11px] text-gray-400">{formatDateTime(log.createdAt)}</p>
                    <p className="text-sm font-medium text-gray-800">{title}</p>
                    <p className="text-xs text-gray-400">{log.user?.name ?? "System"}</p>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>
      </div>
    </div>
  );
}
