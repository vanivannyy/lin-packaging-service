import { Download } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, Table, Thead, Th, Tbody, Tr, Td, EmptyRow } from "@/components/ui/Table";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AutoSubmitSelect } from "@/components/ui/AutoSubmitSelect";
import { formatRupiah, formatDate, formatPercent } from "@/lib/format";
import type { SalesOrderStatus } from "@prisma/client";
import { updateSalesOrderStatusAction } from "./actions";
import { requireModule } from "@/lib/require-session";

const STATUS_OPTIONS: SalesOrderStatus[] = ["MATERIAL_CHECK", "PRODUCTION", "READY_DELIVERY", "DELIVERED", "CANCELLED"];
const NEXT_STATUS: Partial<Record<SalesOrderStatus, { to: SalesOrderStatus; label: string }>> = {
  MATERIAL_CHECK: { to: "PRODUCTION", label: "Mulai Produksi" },
  PRODUCTION: { to: "READY_DELIVERY", label: "Siap Kirim" },
  READY_DELIVERY: { to: "DELIVERED", label: "Kirim" },
};

export default async function SalesOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireModule("sales-order");
  const { status } = await searchParams;

  const salesOrders = await prisma.salesOrder.findMany({
    where: { isDeleted: false, ...(status ? { status: status as SalesOrderStatus } : {}) },
    include: { customer: true, product: true, quotation: true },
    orderBy: { code: "desc" },
  });

  return (
    <div>
      <PageHeader
        eyebrow="Operasional"
        title="Sales Order"
        actions={
          <>
            <form>
              <AutoSubmitSelect
                name="status"
                defaultValue={status}
                placeholder="Semua Status"
                options={STATUS_OPTIONS.map((s) => ({ value: s, label: s.replaceAll("_", " ") }))}
                className="w-48"
              />
            </form>
            <a
              href="/api/export/sales-order"
              className="flex items-center gap-1.5 rounded-md border border-gray-200 px-3.5 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
            >
              <Download size={14} /> Excel
            </a>
          </>
        }
      />

      <Card>
        <Table>
          <Thead>
            <tr>
              <Th>No SO</Th>
              <Th>Quotation</Th>
              <Th>Tanggal</Th>
              <Th>Customer</Th>
              <Th>Produk</Th>
              <Th>Qty</Th>
              <Th>Nilai</Th>
              <Th>Margin</Th>
              <Th>Kirim</Th>
              <Th>Status</Th>
              <Th>Aksi</Th>
            </tr>
          </Thead>
          <Tbody>
            {salesOrders.length === 0 ? (
              <EmptyRow colSpan={11} />
            ) : (
              salesOrders.map((so) => {
                const action = NEXT_STATUS[so.status];
                return (
                  <Tr key={so.id}>
                    <Td className="font-medium text-blue-600">{so.code}</Td>
                    <Td className="text-gray-500">{so.quotation?.code ?? "-"}</Td>
                    <Td>{formatDate(so.date)}</Td>
                    <Td className="font-medium text-gray-900">{so.customer.name}</Td>
                    <Td>{so.product?.name ?? so.productNote ?? "-"}</Td>
                    <Td>{so.qty.toLocaleString("id-ID")}</Td>
                    <Td className="font-semibold text-gray-900">{formatRupiah(Number(so.totalAmount))}</Td>
                    <Td>{formatPercent(Number(so.marginPercent))}</Td>
                    <Td>{so.deliveredAt ? formatDate(so.deliveredAt, false) : "-"}</Td>
                    <Td>
                      <StatusBadge status={so.status} />
                    </Td>
                    <Td>
                      {action ? (
                        <form action={updateSalesOrderStatusAction}>
                          <input type="hidden" name="salesOrderId" value={so.id} />
                          <input type="hidden" name="status" value={action.to} />
                          <button className="rounded-md border border-blue-200 px-2 py-1 text-[11px] font-semibold text-blue-600 hover:bg-blue-50">
                            {action.label}
                          </button>
                        </form>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </Td>
                  </Tr>
                );
              })
            )}
          </Tbody>
        </Table>
      </Card>
    </div>
  );
}
