import { Plus, Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, Table, Thead, Th, Tbody, Tr, Td, EmptyRow } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, SubmitButton, TextArea } from "@/components/ui/FormField";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatRupiahCompact } from "@/lib/format";
import { TERM_LABEL } from "@/lib/labels";
import { createCustomerAction, updateCustomerAction } from "./actions";
import { requireModule } from "@/lib/require-session";

export default async function CustomerPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await requireModule("customer");
  const { q } = await searchParams;

  const customers = await prisma.customer.findMany({
    where: {
      isDeleted: false,
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
    },
    include: { sales: true },
    orderBy: { code: "desc" },
  });

  return (
    <div>
      <PageHeader
        eyebrow="Sales"
        title="Database Customer"
        actions={
          <>
            <form className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                name="q"
                defaultValue={q}
                placeholder="Cari customer..."
                className="w-56 rounded-md border border-gray-200 py-2 pl-8 pr-3 text-sm outline-none focus:border-blue-400"
              />
            </form>
            <Modal
              title="Tambah Customer Baru"
              trigger={
                <button className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                  <Plus size={15} /> Customer Baru
                </button>
              }
            >
              <CustomerForm action={createCustomerAction} salesName={session.name} submitLabel="Simpan Customer" />
            </Modal>
          </>
        }
      />

      <Card>
        <Table>
          <Thead>
            <tr>
              <Th>Kode</Th>
              <Th>Perusahaan</Th>
              <Th>NPWP</Th>
              <Th>Industri</Th>
              <Th>Kontak</Th>
              <Th>Term</Th>
              <Th>Credit Limit</Th>
              <Th>Sales</Th>
              <Th>Status</Th>
              <Th>Aksi</Th>
            </tr>
          </Thead>
          <Tbody>
            {customers.length === 0 ? (
              <EmptyRow colSpan={10} />
            ) : (
              customers.map((c) => (
                <Tr key={c.id}>
                  <Td className="font-medium text-blue-600">{c.code}</Td>
                  <Td>
                    <div className="font-medium text-gray-900">{c.name}</div>
                    {c.address ? <div className="max-w-[220px] truncate text-xs text-gray-400">{c.address}</div> : null}
                  </Td>
                  <Td className="whitespace-nowrap text-xs">{c.npwp ?? "-"}</Td>
                  <Td>{c.industry ?? "-"}</Td>
                  <Td>
                    <div>{c.contactName ?? "-"}</div>
                    <div className="text-xs text-gray-400">{c.contactPhone ?? ""}</div>
                  </Td>
                  <Td>{TERM_LABEL[c.term]}</Td>
                  <Td>{formatRupiahCompact(Number(c.creditLimit))}</Td>
                  <Td>{c.sales?.name ?? "-"}</Td>
                  <Td>
                    <StatusBadge status={c.isActive ? "ACTIVE" : "INACTIVE"} />
                  </Td>
                  <Td>
                    <Modal
                      title={`Edit Customer - ${c.code}`}
                      trigger={
                        <button className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50">
                          Edit
                        </button>
                      }
                    >
                      <CustomerForm
                        action={updateCustomerAction}
                        salesName={c.sales?.name ?? session.name}
                        submitLabel="Simpan Perubahan"
                        defaultValues={c}
                      />
                    </Modal>
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

function CustomerForm({
  action,
  salesName,
  submitLabel,
  defaultValues,
}: {
  action: (formData: FormData) => Promise<void>;
  salesName: string;
  submitLabel: string;
  defaultValues?: {
    id: string;
    name: string;
    industry: string | null;
    npwp: string | null;
    address: string | null;
    contactName: string | null;
    contactPhone: string | null;
    email: string | null;
    term: string;
    creditLimit: unknown;
  };
}) {
  return (
    <form action={action} className="space-y-3">
      {defaultValues ? <input type="hidden" name="customerId" value={defaultValues.id} /> : null}
      <Field label="Nama Perusahaan">
        <Input name="name" required defaultValue={defaultValues?.name} placeholder="PT Contoh Sejahtera" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="NPWP">
          <Input name="npwp" defaultValue={defaultValues?.npwp ?? ""} placeholder="10.0.0.1-000.000" />
        </Field>
        <Field label="Industri">
          <Input name="industry" defaultValue={defaultValues?.industry ?? ""} placeholder="Makanan & Minuman" />
        </Field>
      </div>
      <Field label="Alamat">
        <TextArea name="address" rows={2} defaultValue={defaultValues?.address ?? ""} placeholder="Jl. Contoh No. 10, Jakarta" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Term Pembayaran">
          <Select name="term" defaultValue={defaultValues?.term ?? "NET_30"}>
            <option value="CBD">CBD</option>
            <option value="NET_15">NET 15</option>
            <option value="NET_30">NET 30</option>
            <option value="NET_45">NET 45</option>
            <option value="NET_60">NET 60</option>
          </Select>
        </Field>
        <Field label="Credit Limit (Rp)">
          <Input
            name="creditLimit"
            type="number"
            min={0}
            step={1_000_000}
            defaultValue={defaultValues ? Number(defaultValues.creditLimit) : 0}
          />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nama Kontak">
          <Input name="contactName" defaultValue={defaultValues?.contactName ?? ""} placeholder="Ibu Ratna" />
        </Field>
        <Field label="No. Telepon">
          <Input name="contactPhone" defaultValue={defaultValues?.contactPhone ?? ""} placeholder="021-xxxxxxx" />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Email">
          <Input name="email" type="email" defaultValue={defaultValues?.email ?? ""} placeholder="info@customer.com" />
        </Field>
        <Field label="Sales">
          <Input value={salesName} readOnly className="bg-gray-50 text-gray-600" />
        </Field>
      </div>
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}
