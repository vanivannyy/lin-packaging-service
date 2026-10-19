"use server";

import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { requireModule } from "@/lib/require-session";
import { adminAdjustLinStock, adminAdjustClientStock } from "@/lib/client-stock";
import { notifyClientAccounts } from "@/lib/client-notify";

const accountSchema = z.object({
  customerId: z.string().min(1, "Customer wajib dipilih"),
  name: z.string().min(2, "Nama PIC wajib diisi"),
  email: z.string().email("Email tidak valid"),
  phone: z.string().optional(),
  password: z.string().min(6, "Password minimal 6 karakter"),
});

export async function createClientAccountAction(formData: FormData) {
  const session = await requireModule("client-stock");
  const parsed = accountSchema.parse({
    customerId: formData.get("customerId"),
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") || undefined,
    password: formData.get("password"),
  });

  const passwordHash = await bcrypt.hash(parsed.password, 10);
  const customer = await prisma.customer.findUniqueOrThrow({ where: { id: parsed.customerId } });

  const account = await prisma.clientAccount.create({
    data: {
      customerId: parsed.customerId,
      name: parsed.name,
      email: parsed.email,
      phone: parsed.phone || null,
      passwordHash,
    },
  });

  await logAudit({
    userId: session.userId,
    module: "client-stock",
    action: "CREATE",
    referenceCode: customer.code,
    newValue: { accountId: account.id, email: account.email, customerName: customer.name },
  });
  revalidatePath("/stok-klien");
  revalidatePath("/dashboard");
}

const resetPasswordSchema = z.object({
  clientAccountId: z.string().min(1),
  password: z.string().min(6, "Password minimal 6 karakter"),
});

export async function resetClientAccountPasswordAction(formData: FormData) {
  const session = await requireModule("client-stock");
  const parsed = resetPasswordSchema.parse({
    clientAccountId: formData.get("clientAccountId"),
    password: formData.get("password"),
  });

  const passwordHash = await bcrypt.hash(parsed.password, 10);
  const account = await prisma.clientAccount.update({
    where: { id: parsed.clientAccountId },
    data: { passwordHash },
  });

  await logAudit({
    userId: session.userId,
    module: "client-stock",
    action: "UPDATE",
    referenceCode: account.email,
    newValue: { event: "RESET_PASSWORD" },
  });
  revalidatePath("/stok-klien");
  revalidatePath("/dashboard");
}

export async function toggleClientAccountActiveAction(formData: FormData) {
  const session = await requireModule("client-stock");
  const clientAccountId = formData.get("clientAccountId") as string;
  const account = await prisma.clientAccount.findUniqueOrThrow({ where: { id: clientAccountId } });
  const updated = await prisma.clientAccount.update({
    where: { id: clientAccountId },
    data: { isActive: !account.isActive },
  });

  await logAudit({
    userId: session.userId,
    module: "client-stock",
    action: "STATUS_CHANGE",
    referenceCode: account.email,
    oldValue: { isActive: account.isActive },
    newValue: { isActive: updated.isActive },
  });
  revalidatePath("/stok-klien");
  revalidatePath("/dashboard");
}

const itemSchema = z.object({
  customerId: z.string().min(1, "Customer wajib dipilih"),
  productId: z.string().optional(),
  itemName: z.string().min(1, "Nama barang wajib diisi"),
  sku: z.string().optional(),
  unit: z.string().min(1).default("PCS"),
  minStockQty: z.coerce.number().min(0).default(0),
});

export async function createClientItemAction(formData: FormData) {
  const session = await requireModule("client-stock");
  const parsed = itemSchema.parse({
    customerId: formData.get("customerId"),
    productId: formData.get("productId") || undefined,
    itemName: formData.get("itemName"),
    sku: formData.get("sku") || undefined,
    unit: formData.get("unit") || "PCS",
    minStockQty: formData.get("minStockQty") || 0,
  });

  const item = await prisma.clientFinishedGoodsItem.create({
    data: {
      customerId: parsed.customerId,
      productId: parsed.productId || null,
      itemName: parsed.itemName,
      sku: parsed.sku || null,
      unit: parsed.unit,
      minStockQty: parsed.minStockQty,
    },
  });

  await logAudit({
    userId: session.userId,
    module: "client-stock",
    action: "CREATE",
    referenceCode: item.sku ?? item.itemName,
    newValue: parsed,
  });
  await notifyClientAccounts({
    customerId: parsed.customerId,
    title: `Barang baru: ${item.itemName}`,
    message: `${item.itemName} ditambahkan ke daftar stok Anda dan sudah bisa dipantau di app.`,
    href: `/items/${item.id}`,
  });
  revalidatePath("/stok-klien");
  revalidatePath("/dashboard");
}

