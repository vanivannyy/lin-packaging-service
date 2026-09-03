"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import type { DeliveryStage } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { notifyStatusChange } from "@/lib/notify";
import { requireModule } from "@/lib/require-session";

const DRAGGABLE_STAGES: DeliveryStage[] = ["READY", "IN_DELIVERY", "PENDING", "DELIVERED"];

export async function moveDeliveryStageAction(deliveryId: string, toStage: DeliveryStage, note?: string) {
  const session = await requireModule("delivery");
  if (!DRAGGABLE_STAGES.includes(toStage)) return;

  const delivery = await prisma.deliveryOrder.findUniqueOrThrow({
    where: { id: deliveryId },
    include: { salesOrder: true },
  });
  if (delivery.stage === toStage) return;
  if (delivery.stage === "DELIVERED") return;

  if (toStage === "PENDING" && !note?.trim() && !delivery.note?.trim()) {
    // Note wajib untuk stage pending - dicegah di sisi UI, tapi jaga-jaga di server.
    return;
  }

  await prisma.deliveryOrder.update({
    where: { id: deliveryId },
    data: {
      stage: toStage,
      note: toStage === "PENDING" ? (note?.trim() || delivery.note) : delivery.note,
      deliveredAt: toStage === "DELIVERED" ? new Date() : null,
    },
  });

  if (toStage === "DELIVERED") {
    await prisma.salesOrder.update({ where: { id: delivery.salesOrderId }, data: { status: "DELIVERED" } });
  }

  await logAudit({
    userId: session.userId,
    module: "delivery",
    action: "STATUS_CHANGE",
    referenceCode: delivery.code,
    oldValue: { stage: delivery.stage },
    newValue: { stage: toStage },
  });

  await notifyStatusChange({
    excludeUserId: session.userId,
    moduleKeys: ["delivery", "sales-order"],
    module: "delivery",
    type: "STATUS",
    href: `/delivery`,
    referenceCode: delivery.code,
    title: `Delivery ${delivery.code} → ${toStage.replaceAll("_", " ")}`,
    message: `${session.name} memindahkan pengiriman ${delivery.code} ke status ${toStage.replaceAll("_", " ")}.`,
  });

  revalidatePath("/delivery");
  revalidatePath("/sales-order");
}

const noteSchema = z.object({
  deliveryId: z.string().min(1),
  note: z.string().min(1, "Catatan wajib diisi untuk status Pending"),
});

export async function updateDeliveryNoteAction(formData: FormData) {
  const session = await requireModule("delivery");
  const parsed = noteSchema.parse({
    deliveryId: formData.get("deliveryId"),
    note: formData.get("note"),
  });

  const delivery = await prisma.deliveryOrder.update({
    where: { id: parsed.deliveryId },
    data: { note: parsed.note },
  });

  await logAudit({
    userId: session.userId,
    module: "delivery",
    action: "UPDATE",
    referenceCode: delivery.code,
    newValue: { note: parsed.note },
  });
  revalidatePath("/delivery");
}
