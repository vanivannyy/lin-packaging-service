"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { generateCode } from "@/lib/codegen";
import { logAudit } from "@/lib/audit";
import { requireModule } from "@/lib/require-session";

const categorySchema = z.object({
  name: z.string().min(2, "Nama kategori minimal 2 karakter"),
});

export async function createProductCategoryAction(formData: FormData) {
  const session = await requireModule("produk-kategori");
  const parsed = categorySchema.parse({ name: formData.get("name") });

  const code = await generateCode("productCategory");
  const category = await prisma.productCategory.create({ data: { ...parsed, code } });

  await logAudit({
    userId: session.userId,
    module: "product-category",
    action: "CREATE",
    referenceCode: category.code,
    newValue: parsed,
  });
  revalidatePath("/produk-kategori");
}

export async function updateProductCategoryAction(formData: FormData) {
  const session = await requireModule("produk-kategori");
  const id = formData.get("id") as string;
  const parsed = categorySchema.parse({ name: formData.get("name") });

  const category = await prisma.productCategory.update({ where: { id }, data: parsed });

  await logAudit({
    userId: session.userId,
    module: "product-category",
    action: "UPDATE",
    referenceCode: category.code,
    newValue: parsed,
  });
  revalidatePath("/produk-kategori");
}

export async function deleteProductCategoryAction(formData: FormData) {
  const session = await requireModule("produk-kategori");
  const id = formData.get("id") as string;
  const category = await prisma.productCategory.update({ where: { id }, data: { isDeleted: true } });

  await logAudit({
    userId: session.userId,
    module: "product-category",
    action: "DELETE",
    referenceCode: category.code,
    newValue: { isDeleted: true },
  });
  revalidatePath("/produk-kategori");
}
