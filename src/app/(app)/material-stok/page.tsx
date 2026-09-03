import Link from "next/link";
import { Plus, AlertTriangle, Barcode } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, Table, Thead, Th, Tbody, Tr, Td, EmptyRow } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, TextArea, SubmitButton } from "@/components/ui/FormField";
import { formatRupiah, formatNumber } from "@/lib/format";
import { MATERIAL_CATEGORY_LABEL } from "@/lib/labels";
import { createMaterialAction, adjustStockAction } from "./actions";
import { requireModule } from "@/lib/require-session";
import { autoCreatePurchaseRequestsForAllLowStock } from "@/lib/purchase-auto";

export default async function MaterialStokPage() {
  await requireModule("material-stok");
  await autoCreatePurchaseRequestsForAllLowStock();
  const [materials, suppliers] = await Promise.all([
    prisma.material.findMany({ where: { isDeleted: false }, include: { supplier: true }, orderBy: { name: "asc" } }),
    prisma.supplier.findMany({ where: { isDeleted: false }, orderBy: { name: "asc" } }),
  ]);

  const totalStockValue = materials.reduce((acc, m) => acc + Number(m.stockQty) * Number(m.pricePerUnit), 0);

  return (
    <div>
      <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-gray-400">
        Nilai Stok: {formatRupiah(totalStockValue)}
      </p>
      <PageHeader
        eyebrow="Produksi & Stok"
        title="Material & Stok"
        actions={
          <Modal
            title="Tambah Material Baru"
            trigger={
              <button className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                <Plus size={15} /> Material Baru
              </button>
            }
          >
            <form action={createMaterialAction} className="space-y-3">
              <Field label="Nama Material">
                <Input name="name" required placeholder="Art Carton 260 GSM" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Kategori">
                  <Select name="category" defaultValue="PAPER">
                    <option value="PAPER">Paper</option>
                    <option value="FILM">Film</option>
                    <option value="FOIL">Foil</option>
                    <option value="INK">Ink</option>
                    <option value="OTHER">Other</option>
                  </Select>
                </Field>
                <Field label="GSM">
                  <Input name="gsm" type="number" placeholder="260" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Ukuran">
                  <Input name="size" placeholder="65x100 cm" />
                </Field>
                <Field label="Unit">
                  <Input name="unit" defaultValue="LEMBAR" placeholder="LEMBAR / ROLL / KG" />
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
              <div className="grid grid-cols-2 gap-3">
                <Field label="Harga / Unit (Rp)">
                  <Input name="pricePerUnit" type="number" min={0} required defaultValue={0} />
                </Field>
                <Field label="Stok Minimum">
                  <Input name="minStockQty" type="number" min={0} defaultValue={0} />
                </Field>
              </div>
              <SubmitButton>Simpan Material</SubmitButton>
            </form>
          </Modal>
        }
      />

      <Card>
        <Table>
          <Thead>
            <tr>
              <Th>SKU</Th>
              <Th>Nama</Th>
              <Th>Kategori</Th>
              <Th>GSM</Th>
              <Th>Ukuran</Th>
              <Th>Supplier</Th>
              <Th>Harga/Unit</Th>
              <Th>Stok</Th>
              <Th>Reserved</Th>
              <Th>Tersedia</Th>
              <Th>Min</Th>
              <Th>Aksi</Th>
            </tr>
          </Thead>
          <Tbody>
            {materials.length === 0 ? (
              <EmptyRow colSpan={12} />
            ) : (
              materials.map((m) => {
                const available = Number(m.stockQty) - Number(m.reservedQty);
                const isLow = available <= Number(m.minStockQty);
                return (
                  <Tr key={m.id}>
                    <Td className="font-medium text-blue-600">{m.sku}</Td>
                    <Td className="font-medium text-gray-900">
                      <div className="flex items-center gap-1.5">
                        {isLow ? <AlertTriangle size={13} className="text-red-500" /> : null}
                        {m.name}
                      </div>
                    </Td>
                    <Td>
                      <span className="rounded-md border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-gray-600">
                        {MATERIAL_CATEGORY_LABEL[m.category]}
                      </span>
                    </Td>
                    <Td>{m.gsm ?? "-"}</Td>
                    <Td>{m.size ?? "-"}</Td>
                    <Td>{m.supplier?.name ?? "-"}</Td>
                    <Td>{formatRupiah(Number(m.pricePerUnit))}</Td>
                    <Td className={isLow ? "font-semibold text-red-600" : ""}>{formatNumber(Number(m.stockQty))}</Td>
                    <Td className="text-gray-400">{formatNumber(Number(m.reservedQty))}</Td>
                    <Td className="font-semibold">{formatNumber(available)}</Td>
                    <Td className="text-gray-400">{formatNumber(Number(m.minStockQty))}</Td>
                    <Td>
                      <div className="flex items-center gap-1.5">
                        <Modal
                          title={`Sesuaikan Stok - ${m.name}`}
                          trigger={
                            <button className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50">
                              Adjust
                            </button>
                          }
                        >
                          <form action={adjustStockAction} className="space-y-3">
                            <input type="hidden" name="materialId" value={m.id} />
                            <Field label="Jumlah (+/-)">
                              <Input name="quantity" type="number" required placeholder="mis. -50 atau 100" />
                            </Field>
                            <Field label="Catatan">
                              <TextArea name="note" rows={2} placeholder="Alasan penyesuaian" />
                            </Field>
                            <SubmitButton>Simpan Penyesuaian</SubmitButton>
                          </form>
                        </Modal>
                        <Link
                          href={`/material-stok/barcode/${m.id}`}
                          target="_blank"
                          className="flex items-center gap-1 rounded-md border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                        >
                          <Barcode size={13} /> Barcode
                        </Link>
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
