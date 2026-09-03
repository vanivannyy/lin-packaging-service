import { z } from "zod";
import { requireMobileSession } from "@/lib/mobile-auth";
import { adjustMaterialStock } from "@/lib/material-stock";

const adjustSchema = z.object({
  quantity: z.number().refine((n) => n !== 0, "Jumlah tidak boleh 0"),
  note: z.string().optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireMobileSession(req);
  if (authResult instanceof Response) return authResult;

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Body harus JSON" }, { status: 400 });
  }

  const parsed = adjustSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Data tidak valid" }, { status: 422 });
  }

  try {
    const material = await adjustMaterialStock({
      materialId: id,
      quantity: parsed.data.quantity,
      note: parsed.data.note,
      userId: authResult.userId,
    });

    const available = Number(material.stockQty) - Number(material.reservedQty);
    return Response.json({
      id: material.id,
      sku: material.sku,
      name: material.name,
      category: material.category,
      unit: material.unit,
      stockQty: Number(material.stockQty),
      reservedQty: Number(material.reservedQty),
      available,
      minStockQty: Number(material.minStockQty),
      isLow: available <= Number(material.minStockQty),
    });
  } catch {
    return Response.json({ error: "Material tidak ditemukan" }, { status: 404 });
  }
}
