import { requireMobileSession } from "@/lib/mobile-auth";
import { canAccessModule } from "@/lib/roles";
import { findDeliveryByCode } from "@/lib/mobile-delivery";

const NEXT_STAGE: Record<string, "IN_DELIVERY" | "DELIVERED" | null> = {
  READY: "IN_DELIVERY",
  IN_DELIVERY: "DELIVERED",
  PENDING: "IN_DELIVERY",
  DELIVERED: null,
};

export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const authResult = await requireMobileSession(req);
  if (authResult instanceof Response) return authResult;

  if (!canAccessModule(authResult.role, "delivery") && !canAccessModule(authResult.role, "sales-order")) {
    return Response.json({ error: "Akun ini tidak memiliki akses ke modul Delivery" }, { status: 403 });
  }

  const { code } = await params;
  const delivery = await findDeliveryByCode(decodeURIComponent(code));

  if (!delivery) {
    return Response.json({ error: `Pengiriman untuk kode ${code} tidak ditemukan` }, { status: 404 });
  }

  return Response.json({
    id: delivery.id,
    code: delivery.code,
    stage: delivery.stage,
    note: delivery.note,
    nextStage: NEXT_STAGE[delivery.stage],
    canAdvance: canAccessModule(authResult.role, "delivery") && NEXT_STAGE[delivery.stage] !== null,
    salesOrder: {
      code: delivery.salesOrder.code,
      customerName: delivery.salesOrder.customer.name,
      productName: delivery.salesOrder.product?.name ?? delivery.salesOrder.productNote ?? "-",
      qty: delivery.salesOrder.qty,
    },
  });
}
