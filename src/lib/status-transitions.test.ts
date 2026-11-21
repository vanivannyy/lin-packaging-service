import { describe, expect, it } from "vitest";
import {
  QUOTATION_TRANSITIONS,
  SALES_ORDER_TRANSITIONS,
  canTransition,
  parseQuotationStatus,
  parseSalesOrderStatus,
} from "./status-transitions";

describe("status transitions", () => {
  it("SO maju satu langkah dan boleh dibatalkan sebelum terkirim", () => {
    expect(canTransition(SALES_ORDER_TRANSITIONS, "MATERIAL_CHECK", "PRODUCTION")).toBe(true);
    expect(canTransition(SALES_ORDER_TRANSITIONS, "PRODUCTION", "CANCELLED")).toBe(true);
  });
  it("SO tidak boleh melompat atau keluar dari status akhir", () => {
    expect(canTransition(SALES_ORDER_TRANSITIONS, "MATERIAL_CHECK", "DELIVERED")).toBe(false);
    expect(canTransition(SALES_ORDER_TRANSITIONS, "DELIVERED", "CANCELLED")).toBe(false);
    expect(canTransition(SALES_ORDER_TRANSITIONS, "CANCELLED", "PRODUCTION")).toBe(false);
  });
  it("Quotation: DRAFT->SENT->ACCEPTED/REJECTED saja", () => {
    expect(canTransition(QUOTATION_TRANSITIONS, "DRAFT", "SENT")).toBe(true);
    expect(canTransition(QUOTATION_TRANSITIONS, "DRAFT", "ACCEPTED")).toBe(false);
    expect(canTransition(QUOTATION_TRANSITIONS, "ACCEPTED", "REJECTED")).toBe(false);
  });
  it("menolak nilai status di luar enum", () => {
    expect(() => parseSalesOrderStatus("HACKED")).toThrow();
    expect(() => parseQuotationStatus(null)).toThrow();
    expect(parseSalesOrderStatus("PRODUCTION")).toBe("PRODUCTION");
  });
});
