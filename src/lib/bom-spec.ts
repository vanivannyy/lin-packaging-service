// Helper murni (tanpa DB) untuk membaca BOM dari Quotation.materialSpec.

export type BomLineInput = { materialId: string; qty: number; note?: string; source?: "HPP" | "MANUAL" };

/** Normalisasi BOM dari Quotation.materialSpec (format baru `bom`, atau format lama materialId+jumlahPlano). */
export function parseBomFromSpec(spec: unknown): BomLineInput[] {
  const s = (spec ?? {}) as Record<string, unknown>;
  const lines: BomLineInput[] = [];
  if (Array.isArray(s.bom)) {
    for (const raw of s.bom) {
      const row = raw as { materialId?: unknown; qty?: unknown; note?: unknown };
      const qty = Number(row.qty);
      if (typeof row.materialId === "string" && row.materialId && Number.isFinite(qty) && qty > 0) {
        lines.push({
          materialId: row.materialId,
          qty,
          note: typeof row.note === "string" ? row.note : undefined,
          source: "HPP",
        });
      }
    }
  } else if (typeof s.materialId === "string" && typeof s.jumlahPlano === "number" && s.jumlahPlano > 0) {
    lines.push({ materialId: s.materialId, qty: s.jumlahPlano, source: "HPP" });
  }
  return lines;
}
