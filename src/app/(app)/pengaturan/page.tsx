import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Table";
import { Field, Input, SubmitButton } from "@/components/ui/FormField";
import { updateCompanySettingsAction } from "./actions";
import { requireModule } from "@/lib/require-session";

export default async function PengaturanPage() {
  await requireModule("pengaturan");
  const settings = await prisma.companySettings.findFirst();

  return (
    <div>
      <PageHeader eyebrow="Sistem" title="Pengaturan Perusahaan" />

      <form action={updateCompanySettingsAction}>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card className="p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Profil &amp; Identitas</p>
            <div className="space-y-3">
              <Field label="Nama Perusahaan">
                <Input name="companyName" required defaultValue={settings?.companyName} />
              </Field>
              <Field label="Alamat">
                <Input name="address" defaultValue={settings?.address ?? ""} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Telepon">
                  <Input name="phone" defaultValue={settings?.phone ?? ""} />
                </Field>
                <Field label="Email">
                  <Input name="email" defaultValue={settings?.email ?? ""} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Website">
                  <Input name="website" defaultValue={settings?.website ?? ""} />
                </Field>
                <Field label="NPWP">
                  <Input name="taxId" defaultValue={settings?.taxId ?? ""} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nama Bank">
                  <Input name="bankName" defaultValue={settings?.bankName ?? ""} />
                </Field>
                <Field label="No. Rekening">
                  <Input name="bankAccountNo" defaultValue={settings?.bankAccountNo ?? ""} />
                </Field>
              </div>
              <Field label="Nama Pemilik Rekening">
                <Input name="bankAccountName" defaultValue={settings?.bankAccountName ?? ""} />
              </Field>
              <Field label="URL Logo">
                <Input name="logoUrl" defaultValue={settings?.logoUrl ?? ""} />
              </Field>
              <Field label="Email Tujuan Rekap Harian">
                <Input name="dailyRecapEmail" defaultValue={settings?.dailyRecapEmail ?? ""} />
              </Field>
            </div>
          </Card>

          <Card className="p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Format Penomoran Dokumen</p>
            <div className="grid grid-cols-2 gap-3">
              <PrefixField label="Quotation" name="quotationPrefix" example="QT-2026-00001" defaultValue={settings?.quotationPrefix ?? "QT"} />
              <PrefixField label="Sales Order" name="salesOrderPrefix" example="SO-2026-00001" defaultValue={settings?.salesOrderPrefix ?? "SO"} />
              <PrefixField label="Work Order" name="workOrderPrefix" example="WO-2026-00001" defaultValue={settings?.workOrderPrefix ?? "WO"} />
              <PrefixField label="Delivery Order" name="deliveryOrderPrefix" example="DO-2026-00001" defaultValue={settings?.deliveryOrderPrefix ?? "DO"} />
              <PrefixField label="Invoice" name="invoicePrefix" example="INV-2026-00001" defaultValue={settings?.invoicePrefix ?? "INV"} />
              <PrefixField label="Customer" name="customerPrefix" example="CUS-2026-00001" defaultValue={settings?.customerPrefix ?? "CUS"} />
              <PrefixField label="Lead" name="leadPrefix" example="LEAD-2026-00001" defaultValue={settings?.leadPrefix ?? "LEAD"} />
            </div>

            <div className="mt-5">
              <SubmitButton>Simpan</SubmitButton>
            </div>
          </Card>
        </div>
      </form>
    </div>
  );
}

function PrefixField({
  label,
  name,
  example,
  defaultValue,
}: {
  label: string;
  name: string;
  example: string;
  defaultValue: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-gray-500">{label}</label>
      <Input name={name} required defaultValue={defaultValue} />
      <p className="mt-1 text-[11px] text-gray-400">Contoh: {example}</p>
    </div>
  );
}
