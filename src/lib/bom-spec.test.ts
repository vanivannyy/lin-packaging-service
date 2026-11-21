import { describe, expect, it } from "vitest";
import { parseBomFromSpec } from "./bom-spec";
import { termToDays } from "./payment-terms";

describe("parseBomFromSpec", () => {
  it("membaca format bom baru dan membuang baris tidak valid", () => {
    const lines = parseBomFromSpec({
      bom: [
        { materialId: "m1", qty: 120 },
        { materialId: "m2", qty: 0 },
        { materialId: "", qty: 5 },
        { materialId: "m3", qty: "2.5" },
      ],
    });
    expect(lines.map((l) => [l.materialId, l.qty])).toEqual([["m1", 120], ["m3", 2.5]]);
  });
  it("kompatibel dengan format lama materialId+jumlahPlano", () => {
    expect(parseBomFromSpec({ materialId: "m1", jumlahPlano: 50 })).toEqual([
      { materialId: "m1", qty: 50, source: "HPP" },
    ]);
  });
  it("kosong bila spec kosong", () => {
    expect(parseBomFromSpec(null)).toEqual([]);
    expect(parseBomFromSpec({ gsm: 210 })).toEqual([]);
  });
});

describe("termToDays", () => {
  it("memetakan CustomerTerm ke hari", () => {
    expect(termToDays("CBD")).toBe(0);
    expect(termToDays("NET_30")).toBe(30);
    expect(termToDays("NET_60")).toBe(60);
  });
});
