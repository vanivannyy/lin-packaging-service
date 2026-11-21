"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { generateCode } from "@/lib/codegen";
import { logAudit } from "@/lib/audit";
import { notifyStatusChange } from "@/lib/notify";
import { requireModule } from "@/lib/require-session";
import { canApprovePurchaseRequest } from "@/lib/roles";
import { autoCreatePurchaseRequestsForAllLowStock } from "@/lib/purchase-auto";
import { formId } from "@/lib/form";

const prSchema = z.object({
  materialId: z.string().min(1, "Material wajib dipilih"),
  qty: z.coerce.number().positive(),
  supplierId: z.string().optional(),
  estimatedCost: z.coerce.number().min(0),
  neededDate: z.string().optional(),
  note: z.string().optional(),
});

export async function createPurchaseRequestAction(formData: FormData) {
  const session = await requireModule("purchase-request");
  const parsed = prSchema.parse({
    materialId: formData.get("materialId"),
    qty: formData.get("qty"),
    supplierId: formData.get("supplierId") || undefined,
    estimatedCost: formData.get("estimatedCost"),
    neededDate: formData.get("neededDate") || undefined,
    note: formData.get("note") || undefined,
  });

  // PR buatan GM/OWNER tidak perlu approval: langsung APPROVED (approver = pembuat).
  const autoApproved = canApprovePurchaseRequest(session.role);
  const prCode = await generateCode("purchaseRequest");
  const pr = await prisma.purchaseRequest.create({
    data: {
      ...parsed,
      neededDate: parsed.neededDate ? new Date(parsed.neededDate) : undefined,
      code: prCode,
      requestedById: session.userId,
      status: autoApproved ? "APPROVED" : "PENDING",
      approvedById: autoApproved ? session.userId : undefined,
    },
  });

  await logAudit({
    userId: session.userId,
    module: "purchasing",
    action: "CREATE",
    referenceCode: pr.code,
    newValue: { ...parsed, status: pr.status, autoApproved },
  });
  await notifyStatusChange({
    excludeUserId: session.userId,
    moduleKeys: ["purchase-request"],
    module: "purchase-request",
    type: autoApproved ? "STATUS" : "APPROVAL",
    href: "/purchase-request",
    referenceCode: pr.code,
    title: autoApproved ? "Purchase Request disetujui" : "Purchase Request menunggu approve",
    message: autoApproved
      ? `${session.name} membuat dan menyetujui ${pr.code}. Silakan terima barang setelah datang.`
      : `${session.name} membuat ${pr.code}. Silakan approve atau reject.`,
  });
  revalidatePath("/purchase-request");
}

export async function approvePurchaseRequestAction(formData: FormData) {
  const session = await requireModule("purchase-request");
  if (!canApprovePurchaseRequest(session.role)) {
    throw new Error("Hanya General Manager atau Owner yang bisa menyetujui Purchase Request.");
  }
  const purchaseRequestId = formId(formData, "purchaseRequestId");

  const pr = await prisma.purchaseRequest.findUniqueOrThrow({ where: { id: purchaseRequestId } });
  if (pr.status !== "PENDING") return;
  await prisma.purchaseRequest.update({
    where: { id: purchaseRequestId },
    data: { status: "APPROVED", approvedById: session.userId },
  });

  await logAudit({
    userId: session.userId,
    module: "purchasing",
    action: "APPROVE",
    referenceCode: pr.code,
    oldValue: { status: pr.status },
    newValue: { status: "APPROVED" },
  });
  await notifyStatusChange({
    excludeUserId: session.userId,
    moduleKeys: ["purchase-request", "material-stok"],
    extraUserIds: [pr.requestedById],
    module: "purchase-request",
    type: "STATUS",
    href: "/purchase-request",
    referenceCode: pr.code,
    title: "Purchase Request disetujui",
    message: `${session.name} menyetujui ${pr.code}. Silakan terima barang setelah datang.`,
  });
  revalidatePath("/purchase-request");
}

export async function rejectPurchaseRequestAction(formData: FormData) {
  const session = await requireModule("purchase-request");
  if (!canApprovePurchaseRequest(session.role)) {
    throw new Error("Hanya General Manager atau Owner yang bisa menolak Purchase Request.");
  }
  const purchaseRequestId = formId(formData, "purchaseRequestId");

  const pr = await prisma.purchaseRequest.findUniqueOrThrow({ where: { id: purchaseRequestId } });
  if (pr.status !== "PENDING") return;
  await prisma.purchaseRequest.update({
    where: { id: purchaseRequestId },
    data: { status: "REJECTED", approvedById: session.userId },
  });

  await logAudit({
    userId: session.userId,
    module: "purchasing",
    action: "REJECT",
    referenceCode: pr.code,
    oldValue: { status: pr.status },
    newValue: { status: "REJECTED" },
  });
  await notifyStatusChange({
    excludeUserId: session.userId,
    moduleKeys: ["purchase-request"],
    extraUserIds: [pr.requestedById],
    module: "purchase-request",
    type: "STATUS",
    href: "/purchase-request",
    referenceCode: pr.code,
    title: "Purchase Request ditolak",
    message: `${session.name} menolak ${pr.code}.`,
  });
  revalidatePath("/purchase-request");
}

export async function receivePurchaseRequestAction(formData: FormData) {
  const session = await requireModule("purchase-request");
  const purchaseRequestId = formId(formData, "purchaseRequestId");

  const pr = await prisma.purchaseRequest.findUniqueOrThrow({ where: { id: purchaseRequestId } });
  if (pr.status !== "APPROVED") return;

  await prisma.$transaction([
    prisma.purchaseRequest.update({ where: { id: purchaseRequestId }, data: { status: "RECEIVED" } }),
    prisma.material.update({
      where: { id: pr.materialId },
      data: { stockQty: { increment: pr.qty } },
    }),
    prisma.stockMovement.create({
      data: {
        materialId: pr.materialId,
        quantity: pr.qty,
        type: "PURCHASE_IN",
        referenceCode: pr.code,
        note: `Penerimaan barang dari PO ${pr.code}`,
        source: "WEB",
        userId: session.userId,
      },
    }),
  ]);

  await logAudit({
    userId: session.userId,
    module: "purchasing",
    action: "STATUS_CHANGE",
    referenceCode: pr.code,
    oldValue: { status: pr.status },
    newValue: { status: "RECEIVED" },
  });
  await notifyStatusChange({
    excludeUserId: session.userId,
    moduleKeys: ["purchase-request", "material-stok"],
    extraUserIds: [pr.requestedById],
    module: "purchase-request",
    type: "STATUS",
    href: "/material-stok",
    referenceCode: pr.code,
    title: "Barang Purchase Request diterima",
    message: `${session.name} menerima barang ${pr.code}. Stok material sudah diupdate.`,
  });
  revalidatePath("/purchase-request");
  revalidatePath("/material-stok", "layout");
}

// Pindai material yang stoknya sudah di bawah minimum dan buat PR otomatis bila belum ada.
// Dijalankan manual (tombol), bukan saat render halaman.
export async function scanLowStockAction() {
  await requireModule("purchase-request");
  await autoCreatePurchaseRequestsForAllLowStock();
  revalidatePath("/purchase-request");
}
