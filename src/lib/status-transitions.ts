import type { QuotationStatus, SalesOrderStatus } from "@prisma/client";

// Aturan transisi status yang diperbolehkan lewat aksi manual (UI). Transisi otomatis sistem
// (mis. SO -> READY_DELIVERY saat packing selesai, SO -> DELIVERED dari papan Delivery) tidak melewati peta ini.

export const SALES_ORDER_TRANSITIONS: Record<SalesOrderStatus, SalesOrderStatus[]> = {
  MATERIAL_CHECK: ["PRODUCTION", "CANCELLED"],
  PRODUCTION: ["READY_DELIVERY", "CANCELLED"],
  READY_DELIVERY: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

export const QUOTATION_TRANSITIONS: Record<QuotationStatus, QuotationStatus[]> = {
  DRAFT: ["SENT"],
  SENT: ["ACCEPTED", "REJECTED"],
  ACCEPTED: [],
  REJECTED: [],
  EXPIRED: [],
};

export function canTransition<S extends string>(map: Record<S, S[]>, from: S, to: S): boolean {
  return map[from]?.includes(to) ?? false;
}

const SALES_ORDER_STATUSES = Object.keys(SALES_ORDER_TRANSITIONS) as SalesOrderStatus[];
const QUOTATION_STATUSES = Object.keys(QUOTATION_TRANSITIONS) as QuotationStatus[];

export function parseSalesOrderStatus(value: unknown): SalesOrderStatus {
  if (typeof value === "string" && (SALES_ORDER_STATUSES as string[]).includes(value)) {
    return value as SalesOrderStatus;
  }
  throw new Error("Status Sales Order tidak valid.");
}

export function parseQuotationStatus(value: unknown): QuotationStatus {
  if (typeof value === "string" && (QUOTATION_STATUSES as string[]).includes(value)) {
    return value as QuotationStatus;
  }
  throw new Error("Status Quotation tidak valid.");
}
