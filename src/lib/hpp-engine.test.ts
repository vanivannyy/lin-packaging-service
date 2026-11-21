import { describe, expect, it } from "vitest";
import { countFit, usedSize } from "./hpp-engine";

describe("hpp-engine (fungsi murni dasar)", () => {
  it("countFit: jumlah item muat dalam ruang dengan gap", () => {
    expect(countFit(100, 10, 0)).toBe(10);
    expect(countFit(100, 10, 5)).toBeGreaterThanOrEqual(6);
    expect(countFit(5, 10, 0)).toBe(0);
  });
  it("usedSize: panjang terpakai tidak negatif", () => {
    expect(usedSize(3, 10, 2)).toBeGreaterThan(0);
  });
});
