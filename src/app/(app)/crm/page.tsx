import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { Modal } from "@/components/ui/Modal";
import { Field, Input, SubmitButton } from "@/components/ui/FormField";
import { createLeadAction } from "./actions";
import { LeadKanbanBoard } from "./LeadKanbanBoard";
import { requireModule } from "@/lib/require-session";

export default async function CrmPage() {
  await requireModule("crm");
  const leads = await prisma.lead.findMany({
    where: { isDeleted: false },
    include: { sales: true, customer: true },
    orderBy: { createdAt: "desc" },
  });

  const cards = leads.map((l) => ({
    id: l.id,
    code: l.code,
    companyName: l.companyName,
    productNote: l.productNote,
    estimatedValue: Number(l.estimatedValue),
    stage: l.stage,
    salesName: l.sales?.name ?? null,
    createdAt: l.createdAt.toISOString(),
    hasCustomer: !!l.customer,
  }));

  return (
    <div>
      <PageHeader
        eyebrow="Leads"
        title="CRM Pipeline"
        actions={
          <Modal
            title="Tambah Lead Baru"
            trigger={
              <button className="flex items-center gap-1.5 rounded-md bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-700">
                <Plus size={15} /> Lead Baru
              </button>
            }
          >
            <form action={createLeadAction} className="space-y-3">
              <Field label="Nama Perusahaan">
                <Input name="companyName" required placeholder="PT Contoh Sejahtera" />
              </Field>
              <Field label="Kebutuhan Produk">
                <Input name="productNote" placeholder="Paper Bag Kraft" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Nama Kontak">
                  <Input name="contactName" placeholder="Ibu Ratna" />
                </Field>
                <Field label="No. Telepon">
                  <Input name="contactPhone" placeholder="021-xxxxxxx" />
                </Field>
              </div>
              <Field label="Estimasi Nilai (Rp)">
                <Input name="estimatedValue" type="number" min={0} step={100000} placeholder="50000000" />
              </Field>
              <SubmitButton>Simpan Lead</SubmitButton>
            </form>
          </Modal>
        }
      />

      <p className="mb-3 -mt-3 text-xs text-gray-400">Geser (drag) kartu lead antar kolom untuk memindahkan stage.</p>

      <LeadKanbanBoard leads={cards} />
    </div>
  );
}
