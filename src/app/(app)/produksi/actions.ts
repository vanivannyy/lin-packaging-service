"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { notifyStatusChange } from "@/lib/notify";
import { requireModule } from "@/lib/require-session";
import { saveUploadedFile } from "@/lib/upload";
import { ensureDeliveryOrderForSalesOrder } from "@/lib/delivery";
import { z } from "zod";
import type { WorkOrderProcess, WorkOrderStage } from "@prisma/client";

// Urutan langkah produksi papan kanban: setiap klik "Proses" memajukan satu langkah.
const STEPS: { stage: WorkOrderStage; process: WorkOrderProcess; progress: number }[] = [
  { stage: "WAITING", process: "PREPRESS", progress: 0 },
  { stage: "READY", process: "PREPRESS", progress: 0 },
  { stage: "IN_PRODUCTION", process: "PREPRESS", progress: 10 },
  { stage: "IN_PRODUCTION", process: "MATERIAL", progress: 25 },
  { stage: "IN_PRODUCTION", process: "PRINTING", progress: 45 },
  { stage: "IN_PRODUCTION", process: "FINISHING", progress: 65 },
  { stage: "IN_PRODUCTION", process: "POND", progress: 80 },
  { stage: "IN_PRODUCTION", process: "PACKING", progress: 92 },
  { stage: "QC", process: "QC", progress: 100 },
];

function findStepIndex(stage: WorkOrderStage, process: WorkOrderProcess) {
  const idx = STEPS.findIndex((s) => s.stage === stage && s.process === process);
  return idx === -1 ? 0 : idx;
}

// Prepress harus selesai upload SS design & step-nya DONE sebelum WO boleh masuk In Production.
async function assertPrepressReady(workOrderId: string) {
  const wo = await prisma.workOrder.findUniqueOrThrow({ where: { id: workOrderId } });
  if (!wo.prepressDesignUrl) {
    throw new Error("Prepress harus upload screenshot design terlebih dahulu sebelum masuk produksi.");
  }
  if (wo.isInRevision) {
    throw new Error("Prepress masih dalam status revisi. Selesaikan revisi terlebih dahulu.");
  }
  const prepressStep = await prisma.workOrderStepProgress.findUnique({
    where: { workOrderId_process: { workOrderId, process: "PREPRESS" } },
  });
  if (prepressStep?.status !== "DONE") {
    throw new Error("Tahap Prepress harus ditandai Selesai terlebih dahulu sebelum masuk produksi.");
  }
}

export async function advanceWorkOrderAction(formData: FormData) {
  const session = await requireModule("produksi");
  const parsed = z.object({ workOrderId: z.string().min(1) }).safeParse({
    workOrderId: formData.get("workOrderId"),
  });
  if (!parsed.success) return;
  const { workOrderId } = parsed.data;

  const wo = await prisma.workOrder.findUniqueOrThrow({ where: { id: workOrderId } });
  if (wo.isDeleted || wo.stage === "DONE") return;

  const next =
    wo.stage === "REWORK"
      ? { stage: "QC" as const, process: "QC" as const, progress: 100 }
      : STEPS[Math.min(findStepIndex(wo.stage, wo.process) + 1, STEPS.length - 1)];

  if (next.stage === "IN_PRODUCTION" && wo.stage !== "IN_PRODUCTION") {
    try {
      await assertPrepressReady(workOrderId);
    } catch {
      // Tombol dinonaktifkan di UI saat prepress belum siap; no-op sebagai pengaman tambahan.
      return;
    }
  }

  await prisma.workOrder.update({
    where: { id: workOrderId },
    data: {
      stage: next.stage,
      process: next.process,
      progressPercent: next.progress,
      startedAt: wo.startedAt ?? (next.stage === "IN_PRODUCTION" ? new Date() : null),
      qcPassed: next.stage === "QC" ? null : wo.qcPassed,
    },
  });

  await logAudit({
    userId: session.userId,
    module: "production",
    action: next.stage === "QC" ? "QC" : "START",
    referenceCode: wo.code,
    oldValue: { process: wo.process, stage: wo.stage },
    newValue: { process: next.process, stage: next.stage },
  });
  if (next.stage === "QC" && wo.stage !== "QC") {
    await notifyStatusChange({
      excludeUserId: session.userId,
      moduleKeys: ["produksi"],
      module: "produksi",
      type: "APPROVAL",
      href: "/produksi",
      referenceCode: wo.code,
      title: "Work Order masuk QC",
      message: `${session.name} mengirim ${wo.code} ke QC. Silakan pass atau reject.`,
    });
  }
  revalidatePath("/produksi");
  revalidatePath("/dashboard");
}

