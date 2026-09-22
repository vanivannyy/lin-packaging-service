import { notFound } from "next/navigation";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { Card, Table, Thead, Th, Tbody, Tr, Td, EmptyRow } from "@/components/ui/Table";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, TextArea, SubmitButton } from "@/components/ui/FormField";
import { formatDateTime, formatNumber, formatRupiah } from "@/lib/format";
import { MATERIAL_CATEGORY_LABEL, STOCK_MOVEMENT_SOURCE_LABEL, STOCK_MOVEMENT_TYPE_LABEL, stockMovementSourceLabel } from "@/lib/labels";
import { requireModule } from "@/lib/require-session";
import { adjustStockAction } from "../actions";

function InfoItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-gray-900">{value || "-"}</p>
    </div>
  );
}

function signedQty(qty: number) {
  const formatted = formatNumber(qty);
  return qty > 0 ? `+${formatted}` : formatted;
}

export default async function MaterialDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireModule("material-stok");
  const { id } = await params;

  const material = await prisma.material.findFirst({
    where: { id, isDeleted: false },
    include: { supplier: true },
  });
  if (!material) notFound();

  const stockLogs = await prisma.stockMovement.findMany({
    where: { materialId: material.id },
    include: { user: true },
    orderBy: { createdAt: "desc" },
  });

  const movementRefs = [...new Set(stockLogs.map((log) => log.referenceCode).filter((code): code is string => Boolean(code)))];

  const rawAuditLogs = await prisma.auditTrail.findMany({
    where: {
      module: "material",
      OR: [
        { referenceCode: { equals: material.sku, mode: "insensitive" } },
        ...(movementRefs.length > 0 ? [{ referenceCode: { in: movementRefs } }] : []),
      ],
    },
    include: { user: true },
    orderBy: { createdAt: "desc" as const },
    take: 80,
  });

  const auditLogs = rawAuditLogs.filter((log) => {
    if (log.referenceCode?.toUpperCase() === material.sku.toUpperCase()) return true;
    const newValue = log.newValue as { materialSku?: string } | null;
    return newValue?.materialSku === material.sku;
  }).slice(0, 50);

  const available = Number(material.stockQty) - Number(material.reservedQty);
  const isLow = available <= Number(material.minStockQty);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">Material &amp; Stok</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">{material.name}</h1>
            {isLow ? (
              <span className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-red-700">
                <AlertTriangle size={12} /> Stok Rendah
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm font-medium text-blue-600">{material.sku}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Modal
            title={`Sesuaikan Stok - ${material.name}`}
            trigger={
              <button className="rounded-md border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50">
                Adjust
              </button>
            }
          >
            <form action={adjustStockAction} className="space-y-3">
              <input type="hidden" name="materialId" value={material.id} />
              <Field label="Jumlah (+/-)">
                <Input name="quantity" type="number" required placeholder="mis. -50 atau 100" />
              </Field>
              <Field label="Referensi SO/WO/DO (opsional)">
                <Input name="referenceCode" placeholder="mis. SO-2026-00001 / WO-2026-00001" />
              </Field>
              <Field label="Catatan">
                <TextArea name="note" rows={2} placeholder="Alasan penyesuaian" />
              </Field>
              <SubmitButton>Simpan Penyesuaian</SubmitButton>
            </form>
          </Modal>
          <Link
            href={`/material-stok/barcode/${material.id}`}
            target="_blank"
            className="rounded-md border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            Barcode
          </Link>
          <Link
            href="/material-stok"
            className="rounded-md border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            Kembali
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Detail Material</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-3">
              <InfoItem label="SKU" value={material.sku} />
              <InfoItem label="Nama" value={material.name} />
              <InfoItem label="Kategori" value={MATERIAL_CATEGORY_LABEL[material.category] ?? material.category} />
              <InfoItem label="GSM" value={material.gsm ?? "-"} />
              <InfoItem label="Ukuran" value={material.size ?? "-"} />
              <InfoItem label="Supplier" value={material.supplier?.name ?? "-"} />
              <InfoItem label="Harga/Unit" value={formatRupiah(Number(material.pricePerUnit))} />
              <InfoItem label="Unit" value={material.unit} />
              <InfoItem
                label="Stok"
                value={<span className={isLow ? "font-semibold text-red-600" : undefined}>{formatNumber(Number(material.stockQty))}</span>}
              />
              <InfoItem label="Reserved" value={formatNumber(Number(material.reservedQty))} />
              <InfoItem label="Tersedia" value={formatNumber(available)} />
              <InfoItem label="Min. Stok" value={formatNumber(Number(material.minStockQty))} />
            </div>
          </Card>

          <Card>
            <div className="border-b border-gray-100 px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Log Stok</p>
              <p className="mt-0.5 text-xs text-gray-400">
                Semua penambahan dan pengurangan stok dari web maupun aplikasi.
              </p>
            </div>
            <Table>
              <Thead>
                <tr>
                  <Th>Waktu</Th>
                  <Th>Qty</Th>
                  <Th>Tipe</Th>
                  <Th>Sumber</Th>
                  <Th>User</Th>
                  <Th>Referensi</Th>
                  <Th>Catatan</Th>
                </tr>
              </Thead>
              <Tbody>
                {stockLogs.length === 0 ? (
                  <EmptyRow colSpan={7} message="Belum ada pergerakan stok" />
                ) : (
                  stockLogs.map((log) => {
                    const qty = Number(log.quantity);
                    return (
                      <Tr key={log.id}>
                        <Td className="text-gray-500">{formatDateTime(log.createdAt)}</Td>
                        <Td className={qty < 0 ? "font-semibold text-red-600" : "font-semibold text-emerald-600"}>
                          {signedQty(qty)} {material.unit}
                        </Td>
                        <Td>{STOCK_MOVEMENT_TYPE_LABEL[log.type] ?? log.type}</Td>
                        <Td>{stockMovementSourceLabel(log.source, log.userId)}</Td>
                        <Td>{log.user?.name ?? "System"}</Td>
                        <Td className="text-blue-600">{log.referenceCode ?? "-"}</Td>
                        <Td className="max-w-[220px] truncate text-xs text-gray-500">{log.note ?? "-"}</Td>
                      </Tr>
                    );
                  })
                )}
              </Tbody>
            </Table>
          </Card>
        </div>

        <Card className="p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Timeline</p>
          {auditLogs.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">Belum ada aktivitas</p>
          ) : (
            <ol className="space-y-3">
              {auditLogs.map((log) => {
                const newValue = log.newValue as {
                  adjustment?: number;
                  referenceCode?: string | null;
                  source?: string;
                  name?: string;
                } | null;
                let title = log.action.replaceAll("_", " ");
                if (log.action === "CREATE") {
                  title = `Material dibuat${newValue?.name ? ` · ${newValue.name}` : ""}`;
                } else if (typeof newValue?.adjustment === "number") {
                  const sourceLabel = STOCK_MOVEMENT_SOURCE_LABEL[newValue.source ?? ""] ?? "";
                  const ref = newValue.referenceCode ? ` · ${newValue.referenceCode}` : "";
                  title = `Stok ${signedQty(newValue.adjustment)}${ref}${sourceLabel ? ` · ${sourceLabel}` : ""}`;
                }
                return (
                  <li key={log.id} className="border-l-2 border-blue-200 pl-3">
                    <p className="text-[11px] text-gray-400">{formatDateTime(log.createdAt)}</p>
                    <p className="text-sm font-medium text-gray-800">{title}</p>
                    <p className="text-xs text-gray-400">{log.user?.name ?? "System"}</p>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>
      </div>
    </div>
  );
}
