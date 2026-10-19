import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireClientSession } from "@/lib/client-auth";
import { clientReportStock } from "@/lib/client-stock";

const reportSchema = z.object({
  qty: z.coerce.number().min(0, "Jumlah tidak boleh negatif"),
  note: z.string().max(500).optional(),
});

function toNum(v: unknown): number {
  return v === null || v === undefined ? 0 : Number(v);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireClientSession(req);
  if (session instanceof Response) return session;

  const { id } = await params;

  const item = await prisma.clientFinishedGoodsItem.findFirst({
    where: { id, customerId: session.customerId, isDeleted: false, isActive: true },
  });
  if (!item) {
    return Response.json({ error: "Item tidak ditemukan" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Body harus JSON" }, { status: 400 });
  }

  const parsed = reportSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Data tidak valid" }, { status: 422 });
  }

  const updated = await clientReportStock({
    itemId: item.id,
    newQty: parsed.data.qty,
    note: parsed.data.note,
    clientAccountId: session.clientAccountId,
  });

  const clientQty = toNum(updated.clientWarehouseQty);
  const minQty = toNum(updated.minStockQty);

  return Response.json({
    id: updated.id,
    itemName: updated.itemName,
    unit: updated.unit,
    linWarehouseQty: toNum(updated.linWarehouseQty),
    clientWarehouseQty: clientQty,
    minStockQty: minQty,
    isLow: clientQty <= minQty,
    clientReportedAt: updated.clientReportedAt?.toISOString() ?? null,
  });
}
