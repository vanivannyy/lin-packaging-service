import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { HppCalculatorForm } from "./HppCalculatorForm";
import { requireModule } from "@/lib/require-session";

export default async function KalkulatorHppPage() {
  await requireModule("kalkulator-hpp");
  const [customers, priceMasterItems] = await Promise.all([
    prisma.customer.findMany({
      where: { isDeleted: false, isActive: true },
      orderBy: { name: "asc" },
      include: {
        quotations: {
          where: { isDeleted: false },
          orderBy: { createdAt: "desc" },
          include: { product: true },
        },
      },
    }),
    prisma.priceMasterItem.findMany({
      where: { isDeleted: false, isActive: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    }),
  ]);

  return (
    <div>
      <PageHeader eyebrow="Pricing Engine" title="Kalkulator Harga Produksi Kemasan" />
      <p className="mb-4 -mt-3 text-xs text-gray-400">
        Optimasi potong plano, harga kertas, pond, laminating, foil, pelat &amp; tinta hingga Total Biaya Produksi dan
        Harga Modal per Potong.
      </p>
      <HppCalculatorForm
        customers={customers.map((c) => ({
          id: c.id,
          name: c.name,
          quotations: c.quotations.map((q) => ({
            id: q.id,
            code: q.code,
            productName: q.product?.name ?? q.productNote ?? "Produk",
            qty: q.qty,
            marginPercent: Number(q.marginPercent),
            createdAt: q.createdAt.toISOString(),
            materialSpec: (q.materialSpec as Record<string, unknown> | null) ?? null,
          })),
        }))}
        priceMasterItems={priceMasterItems.map((p) => ({
          id: p.id,
          category: p.category,
          name: p.name,
          unit: p.unit,
          price: Number(p.price),
        }))}
      />
    </div>
  );
}
