import { ringkasKomposisi, type Layout } from "@/lib/hpp-engine";

export type CuttingLayoutSpec = {
  panjangPlano?: unknown;
  lebarPlano?: unknown;
  panjangPotong?: unknown;
  lebarPotong?: unknown;
  marginKiri?: unknown;
  marginKanan?: unknown;
  marginAtas?: unknown;
  marginBawah?: unknown;
  gap?: unknown;
};

function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

export function parseCuttingLayoutInput(spec: CuttingLayoutSpec | null | undefined) {
  if (!spec) return null;
  const panjangPlano = asNumber(spec.panjangPlano);
  const lebarPlano = asNumber(spec.lebarPlano);
  const panjangPotong = asNumber(spec.panjangPotong);
  const lebarPotong = asNumber(spec.lebarPotong);
  if (panjangPlano <= 0 || lebarPlano <= 0 || panjangPotong <= 0 || lebarPotong <= 0) return null;

  return {
    panjangPlano,
    lebarPlano,
    panjangPotong,
    lebarPotong,
    marginKiri: asNumber(spec.marginKiri),
    marginKanan: asNumber(spec.marginKanan),
    marginAtas: asNumber(spec.marginAtas),
    marginBawah: asNumber(spec.marginBawah),
    gap: asNumber(spec.gap),
  };
}

export type CuttingLayoutDrawData = {
  panjangPlano: number;
  lebarPlano: number;
  panjangEfektif: number;
  lebarEfektif: number;
  marginKiri: number;
  marginAtas: number;
  gap: number;
  terbaik: Layout;
};

export function drawCuttingLayout(canvas: HTMLCanvasElement | null, data: CuttingLayoutDrawData) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const padding = 55;
  const scaleX = (canvas.width - padding * 2) / data.panjangPlano;
  const scaleY = (canvas.height - padding * 2) / data.lebarPlano;
  const scale = Math.min(scaleX, scaleY);

  const planoX = padding;
  const planoY = padding;
  const planoW = data.panjangPlano * scale;
  const planoH = data.lebarPlano * scale;

  const efektifX = planoX + data.marginKiri * scale;
  const efektifY = planoY + data.marginAtas * scale;
  const efektifW = data.panjangEfektif * scale;
  const efektifH = data.lebarEfektif * scale;

  ctx.fillStyle = "#f3f4f6";
  ctx.fillRect(planoX, planoY, planoW, planoH);

  ctx.strokeStyle = "#111827";
  ctx.lineWidth = 2;
  ctx.strokeRect(planoX, planoY, planoW, planoH);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(efektifX, efektifY, efektifW, efektifH);

  ctx.strokeStyle = "#2563eb";
  ctx.lineWidth = 2;
  ctx.strokeRect(efektifX, efektifY, efektifW, efektifH);

  data.terbaik.blocks.forEach((block) => {
    if (block.count <= 0) return;

    const blockBaseX = efektifX + block.x * scale;
    const blockBaseY = efektifY + block.y * scale;

    const itemW = block.w * scale;
    const itemH = block.h * scale;
    const gap = data.gap * scale;

    for (let row = 0; row < block.rows; row++) {
      for (let col = 0; col < block.cols; col++) {
        const x = blockBaseX + col * (itemW + gap);
        const y = blockBaseY + row * (itemH + gap);

        if (block.orientation === "Horizontal") {
          ctx.fillStyle = "#dbeafe";
          ctx.strokeStyle = "#1d4ed8";
        } else {
          ctx.fillStyle = "#dcfce7";
          ctx.strokeStyle = "#15803d";
        }

        ctx.fillRect(x, y, itemW, itemH);
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, itemW, itemH);

        ctx.fillStyle = "#111827";
        ctx.font = "11px Arial";
        ctx.fillText(block.orientation === "Horizontal" ? "H" : "V", x + 5, y + 14);
      }
    }

    ctx.fillStyle = "#374151";
    ctx.font = "12px Arial";
    ctx.fillText(`${block.label} - ${block.orientation}`, blockBaseX, blockBaseY - 5);
  });

  ctx.fillStyle = "#111827";
  ctx.font = "14px Arial";
  ctx.fillText("Plano Utuh", planoX, planoY - 16);

  ctx.fillStyle = "#2563eb";
  ctx.font = "13px Arial";
  ctx.fillText("Area Efektif Setelah Margin", efektifX, efektifY - 8);

  ctx.fillStyle = "#111827";
  ctx.font = "13px Arial";
  ctx.fillText(
    `Total ${data.terbaik.totalPotong} potong | ${ringkasKomposisi(data.terbaik)} | Waste Total ${data.terbaik.persenSisaTotal.toFixed(2)}%`,
    planoX,
    planoY + planoH + 28
  );
}
