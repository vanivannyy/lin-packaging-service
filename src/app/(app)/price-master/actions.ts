"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requireModule } from "@/lib/require-session";
import type { PriceMasterCategory } from "@prisma/client";

const priceSchema = z.object({
  category: z.enum(["PAPER", "FINISHING", "LABOR", "OUTSOURCING", "OVERHEAD"]),
  name: z.string().min(2),
  vendor: z.string().optional(),
  unit: z.string().min(1),
  minQty: z.coerce.number().min(0).default(0),
  price: z.coerce.number().min(0),
});

export async function createPriceMasterAction(formData: FormData) {
  const session = await requireModule("price-master");
  const parsed = priceSchema.parse({
    category: formData.get("category") as PriceMasterCategory,
    name: formData.get("name"),
    vendor: formData.get("vendor") || "Internal",
    unit: formData.get("unit"),
    minQty: formData.get("minQty") || 0,
    price: formData.get("price"),
  });

  const item = await prisma.priceMasterItem.create({ data: parsed });
  await logAudit({ userId: session.userId, module: "price-master", action: "CREATE", referenceCode: item.id, newValue: parsed });
  revalidatePath("/price-master");
}

export async function updatePriceMasterAction(formData: FormData) {
  const session = await requireModule("price-master");
  const id = formData.get("id") as string;
  const parsed = priceSchema.parse({
    category: formData.get("category") as PriceMasterCategory,
    name: formData.get("name"),
    vendor: formData.get("vendor") || "Internal",
    unit: formData.get("unit"),
    minQty: formData.get("minQty") || 0,
    price: formData.get("price"),
  });

  const before = await prisma.priceMasterItem.findUniqueOrThrow({ where: { id } });
  await prisma.priceMasterItem.update({ where: { id }, data: parsed });

  await logAudit({
    userId: session.userId,
    module: "price-master",
    action: "UPDATE",
    referenceCode: id,
    oldValue: { price: before.price.toString() },
    newValue: parsed,
  });
  revalidatePath("/price-master");
}

export async function toggleActivePriceMasterAction(formData: FormData) {
  const session = await requireModule("price-master");
  const id = formData.get("id") as string;
  const item = await prisma.priceMasterItem.findUniqueOrThrow({ where: { id } });
  await prisma.priceMasterItem.update({ where: { id }, data: { isActive: !item.isActive } });

  await logAudit({
    userId: session.userId,
    module: "price-master",
    action: "STATUS_CHANGE",
    referenceCode: id,
    oldValue: { isActive: item.isActive },
    newValue: { isActive: !item.isActive },
  });
  revalidatePath("/price-master");
}
