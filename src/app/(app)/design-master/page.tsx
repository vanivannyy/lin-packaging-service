import { ExternalLink, Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, Table, Thead, Th, Tbody, Tr, Td, EmptyRow } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, TextArea, SubmitButton } from "@/components/ui/FormField";
import { ConfirmSubmitButton } from "@/components/ui/ConfirmSubmitButton";
import { formatDate } from "@/lib/format";
import { createDesignMasterAction, deleteDesignMasterAction, updateDesignMasterAction } from "./actions";
import { requireModule } from "@/lib/require-session";

export default async function DesignMasterPage() {
  await requireModule("design-master");
  const [designs, products] = await Promise.all([
    prisma.designMaster.findMany({
      where: { isDeleted: false },
      include: { product: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.product.findMany({ where: { isDeleted: false }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow="Master Data"
        title="Master Design"
        actions={
          <Modal
            title="Tambah Design Baru"
            trigger={
              <button className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                <Plus size={15} /> Design Baru
              </button>
            }
          >
            <DesignForm action={createDesignMasterAction} submitLabel="Simpan Design" products={products} />
          </Modal>
        }
      />
      <p className="mb-4 -mt-3 text-xs text-gray-400">
        Simpan tautan (Google Drive/Canva/Figma dsb.) file design final agar mudah diakses tim prepress &amp; produksi.
      </p>

      <Card>
        <Table>
          <Thead>
            <tr>
              <Th>Kode</Th>
              <Th>Nama Design</Th>
              <Th>Produk</Th>
              <Th>URL</Th>
              <Th>Catatan</Th>
              <Th>Dibuat</Th>
              <Th>Aksi</Th>
            </tr>
          </Thead>
          <Tbody>
            {designs.length === 0 ? (
              <EmptyRow colSpan={7} />
            ) : (
              designs.map((d) => (
                <Tr key={d.id}>
                  <Td className="font-medium text-blue-600">{d.code}</Td>
                  <Td className="font-medium text-gray-900">{d.name}</Td>
                  <Td>{d.product?.name ?? "-"}</Td>
                  <Td>
                    <a
                      href={d.driveUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                    >
                      Buka Link <ExternalLink size={12} />
                    </a>
                  </Td>
                  <Td className="text-gray-400">{d.note ?? "-"}</Td>
                  <Td className="text-gray-400">{formatDate(d.createdAt)}</Td>
                  <Td>
                    <div className="flex items-center gap-1.5">
                      <Modal
                        title={`Edit Design - ${d.name}`}
                        trigger={
                          <button className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50">
                            Edit
                          </button>
                        }
                      >
                        <DesignForm
                          action={updateDesignMasterAction}
                          submitLabel="Simpan Perubahan"
                          products={products}
                          defaultValues={d}
                        />
                      </Modal>
                      <form action={deleteDesignMasterAction}>
                        <input type="hidden" name="id" value={d.id} />
                        <ConfirmSubmitButton confirmMessage={`Hapus design "${d.name}"? Data akan disembunyikan (soft delete).`}>
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

function DesignForm({
  action,
  submitLabel,
  products,
  defaultValues,
}: {
  action: (formData: FormData) => Promise<void>;
  submitLabel: string;
  products: { id: string; name: string }[];
  defaultValues?: { id: string; name: string; driveUrl: string; productId: string | null; note: string | null };
}) {
  return (
    <form action={action} className="space-y-3">
      {defaultValues ? <input type="hidden" name="id" value={defaultValues.id} /> : null}
      <Field label="Nama Design">
        <Input name="name" required defaultValue={defaultValues?.name} placeholder="Design Box Kopi Varian A" />
      </Field>
      <Field label="URL Google Drive / Cloud">
        <Input
          name="driveUrl"
          type="url"
          required
          defaultValue={defaultValues?.driveUrl}
          placeholder="https://drive.google.com/..."
        />
      </Field>
      <Field label="Produk Terkait (opsional)">
        <Select name="productId" defaultValue={defaultValues?.productId ?? ""}>
          <option value="">- Tanpa Produk -</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Catatan">
        <TextArea name="note" rows={2} defaultValue={defaultValues?.note ?? ""} placeholder="Versi revisi terakhir, dsb." />
      </Field>
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
