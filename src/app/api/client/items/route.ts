import { prisma } from "@/lib/prisma";
import { requireClientSession } from "@/lib/client-auth";

function toNum(v: unknown): number {
  return v === null || v === undefined ? 0 : Number(v);
}

export async function GET(req: Request) {
  const session = await requireClientSession(req);
  if (session instanceof Response) return session;

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim();

  const items = await prisma.clientFinishedGoodsItem.findMany({
    where: {
      customerId: session.customerId,
      isDeleted: false,
      isActive: true,
      ...(q ? { itemName: { contains: q, mode: "insensitive" } } : {}),
    },
    orderBy: { itemName: "asc" },
  });

  return Response.json({
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
  });
}
