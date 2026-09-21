import { prisma } from "@/lib/prisma";
import { requireMobileSession } from "@/lib/mobile-auth";
import { canAccessModule } from "@/lib/roles";

function toNum(v: unknown) {
  return v === null || v === undefined ? 0 : Number(v);
}

export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const authResult = await requireMobileSession(req);
  if (authResult instanceof Response) return authResult;

  const canView =
    canAccessModule(authResult.role, "sales-order") ||
    canAccessModule(authResult.role, "delivery") ||
    canAccessModule(authResult.role, "produksi");
  if (!canView) {
    return Response.json({ error: "Akun ini tidak memiliki akses ke modul Order" }, { status: 403 });
  }

  const { code } = await params;
  const soCode = decodeURIComponent(code).trim().toUpperCase();

  const salesOrder = await prisma.salesOrder.findFirst({
    where: { code: { equals: soCode, mode: "insensitive" }, isDeleted: false },
    include: {
      customer: true,
      product: true,
      workOrder: true,
      deliveryOrder: true,
      invoice: true,
    },
  });

  if (!salesOrder) {
    return Response.json({ error: `Sales Order ${soCode} tidak ditemukan` }, { status: 404 });
  }

  return Response.json({
    id: salesOrder.id,
    code: salesOrder.code,
    date: salesOrder.date.toISOString(),
    customer: { name: salesOrder.customer.name, phone: salesOrder.customer.contactPhone },
    productName: salesOrder.product?.name ?? salesOrder.productNote ?? "-",
    qty: salesOrder.qty,
    totalAmount: toNum(salesOrder.totalAmount),
    status: salesOrder.status,
    requestedDeliveryDate: salesOrder.requestedDeliveryDate ? salesOrder.requestedDeliveryDate.toISOString() : null,
    deliveredAt: salesOrder.deliveredAt ? salesOrder.deliveredAt.toISOString() : null,
    workOrder: salesOrder.workOrder
      ? {
          code: salesOrder.workOrder.code,
          stage: salesOrder.workOrder.stage,
          process: salesOrder.workOrder.process,
          progressPercent: salesOrder.workOrder.progressPercent,
          qcPassed: salesOrder.workOrder.qcPassed,
        }
      : null,
    deliveryOrder: salesOrder.deliveryOrder
      ? { code: salesOrder.deliveryOrder.code, stage: salesOrder.deliveryOrder.stage, note: salesOrder.deliveryOrder.note }
      : null,
    invoice: salesOrder.invoice
      ? {
          code: salesOrder.invoice.code,
          status: salesOrder.invoice.status,
          dueDate: salesOrder.invoice.dueDate ? salesOrder.invoice.dueDate.toISOString() : null,
        }
      : null,
  });
}
