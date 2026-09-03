import bwipjs from "bwip-js/node";
import { denyIfNoModule } from "@/lib/require-session";

export async function GET(_req: Request, { params }: { params: Promise<{ sku: string }> }) {
  const denied = await denyIfNoModule("material-stok");
  if (denied) return denied;
  const { sku } = await params;

  try {
    const png = await bwipjs.toBuffer({
      bcid: "code128",
      text: decodeURIComponent(sku),
      scale: 3,
      height: 12,
      includetext: true,
      textxalign: "center",
      textsize: 9,
    });

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
