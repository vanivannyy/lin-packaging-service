import { prisma } from "@/lib/prisma";
import { requireMobileSession } from "@/lib/mobile-auth";
import { canAccessModule } from "@/lib/roles";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireMobileSession(req);
  if (authResult instanceof Response) return authResult;

  if (!canAccessModule(authResult.role, "material-stok")) {
    return Response.json(
      { error: "Akun ini tidak memiliki akses ke modul Material & Stok" },
      { status: 403 },
    );
  }

  const { id } = await params;
  const sku = decodeURIComponent(id);

  const material = await prisma.material.findFirst({
    where: { sku, isDeleted: false },
    include: { supplier: true },
  });

  if (!material) {
    return Response.json({ error: "Material tidak ditemukan" }, { status: 404 });
  }

  const available = Number(material.stockQty) - Number(material.reservedQty);
  const isLow = available <= Number(material.minStockQty);

  return Response.json({
    id: material.id,
    sku: material.sku,
    name: material.name,
    category: material.category,
    gsm: material.gsm,
    size: material.size,
    unit: material.unit,
    stockQty: Number(material.stockQty),
    reservedQty: Number(material.reservedQty),
    available,
    minStockQty: Number(material.minStockQty),
    pricePerUnit: Number(material.pricePerUnit),
    isLow,
    supplier: material.supplier ? { id: material.supplier.id, name: material.supplier.name } : null,
  });
}
