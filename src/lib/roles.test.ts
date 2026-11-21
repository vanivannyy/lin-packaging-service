import { describe, expect, it } from "vitest";
import { canAccessModule, canApprovePurchaseRequest, canPerformQc } from "./roles";

describe("roles", () => {
  it("QC boleh: OWNER, GM, QC; lainnya tidak", () => {
    expect(canPerformQc("OWNER")).toBe(true);
    expect(canPerformQc("GENERAL_MANAGER")).toBe(true);
    expect(canPerformQc("QC")).toBe(true);
    expect(canPerformQc("SALES")).toBe(false);
    expect(canPerformQc("PRODUCTION_PLANNER")).toBe(false);
  });
  it("approve PR hanya GM & OWNER", () => {
    expect(canApprovePurchaseRequest("OWNER")).toBe(true);
    expect(canApprovePurchaseRequest("GENERAL_MANAGER")).toBe(true);
    expect(canApprovePurchaseRequest("PURCHASING")).toBe(false);
    expect(canApprovePurchaseRequest("WAREHOUSE")).toBe(false);
  });
  it("modul sensitif hanya OWNER", () => {
    expect(canAccessModule("OWNER", "user-role")).toBe(true);
    expect(canAccessModule("GENERAL_MANAGER", "user-role")).toBe(false);
    expect(canAccessModule("FINANCE", "audit-trail")).toBe(false);
  });
});
