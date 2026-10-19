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

export async function createMaterialAction(formData: FormData) {
  const session = await requireModule("material-stok");
  const parsed = materialSchema.parse({
    name: formData.get("name"),
    category: (formData.get("category") as MaterialCategory) || "PAPER",
    gsm: formData.get("gsm") || undefined,
    size: formData.get("size") || undefined,
    supplierId: formData.get("supplierId") || undefined,
    pricePerUnit: formData.get("pricePerUnit"),
    unit: formData.get("unit") || "LEMBAR",
    minStockQty: formData.get("minStockQty") || 0,
  });

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
