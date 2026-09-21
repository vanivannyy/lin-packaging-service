import { prisma } from "@/lib/prisma";
import { requireMobileSession } from "@/lib/mobile-auth";
import { canAccessModule } from "@/lib/roles";
import type { SalesOrderStatus } from "@prisma/client";

function toNum(v: unknown) {
  return v === null || v === undefined ? 0 : Number(v);
}

export async function GET(req: Request) {
  const authResult = await requireMobileSession(req);
  if (authResult instanceof Response) return authResult;

  const canView =
    canAccessModule(authResult.role, "sales-order") ||
    canAccessModule(authResult.role, "delivery") ||
    canAccessModule(authResult.role, "produksi");
  if (!canView) {
    return Response.json({ error: "Akun ini tidak memiliki akses ke modul Order" }, { status: 403 });
  }

  const url = new URL(req.url);
  const statusParam = url.searchParams.get("status") as SalesOrderStatus | null;
  const q = url.searchParams.get("q")?.trim();

  const salesOrders = await prisma.salesOrder.findMany({
    where: {
      isDeleted: false,
      ...(statusParam ? { status: statusParam } : { status: { not: "CANCELLED" } }),
      ...(q
        ? {
            OR: [
              { code: { contains: q, mode: "insensitive" } },
              { customer: { name: { contains: q, mode: "insensitive" } } },
            ],
          }
        : {}),
    },
    include: {
      customer: true,
      product: true,
      workOrder: true,
      deliveryOrder: true,
    },
    orderBy: { createdAt: "desc" },
    take: 40,
  });

  return Response.json({
    items: salesOrders.map((so) => ({
      id: so.id,
      code: so.code,
      customerName: so.customer.name,
      productName: so.product?.name ?? so.productNote ?? "-",
      qty: so.qty,
      totalAmount: toNum(so.totalAmount),
      status: so.status,
      requestedDeliveryDate: so.requestedDeliveryDate ? so.requestedDeliveryDate.toISOString() : null,
      workOrderStage: so.workOrder?.stage ?? null,
      deliveryStage: so.deliveryOrder?.stage ?? null,
    })),
  });
}
