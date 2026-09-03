"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requireModule } from "@/lib/require-session";

const settingsSchema = z.object({
  companyName: z.string().min(2),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  website: z.string().optional(),
  taxId: z.string().optional(),
  bankName: z.string().optional(),
  bankAccountNo: z.string().optional(),
  bankAccountName: z.string().optional(),
  logoUrl: z.string().optional(),
  dailyRecapEmail: z.string().optional(),
  quotationPrefix: z.string().min(1),
  salesOrderPrefix: z.string().min(1),
  workOrderPrefix: z.string().min(1),
  deliveryOrderPrefix: z.string().min(1),
  invoicePrefix: z.string().min(1),
  customerPrefix: z.string().min(1),
  leadPrefix: z.string().min(1),
});

export async function updateCompanySettingsAction(formData: FormData) {
  const session = await requireModule("pengaturan");
  const parsed = settingsSchema.parse(Object.fromEntries(formData.entries()));

  const existing = await prisma.companySettings.findFirst();
  if (existing) {
    await prisma.companySettings.update({ where: { id: existing.id }, data: parsed });
  } else {
    await prisma.companySettings.create({ data: parsed });
  }

  await logAudit({ userId: session.userId, module: "settings", action: "UPDATE", newValue: parsed });
  revalidatePath("/pengaturan");
}
