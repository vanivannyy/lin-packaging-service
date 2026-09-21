"use client";

import { useEffect, useMemo, useRef } from "react";
import { drawCuttingLayout, parseCuttingLayoutInput, type CuttingLayoutSpec } from "@/lib/draw-cutting-layout";
import { formatDecimal } from "@/lib/format";
import { cariLayoutTerbaik, ringkasKomposisi } from "@/lib/hpp-engine";

export function CuttingLayoutPreview({ spec }: { spec: CuttingLayoutSpec | null | undefined }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const input = useMemo(() => parseCuttingLayoutInput(spec), [spec]);

  const computed = useMemo(() => {
    if (!input) return null;
    const panjangEfektif = input.panjangPlano - input.marginKiri - input.marginKanan;
    const lebarEfektif = input.lebarPlano - input.marginAtas - input.marginBawah;
    if (panjangEfektif <= 0 || lebarEfektif <= 0) {
      return { error: "Margin terlalu besar sehingga area efektif tidak valid." };
    }

    const terbaik = cariLayoutTerbaik(
      panjangEfektif,
      lebarEfektif,
      input.panjangPotong,
      input.lebarPotong,
      input.gap,
      input.panjangPlano,
      input.lebarPlano
    );
    if (!terbaik || terbaik.totalPotong <= 0) {
      return { error: "Ukuran potong tidak muat di dalam plano dengan margin tersebut." };
    }

    return { panjangEfektif, lebarEfektif, terbaik };
  }, [input]);

  useEffect(() => {
    if (!input || !computed || "error" in computed) return;
    drawCuttingLayout(canvasRef.current, {
      panjangPlano: input.panjangPlano,
      lebarPlano: input.lebarPlano,
      panjangEfektif: computed.panjangEfektif,
      lebarEfektif: computed.lebarEfektif,
      marginKiri: input.marginKiri,
      marginAtas: input.marginAtas,
      gap: input.gap,
      terbaik: computed.terbaik,
    });
  }, [input, computed]);

  if (!input || !computed) return null;

  if ("error" in computed) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        {computed.error}
      </div>
    );
  }

  const { terbaik, panjangEfektif, lebarEfektif } = computed;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <InfoBox label="Ukuran Plano Utuh" value={`${formatDecimal(input.panjangPlano)} × ${formatDecimal(input.lebarPlano)} cm`} />
        <InfoBox label="Ukuran Jadi" value={`${formatDecimal(input.panjangPotong)} × ${formatDecimal(input.lebarPotong)} cm`} />
        <InfoBox
          label="Margin Kiri / Kanan"
          value={`${formatDecimal(input.marginKiri)} / ${formatDecimal(input.marginKanan)} cm`}
        />
        <InfoBox
          label="Margin Atas / Bawah"
          value={`${formatDecimal(input.marginAtas)} / ${formatDecimal(input.marginBawah)} cm`}
        />
        <InfoBox label="Gap Antar Potongan" value={`${formatDecimal(input.gap)} cm`} />
        <InfoBox label="Area Efektif" value={`${formatDecimal(panjangEfektif)} × ${formatDecimal(lebarEfektif)} cm`} />
        <InfoBox label="Potongan per Plano" value={formatDecimal(terbaik.totalPotong)} />
        <InfoBox label="Komposisi" value={ringkasKomposisi(terbaik)} />
        <InfoBox label="Jenis Layout" value={terbaik.type === "mixed" ? "Campuran" : "Seragam"} />
        <InfoBox label="Nama Layout" value={terbaik.name} />
        <InfoBox label="Waste Total / Plano" value={`${formatDecimal(terbaik.persenSisaTotal)}%`} warning />
        <InfoBox label="Waste Area Efektif" value={`${formatDecimal(terbaik.persenSisaEfektif)}%`} />
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-gray-800">Visual Layout Potong</p>
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white p-3">
          <canvas
            ref={canvasRef}
            width={1050}
            height={700}
            className="block h-auto w-full max-w-[1050px] rounded-md border border-gray-300 bg-white"
          />
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-gray-800">Detail Blok Potongan</p>
        <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <th className="border border-gray-200 px-3 py-2">Blok</th>
                <th className="border border-gray-200 px-3 py-2">Orientasi</th>
                <th className="border border-gray-200 px-3 py-2">Ukuran Dipakai</th>
                <th className="border border-gray-200 px-3 py-2">Kolom</th>
                <th className="border border-gray-200 px-3 py-2">Baris</th>
                <th className="border border-gray-200 px-3 py-2">Total</th>
                <th className="border border-gray-200 px-3 py-2">Posisi X</th>
                <th className="border border-gray-200 px-3 py-2">Posisi Y</th>
              </tr>
            </thead>
            <tbody>
              {terbaik.blocks
                .filter((block) => block.count > 0)
                .map((block, idx) => (
                  <tr key={`${block.label}-${idx}`}>
                    <td className="border border-gray-200 px-3 py-2">{block.label}</td>
                    <td className="border border-gray-200 px-3 py-2">
                      <span className="rounded-full bg-sky-100 px-2 py-0.5 text-xs font-semibold text-sky-800">
                        {block.orientation}
                      </span>
                    </td>
                    <td className="border border-gray-200 px-3 py-2">
                      {formatDecimal(block.w)} × {formatDecimal(block.h)}
                    </td>
                    <td className="border border-gray-200 px-3 py-2">{block.cols}</td>
                    <td className="border border-gray-200 px-3 py-2">{block.rows}</td>
                    <td className="border border-gray-200 px-3 py-2">{block.count}</td>
                    <td className="border border-gray-200 px-3 py-2">{formatDecimal(block.x)}</td>
                    <td className="border border-gray-200 px-3 py-2">{formatDecimal(block.y)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function InfoBox({ label, value, warning }: { label: string; value: string; warning?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 ${warning ? "border-amber-300 bg-amber-50" : "border-gray-200 bg-gray-50"}`}>
      <small className="mb-2 block text-xs font-bold text-gray-500">{label}</small>
      <strong className="block text-lg leading-tight text-gray-900">{value}</strong>
    </div>
  );
}
