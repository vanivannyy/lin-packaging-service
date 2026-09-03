"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { generateCode } from "@/lib/codegen";
import { logAudit } from "@/lib/audit";
import { notifyStatusChange } from "@/lib/notify";
import { requireModule } from "@/lib/require-session";
import type { LeadStage } from "@prisma/client";

const createLeadSchema = z.object({
  companyName: z.string().min(2, "Nama perusahaan wajib diisi"),
  productNote: z.string().optional(),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  estimatedValue: z.coerce.number().min(0).default(0),
});

export async function createLeadAction(formData: FormData) {
  const session = await requireModule("crm");
  const parsed = createLeadSchema.parse({
    companyName: formData.get("companyName"),
    productNote: formData.get("productNote") || undefined,
    contactName: formData.get("contactName") || undefined,
    contactPhone: formData.get("contactPhone") || undefined,
    estimatedValue: formData.get("estimatedValue") || 0,
  });

  const leadCode = await generateCode("lead");
  const lead = await prisma.lead.create({
    data: { ...parsed, code: leadCode, salesId: session.userId },
  });

  await logAudit({ userId: session.userId, module: "crm", action: "CREATE", referenceCode: lead.code, newValue: parsed });
  revalidatePath("/crm");
}

export async function advanceLeadStageAction(formData: FormData) {
  const session = await requireModule("crm");
  const leadId = formData.get("leadId") as string;
  const toStage = formData.get("toStage") as LeadStage;

  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
  await prisma.lead.update({ where: { id: leadId }, data: { stage: toStage } });

  await logAudit({
    userId: session.userId,
    module: "crm",
    action: "STATUS_CHANGE",
    referenceCode: lead.code,
    oldValue: { stage: lead.stage },
    newValue: { stage: toStage },
  });
  revalidatePath("/crm");
}

// Stage yang boleh dituju lewat drag-and-drop kanban sampai Negotiation & Lost.
// WON hanya boleh didapat lewat aksi "Convert to Customer" (convertLeadToCustomerAction).
const DRAGGABLE_STAGES: LeadStage[] = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "MEETING",
  "QUOTATION",
  "NEGOTIATION",
  "LOST",
];

export async function moveLeadStageAction(leadId: string, toStage: LeadStage) {
  const session = await requireModule("crm");
  if (!DRAGGABLE_STAGES.includes(toStage)) {
    throw new Error("Stage tujuan tidak valid untuk drag & drop. WON hanya bisa lewat aksi Convert to Customer.");
  }

  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
  if (lead.isDeleted || lead.stage === toStage) return;
  if (lead.stage === "WON") {
    throw new Error("Lead yang sudah WON tidak bisa dipindahkan lagi.");
  }

  await prisma.lead.update({ where: { id: leadId }, data: { stage: toStage } });

  await logAudit({
    userId: session.userId,
    module: "crm",
    action: "STATUS_CHANGE",
    referenceCode: lead.code,
    oldValue: { stage: lead.stage },
    newValue: { stage: toStage },
  });
  revalidatePath("/crm");
}

export async function markLeadLostAction(formData: FormData) {
  const session = await requireModule("crm");
  const leadId = formData.get("leadId") as string;
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });
  await prisma.lead.update({ where: { id: leadId }, data: { stage: "LOST" } });
  await logAudit({
    userId: session.userId,
    module: "crm",
    action: "STATUS_CHANGE",
    referenceCode: lead.code,
    oldValue: { stage: lead.stage },
    newValue: { stage: "LOST" },
  });
  revalidatePath("/crm");
}

export async function convertLeadToCustomerAction(formData: FormData) {
  const session = await requireModule("crm");
  const leadId = formData.get("leadId") as string;
  const lead = await prisma.lead.findUniqueOrThrow({ where: { id: leadId } });

  const existing = await prisma.customer.findUnique({ where: { leadId } });
  if (existing) {
    revalidatePath("/crm");
    return;
  }

  const customerCode = await generateCode("customer");
  const customer = await prisma.customer.create({
    data: {
      code: customerCode,
      name: lead.companyName,
      contactName: lead.contactName,
      contactPhone: lead.contactPhone,
      leadId: lead.id,
      salesId: lead.salesId ?? session.userId,
    },
  });

  await prisma.lead.update({ where: { id: leadId }, data: { stage: "WON" } });
  await logAudit({
    userId: session.userId,
    module: "crm",
    action: "CREATE",
    referenceCode: customer.code,
    newValue: { convertedFromLead: lead.code },
  });
  await notifyStatusChange({
    excludeUserId: session.userId,
    moduleKeys: ["crm"],
    extraUserIds: [lead.salesId],
    module: "crm",
    type: "STATUS",
    href: "/customer",
    referenceCode: customer.code,
    title: "Lead menang — customer baru",
    message: `${session.name} mengkonversi ${lead.code} menjadi ${customer.code}.`,
  });
  revalidatePath("/crm");
  revalidatePath("/customer");
}
