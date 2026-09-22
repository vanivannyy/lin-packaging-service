import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Card, Table, Thead, Th, Tbody, Tr, Td, EmptyRow } from "@/components/ui/Table";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDate, formatDateTime, formatNumber, formatPercent, formatRupiah } from "@/lib/format";
import { STOCK_MOVEMENT_SOURCE_LABEL, STOCK_MOVEMENT_TYPE_LABEL, stockMovementSourceLabel } from "@/lib/labels";
import { requireModule } from "@/lib/require-session";
import type { SalesOrderStatus } from "@prisma/client";
import { updateSalesOrderStatusAction } from "../actions";

const NEXT_STATUS: Partial<Record<SalesOrderStatus, { to: SalesOrderStatus; label: string }>> = {
  MATERIAL_CHECK: { to: "PRODUCTION", label: "Mulai Produksi" },
  PRODUCTION: { to: "READY_DELIVERY", label: "Siap Kirim" },
  READY_DELIVERY: { to: "DELIVERED", label: "Kirim" },
};

function InfoItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-gray-900">{value || "-"}</p>
    </div>
  );
}

function signedQty(qty: number) {
  const formatted = formatNumber(qty);
  return qty > 0 ? `+${formatted}` : formatted;
}

export default async function SalesOrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireModule("sales-order");
  const { id } = await params;

  const salesOrder = await prisma.salesOrder.findFirst({
    where: { id, isDeleted: false },
    include: {
      customer: true,
      product: true,
      quotation: true,
      workOrder: true,
      deliveryOrder: true,
      invoice: true,
    },
  });
  if (!salesOrder) notFound();

  const refCodes = [salesOrder.code, salesOrder.workOrder?.code, salesOrder.deliveryOrder?.code].filter(
    (code): code is string => Boolean(code),
  );

  const [logs, stockLogs] = await Promise.all([
    prisma.auditTrail.findMany({
      where: {
        OR: refCodes.map((code) => ({ referenceCode: { equals: code, mode: "insensitive" as const } })),
      },
      include: { user: true },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.stockMovement.findMany({
      where: {
        OR: refCodes.map((code) => ({ referenceCode: { equals: code, mode: "insensitive" as const } })),
      },
      include: { material: true, user: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const productName = salesOrder.product?.name ?? salesOrder.productNote ?? "-";
  const action = NEXT_STATUS[salesOrder.status];

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
            Sales Order · {salesOrder.customer.name}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">{salesOrder.code}</h1>
            <StatusBadge status={salesOrder.status} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {action ? (
            <form action={updateSalesOrderStatusAction}>
              <input type="hidden" name="salesOrderId" value={salesOrder.id} />
              <input type="hidden" name="status" value={action.to} />
              <button className="rounded-md border border-blue-200 px-3 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50">
                {action.label}
              </button>
            </form>
          ) : null}
          <Link
            href="/sales-order"
            className="rounded-md border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            Kembali
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Detail Sales Order</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-3">
              <InfoItem label="No SO" value={salesOrder.code} />
              <InfoItem
                label="Quotation"
                value={
                  salesOrder.quotation ? (
                    <Link href={`/quotation/${salesOrder.quotation.id}`} className="text-blue-600 hover:underline">
                      {salesOrder.quotation.code}
                    </Link>
                  ) : (
                    "-"
                  )
                }
              />
              <InfoItem label="Tanggal" value={formatDate(salesOrder.date)} />
              <InfoItem label="Customer" value={`${salesOrder.customer.name} (${salesOrder.customer.code})`} />
              <InfoItem label="Produk" value={productName} />
              <InfoItem label="Qty" value={`${formatNumber(salesOrder.qty)} pcs`} />
              <InfoItem label="Nilai" value={formatRupiah(Number(salesOrder.totalAmount))} />
              <InfoItem label="Margin" value={formatPercent(Number(salesOrder.marginPercent))} />
              <InfoItem
                label="Kirim Diminta"
                value={salesOrder.requestedDeliveryDate ? formatDate(salesOrder.requestedDeliveryDate, false) : "-"}
              />
              <InfoItem
                label="Dikirim"
                value={salesOrder.deliveredAt ? formatDate(salesOrder.deliveredAt, false) : "-"}
              />
              <InfoItem label="Status" value={<StatusBadge status={salesOrder.status} />} />
              <InfoItem label="Catatan Produk" value={salesOrder.productNote ?? "-"} />
            </div>
          </Card>

          <Card className="p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Dokumen Terkait</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-3">
              <InfoItem label="Work Order" value={salesOrder.workOrder?.code ?? "-"} />
              <InfoItem
                label="Stage WO"
                value={salesOrder.workOrder ? salesOrder.workOrder.stage.replaceAll("_", " ") : "-"}
              />
              <InfoItem label="Delivery Order" value={salesOrder.deliveryOrder?.code ?? "-"} />
              <InfoItem
                label="Stage DO"
                value={salesOrder.deliveryOrder ? salesOrder.deliveryOrder.stage.replaceAll("_", " ") : "-"}
              />
              <InfoItem label="Invoice" value={salesOrder.invoice?.code ?? "-"} />
              <InfoItem
                label="Status Invoice"
                value={salesOrder.invoice ? <StatusBadge status={salesOrder.invoice.status} /> : "-"}
              />
            </div>
          </Card>

          <Card>
            <div className="border-b border-gray-100 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Log Material</p>
              <p className="mt-0.5 text-xs text-gray-400">
                Penambahan/pengurangan stok yang mereferensikan SO, WO, atau DO ini (web &amp; aplikasi).
              </p>
            </div>
            <Table>
              <Thead>
                <tr>
                  <Th>Waktu</Th>
                  <Th>Material</Th>
                  <Th>Qty</Th>
                  <Th>Tipe</Th>
                  <Th>Sumber</Th>
                  <Th>User</Th>
                  <Th>Referensi</Th>
                  <Th>Catatan</Th>
                </tr>
              </Thead>
              <Tbody>
                {stockLogs.length === 0 ? (
                  <EmptyRow colSpan={8} message="Belum ada pergerakan stok untuk order ini" />
                ) : (
                  stockLogs.map((log) => {
                    const qty = Number(log.quantity);
                    return (
                      <Tr key={log.id}>
                        <Td className="text-gray-500">{formatDateTime(log.createdAt)}</Td>
                        <Td>
                          <Link href={`/material-stok/${log.material.id}`} className="font-medium text-blue-600 hover:underline">
                            {log.material.name}
                          </Link>
                          <p className="text-[11px] text-gray-400">{log.material.sku}</p>
                        </Td>
                        <Td className={qty < 0 ? "font-semibold text-red-600" : "font-semibold text-emerald-600"}>
                          {signedQty(qty)} {log.material.unit}
                        </Td>
                        <Td>{STOCK_MOVEMENT_TYPE_LABEL[log.type] ?? log.type}</Td>
                        <Td>{stockMovementSourceLabel(log.source, log.userId)}</Td>
                        <Td>{log.user?.name ?? "System"}</Td>
                        <Td className="text-blue-600">{log.referenceCode ?? "-"}</Td>
                        <Td className="max-w-[200px] truncate text-xs text-gray-500">{log.note ?? "-"}</Td>
                      </Tr>
                    );
                  })
                )}
              </Tbody>
            </Table>
          </Card>
        </div>

        <Card className="p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Timeline</p>
          {logs.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">Belum ada aktivitas</p>
          ) : (
            <ol className="space-y-3">
              {logs.map((log) => {
                const oldValue = log.oldValue as { status?: string; stockQty?: string; materialSku?: string } | null;
                const newValue = log.newValue as {
                  status?: string;
                  fromQuotation?: string;
                  adjustment?: number;
                  materialName?: string;
                  materialSku?: string;
                  source?: string;
                } | null;
                let title = log.action.replaceAll("_", " ");
                if (log.action === "STATUS_CHANGE" && oldValue?.status && newValue?.status) {
                  title = `Status: ${oldValue.status} → ${newValue.status}`;
                } else if (log.action === "CREATE") {
                  title = newValue?.fromQuotation
                    ? `Sales Order dibuat dari ${newValue.fromQuotation}`
                    : "Sales Order dibuat";
                } else if (log.module === "material" && typeof newValue?.adjustment === "number") {
                  const materialLabel = newValue.materialName ?? newValue.materialSku ?? "Material";
                  const sourceLabel = STOCK_MOVEMENT_SOURCE_LABEL[newValue.source ?? ""] ?? "";
                  title = `${materialLabel}: ${signedQty(newValue.adjustment)}${sourceLabel ? ` · ${sourceLabel}` : ""}`;
                }
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
