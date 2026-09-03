"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { generateCode } from "@/lib/codegen";
import { logAudit } from "@/lib/audit";
import { requireModule } from "@/lib/require-session";

const productSchema = z.object({
  name: z.string().min(2),
  category: z.string().min(1),
  categoryId: z.string().optional(),
  unit: z.string().min(1).default("PCS"),
  defaultMaterialId: z.string().optional(),
  specification: z.string().optional(),
});

export async function createProductAction(formData: FormData) {
  const session = await requireModule("produk");
  const parsed = productSchema.parse({
    name: formData.get("name"),
    category: formData.get("category"),
    categoryId: formData.get("categoryId") || undefined,
    unit: formData.get("unit") || "PCS",
    defaultMaterialId: formData.get("defaultMaterialId") || undefined,
    specification: formData.get("specification") || undefined,
  });

  const code = await generateCode("product");
  const product = await prisma.product.create({ data: { ...parsed, code } });

  await logAudit({ userId: session.userId, module: "product", action: "CREATE", referenceCode: product.code, newValue: parsed });
  revalidatePath("/produk");
}

export async function deleteProductAction(formData: FormData) {
  const session = await requireModule("produk");
  const id = formData.get("productId") as string;
  const product = await prisma.product.findUniqueOrThrow({ where: { id } });
  await prisma.product.update({ where: { id }, data: { isDeleted: true, isActive: false } });

  await logAudit({
    userId: session.userId,
    module: "product",
    action: "DELETE",
    referenceCode: product.code,
    oldValue: { isDeleted: product.isDeleted },
    newValue: { isDeleted: true },
  });
  revalidatePath("/produk");
}

export async function toggleProductActiveAction(formData: FormData) {
  const session = await requireModule("produk");
  const id = formData.get("productId") as string;
  const product = await prisma.product.findUniqueOrThrow({ where: { id } });
  await prisma.product.update({ where: { id }, data: { isActive: !product.isActive } });

  await logAudit({
    userId: session.userId,
    module: "product",
    action: "STATUS_CHANGE",
    referenceCode: product.code,
    oldValue: { isActive: product.isActive },
    newValue: { isActive: !product.isActive },
  });
  revalidatePath("/produk");
}
