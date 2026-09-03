import { Download, FileText } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Card, Table, Thead, Th, Tbody, Tr, Td, EmptyRow } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, SubmitButton } from "@/components/ui/FormField";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatRupiah, formatRupiahCompact, formatDate, daysBetween } from "@/lib/format";
import { recordPaymentAction } from "./actions";
import { requireModule } from "@/lib/require-session";

function effectiveStatus(status: string, dueDate: Date | null, paidAmount: number, totalAmount: number) {
  if (status === "PAID") return "PAID";
  if (dueDate && dueDate < new Date() && paidAmount < totalAmount) return "OVERDUE";
  return status;
}

function agingBucket(dueDate: Date | null) {
  if (!dueDate) return "Belum Jatuh Tempo";
  const days = daysBetween(dueDate, new Date());
  if (days <= 0) return "Belum Jatuh Tempo";
  if (days <= 30) return "1-30 Hari";
  if (days <= 60) return "31-60 Hari";
  if (days <= 90) return "61-90 Hari";
  return "90+ Hari";
}

export default async function InvoicePage() {
  await requireModule("invoice");
  const invoices = await prisma.invoice.findMany({
    where: { isDeleted: false },
    include: { customer: true, salesOrder: true },
    orderBy: { code: "desc" },
  });

  const totalBilled = invoices.reduce((acc, i) => acc + Number(i.totalAmount), 0);
  const totalPaid = invoices.reduce((acc, i) => acc + Number(i.paidAmount), 0);
  const outstanding = totalBilled - totalPaid;
  const overdueInvoices = invoices.filter(
    (i) => i.dueDate && i.dueDate < new Date() && Number(i.paidAmount) < Number(i.totalAmount)
  );
  const overdueOutstanding = overdueInvoices.reduce((acc, i) => acc + Number(i.totalAmount) - Number(i.paidAmount), 0);

  const agingBuckets = ["Belum Jatuh Tempo", "1-30 Hari", "31-60 Hari", "61-90 Hari", "90+ Hari"];
  const agingSummary = agingBuckets.map((bucket) => {
    const unpaid = invoices.filter((i) => Number(i.paidAmount) < Number(i.totalAmount) && agingBucket(i.dueDate) === bucket);
    return {
      bucket,
      count: unpaid.length,
      value: unpaid.reduce((acc, i) => acc + Number(i.totalAmount) - Number(i.paidAmount), 0),
    };
  });

  const customersDue = overdueInvoices
    .map((i) => ({
      customer: i.customer.name,
      invoiceCode: i.code,
      outstanding: Number(i.totalAmount) - Number(i.paidAmount),
      dueDate: i.dueDate,
    }))
    .slice(0, 6);

  return (
    <div>
      <PageHeader
        eyebrow="Finance"
        title="Invoice & Piutang"
        actions={
          <a
            href="/api/export/invoice"
            className="flex items-center gap-1.5 rounded-md border border-gray-200 px-3.5 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            <Download size={14} /> Excel
          </a>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total Ditagihkan" value={formatRupiahCompact(totalBilled)} />
        <StatCard label="Sudah Dibayar" value={formatRupiahCompact(totalPaid)} valueColor="green" />
        <StatCard label="Piutang Outstanding" value={formatRupiahCompact(outstanding)} valueColor="red" />
        <StatCard label="Piutang Jatuh Tempo" value={formatRupiahCompact(overdueOutstanding)} valueColor="red" />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Aging Piutang</p>
          <Table>
            <Thead>
              <tr>
                <Th>Umur</Th>
                <Th>Jumlah Invoice</Th>
                <Th>Nilai</Th>
              </tr>
            </Thead>
            <Tbody>
              {agingSummary.map((a) => (
                <Tr key={a.bucket}>
                  <Td>
                    <span
                      className={`rounded-md border px-2 py-0.5 text-[11px] font-semibold ${
                        a.bucket === "Belum Jatuh Tempo"
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : a.bucket === "90+ Hari"
                            ? "border-red-200 bg-red-50 text-red-700"
                            : "border-amber-200 bg-amber-50 text-amber-700"
                      }`}
                    >
                      {a.bucket}
                    </span>
                  </Td>
                  <Td>{a.count}</Td>
                  <Td className="font-semibold">{formatRupiah(a.value)}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Card>

        <Card className="p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Customer Jatuh Tempo</p>
          <Table>
            <Thead>
              <tr>
                <Th>Customer</Th>
                <Th>Invoice</Th>
                <Th>Outstanding</Th>
                <Th>Jatuh Tempo</Th>
              </tr>
            </Thead>
            <Tbody>
              {customersDue.length === 0 ? (
                <EmptyRow colSpan={4} message="Tidak ada piutang jatuh tempo" />
              ) : (
                customersDue.map((c, i) => (
                  <Tr key={i}>
                    <Td className="font-medium text-gray-900">{c.customer}</Td>
                    <Td className="text-blue-600">{c.invoiceCode}</Td>
                    <Td>{formatRupiah(c.outstanding)}</Td>
                    <Td className="font-semibold text-red-600">{c.dueDate ? formatDate(c.dueDate, false) : "-"}</Td>
                  </Tr>
                ))
              )}
            </Tbody>
          </Table>
        </Card>
      </div>

      <Card>
        <Table>
          <Thead>
            <tr>
              <Th>No Invoice</Th>
              <Th>SO</Th>
              <Th>Tanggal</Th>
              <Th>Jatuh Tempo</Th>
              <Th>Customer</Th>
              <Th>Total</Th>
              <Th>Dibayar</Th>
              <Th>Outstanding</Th>
              <Th>Status</Th>
              <Th>Aksi</Th>
            </tr>
          </Thead>
          <Tbody>
            {invoices.length === 0 ? (
              <EmptyRow colSpan={10} />
            ) : (
              invoices.map((inv) => {
                const status = effectiveStatus(inv.status, inv.dueDate, Number(inv.paidAmount), Number(inv.totalAmount));
                const remaining = Number(inv.totalAmount) - Number(inv.paidAmount);
                return (
                  <Tr key={inv.id}>
                    <Td className="font-medium text-blue-600">{inv.code}</Td>
                    <Td className="text-gray-500">{inv.salesOrder.code}</Td>
                    <Td>{formatDate(inv.issuedAt)}</Td>
                    <Td>{inv.dueDate ? formatDate(inv.dueDate) : "-"}</Td>
                    <Td className="font-medium text-gray-900">{inv.customer.name}</Td>
                    <Td className="font-semibold">{formatRupiah(Number(inv.totalAmount))}</Td>
                    <Td className="text-emerald-600">{formatRupiah(Number(inv.paidAmount))}</Td>
                    <Td className={remaining > 0 ? "font-semibold text-red-600" : "text-gray-400"}>{formatRupiah(remaining)}</Td>
                    <Td>
                      <StatusBadge status={status} />
                    </Td>
                    <Td>
                      <div className="flex items-center gap-1.5">
                        <a
                          href={`/invoice/${inv.id}`}
                          target="_blank"
                          className="flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-50"
                        >
                          <FileText size={11} /> PDF
                        </a>
                        {remaining > 0 ? (
                          <Modal
                            title={`Catat Pembayaran - ${inv.code}`}
                            trigger={
                              <button className="rounded-md border border-blue-200 px-2 py-1 text-[11px] font-semibold text-blue-600 hover:bg-blue-50">
                                Bayar
                              </button>
                            }
                          >
                            <form action={recordPaymentAction} className="space-y-3">
                              <input type="hidden" name="invoiceId" value={inv.id} />
                              <Field label={`Jumlah Bayar (sisa ${formatRupiah(remaining)})`}>
                                <Input name="amount" type="number" min={1} max={remaining} required defaultValue={remaining} />
                              </Field>
                              <Field label="Metode Pembayaran">
                                <Select name="method" defaultValue="TRANSFER">
                                  <option value="TRANSFER">Transfer</option>
                                  <option value="CASH">Cash</option>
                                  <option value="QRIS">QRIS</option>
                                  <option value="CARD">Card</option>
                                </Select>
                              </Field>
                              <Field label="No. Referensi">
                                <Input name="reference" placeholder="TRF-xxxxxx" />
                              </Field>
                              <SubmitButton>Simpan Pembayaran</SubmitButton>
                            </form>
                          </Modal>
                        ) : null}
                      </div>
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