const updateItemSchema = z.object({
  itemId: z.string().min(1),
  itemName: z.string().min(1, "Nama barang wajib diisi"),
  sku: z.string().optional(),
  unit: z.string().min(1),
  minStockQty: z.coerce.number().min(0),
});

export async function updateClientItemAction(formData: FormData) {
  const session = await requireModule("client-stock");
  const parsed = updateItemSchema.parse({
    itemId: formData.get("itemId"),
    itemName: formData.get("itemName"),
    sku: formData.get("sku") || undefined,
    unit: formData.get("unit"),
    minStockQty: formData.get("minStockQty"),
  });

  const before = await prisma.clientFinishedGoodsItem.findUniqueOrThrow({ where: { id: parsed.itemId } });
  await prisma.clientFinishedGoodsItem.update({
    where: { id: parsed.itemId },
    data: {
      itemName: parsed.itemName,
      sku: parsed.sku || null,
      unit: parsed.unit,
      minStockQty: parsed.minStockQty,
    },
  });

  await logAudit({
    userId: session.userId,
    module: "client-stock",
    action: "UPDATE",
    referenceCode: before.sku ?? before.itemName,
    oldValue: { itemName: before.itemName, minStockQty: before.minStockQty.toString() },
    newValue: parsed,
  });
  revalidatePath("/stok-klien");
  revalidatePath("/dashboard");
}

export async function toggleClientItemActiveAction(formData: FormData) {
  const session = await requireModule("client-stock");
  const itemId = formData.get("itemId") as string;
  const item = await prisma.clientFinishedGoodsItem.findUniqueOrThrow({ where: { id: itemId } });
  const updated = await prisma.clientFinishedGoodsItem.update({
    where: { id: itemId },
    data: { isActive: !item.isActive },
  });

  await logAudit({
    userId: session.userId,
    module: "client-stock",
    action: "STATUS_CHANGE",
    referenceCode: item.itemName,
    oldValue: { isActive: item.isActive },
    newValue: { isActive: updated.isActive },
  });
  revalidatePath("/stok-klien");
  revalidatePath("/dashboard");
}

const adjustSchema = z.object({
  itemId: z.string().min(1),
  newQty: z.coerce.number().min(0, "Jumlah tidak boleh negatif"),
  note: z.string().optional(),
});

export async function adjustLinStockAction(formData: FormData) {
  const session = await requireModule("client-stock");
  const parsed = adjustSchema.parse({
    itemId: formData.get("itemId"),
    newQty: formData.get("newQty"),
    note: formData.get("note") || undefined,
  });

  await adminAdjustLinStock({
    itemId: parsed.itemId,
    newQty: parsed.newQty,
    note: parsed.note,
    userId: session.userId,
  });

  revalidatePath("/stok-klien");
  revalidatePath("/dashboard");
}

export async function adjustClientStockAction(formData: FormData) {
  const session = await requireModule("client-stock");
  const parsed = adjustSchema.parse({
    itemId: formData.get("itemId"),
    newQty: formData.get("newQty"),
    note: formData.get("note") || undefined,
  });

  const item = await prisma.clientFinishedGoodsItem.findUniqueOrThrow({ where: { id: parsed.itemId } });
  await adminAdjustClientStock({
    itemId: parsed.itemId,
    newQty: parsed.newQty,
    note: parsed.note,
    userId: session.userId,
  });

  // Beritahu klien lewat app mobile mereka juga, biar transparan - koreksi
  // stok gudang mereka dilakukan oleh admin Lin Packaging.
  await notifyClientAccounts({
    customerId: item.customerId,
    title: `Stok ${item.itemName} dikoreksi admin`,
    message: `Stok gudang Anda untuk ${item.itemName} diperbarui menjadi ${parsed.newQty} ${item.unit} oleh admin Lin Packaging.`,
    href: `/items/${item.id}`,
  });

  revalidatePath("/stok-klien");
  revalidatePath("/dashboard");
}