// Default proses & progress saat kartu dipindah langsung via drag-and-drop antar kolom kanban.
// PACKING tidak termasuk (harus lewat tombol "Ke Packing" setelah lulus QC).
const STAGE_DRAG_DEFAULTS: Record<Exclude<WorkOrderStage, "PACKING">, { process: WorkOrderProcess; progress: number }> = {
  WAITING: { process: "PREPRESS", progress: 0 },
  READY: { process: "PREPRESS", progress: 0 },
  IN_PRODUCTION: { process: "PREPRESS", progress: 10 },
  QC: { process: "QC", progress: 100 },
  REWORK: { process: "REWORK", progress: 70 },
  DONE: { process: "COMPLETED", progress: 100 },
};

const DRAGGABLE_STAGES = z.enum(["WAITING", "READY", "IN_PRODUCTION", "QC", "REWORK", "DONE"]);

export async function moveWorkOrderStageAction(workOrderId: string, toStage: WorkOrderStage) {
  const session = await requireModule("produksi");
  const parsed = DRAGGABLE_STAGES.safeParse(toStage);
  if (!parsed.success) {
    throw new Error("Kolom Packing hanya bisa dicapai lewat tombol 'Ke Packing' setelah lulus QC.");
  }

  const wo = await prisma.workOrder.findUniqueOrThrow({ where: { id: workOrderId } });
  if (wo.isDeleted || wo.stage === toStage) return;

  if (toStage === "IN_PRODUCTION") {
    await assertPrepressReady(workOrderId);
  }

  const defaults = STAGE_DRAG_DEFAULTS[parsed.data as Exclude<WorkOrderStage, "PACKING">];

  await prisma.workOrder.update({
    where: { id: workOrderId },
    data: {
      stage: toStage,
      process: defaults.process,
      progressPercent: defaults.progress,
      startedAt: wo.startedAt ?? (toStage === "IN_PRODUCTION" || toStage === "REWORK" ? new Date() : wo.startedAt),
      qcPassed: toStage === "QC" ? null : toStage === "DONE" ? true : toStage === "REWORK" ? false : wo.qcPassed,
      completedAt: toStage === "DONE" ? new Date() : null,
    },
  });

  if (toStage === "DONE") {
    await ensureDeliveryOrderForSalesOrder(wo.salesOrderId);
  }

  await logAudit({
    userId: session.userId,
    module: "production",
    action: toStage === "DONE" ? "COMPLETE" : "STATUS_CHANGE",
    referenceCode: wo.code,
    oldValue: { stage: wo.stage, process: wo.process },
    newValue: { stage: toStage, process: defaults.process },
  });
  if (toStage === "QC") {
    await notifyStatusChange({
      excludeUserId: session.userId,
      moduleKeys: ["produksi"],
      module: "produksi",
      type: "APPROVAL",
      href: "/produksi",
      referenceCode: wo.code,
      title: "Work Order masuk QC",
      message: `${session.name} memindahkan ${wo.code} ke QC. Silakan pass atau reject.`,
    });
  } else if (toStage === "REWORK") {
    await notifyStatusChange({
      excludeUserId: session.userId,
      moduleKeys: ["produksi"],
      module: "produksi",
      type: "STATUS",
      href: "/produksi",
      referenceCode: wo.code,
      title: "Work Order masuk Rework",
      message: `${session.name} memindahkan ${wo.code} ke Rework.`,
    });
  } else if (toStage === "DONE") {
    await notifyStatusChange({
      excludeUserId: session.userId,
      moduleKeys: ["sales-order", "delivery"],
      module: "produksi",
      type: "STATUS",
      href: "/delivery",
      referenceCode: wo.code,
      title: "Work Order completed",
      message: `${session.name} menandai ${wo.code} sebagai Completed. Siap diproses di papan Delivery.`,
    });
  }
  revalidatePath("/produksi");
  revalidatePath("/dashboard");
  revalidatePath("/delivery");
  revalidatePath("/sales-order");
}

// ============================================================
// PREPRESS - upload screenshot design & revisi
// ============================================================

