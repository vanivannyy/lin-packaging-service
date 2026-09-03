import { prisma } from "@/lib/prisma";

function toNum(v: unknown) {
  return v === null || v === undefined ? 0 : Number(v);
}

export async function getSalesOrdersWithCost() {
  return prisma.salesOrder.findMany({
    where: { isDeleted: false, status: { not: "CANCELLED" } },
    include: { customer: { include: { sales: true } }, product: true, quotation: true },
  });
}

export type ReportRow = { name: string; orderCount: number; revenue: number; grossProfit: number; margin: number };

export async function getReportByCustomer(): Promise<ReportRow[]> {
  const orders = await getSalesOrdersWithCost();
  const map = new Map<string, ReportRow>();

  for (const so of orders) {
    const key = so.customer.name;
    const revenue = toNum(so.totalAmount);
    const hpp = so.quotation ? toNum(so.quotation.hppAmount) : revenue * 0.72;
    const existing = map.get(key) ?? { name: key, orderCount: 0, revenue: 0, grossProfit: 0, margin: 0 };
    existing.orderCount += 1;
    existing.revenue += revenue;
    existing.grossProfit += revenue - hpp;
    map.set(key, existing);
  }

  return Array.from(map.values())
    .map((r) => ({ ...r, margin: r.revenue > 0 ? (r.grossProfit / r.revenue) * 100 : 0 }))
    .sort((a, b) => b.revenue - a.revenue);
}

export async function getReportByProduct(): Promise<ReportRow[]> {
  const orders = await getSalesOrdersWithCost();
  const map = new Map<string, ReportRow>();

  for (const so of orders) {
    const key = so.product?.name ?? so.productNote ?? "Lainnya";
    const revenue = toNum(so.totalAmount);
    const hpp = so.quotation ? toNum(so.quotation.hppAmount) : revenue * 0.72;
    const existing = map.get(key) ?? { name: key, orderCount: 0, revenue: 0, grossProfit: 0, margin: 0 };
    existing.orderCount += 1;
    existing.revenue += revenue;
    existing.grossProfit += revenue - hpp;
    map.set(key, existing);
  }

  return Array.from(map.values())
    .map((r) => ({ ...r, margin: r.revenue > 0 ? (r.grossProfit / r.revenue) * 100 : 0 }))
    .sort((a, b) => b.revenue - a.revenue);
}

export async function getReportBySales(): Promise<ReportRow[]> {
  const orders = await getSalesOrdersWithCost();
  const map = new Map<string, ReportRow>();

  for (const so of orders) {
    const key = so.customer.sales?.name ?? "Belum ditugaskan";
    const revenue = toNum(so.totalAmount);
    const hpp = so.quotation ? toNum(so.quotation.hppAmount) : revenue * 0.72;
    const existing = map.get(key) ?? { name: key, orderCount: 0, revenue: 0, grossProfit: 0, margin: 0 };
    existing.orderCount += 1;
    existing.revenue += revenue;
    existing.grossProfit += revenue - hpp;
    map.set(key, existing);
  }

  return Array.from(map.values())
    .map((r) => ({ ...r, margin: r.revenue > 0 ? (r.grossProfit / r.revenue) * 100 : 0 }))
    .sort((a, b) => b.revenue - a.revenue);
}
