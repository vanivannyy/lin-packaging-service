"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { generateCode } from "@/lib/codegen";
import { logAudit } from "@/lib/audit";
import { requireModule } from "@/lib/require-session";
import { autoCreatePurchaseRequestIfNeeded } from "@/lib/purchase-auto";
import { adjustMaterialStock } from "@/lib/material-stock";
import type { MaterialCategory } from "@prisma/client";

const materialSchema = z.object({
  name: z.string().min(2, "Nama material wajib diisi"),
  category: z.enum(["PAPER", "FILM", "FOIL", "INK", "OTHER"]),
  gsm: z.coerce.number().optional(),
  size: z.string().optional(),
  supplierId: z.string().optional(),
  pricePerUnit: z.coerce.number().min(0),
  unit: z.string().min(1),
  minStockQty: z.coerce.number().min(0).default(0),
});

const materialEditSchema = materialSchema.extend({
  sku: z.string().trim().min(1, "SKU wajib diisi"),
  stockQty: z.coerce.number().min(0),
  reservedQty: z.coerce.number().min(0),
});

function optionalText(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  return raw || undefined;
}

function optionalNumber(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return undefined;
  return Number(raw);
}

function parseMaterialForm(formData: FormData) {
  return materialSchema.parse({
    name: formData.get("name"),
    category: (formData.get("category") as MaterialCategory) || "PAPER",
    gsm: optionalNumber(formData.get("gsm")),
    size: optionalText(formData.get("size")),
    supplierId: optionalText(formData.get("supplierId")),
    pricePerUnit: formData.get("pricePerUnit"),
    unit: formData.get("unit") || "LEMBAR",
    minStockQty: formData.get("minStockQty") || 0,
  });
}

export async function createMaterialAction(formData: FormData) {
  const session = await requireModule("material-stok");
  const parsed = parseMaterialForm(formData);

  const sku = await generateCode("material");
  const material = await prisma.material.create({ data: { ...parsed, sku } });

  await logAudit({ userId: session.userId, module: "material", action: "CREATE", referenceCode: material.sku, newValue: parsed });
  await autoCreatePurchaseRequestIfNeeded(material.id);
  revalidatePath("/material-stok", "layout");
  revalidatePath("/purchase-request");
}

const adjustSchema = z.object({
  materialId: z.string(),
  quantity: z.coerce.number(),
  note: z.string().optional(),
  referenceCode: z.string().optional(),
});

export async function adjustStockAction(formData: FormData) {
  const session = await requireModule("material-stok");
  const parsed = adjustSchema.parse({
    materialId: formData.get("materialId"),
    quantity: formData.get("quantity"),
    note: formData.get("note") || undefined,
    referenceCode: formData.get("referenceCode") || undefined,
  });

  await adjustMaterialStock({
    materialId: parsed.materialId,
    quantity: parsed.quantity,
    note: parsed.note,
    referenceCode: parsed.referenceCode,
    userId: session.userId,
    source: "WEB",
  });
}

export async function updateMaterialAction(formData: FormData) {
  const session = await requireModule("material-stok");
  if (session.role !== "OWNER") {
    redirect("/material-stok?error=" + encodeURIComponent("Hanya Owner yang bisa mengubah material"));
  }

  const id = String(formData.get("materialId") ?? "");
  const parsed = materialEditSchema.parse({
    ...parseMaterialForm(formData),
    sku: formData.get("sku"),
    stockQty: formData.get("stockQty"),
    reservedQty: formData.get("reservedQty"),
  });
  const material = await prisma.material.findFirst({ where: { id, isDeleted: false } });
  if (!material) {
    redirect("/material-stok?error=" + encodeURIComponent("Material tidak ditemukan"));
  }

  const sku = parsed.sku.trim();
  const skuTaken = await prisma.material.findFirst({
    where: { sku: { equals: sku, mode: "insensitive" }, NOT: { id: material.id } },
  });
  if (skuTaken) {
    redirect("/material-stok?error=" + encodeURIComponent(`SKU ${sku} sudah dipakai material lain`));
  }

  const previousStock = Number(material.stockQty);
  const stockDelta = parsed.stockQty - previousStock;
  const data = {
    sku,
    name: parsed.name,
    category: parsed.category,
    gsm: parsed.gsm ?? null,
    size: parsed.size ?? null,
    supplierId: parsed.supplierId ?? null,
    pricePerUnit: parsed.pricePerUnit,
    unit: parsed.unit,
    stockQty: parsed.stockQty,
    reservedQty: parsed.reservedQty,
    minStockQty: parsed.minStockQty,
  };

  await prisma.$transaction(async (tx) => {
    await tx.material.update({ where: { id: material.id }, data });
    if (Math.abs(stockDelta) > 0.0005) {
      await tx.stockMovement.create({
        data: {
          materialId: material.id,
          quantity: stockDelta,
          type: "ADJUSTMENT",
          note: `Koreksi stok dari edit material (${previousStock} → ${parsed.stockQty})`,
          source: "WEB",
          userId: session.userId,
        },
      });
    }
    if (sku.toUpperCase() !== material.sku.toUpperCase()) {
      await tx.auditTrail.updateMany({
        where: { module: "material", referenceCode: { equals: material.sku, mode: "insensitive" } },
        data: { referenceCode: sku },
      });
    }
  });

  await logAudit({
    userId: session.userId,
    module: "material",
    action: "UPDATE",
    referenceCode: sku,
    oldValue: {
      sku: material.sku,
      name: material.name,
      category: material.category,
      gsm: material.gsm,
      size: material.size,
      supplierId: material.supplierId,
      pricePerUnit: Number(material.pricePerUnit),
      unit: material.unit,
      stockQty: previousStock,
      reservedQty: Number(material.reservedQty),
      minStockQty: Number(material.minStockQty),
    },
    newValue: data,
  });
  await autoCreatePurchaseRequestIfNeeded(material.id);

  revalidatePath("/material-stok", "layout");
  revalidatePath(`/material-stok/${material.id}`);
  revalidatePath("/purchase-request");
}

export async function deleteMaterialAction(formData: FormData) {
  const session = await requireModule("material-stok");
  if (session.role !== "OWNER") {
    redirect("/material-stok?error=" + encodeURIComponent("Hanya Owner yang bisa menghapus material"));
  }

  const id = String(formData.get("materialId") ?? "");
  const material = await prisma.material.findFirst({ where: { id, isDeleted: false } });
  if (!material) {
    redirect("/material-stok?error=" + encodeURIComponent("Material tidak ditemukan"));
  }

  const pendingRequests = await prisma.purchaseRequest.findMany({
    where: { materialId: material.id, isDeleted: false, status: "PENDING" },
    select: { id: true, note: true },
  });

  await prisma.$transaction([
    prisma.material.update({ where: { id: material.id }, data: { isDeleted: true } }),
    ...pendingRequests.map((request) =>
      prisma.purchaseRequest.update({
        where: { id: request.id },
        data: {
          status: "REJECTED",
          note: [request.note, "Dibatalkan karena material dihapus."].filter(Boolean).join(" "),
        },
      }),
    ),
  ]);

  await logAudit({
    userId: session.userId,
    module: "material",
    action: "DELETE",
    referenceCode: material.sku,
    oldValue: { isDeleted: false, name: material.name },
    newValue: { isDeleted: true },
  });

  revalidatePath("/material-stok", "layout");
  revalidatePath("/purchase-request");
  redirect("/material-stok?ok=deleted");
}