export async function uploadPrepressDesignAction(formData: FormData) {
  const session = await requireModule("produksi");
  const workOrderId = formData.get("workOrderId") as string;
  const file = formData.get("file");
  if (!workOrderId || !(file instanceof File) || file.size === 0) return;

  const wo = await prisma.workOrder.findUniqueOrThrow({ where: { id: workOrderId } });
  if (wo.isDeleted) return;

  const url = await saveUploadedFile(file, "prepress");

  await prisma.workOrder.update({
    where: { id: workOrderId },
    data: { prepressDesignUrl: url, prepressDesignUploadedAt: new Date() },
  });

  await logAudit({
    userId: session.userId,
    module: "production",
    action: "UPDATE",
    referenceCode: wo.code,
    newValue: { prepressDesignUrl: url },
  });
  revalidatePath("/produksi");
}

// Tombol "Revisi" hanya muncul setelah tahap Prepress ditandai Done - membuka lagi
// tahap tsb (kartu berubah kuning) sampai desain baru diupload & ditandai Done lagi.
export async function requestPrepressRevisionAction(formData: FormData) {
  const session = await requireModule("produksi");
  const workOrderId = formData.get("workOrderId") as string;
  const note = (formData.get("note") as string | null)?.trim() || null;
  if (!workOrderId) return;

  const wo = await prisma.workOrder.findUniqueOrThrow({ where: { id: workOrderId } });
  if (wo.isDeleted) return;

  const prepressStep = await prisma.workOrderStepProgress.findUnique({
    where: { workOrderId_process: { workOrderId, process: "PREPRESS" } },
  });
  if (prepressStep?.status !== "DONE") return;

  await prisma.$transaction([
    prisma.workOrderStepProgress.update({
      where: { id: prepressStep.id },
      data: { status: "IN_PROGRESS", completedAt: null },
    }),
    prisma.workOrder.update({
      where: { id: workOrderId },
      data: { isInRevision: true, revisionCount: { increment: 1 }, revisionNote: note },
    }),
  ]);

  await logAudit({
    userId: session.userId,
    module: "production",
    action: "UPDATE",
    referenceCode: wo.code,
    newValue: { revisi: true, note },
  });
  await notifyStatusChange({
    excludeUserId: session.userId,
    moduleKeys: ["produksi"],
    module: "produksi",
    type: "STATUS",
    href: "/produksi",
    referenceCode: wo.code,
    title: "Prepress diminta revisi",
    message: `${session.name} meminta revisi design pada ${wo.code}.${note ? ` Catatan: ${note}` : ""}`,
  });
  revalidatePath("/produksi");
}

// ============================================================
// DETAIL WORK ORDER MODAL - proses per langkah, log produksi, checklist QC
// ============================================================

const DETAIL_STEP_PROCESS = z.enum(["PREPRESS", "MATERIAL", "PRINTING", "LAMINATING", "FINISHING", "QC", "PACKING"]);

// Klik "Mulai" memajukan status langkah: WAITING -> IN_PROGRESS -> DONE.
export async function startWorkOrderStepAction(formData: FormData) {
  const session = await requireModule("produksi");
  const parsed = z
    .object({ workOrderId: z.string().min(1), process: DETAIL_STEP_PROCESS })
    .safeParse({ workOrderId: formData.get("workOrderId"), process: formData.get("process") });
  if (!parsed.success) return;
  const { workOrderId, process } = parsed.data;

  const wo = await prisma.workOrder.findUniqueOrThrow({ where: { id: workOrderId } });
  if (wo.isDeleted) return;

  const existing = await prisma.workOrderStepProgress.findUnique({
    where: { workOrderId_process: { workOrderId, process } },
  });
  if (existing?.status === "DONE") return;

  const nextStatus = existing?.status === "IN_PROGRESS" ? "DONE" : "IN_PROGRESS";

  // Prepress tidak boleh ditandai Done sebelum screenshot design diupload.
  if (process === "PREPRESS" && nextStatus === "DONE" && !wo.prepressDesignUrl) {
    throw new Error("Upload screenshot design terlebih dahulu sebelum menandai Prepress selesai.");
  }

  const now = new Date();

  await prisma.$transaction([
    prisma.workOrderStepProgress.upsert({
      where: { workOrderId_process: { workOrderId, process } },
      create: { workOrderId, process, status: nextStatus, startedAt: now, completedAt: nextStatus === "DONE" ? now : null },
      update: { status: nextStatus, startedAt: existing?.startedAt ?? now, completedAt: nextStatus === "DONE" ? now : null },
    }),
    ...(process === "PREPRESS" && nextStatus === "DONE"
      ? [prisma.workOrder.update({ where: { id: workOrderId }, data: { isInRevision: false } })]
      : []),
  ]);

  await logAudit({
    userId: session.userId,
    module: "production",
    action: nextStatus === "DONE" ? "COMPLETE" : "START",
    referenceCode: wo.code,
    newValue: { process, status: nextStatus },
  });

  revalidatePath("/produksi");
}

