import { Plus, Download } from "lucide-react";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, Table, Thead, Th, Tbody, Tr, Td, EmptyRow } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, SubmitButton } from "@/components/ui/FormField";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AutoSubmitSelect } from "@/components/ui/AutoSubmitSelect";
import { formatRupiah, formatRupiahCompact, formatDate, formatPercent } from "@/lib/format";
import type { QuotationStatus } from "@prisma/client";
import {
  createQuotationAction,
  updateQuotationStatusAction,
  convertQuotationToSalesOrderAction,
} from "./actions";
import { requireModule } from "@/lib/require-session";

const STATUS_OPTIONS: QuotationStatus[] = ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "EXPIRED"];

export default async function QuotationPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await requireModule("quotation");
  const { status } = await searchParams;

  const [quotations, customers, products] = await Promise.all([
    prisma.quotation.findMany({
      where: { isDeleted: false, ...(status ? { status: status as QuotationStatus } : {}) },
      include: { customer: true, product: true, sales: true, salesOrder: true },
      orderBy: { code: "desc" },
    }),
    prisma.customer.findMany({ where: { isDeleted: false, isActive: true }, orderBy: { name: "asc" } }),
    prisma.product.findMany({ where: { isDeleted: false, isActive: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow="Sales"
        title="Quotation"
        actions={
          <>
            <form>
              <AutoSubmitSelect
                name="status"
                defaultValue={status}
                placeholder="Semua Status"
                options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
                className="w-44"
              />
            </form>
            <Modal
              title="Buat Quotation Baru"
              trigger={
                <button className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                  <Plus size={15} /> Quotation Baru
                </button>
              }
            >
              <form action={createQuotationAction} className="space-y-3">
                <Field label="Customer">
                  <Select name="customerId" required defaultValue="">
                    <option value="" disabled>
                      - Pilih Customer -
                    </option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Produk">
                  <Select name="productId" defaultValue="">
                    <option value="">- Free text (isi catatan) -</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Catatan Produk (opsional)">
                  <Input name="productNote" placeholder="Custom Food Packaging Box" />
                </Field>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Qty">
                    <Input name="qty" type="number" min={1} required defaultValue={1000} />
                  </Field>
                  <Field label="HPP (Rp)">
                    <Input name="hppAmount" type="number" min={0} required defaultValue={0} />
                  </Field>
                  <Field label="Margin (%)">
                    <Input name="marginPercent" type="number" min={0} step={0.5} required defaultValue={30} />
                  </Field>
                </div>
                <SubmitButton>Simpan Quotation</SubmitButton>
              </form>
            </Modal>
            <a
              href="/api/export/quotation"
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
              <Th>No</Th>
              <Th>Tanggal</Th>
              <Th>Customer</Th>
              <Th>Produk</Th>
              <Th>Qty</Th>
              <Th>HPP</Th>
              <Th>Nilai</Th>
              <Th>Margin</Th>
              <Th>Sales</Th>
              <Th>Status</Th>
              <Th>Aksi</Th>
            </tr>
          </Thead>
          <Tbody>
            {quotations.length === 0 ? (
              <EmptyRow colSpan={11} />
            ) : (
              quotations.map((q) => (
                <Tr key={q.id}>
                  <Td>
                    <Link href={`/quotation/${q.id}`} className="font-medium text-blue-600 hover:underline">
                      {q.code}
                    </Link>
                  </Td>
                  <Td>{formatDate(q.date)}</Td>
                  <Td className="font-medium text-gray-900">{q.customer?.name ?? "-"}</Td>
                  <Td>{q.product?.name ?? q.productNote ?? "-"}</Td>
                  <Td>{q.qty.toLocaleString("id-ID")}</Td>
                  <Td>{formatRupiahCompact(Number(q.hppAmount))}</Td>
                  <Td className="font-semibold text-gray-900">{formatRupiah(Number(q.totalAmount))}</Td>
                  <Td>{formatPercent(Number(q.marginPercent))}</Td>
                  <Td>{q.sales?.name ?? "-"}</Td>
                  <Td>
                    <StatusBadge status={q.status} />
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1.5">
                      {q.status === "DRAFT" ? (
                        <form action={updateQuotationStatusAction}>
                          <input type="hidden" name="quotationId" value={q.id} />
                          <input type="hidden" name="status" value="SENT" />
                          <button className="rounded-md border border-gray-200 px-2 py-1 text-[11px] font-semibold text-gray-600 hover:bg-gray-50">
                            Kirim
                          </button>
                        </form>
                      ) : null}
                      {q.status === "SENT" ? (
                        <>
                          <form action={updateQuotationStatusAction}>
                            <input type="hidden" name="quotationId" value={q.id} />
                            <input type="hidden" name="status" value="ACCEPTED" />
                            <button className="rounded-md border border-emerald-200 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50">
                              Accept
                            </button>
                          </form>
                          <form action={updateQuotationStatusAction}>
                            <input type="hidden" name="quotationId" value={q.id} />
                            <input type="hidden" name="status" value="REJECTED" />
                            <button className="rounded-md border border-red-200 px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50">
                              Reject
                            </button>
                          </form>
                        </>
                      ) : null}
                      {q.status === "ACCEPTED" && !q.salesOrder ? (
                        q.customerId ? (
                          <form action={convertQuotationToSalesOrderAction}>
                            <input type="hidden" name="quotationId" value={q.id} />
                            <button className="rounded-md border border-blue-200 px-2 py-1 text-[11px] font-semibold text-blue-600 hover:bg-blue-50">
                              Buat SO
                            </button>
                          </form>
                        ) : (
                          <Link href={`/quotation/${q.id}`} className="text-[11px] font-semibold text-blue-600 hover:underline">
                            Pilih customer
                          </Link>
                        )
                      ) : null}
                      {q.salesOrder ? <span className="text-[11px] text-gray-400">{q.salesOrder.code}</span> : null}
                    </div>
                  </Td>
                </Tr>
              ))
            )}
          </Tbody>
        </Table>
      </Card>
    </div>
  );
}
