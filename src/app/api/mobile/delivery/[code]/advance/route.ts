import { prisma } from "@/lib/prisma";
import { requireMobileSession } from "@/lib/mobile-auth";
import { canAccessModule } from "@/lib/roles";
import { logAudit } from "@/lib/audit";
import { notifyStatusChange } from "@/lib/notify";
import { findDeliveryByCode } from "@/lib/mobile-delivery";
import type { DeliveryStage } from "@prisma/client";

const NEXT_STAGE: Record<DeliveryStage, DeliveryStage | null> = {
  READY: "IN_DELIVERY",
  IN_DELIVERY: "DELIVERED",
  PENDING: "IN_DELIVERY",
  DELIVERED: null,
};

// Mirip moveDeliveryStageAction di web (papan kanban), tapi hanya maju linear —
// dipakai untuk "Scan Kirim" di mobile, tanpa opsi Pending (butuh catatan wajib).
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const authResult = await requireMobileSession(req);
  if (authResult instanceof Response) return authResult;

  if (!canAccessModule(authResult.role, "delivery")) {
    return Response.json({ error: "Akun ini tidak memiliki akses ke modul Delivery" }, { status: 403 });
  }

  const { code } = await params;
  const delivery = await findDeliveryByCode(decodeURIComponent(code));

  if (!delivery) {
    return Response.json({ error: `Pengiriman untuk kode ${code} tidak ditemukan` }, { status: 404 });
  }

  const toStage = NEXT_STAGE[delivery.stage];
  if (!toStage) {
    return Response.json({ error: "Pengiriman ini sudah sampai tujuan (Delivered)" }, { status: 400 });
  }

  await prisma.deliveryOrder.update({
    where: { id: delivery.id },
    data: {
      stage: toStage,
      deliveredAt: toStage === "DELIVERED" ? new Date() : null,
    },
  });

  if (toStage === "DELIVERED") {
    await prisma.salesOrder.update({ where: { id: delivery.salesOrderId }, data: { status: "DELIVERED" } });
  }

  await logAudit({
    userId: authResult.userId,
    module: "delivery",
    action: "STATUS_CHANGE",
    referenceCode: delivery.code,
    oldValue: { stage: delivery.stage },
    newValue: { stage: toStage },
  });

  await notifyStatusChange({
    excludeUserId: authResult.userId,
    moduleKeys: ["delivery", "sales-order"],
    module: "delivery",
    type: "STATUS",
    href: "/delivery",
    referenceCode: delivery.code,
    title: `Delivery ${delivery.code} → ${toStage.replaceAll("_", " ")}`,
    message: `${authResult.name} memindahkan pengiriman ${delivery.code} ke status ${toStage.replaceAll("_", " ")} lewat scan mobile.`,
  });

  return Response.json({
    id: delivery.id,
    code: delivery.code,
    stage: toStage,
    nextStage: NEXT_STAGE[toStage],
  });
}
