import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, Table, Thead, Th, Tbody, Tr, Td, EmptyRow } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ConfirmSubmitButton } from "@/components/ui/ConfirmSubmitButton";
import { ProductForm } from "./ProductForm";
import { createProductAction, deleteProductAction, toggleProductActiveAction, updateProductAction } from "./actions";
import { requireModule } from "@/lib/require-session";

export default async function ProdukPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireModule("produk");
  const { error } = await searchParams;
  const canEdit = session.role === "OWNER";
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
            <ProductForm
              action={createProductAction}
              categories={categories}
              materials={materials}
              submitLabel="Simpan Produk"
            />
          </Modal>
        }
      />

      {error ? (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      ) : null}

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
                      {canEdit ? (
                        <Modal
                          title={`Edit Produk - ${p.code}`}
                          trigger={
                            <button
                              type="button"
                              className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                            >
                              Edit
                            </button>
                          }
                        >
                          <ProductForm
                            action={updateProductAction}
                            categories={categories}
                            materials={materials}
                            submitLabel="Simpan Perubahan"
                            defaultValues={{
                              ...p,
                              categoryName: p.productCategory?.name,
                              defaultMaterialName: p.defaultMaterial?.name,
                            }}
                          />
                        </Modal>
                      ) : null}
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
