"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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

function optionalText(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  return raw || undefined;
}

function parseProductForm(formData: FormData) {
  return productSchema.parse({
    name: formData.get("name"),
    category: formData.get("category"),
    categoryId: optionalText(formData.get("categoryId")),
    unit: formData.get("unit") || "PCS",
    defaultMaterialId: optionalText(formData.get("defaultMaterialId")),
    specification: optionalText(formData.get("specification")),
  });
}

function toProductData(parsed: z.infer<typeof productSchema>) {
  return {
    name: parsed.name,
    category: parsed.category,
    categoryId: parsed.categoryId ?? null,
    unit: parsed.unit,
    defaultMaterialId: parsed.defaultMaterialId ?? null,
    specification: parsed.specification ?? null,
  };
}

export async function createProductAction(formData: FormData) {
  const session = await requireModule("produk");
  const parsed = parseProductForm(formData);

  const code = await generateCode("product");
  const product = await prisma.product.create({ data: { ...toProductData(parsed), code } });

  await logAudit({ userId: session.userId, module: "product", action: "CREATE", referenceCode: product.code, newValue: parsed });
  revalidatePath("/produk");
}

export async function updateProductAction(formData: FormData) {
  const session = await requireModule("produk");
  if (session.role !== "OWNER") {
    redirect("/produk?error=" + encodeURIComponent("Hanya Owner yang bisa mengubah produk"));
  }

  const id = String(formData.get("productId") ?? "");
  const parsed = parseProductForm(formData);
  const code = z.string().trim().min(1, "Kode produk wajib diisi").parse(formData.get("code"));
  const isActive = formData.get("isActive") === "true";
  const product = await prisma.product.findFirst({ where: { id, isDeleted: false } });
  if (!product) {
    redirect("/produk?error=" + encodeURIComponent("Produk tidak ditemukan"));
  }

  const codeTaken = await prisma.product.findFirst({
    where: { code: { equals: code, mode: "insensitive" }, NOT: { id: product.id } },
  });
  if (codeTaken) {
    redirect("/produk?error=" + encodeURIComponent(`Kode ${code} sudah dipakai produk lain`));
  }

  const data = { ...toProductData(parsed), code, isActive };
  await prisma.$transaction(async (tx) => {
    await tx.product.update({ where: { id: product.id }, data });
    if (code.toUpperCase() !== product.code.toUpperCase()) {
      await tx.auditTrail.updateMany({
        where: { module: "product", referenceCode: { equals: product.code, mode: "insensitive" } },
        data: { referenceCode: code },
      });
    }
  });

  await logAudit({
    userId: session.userId,
    module: "product",
    action: "UPDATE",
    referenceCode: code,
    oldValue: {
      code: product.code,
      name: product.name,
      category: product.category,
      categoryId: product.categoryId,
      unit: product.unit,
      defaultMaterialId: product.defaultMaterialId,
      specification: product.specification,
      isActive: product.isActive,
    },
    newValue: data,
  });
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
