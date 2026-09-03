import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { Card, Table, Thead, Th, Tbody, Tr, Td, EmptyRow } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, TextArea, SubmitButton } from "@/components/ui/FormField";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatRupiah, formatDate } from "@/lib/format";
import {
  createPurchaseRequestAction,
  approvePurchaseRequestAction,
  rejectPurchaseRequestAction,
  receivePurchaseRequestAction,
} from "./actions";
import { requireModule } from "@/lib/require-session";
import { autoCreatePurchaseRequestsForAllLowStock } from "@/lib/purchase-auto";

export default async function PurchaseRequestPage() {
  await requireModule("purchase-request");
  await autoCreatePurchaseRequestsForAllLowStock();
  const [purchaseRequests, materials, suppliers, stats] = await Promise.all([
    prisma.purchaseRequest.findMany({
      where: { isDeleted: false },
      include: { material: true, supplier: true, requestedBy: true },
      orderBy: { code: "desc" },
    }),
    prisma.material.findMany({ where: { isDeleted: false }, orderBy: { name: "asc" } }),
    prisma.supplier.findMany({ where: { isDeleted: false }, orderBy: { name: "asc" } }),
    prisma.purchaseRequest.aggregate({
      _count: { _all: true },
      _sum: { estimatedCost: true },
      where: { isDeleted: false, status: "PENDING" },
    }),
  ]);

  const total = purchaseRequests.length;
  const pending = purchaseRequests.filter((p) => p.status === "PENDING").length;
  const approved = purchaseRequests.filter((p) => p.status === "APPROVED").length;

  return (
    <div>
      <PageHeader
        eyebrow="Purchasing"
        title="Purchase Request"
        actions={
          <Modal
            title="Buat Purchase Request"
            trigger={
              <button className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                <Plus size={15} /> PR Baru
              </button>
            }
          >
            <form action={createPurchaseRequestAction} className="space-y-3">
              <Field label="Material">
                <Select name="materialId" required defaultValue="">
                  <option value="" disabled>
                    - Pilih Material -
                  </option>
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.sku})
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Qty">
                  <Input name="qty" type="number" min={1} required defaultValue={1000} />
                </Field>
                <Field label="Estimasi Biaya (Rp)">
                  <Input name="estimatedCost" type="number" min={0} required defaultValue={0} />
                </Field>
              </div>
              <Field label="Supplier">
                <Select name="supplierId" defaultValue="">
                  <option value="">- Pilih Supplier -</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Butuh Tanggal">
                <Input name="neededDate" type="date" />
              </Field>
              <Field label="Catatan">
                <TextArea name="note" rows={2} placeholder="Catatan tambahan (opsional)" />
              </Field>
              <SubmitButton>Simpan PR</SubmitButton>
            </form>
          </Modal>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total PR" value={total} />
        <StatCard label="Menunggu Approval" value={pending} valueColor="amber" />
        <StatCard label="Disetujui" value={approved} valueColor="green" />
        <StatCard label="Estimasi Nilai" value={formatRupiah(Number(stats._sum.estimatedCost ?? 0))} />
      </div>

      <Card>
        <Table>
          <Thead>
            <tr>
              <Th>No PR</Th>
              <Th>Tanggal</Th>
              <Th>Material</Th>
              <Th>Qty</Th>
              <Th>Supplier</Th>
              <Th>Estimasi</Th>
              <Th>Butuh Tanggal</Th>
              <Th>Pemohon</Th>
              <Th>Status</Th>
              <Th>Aksi</Th>
            </tr>
          </Thead>
          <Tbody>
            {purchaseRequests.length === 0 ? (
              <EmptyRow colSpan={10} />
            ) : (
              purchaseRequests.map((pr) => (
                <Tr key={pr.id}>
                  <Td className="font-medium text-blue-600">
                    <div className="flex items-center gap-1.5">
                      {pr.code}
                      {pr.autoGenerated ? (
                        <span className="rounded-md border border-purple-200 bg-purple-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-purple-700">
                          Auto
                        </span>
                      ) : null}
                    </div>
                  </Td>
                  <Td>{formatDate(pr.date)}</Td>
                  <Td className="font-medium text-gray-900">{pr.material.name}</Td>
                  <Td>
                    {Number(pr.qty).toLocaleString("id-ID")} {pr.material.unit}
                  </Td>
                  <Td>{pr.supplier?.name ?? "-"}</Td>
                  <Td>{formatRupiah(Number(pr.estimatedCost))}</Td>
                  <Td>{pr.neededDate ? formatDate(pr.neededDate, false) : "-"}</Td>
                  <Td>{pr.requestedBy.name}</Td>
                  <Td>
                    <StatusBadge status={pr.status} />
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1.5">
                      {pr.status === "PENDING" ? (
                        <>
                          <form action={approvePurchaseRequestAction}>
                            <input type="hidden" name="purchaseRequestId" value={pr.id} />
                            <button className="rounded-md border border-emerald-200 px-2 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-50">
                              Setujui
                            </button>
                          </form>
                          <form action={rejectPurchaseRequestAction}>
                            <input type="hidden" name="purchaseRequestId" value={pr.id} />
                            <button className="rounded-md border border-red-200 px-2 py-1 text-[11px] font-semibold text-red-600 hover:bg-red-50">
                              Tolak
                            </button>
                          </form>
                        </>
                      ) : null}
                      {pr.status === "APPROVED" ? (
                        <form action={receivePurchaseRequestAction}>
                          <input type="hidden" name="purchaseRequestId" value={pr.id} />
                          <button className="rounded-md border border-blue-200 px-2 py-1 text-[11px] font-semibold text-blue-600 hover:bg-blue-50">
                            Terima Barang
                          </button>
                        </form>
                      ) : null}
                      {pr.status === "RECEIVED" || pr.status === "REJECTED" ? (
                        <span className="text-xs text-gray-400">-</span>
                      ) : null}
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
