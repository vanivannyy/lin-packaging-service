import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, Table, Thead, Th, Tbody, Tr, Td, EmptyRow } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, TextArea, SubmitButton } from "@/components/ui/FormField";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ConfirmSubmitButton } from "@/components/ui/ConfirmSubmitButton";
import { createProductAction, deleteProductAction, toggleProductActiveAction } from "./actions";
import { requireModule } from "@/lib/require-session";

const CATEGORY_OPTIONS = ["BOX", "FOLDING_CARTON", "BROCHURE", "PAPER_BAG", "STICKER", "WOBBLER", "CUSTOM"];

export default async function ProdukPage() {
  await requireModule("produk");
  const [products, materials, categories] = await Promise.all([
    prisma.product.findMany({
      where: { isDeleted: false },
      include: { defaultMaterial: true, productCategory: true },
      orderBy: { code: "asc" },
    }),
    prisma.material.findMany({ where: { isDeleted: false }, orderBy: { name: "asc" } }),
    prisma.productCategory.findMany({ where: { isDeleted: false }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow="Master Data"
        title="Master Produk"
        actions={
          <Modal
            title="Tambah Produk Baru"
            trigger={
              <button className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                <Plus size={15} /> Produk Baru
              </button>
            }
          >
            <form action={createProductAction} className="space-y-3">
              <Field label="Nama Produk">
                <Input name="name" required placeholder="Custom Food Packaging Box" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Kategori (legacy)">
                  <Select name="category" defaultValue="BOX">
                    {CATEGORY_OPTIONS.map((c) => (
                      <option key={c} value={c}>
                        {c.replaceAll("_", " ")}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Unit">
                  <Input name="unit" defaultValue="PCS" />
                </Field>
              </div>
              <Field label="Kategori Produk (Master Kategori)">
                <Select name="categoryId" defaultValue="">
                  <option value="">- Tanpa Kategori Master -</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Material Default">
                <Select name="defaultMaterialId" defaultValue="">
                  <option value="">- Pilih Material -</option>
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Spesifikasi">
                <TextArea name="specification" rows={2} placeholder="Sesuai artwork customer" />
              </Field>
              <SubmitButton>Simpan Produk</SubmitButton>
            </form>
          </Modal>
        }
      />

      <Card>
        <Table>
          <Thead>
            <tr>
              <Th>Kode</Th>
              <Th>Nama Produk</Th>
              <Th>Kategori</Th>
              <Th>Unit</Th>
              <Th>Material Default</Th>
              <Th>Spesifikasi</Th>
              <Th>Status</Th>
              <Th>Aksi</Th>
            </tr>
          </Thead>
          <Tbody>
            {products.length === 0 ? (
              <EmptyRow colSpan={8} />
            ) : (
              products.map((p) => (
                <Tr key={p.id}>
                  <Td className="font-medium text-blue-600">{p.code}</Td>
                  <Td className="font-medium text-gray-900">{p.name}</Td>
                  <Td>
                    <span className="rounded-md border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-gray-600">
                      {p.productCategory?.name ?? p.category.replaceAll("_", " ")}
                    </span>
                  </Td>
                  <Td>{p.unit}</Td>
                  <Td>{p.defaultMaterial?.name ?? "-"}</Td>
                  <Td className="text-gray-400">{p.specification ?? "-"}</Td>
                  <Td>
                    <StatusBadge status={p.isActive ? "ACTIVE" : "INACTIVE"} />
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1.5">
                      <form action={toggleProductActiveAction}>
                        <input type="hidden" name="productId" value={p.id} />
                        <button className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50">
                          {p.isActive ? "Nonaktifkan" : "Aktifkan"}
                        </button>
                      </form>
                      <form action={deleteProductAction}>
                        <input type="hidden" name="productId" value={p.id} />
                        <ConfirmSubmitButton confirmMessage={`Hapus produk "${p.name}"? Produk akan disembunyikan (soft delete).`}>
                          Hapus
                        </ConfirmSubmitButton>
                      </form>
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
