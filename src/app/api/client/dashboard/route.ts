import { prisma } from "@/lib/prisma";
import { requireClientSession } from "@/lib/client-auth";

function toNum(v: unknown): number {
  return v === null || v === undefined ? 0 : Number(v);
}

export async function GET(req: Request) {
  const session = await requireClientSession(req);
  if (session instanceof Response) return session;

  const items = await prisma.clientFinishedGoodsItem.findMany({
    where: { customerId: session.customerId, isDeleted: false, isActive: true },
    orderBy: { itemName: "asc" },
  });

  const recentMovements = await prisma.clientStockMovement.findMany({
    where: { item: { customerId: session.customerId } },
    orderBy: { createdAt: "desc" },
    take: 8,
    include: { item: true },
  });

  const lowClientStockItems = items.filter((it) => toNum(it.clientWarehouseQty) <= toNum(it.minStockQty));
  const lowLinStockItems = items.filter((it) => toNum(it.linWarehouseQty) <= toNum(it.minStockQty) && toNum(it.minStockQty) > 0);

  const totalLinWarehouseQty = items.reduce((sum, it) => sum + toNum(it.linWarehouseQty), 0);
  const totalClientWarehouseQty = items.reduce((sum, it) => sum + toNum(it.clientWarehouseQty), 0);

  return Response.json({
    customerName: session.customerName,
    totalItems: items.length,
    totalLinWarehouseQty,
    totalClientWarehouseQty,
    lowClientStockCount: lowClientStockItems.length,
    lowLinStockCount: lowLinStockItems.length,
    lowStockItems: lowClientStockItems.slice(0, 5).map((it) => ({
      id: it.id,
      itemName: it.itemName,
      unit: it.unit,
      clientWarehouseQty: toNum(it.clientWarehouseQty),
      minStockQty: toNum(it.minStockQty),
    })),
    items: items.map((it) => {
      const clientQty = toNum(it.clientWarehouseQty);
      const minQty = toNum(it.minStockQty);
      return {
        id: it.id,
        itemName: it.itemName,
        sku: it.sku,
        unit: it.unit,
        linWarehouseQty: toNum(it.linWarehouseQty),
        clientWarehouseQty: clientQty,
        minStockQty: minQty,
        isLow: clientQty <= minQty,
        clientReportedAt: it.clientReportedAt?.toISOString() ?? null,
      };
    }),
    recentMovements: recentMovements.map((m) => ({
      id: m.id,
      itemName: m.item.itemName,
      side: m.side,
      type: m.type,
      quantity: toNum(m.quantity),
      resultingQty: toNum(m.resultingQty),
      unit: m.item.unit,
      note: m.note,
      createdAt: m.createdAt.toISOString(),
    })),
  });
}
