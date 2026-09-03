import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, Table, Thead, Th, Tbody, Tr, Td, EmptyRow } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, SubmitButton } from "@/components/ui/FormField";
import { AutoSubmitSelect } from "@/components/ui/AutoSubmitSelect";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatRupiah, formatDate } from "@/lib/format";
import { PRICE_CATEGORY_LABEL } from "@/lib/labels";
import type { PriceMasterCategory } from "@prisma/client";
import { createPriceMasterAction, updatePriceMasterAction, toggleActivePriceMasterAction } from "./actions";
import { requireModule } from "@/lib/require-session";

const CATEGORIES: PriceMasterCategory[] = ["PAPER", "FINISHING", "LABOR", "OUTSOURCING", "OVERHEAD"];

export default async function PriceMasterPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  await requireModule("price-master");
  const { category } = await searchParams;

  const items = await prisma.priceMasterItem.findMany({
    where: { isDeleted: false, ...(category ? { category: category as PriceMasterCategory } : {}) },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });

  return (
    <div>
      <PageHeader
        eyebrow="Master Data Harga"
        title="Price Master"
        actions={
          <>
            <form>
              <AutoSubmitSelect
                name="category"
                defaultValue={category}
                placeholder="Semua Kategori"
                options={CATEGORIES.map((c) => ({ value: c, label: PRICE_CATEGORY_LABEL[c] }))}
                className="w-44"
              />
            </form>
            <Modal
              title="Tambah Harga Baru"
              trigger={
                <button className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                  <Plus size={15} /> Harga Baru
                </button>
              }
            >
              <PriceForm action={createPriceMasterAction} submitLabel="Simpan Harga" />
            </Modal>
          </>
        }
      />

      <Card>
        <Table>
          <Thead>
            <tr>
              <Th>Kategori</Th>
              <Th>Nama</Th>
              <Th>Vendor</Th>
              <Th>Unit</Th>
              <Th>Min Qty</Th>
              <Th>Harga</Th>
              <Th>Efektif</Th>
              <Th>Status</Th>
              <Th>Aksi</Th>
            </tr>
          </Thead>
          <Tbody>
            {items.length === 0 ? (
              <EmptyRow colSpan={9} />
            ) : (
              items.map((item) => (
                <Tr key={item.id}>
                  <Td>
                    <span className="rounded-md border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-gray-600">
                      {PRICE_CATEGORY_LABEL[item.category]}
                    </span>
                  </Td>
                  <Td className="font-medium text-gray-900">{item.name}</Td>
                  <Td>{item.vendor}</Td>
                  <Td>{item.unit}</Td>
                  <Td>{item.minQty.toLocaleString("id-ID")}</Td>
                  <Td className="font-semibold">{formatRupiah(Number(item.price))}</Td>
                  <Td>{formatDate(item.effectiveDate)}</Td>
                  <Td>
                    <StatusBadge status={item.isActive ? "ACTIVE" : "INACTIVE"} />
                  </Td>
                  <Td>
                    <div className="flex items-center gap-1.5">
                      <Modal
                        title={`Edit Harga - ${item.name}`}
                        trigger={
                          <button className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50">
                            <span className="text-[13px]">↻</span>
                          </button>
                        }
                      >
                        <PriceForm action={updatePriceMasterAction} submitLabel="Simpan Perubahan" defaultValues={item} />
                      </Modal>
                      <form action={toggleActivePriceMasterAction}>
                        <input type="hidden" name="id" value={item.id} />
                        <button className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50">
                          Edit
                        </button>
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

function PriceForm({
  action,
  submitLabel,
  defaultValues,
}: {
  action: (formData: FormData) => Promise<void>;
  submitLabel: string;
  defaultValues?: {
    id: string;
    category: string;
    name: string;
    vendor: string | null;
    unit: string;
    minQty: number;
    price: unknown;
  };
}) {
  return (
    <form action={action} className="space-y-3">
      {defaultValues ? <input type="hidden" name="id" value={defaultValues.id} /> : null}
      <Field label="Kategori">
        <Select name="category" defaultValue={defaultValues?.category ?? "FINISHING"}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {PRICE_CATEGORY_LABEL[c]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Nama Komponen">
        <Input name="name" required defaultValue={defaultValues?.name} placeholder="Laminating Glossy" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Vendor">
          <Input name="vendor" defaultValue={defaultValues?.vendor ?? "Internal"} />
        </Field>
        <Field label="Unit">
          <Input name="unit" required defaultValue={defaultValues?.unit ?? "LEMBAR"} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Min Qty">
          <Input name="minQty" type="number" min={0} defaultValue={defaultValues?.minQty ?? 0} />
        </Field>
        <Field label="Harga (Rp)">
          <Input name="price" type="number" min={0} required defaultValue={defaultValues ? Number(defaultValues.price) : 0} />
        </Field>
      </div>
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
