import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireModule } from "@/lib/require-session";
import { MATERIAL_CATEGORY_LABEL } from "@/lib/labels";
import { PrintButton } from "@/app/invoice/[id]/PrintButton";

export default async function MaterialBarcodePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ qty?: string }>;
}) {
  await requireModule("material-stok");
  const { id } = await params;
  const { qty } = await searchParams;
  const copies = Math.min(Math.max(Number(qty) || 1, 1), 60);

  const [material, settings] = await Promise.all([
    prisma.material.findUnique({ where: { id } }),
    prisma.companySettings.findFirst(),
  ]);

  if (!material || material.isDeleted) notFound();

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 text-sm text-gray-800">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3 print:hidden">
        <div>
          <p className="text-lg font-bold text-gray-900">Label Barcode Material</p>
          <p className="text-xs text-gray-500">
            {material.sku} - {material.name}
          </p>
        </div>
        <form method="GET" className="flex items-end gap-2">
          <label className="text-xs text-gray-500">
            Jumlah Label
            <input
              type="number"
              name="qty"
              min={1}
              max={60}
              defaultValue={copies}
              className="mt-1 block w-20 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
          </label>
          <button
            type="submit"
            className="rounded-md border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-gray-50"
          >
            Terapkan
          </button>
        </form>
      </div>

      <div className="grid grid-cols-3 gap-3 print:grid-cols-3">
        {Array.from({ length: copies }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col items-center break-inside-avoid rounded-md border border-gray-300 p-3 text-center"
          >
            <p className="line-clamp-2 text-xs font-semibold text-gray-900">{material.name}</p>
            <p className="text-[10px] text-gray-400">
              {MATERIAL_CATEGORY_LABEL[material.category]}
              {material.size ? ` · ${material.size}` : ""}
              {material.gsm ? ` · ${material.gsm}gsm` : ""}
            </p>
            <img src={`/api/barcode/${material.sku}`} alt={material.sku} className="my-1.5 h-14" />
            <p className="font-mono text-xs text-gray-700">{material.sku}</p>
            {settings?.companyName ? <p className="text-[9px] text-gray-400">{settings.companyName}</p> : null}
          </div>
        ))}
      </div>

      <div className="mt-8 print:hidden">
        <PrintButton />
      </div>
    </div>
  );
}