// Submit qty good/reject/downtime/catatan dari modal detail -> tercatat di log produksi + akumulasi total WO.
export async function submitProductionLogAction(formData: FormData) {
  const session = await requireModule("produksi");
  const parsed = z
    .object({
      workOrderId: z.string().min(1),
      goodQty: z.coerce.number().int().min(0).default(0),
      rejectQty: z.coerce.number().int().min(0).default(0),
      downtimeMinutes: z.coerce.number().int().min(0).default(0),
      note: z.string().trim().max(1000).optional(),
    })
    .safeParse({
      workOrderId: formData.get("workOrderId"),
      goodQty: formData.get("goodQty") || 0,
      rejectQty: formData.get("rejectQty") || 0,
      downtimeMinutes: formData.get("downtimeMinutes") || 0,
      note: formData.get("note") || undefined,
    });
  if (!parsed.success) return;
  const { workOrderId, goodQty, rejectQty, downtimeMinutes, note } = parsed.data;
  if (goodQty === 0 && rejectQty === 0 && downtimeMinutes === 0 && !note) return;

  const wo = await prisma.workOrder.findUniqueOrThrow({ where: { id: workOrderId } });
  if (wo.isDeleted) return;

  const activeStep = await prisma.workOrderStepProgress.findFirst({
    where: { workOrderId, status: "IN_PROGRESS" },
    orderBy: { startedAt: "desc" },
  });

  await prisma.$transaction([
    prisma.workOrderProductionLog.create({
      data: {
        workOrderId,
        process: activeStep?.process,
        goodQty,
        rejectQty,
        downtimeMinutes,
        note: note || null,
        userId: session.userId,
      },
    }),
    prisma.workOrder.update({
      where: { id: workOrderId },
      data: { goodQtyTotal: { increment: goodQty }, rejectQtyTotal: { increment: rejectQty } },
    }),
    ...(activeStep
      ? [
          prisma.workOrderStepProgress.update({
            where: { id: activeStep.id },
            data: { goodQty: { increment: goodQty }, rejectQty: { increment: rejectQty } },
          }),
        ]
      : []),
  ]);

  await logAudit({
    userId: session.userId,
    module: "production",
    action: "UPDATE",
    referenceCode: wo.code,
    newValue: { process: activeStep?.process, goodQty, rejectQty, downtimeMinutes, note },
  });

  revalidatePath("/produksi");
}

// Checklist QC (mis. "QC Printing" / "QC Finishing") - dicatat sebagai riwayat inspeksi, tidak menimpa data lama.
export async function submitQcCheckAction(formData: FormData) {
  const session = await requireModule("produksi");
  const parsed = z
    .object({
      workOrderId: z.string().min(1),
      checkType: z.enum(["PRINTING", "FINISHING"]),
      passed: z.enum(["true", "false"]),
      note: z.string().trim().max(1000).optional(),
    })
    .safeParse({
      workOrderId: formData.get("workOrderId"),
      checkType: formData.get("checkType"),
      passed: formData.get("passed"),
      note: formData.get("note") || undefined,
    });
  if (!parsed.success) return;
  const { workOrderId, checkType, passed, note } = parsed.data;

  const wo = await prisma.workOrder.findUniqueOrThrow({ where: { id: workOrderId } });
  if (wo.isDeleted) return;

  await prisma.workOrderQcCheck.create({
    data: { workOrderId, checkType, passed: passed === "true", note: note || null, userId: session.userId },
  });

  await logAudit({
    userId: session.userId,
    module: "production",
    action: passed === "true" ? "APPROVE" : "REJECT",
    referenceCode: wo.code,
    newValue: { checkType, passed: passed === "true", note },
  });

  revalidatePath("/produksi");
}

