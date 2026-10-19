import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card, Table, Thead, Th, Tbody, Tr, Td, EmptyRow } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, Select, SubmitButton, TextArea } from "@/components/ui/FormField";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ConfirmSubmitButton } from "@/components/ui/ConfirmSubmitButton";
import { StatCard } from "@/components/ui/StatCard";
import { PasswordField } from "@/app/login/PasswordField";
import { formatNumber, formatDateTime } from "@/lib/format";
import { requireModule } from "@/lib/require-session";
import {
  adjustClientStockAction,
  adjustLinStockAction,
  createClientAccountAction,
  createClientItemAction,
  resetClientAccountPasswordAction,
  toggleClientAccountActiveAction,
  toggleClientItemActiveAction,
  updateClientItemAction,
} from "./actions";

function toNum(v: unknown): number {
  return v === null || v === undefined ? 0 : Number(v);
}

export default async function StokKlienPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; customerId?: string; tab?: string }>;
}) {
  await requireModule("client-stock");
  const { q, customerId, tab } = await searchParams;
  const activeTab = tab === "akun" ? "akun" : "barang";

  const [customers, products, items, accounts] = await Promise.all([
    prisma.customer.findMany({ where: { isDeleted: false }, orderBy: { name: "asc" } }),
    prisma.product.findMany({ where: { isDeleted: false }, orderBy: { name: "asc" } }),
    prisma.clientFinishedGoodsItem.findMany({
      where: {
        isDeleted: false,
        ...(customerId ? { customerId } : {}),
        ...(q && activeTab === "barang"
          ? { itemName: { contains: q, mode: "insensitive" } }
          : {}),
      },
      include: { customer: true, product: true },
      orderBy: [{ customer: { name: "asc" } }, { itemName: "asc" }],
    }),
    prisma.clientAccount.findMany({
      where: {
        isDeleted: false,
        ...(customerId ? { customerId } : {}),
        ...(q && activeTab === "akun"
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" } },
                { email: { contains: q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: { customer: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const lowCount = items.filter((it) => toNum(it.clientWarehouseQty) <= toNum(it.minStockQty)).length;
  const tabHref = (next: "barang" | "akun") => {
    const params = new URLSearchParams();
    params.set("tab", next);
    if (customerId) params.set("customerId", customerId);
    if (q) params.set("q", q);
    return `/stok-klien?${params.toString()}`;
  };

  return (
    <div>
      <PageHeader
        eyebrow="Produksi & Stok"
        title="Stok Klien (App)"
        actions={
          <>
            {activeTab === "barang" ? (
              <Modal
                title="Tambah Barang Jadi"
                trigger={
                  <button className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                    <Plus size={15} /> Barang Jadi
                  </button>
                }
              >
                <ItemForm customers={customers} products={products} action={createClientItemAction} submitLabel="Simpan Barang" />
              </Modal>
            ) : (
              <Modal
                title="Tambah Akun App Klien"
                trigger={
                  <button className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                    <Plus size={15} /> Akun App
                  </button>
                }
              >
                <AccountForm customers={customers} />
              </Modal>
            )}
          </>
        }
      />

      <p className="mb-4 max-w-3xl text-sm text-gray-500">
        Daftar barang jadi di halaman ini sama dengan yang tampil di aplikasi klien. Stok gudang Lin Packaging
        berubah otomatis dari produksi &amp; pengiriman; stok gudang klien diisi klien lewat app atau dikoreksi di sini.
      </p>

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Barang Jadi" value={formatNumber(items.length)} />
        <StatCard label="Stok Klien Menipis" value={formatNumber(lowCount)} valueColor={lowCount > 0 ? "amber" : "default"} />
        <StatCard label="Akun App" value={formatNumber(accounts.length)} />
        <StatCard
          label="Akun Aktif"
          value={formatNumber(accounts.filter((a) => a.isActive).length)}
          valueColor="green"
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link
          href={tabHref("barang")}
          className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
            activeTab === "barang" ? "bg-blue-600 text-white" : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
          }`}
        >
          Barang Jadi
        </Link>
        <Link
          href={tabHref("akun")}
          className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
            activeTab === "akun" ? "bg-blue-600 text-white" : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
          }`}
        >
          Akun App Klien
        </Link>
        <form className="ml-auto flex flex-wrap items-center gap-2">
          <input type="hidden" name="tab" value={activeTab} />
          <Select name="customerId" defaultValue={customerId ?? ""} className="w-56">
            <option value="">Semua customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder={activeTab === "akun" ? "Cari nama/email..." : "Cari barang..."}
              className="w-52 rounded-md border border-gray-200 py-2 pl-8 pr-3 text-sm outline-none focus:border-blue-400"
            />
          </div>
          <button type="submit" className="rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50">
            Filter
          </button>
        </form>
      </div>

      {activeTab === "barang" ? (
        <Card>
          <Table>
            <Thead>
              <tr>
                <Th>Customer</Th>
                <Th>Barang Jadi</Th>
                <Th>Gudang Lin</Th>
                <Th>Gudang Klien</Th>
                <Th>Min.</Th>
                <Th>Lapor Terakhir</Th>
                <Th>Status</Th>
                <Th>Aksi</Th>
              </tr>
            </Thead>
            <Tbody>
              {items.length === 0 ? (
                <EmptyRow colSpan={8} message="Belum ada barang jadi. Item juga muncul otomatis saat work order klien selesai produksi." />
              ) : (
                items.map((it) => {
                  const linQty = toNum(it.linWarehouseQty);
                  const clientQty = toNum(it.clientWarehouseQty);
                  const minQty = toNum(it.minStockQty);
                  const isLow = clientQty <= minQty;
                  return (
                    <Tr key={it.id}>
                      <Td>
                        <div className="font-medium text-gray-900">{it.customer.name}</div>
                        <div className="text-xs text-gray-400">{it.customer.code}</div>
                      </Td>
                      <Td>
                        <div className="font-medium text-gray-900">{it.itemName}</div>
                        <div className="text-xs text-gray-400">
                          {it.sku ?? "Tanpa SKU"} · {it.unit}
                          {it.product ? ` · ${it.product.name}` : ""}
                        </div>
                      </Td>
                      <Td className="font-semibold tabular-nums">{formatNumber(linQty)}</Td>
                      <Td className={`font-semibold tabular-nums ${isLow ? "text-amber-700" : ""}`}>
                        {formatNumber(clientQty)}
                      </Td>
                      <Td className="tabular-nums text-gray-500">{formatNumber(minQty)}</Td>
                      <Td className="text-xs text-gray-500">
                        {it.clientReportedAt ? formatDateTime(it.clientReportedAt) : "Belum ada"}
                      </Td>
                      <Td>
                        <div className="flex flex-col gap-1">
                          <StatusBadge status={it.isActive ? "ACTIVE" : "INACTIVE"} />
                          {isLow ? (
                            <span className="rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
                              Menipis
                            </span>
                          ) : null}
                        </div>
                      </Td>
                      <Td>
                        <div className="flex flex-wrap gap-1.5">
                          <Modal
                            title={`Edit ${it.itemName}`}
                            trigger={
                              <button className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50">
                                Edit
                              </button>
                            }
                          >
                            <ItemForm
                              customers={customers}
                              products={products}
                              action={updateClientItemAction}
                              submitLabel="Simpan Perubahan"
                              defaultValues={it}
                            />
                          </Modal>
                          <Modal
                            title={`Koreksi stok Lin — ${it.itemName}`}
                            trigger={
                              <button className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50">
                                Stok Lin
                              </button>
                            }
                          >
                            <AdjustForm
                              itemId={it.id}
                              currentQty={linQty}
                              unit={it.unit}
                              action={adjustLinStockAction}
                              label="Stok gudang Lin Packaging"
                            />
                          </Modal>
                          <Modal
                            title={`Koreksi stok klien — ${it.itemName}`}
                            trigger={
                              <button className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50">
                                Stok Klien
                              </button>
                            }
                          >
                            <AdjustForm
                              itemId={it.id}
                              currentQty={clientQty}
                              unit={it.unit}
                              action={adjustClientStockAction}
                              label="Stok gudang klien (tersinkron ke app)"
                            />
                          </Modal>
                          <form action={toggleClientItemActiveAction}>
                            <input type="hidden" name="itemId" value={it.id} />
                            <ConfirmSubmitButton confirmMessage={it.isActive ? "Nonaktifkan item ini dari app klien?" : "Aktifkan kembali item ini?"}>
                              {it.isActive ? "Nonaktif" : "Aktifkan"}
                            </ConfirmSubmitButton>
                          </form>
                        </div>
                      </Td>
                    </Tr>
                  );
                })
              )}
            </Tbody>
          </Table>
        </Card>
      ) : (
        <Card>
          <Table>
            <Thead>
              <tr>
                <Th>Customer</Th>
                <Th>PIC / Email</Th>
                <Th>Telepon</Th>
                <Th>Login Terakhir</Th>
                <Th>Status</Th>
                <Th>Aksi</Th>
              </tr>
            </Thead>
            <Tbody>
              {accounts.length === 0 ? (
                <EmptyRow colSpan={6} message="Belum ada akun app klien. Buat akun supaya customer bisa login di aplikasi stok." />
              ) : (
                accounts.map((a) => (
                  <Tr key={a.id}>
                    <Td>
                      <div className="font-medium text-gray-900">{a.customer.name}</div>
                      <div className="text-xs text-gray-400">{a.customer.code}</div>
                    </Td>
                    <Td>
                      <div className="font-medium text-gray-900">{a.name}</div>
                      <div className="text-xs text-gray-400">{a.email}</div>
                    </Td>
                    <Td>{a.phone ?? "-"}</Td>
                    <Td className="text-xs text-gray-500">{a.lastLoginAt ? formatDateTime(a.lastLoginAt) : "Belum pernah"}</Td>
                    <Td>
                      <StatusBadge status={a.isActive ? "ACTIVE" : "INACTIVE"} />
                    </Td>
                    <Td>
                      <div className="flex flex-wrap gap-1.5">
                        <Modal
                          title={`Reset password — ${a.email}`}
                          trigger={
                            <button className="rounded-md border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50">
                              Reset Password
                            </button>
                          }
                        >
                          <form action={resetClientAccountPasswordAction} className="space-y-3">
                            <input type="hidden" name="clientAccountId" value={a.id} />
                            <Field label="Password baru">
                              <PasswordField name="password" id={`reset-${a.id}`} autoComplete="new-password" />
                            </Field>
                            <SubmitButton>Simpan Password</SubmitButton>
                          </form>
                        </Modal>
                        <form action={toggleClientAccountActiveAction}>
                          <input type="hidden" name="clientAccountId" value={a.id} />
                          <ConfirmSubmitButton
                            confirmMessage={a.isActive ? "Nonaktifkan akun ini? Klien tidak bisa login." : "Aktifkan kembali akun ini?"}
                          >
                            {a.isActive ? "Nonaktif" : "Aktifkan"}
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
      )}
    </div>
  );
}

function ItemForm({
  customers,
  products,
  action,
  submitLabel,
  defaultValues,
}: {
  customers: { id: string; name: string }[];
  products: { id: string; name: string }[];
  action: (formData: FormData) => Promise<void>;
  submitLabel: string;
  defaultValues?: {
    id: string;
    customerId: string;
    productId: string | null;
    itemName: string;
    sku: string | null;
    unit: string;
    minStockQty: unknown;
  };
}) {
  return (
    <form action={action} className="space-y-3">
      {defaultValues ? <input type="hidden" name="itemId" value={defaultValues.id} /> : null}
      {!defaultValues ? (
        <Field label="Customer">
          <Select name="customerId" required defaultValue="">
            <option value="">- Pilih customer -</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      <Field label="Nama Barang">
        <Input name="itemName" required defaultValue={defaultValues?.itemName} placeholder="Box Premium 20x15" />
      </Field>
      <Field label="Produk (opsional)">
        <Select name="productId" defaultValue={defaultValues?.productId ?? ""}>
          <option value="">- Tidak dihubungkan -</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="SKU">
          <Input name="sku" defaultValue={defaultValues?.sku ?? ""} placeholder="SKU-001" />
        </Field>
        <Field label="Unit">
          <Input name="unit" defaultValue={defaultValues?.unit ?? "PCS"} />
        </Field>
      </div>
      <Field label="Stok minimum gudang klien">
        <Input name="minStockQty" type="number" min={0} step="0.001" defaultValue={defaultValues ? toNum(defaultValues.minStockQty) : 0} />
      </Field>
      <SubmitButton>{submitLabel}</SubmitButton>
    </form>
  );
}

function AccountForm({ customers }: { customers: { id: string; name: string }[] }) {
  return (
    <form action={createClientAccountAction} className="space-y-3">
      <Field label="Customer">
        <Select name="customerId" required defaultValue="">
          <option value="">- Pilih customer -</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Nama PIC">
        <Input name="name" required placeholder="Budi Santoso" />
      </Field>
      <Field label="Email login">
        <Input name="email" type="email" required placeholder="pic@customer.com" />
      </Field>
      <Field label="Telepon">
        <Input name="phone" placeholder="0812xxxxxxx" />
      </Field>
      <Field label="Password">
        <PasswordField name="password" id="new-client-password" autoComplete="new-password" />
      </Field>
      <SubmitButton>Buat Akun App</SubmitButton>
    </form>
  );
}

function AdjustForm({
  itemId,
  currentQty,
  unit,
  action,
  label,
}: {
  itemId: string;
  currentQty: number;
  unit: string;
  action: (formData: FormData) => Promise<void>;
  label: string;
}) {
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="itemId" value={itemId} />
      <p className="text-sm text-gray-600">
        {label} saat ini: <span className="font-semibold text-gray-900">{formatNumber(currentQty)} {unit}</span>
      </p>
      <Field label={`Stok baru (${unit})`}>
        <Input name="newQty" type="number" min={0} step="0.001" required defaultValue={currentQty} />
      </Field>
      <Field label="Catatan">
        <TextArea name="note" rows={2} placeholder="Alasan koreksi" />
      </Field>
      <SubmitButton>Simpan Stok</SubmitButton>
    </form>
  );
}
