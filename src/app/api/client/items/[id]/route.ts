import { prisma } from "@/lib/prisma";
import { requireClientSession } from "@/lib/client-auth";

function toNum(v: unknown): number {
  return v === null || v === undefined ? 0 : Number(v);
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireClientSession(req);
  if (session instanceof Response) return session;

  const { id } = await params;

  const item = await prisma.clientFinishedGoodsItem.findFirst({
    where: { id, customerId: session.customerId, isDeleted: false, isActive: true },
  });
  if (!item) {
    return Response.json({ error: "Item tidak ditemukan" }, { status: 404 });
  }

  const movements = await prisma.clientStockMovement.findMany({
    where: { itemId: item.id },
    orderBy: { createdAt: "desc" },
    take: 30,
    include: { actorUser: true, actorClientAccount: true },
  });

  const clientQty = toNum(item.clientWarehouseQty);
  const minQty = toNum(item.minStockQty);

  return Response.json({
    id: item.id,
    itemName: item.itemName,
    sku: item.sku,
    unit: item.unit,
    linWarehouseQty: toNum(item.linWarehouseQty),
    clientWarehouseQty: clientQty,
    minStockQty: minQty,
    isLow: clientQty <= minQty,
    clientReportedAt: item.clientReportedAt?.toISOString() ?? null,
    history: movements.map((m) => ({
      id: m.id,
      side: m.side,
      type: m.type,
      quantity: toNum(m.quantity),
      resultingQty: toNum(m.resultingQty),
      note: m.note,
      referenceCode: m.referenceCode,
      actorName: m.actorUser?.name ?? m.actorClientAccount?.name ?? null,
      createdAt: m.createdAt.toISOString(),
    })),
  });
}