// QC utama papan produksi: Lulus -> status "Lolos" (tetap di kolom QC, tunggu diklik Packing).
// Reject -> langsung pindah ke Rework (kartu merah).
export async function qcResultAction(formData: FormData) {
  const session = await requireModule("produksi");
  const parsed = z
    .object({
      workOrderId: z.string().min(1),
      passed: z.boolean(),
      rejectRatePercent: z.number().min(0).max(100),
    })
    .safeParse({
      workOrderId: formData.get("workOrderId"),
      passed: formData.get("passed") === "true",
      rejectRatePercent:
        formData.get("passed") === "true" ? 0 : Math.min(100, Math.max(0, Number(formData.get("rejectRatePercent")) || 0)),
    });
  if (!parsed.success) return;
  const { workOrderId, passed, rejectRatePercent } = parsed.data;

  const wo = await prisma.workOrder.findUniqueOrThrow({ where: { id: workOrderId } });

  await prisma.workOrder.update({
    where: { id: workOrderId },
    data: passed
      ? { qcPassed: true, rejectRatePercent: 0 }
      : {
          qcPassed: false,
          stage: "REWORK",
          process: "REWORK",
          progressPercent: 70,
          completedAt: null,
          rejectRatePercent,
        },
  });

  await logAudit({
    userId: session.userId,
    module: "production",
    action: passed ? "APPROVE" : "REJECT",
    referenceCode: wo.code,
    newValue: { qcPassed: passed, rejectRatePercent },
  });
  if (passed) {
    await notifyStatusChange({
      excludeUserId: session.userId,
      moduleKeys: ["produksi"],
      module: "produksi",
      type: "STATUS",
      href: "/produksi",
      referenceCode: wo.code,
      title: "QC lulus",
      message: `${session.name} menyatakan ${wo.code} Lolos QC. Silakan proses ke Packing.`,
    });
  } else {
    await notifyStatusChange({
      excludeUserId: session.userId,
      moduleKeys: ["produksi"],
      module: "produksi",
      type: "STATUS",
      href: "/produksi",
      referenceCode: wo.code,
      title: "QC ditolak — masuk Rework",
      message: `${session.name} menolak QC ${wo.code} (reject ${rejectRatePercent}%). Work order dipindahkan ke Rework.`,
    });
  }
  revalidatePath("/produksi");
  revalidatePath("/dashboard");
}

// Diklik manual setelah QC Lolos - baru WO masuk tab Packing.
export async function moveToPackingAction(formData: FormData) {
  const session = await requireModule("produksi");
  const workOrderId = formData.get("workOrderId") as string;
  if (!workOrderId) return;

  const wo = await prisma.workOrder.findUniqueOrThrow({ where: { id: workOrderId } });
  if (wo.isDeleted || wo.stage !== "QC" || wo.qcPassed !== true) return;

  await prisma.workOrder.update({
    where: { id: workOrderId },
    data: { stage: "PACKING", process: "PACKING", progressPercent: 96 },
  });

  await logAudit({
    userId: session.userId,
    module: "production",
    action: "STATUS_CHANGE",
    referenceCode: wo.code,
    oldValue: { stage: "QC" },
    newValue: { stage: "PACKING" },
  });
  revalidatePath("/produksi");
}

// Packing selesai -> WO Completed (hijau) + Sales Order siap kirim + kartu baru di papan Delivery.
export async function completePackingAction(formData: FormData) {
  const session = await requireModule("produksi");
  const workOrderId = formData.get("workOrderId") as string;
  if (!workOrderId) return;

  const wo = await prisma.workOrder.findUniqueOrThrow({ where: { id: workOrderId } });
  if (wo.isDeleted || wo.stage !== "PACKING") return;

  await prisma.workOrder.update({
    where: { id: workOrderId },
    data: { stage: "DONE", process: "COMPLETED", progressPercent: 100, completedAt: new Date() },
  });

  const deliveryOrder = await ensureDeliveryOrderForSalesOrder(wo.salesOrderId);

  await logAudit({
    userId: session.userId,
    module: "production",
    action: "COMPLETE",
    referenceCode: wo.code,
    newValue: { stage: "DONE" },
  });
  await notifyStatusChange({
    excludeUserId: session.userId,
    moduleKeys: ["sales-order", "delivery"],
    module: "produksi",
    type: "STATUS",
    href: "/delivery",
    referenceCode: deliveryOrder.code,
    title: "Packing selesai — siap dikirim",
    message: `${session.name} menyelesaikan packing ${wo.code}. Kartu ${deliveryOrder.code} sudah tersedia di papan Delivery.`,
  });
  revalidatePath("/produksi");
  revalidatePath("/dashboard");
  revalidatePath("/delivery");
  revalidatePath("/sales-order");
}
