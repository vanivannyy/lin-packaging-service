"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { generateCode } from "@/lib/codegen";
import { logAudit } from "@/lib/audit";
import { requireModule } from "@/lib/require-session";
import type { CustomerTerm } from "@prisma/client";

const customerSchema = z.object({
  name: z.string().min(2, "Nama perusahaan wajib diisi"),
  industry: z.string().optional(),
  npwp: z.string().max(32).optional().or(z.literal("")),
  address: z.string().max(500).optional().or(z.literal("")),
  contactName: z.string().optional(),
  contactPhone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  term: z.enum(["CBD", "NET_15", "NET_30", "NET_45", "NET_60"]),
  creditLimit: z.coerce.number().min(0).default(0),
});

function toCustomerData(parsed: z.infer<typeof customerSchema>) {
  return {
    ...parsed,
    email: parsed.email || null,
    npwp: parsed.npwp || null,
    address: parsed.address || null,
  };
}

export async function createCustomerAction(formData: FormData) {
  const session = await requireModule("customer");
  const parsed = customerSchema.parse({
    name: formData.get("name"),
    industry: formData.get("industry") || undefined,
    npwp: formData.get("npwp") || "",
    address: formData.get("address") || "",
    contactName: formData.get("contactName") || undefined,
    contactPhone: formData.get("contactPhone") || undefined,
    email: formData.get("email") || "",
    term: (formData.get("term") as CustomerTerm) || "NET_30",
    creditLimit: formData.get("creditLimit") || 0,
  });

  const customerCode = await generateCode("customer");
  const customer = await prisma.customer.create({
    data: { ...toCustomerData(parsed), code: customerCode, salesId: session.userId },
  });

  await logAudit({ userId: session.userId, module: "customer", action: "CREATE", referenceCode: customer.code, newValue: parsed });
  revalidatePath("/customer");
}

export async function updateCustomerAction(formData: FormData) {
  const session = await requireModule("customer");
  const customerId = formData.get("customerId") as string;
  const parsed = customerSchema.parse({
    name: formData.get("name"),
    industry: formData.get("industry") || undefined,
    npwp: formData.get("npwp") || "",
    address: formData.get("address") || "",
    contactName: formData.get("contactName") || undefined,
    contactPhone: formData.get("contactPhone") || undefined,
    email: formData.get("email") || "",
    term: (formData.get("term") as CustomerTerm) || "NET_30",
    creditLimit: formData.get("creditLimit") || 0,
  });

  const before = await prisma.customer.findUniqueOrThrow({ where: { id: customerId } });
  await prisma.customer.update({
    where: { id: customerId },
    data: toCustomerData(parsed),
  });

  await logAudit({
    userId: session.userId,
    module: "customer",
    action: "UPDATE",
    referenceCode: before.code,
    oldValue: { name: before.name, creditLimit: before.creditLimit.toString() },
    newValue: parsed,
  });
  revalidatePath("/customer");
}

export async function toggleCustomerActiveAction(formData: FormData) {
  const session = await requireModule("customer");
  const customerId = formData.get("customerId") as string;
  const customer = await prisma.customer.findUniqueOrThrow({ where: { id: customerId } });
  const updated = await prisma.customer.update({
    where: { id: customerId },
    data: { isActive: !customer.isActive },
  });

  await logAudit({
    userId: session.userId,
    module: "customer",
    action: "STATUS_CHANGE",
    referenceCode: customer.code,
    oldValue: { isActive: customer.isActive },
    newValue: { isActive: updated.isActive },
  });
  revalidatePath("/customer");
}
