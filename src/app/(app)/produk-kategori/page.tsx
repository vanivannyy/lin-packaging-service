import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, Table, Thead, Th, Tbody, Tr, Td, EmptyRow } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, SubmitButton } from "@/components/ui/FormField";
import { ConfirmSubmitButton } from "@/components/ui/ConfirmSubmitButton";
import { formatDate } from "@/lib/format";
import { createProductCategoryAction, deleteProductCategoryAction, updateProductCategoryAction } from "./actions";
import { requireModule } from "@/lib/require-session";

export default async function ProdukKategoriPage() {
  await requireModule("produk-kategori");
  const categories = await prisma.productCategory.findMany({
    where: { isDeleted: false },
    include: { _count: { select: { products: true } } },
    orderBy: { name: "asc" },
  });

  return (
    <div>
      <PageHeader
        eyebrow="Master Data"
        title="Master Kategori Produk"
        actions={
          <Modal
            title="Tambah Kategori Produk"
            trigger={
              <button className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                <Plus size={15} /> Kategori Baru
              </button>
            }
          >
            <form action={createProductCategoryAction} className="space-y-3">
              <Field label="Nama Kategori">
                <Input name="name" required placeholder="Box Kemasan Makanan" />
              </Field>
              <SubmitButton>Simpan Kategori</SubmitButton>
            </form>
          </Modal>
        }
      />

      <Card>
        <Table>
          <Thead>
            <tr>
              <Th>Kode</Th>
              <Th>Nama Kategori</Th>
              <Th>Jumlah Produk</Th>
              <Th>Dibuat</Th>
              <Th>Aksi</Th>
            </tr>
          </Thead>
          <Tbody>
            {categories.length === 0 ? (
              <EmptyRow colSpan={5} />
            ) : (
              categories.map((c) => (
                <Tr key={c.id}>
                  <Td className="font-medium text-blue-600">{c.code}</Td>
                  <Td className="font-medium text-gray-900">{c.name}</Td>
                  <Td>{c._count.products}</Td>
                  <Td className="text-gray-400">{formatDate(c.createdAt)}</Td>
                  <Td>
                    <div className="flex items-center gap-1.5">
                      <Modal
                        title={`Edit Kategori - ${c.name}`}
                        trigger={
                          <button className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50">
                            Edit
                          </button>
                        }
                      >
                        <form action={updateProductCategoryAction} className="space-y-3">
                          <input type="hidden" name="id" value={c.id} />
                          <Field label="Nama Kategori">
                            <Input name="name" required defaultValue={c.name} />
                          </Field>
                          <SubmitButton>Simpan Perubahan</SubmitButton>
                        </form>
                      </Modal>
                      <form action={deleteProductCategoryAction}>
                        <input type="hidden" name="id" value={c.id} />
                        <ConfirmSubmitButton
                          confirmMessage={`Hapus kategori "${c.name}"? Kategori akan disembunyikan (soft delete).`}
                        >
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
