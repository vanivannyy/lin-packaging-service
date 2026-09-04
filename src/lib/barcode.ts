import bwipjs from "bwip-js/node";

export async function generateBarcodePng(text: string): Promise<Buffer> {
  return bwipjs.toBuffer({
    bcid: "code128",
    text,
    scale: 3,
    height: 12,
    includetext: true,
    textxalign: "center",
    textsize: 9,
  });
}

export async function generateBarcodeDataUrl(text: string): Promise<string> {
  const png = await generateBarcodePng(text);
  return `data:image/png;base64,${png.toString("base64")}`;
}
