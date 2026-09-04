import { denyIfNoModule } from "@/lib/require-session";
import { generateBarcodePng } from "@/lib/barcode";

export async function GET(_req: Request, { params }: { params: Promise<{ sku: string }> }) {
  const denied = await denyIfNoModule("material-stok");
  if (denied) return denied;
  const { sku } = await params;

  try {
    const png = await generateBarcodePng(decodeURIComponent(sku));

    return new Response(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    return new Response(`Gagal membuat barcode: ${String(err)}`, { status: 400 });
  }
}
