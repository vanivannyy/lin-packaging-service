import { prisma } from "@/lib/prisma";
import { daysBetween } from "@/lib/format";

export type BusinessAlert =
  | { type: "LOW_STOCK"; text: string }
  | { type: "OVERDUE"; text: string }
  | { type: "DELAY"; text: string }
  | { type: "PRODUCTION_ISSUE"; text: string };

const REJECT_RATE_ALERT_THRESHOLD = 3; // % — di atas ini dianggap production issue

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}
function startOfYear(date = new Date()) {
  return new Date(date.getFullYear(), 0, 1);
}
function toNum(v: unknown) {
  return v === null || v === undefined ? 0 : Number(v);
}

export async function getDashboardData() {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const yearStart = startOfYear(now);

  const [
    salesOrdersThisMonth,
    salesOrdersThisYear,
    invoiceAgg,
    overdueInvoiceAgg,
    workOrderTotal,
    workOrderInProduction,
    workOrderLate,
    prPending,
    prTotalEstimate,
    leadsNewCount,
    leadsTotalValue,
    quotationActiveAgg,
    quotationWon,
    quotationLost,
    salesOrderInProductionCount,
    salesOrderReadyCount,
    salesOrderDeliveredThisMonth,
    materials,
    overdueInvoices,
    activeWorkOrdersForAlerts,
    rejectAgg,
  ] = await Promise.all([
    prisma.salesOrder.findMany({
      where: { createdAt: { gte: monthStart }, isDeleted: false, status: { not: "CANCELLED" } },
      include: { quotation: true },
    }),
    prisma.salesOrder.findMany({
      where: { createdAt: { gte: yearStart }, isDeleted: false, status: { not: "CANCELLED" } },
      include: { quotation: true, customer: true },
    }),
    prisma.invoice.aggregate({
      _sum: { totalAmount: true, paidAmount: true },
      where: { isDeleted: false, status: { not: "PAID" } },
    }),
    prisma.invoice.aggregate({
      _sum: { totalAmount: true, paidAmount: true },
      where: { isDeleted: false, status: "OVERDUE" },
    }),
    prisma.workOrder.count({ where: { isDeleted: false } }),
    prisma.workOrder.count({ where: { isDeleted: false, stage: { in: ["IN_PRODUCTION", "QC", "REWORK"] } } }),
    prisma.workOrder.count({
      where: { isDeleted: false, stage: { notIn: ["DONE"] }, deadline: { lt: now } },
    }),
    prisma.purchaseRequest.count({ where: { isDeleted: false, status: "PENDING" } }),
    prisma.purchaseRequest.aggregate({ _sum: { estimatedCost: true }, where: { isDeleted: false, status: "PENDING" } }),
    prisma.lead.count({ where: { isDeleted: false, stage: "NEW" } }),
    prisma.lead.aggregate({ _sum: { estimatedValue: true }, where: { isDeleted: false, stage: { notIn: ["WON", "LOST"] } } }),
    prisma.quotation.aggregate({
      _count: { _all: true },
      _sum: { totalAmount: true },
      where: { isDeleted: false, status: { in: ["DRAFT", "SENT"] } },
    }),
    prisma.quotation.count({ where: { isDeleted: false, status: "ACCEPTED" } }),
    prisma.quotation.count({ where: { isDeleted: false, status: "REJECTED" } }),
    prisma.workOrder.count({ where: { isDeleted: false, stage: { in: ["IN_PRODUCTION", "QC", "READY", "REWORK"] } } }),
    prisma.salesOrder.count({ where: { isDeleted: false, status: "READY_DELIVERY" } }),
    prisma.salesOrder.count({ where: { isDeleted: false, status: "DELIVERED", updatedAt: { gte: monthStart } } }),
    prisma.material.findMany({ where: { isDeleted: false } }),
    prisma.invoice.findMany({
      where: { isDeleted: false, status: "OVERDUE" },
      include: { customer: true },
      orderBy: { dueDate: "asc" },
    }),
    prisma.workOrder.findMany({
      where: { isDeleted: false, stage: { not: "DONE" } },
      orderBy: { code: "asc" },
    }),
    prisma.workOrder.aggregate({
      _avg: { rejectRatePercent: true },
      where: { isDeleted: false, rejectRatePercent: { gt: 0 } },
    }),
  ]);

  const sumRevenueAndProfit = (orders: typeof salesOrdersThisMonth) => {
    let revenue = 0;
    let hpp = 0;
    for (const so of orders) {
      revenue += toNum(so.totalAmount);
      hpp += so.quotation ? toNum(so.quotation.hppAmount) : toNum(so.totalAmount) * 0.72;
    }
    return { revenue, profit: revenue - hpp };
  };

  const monthStats = sumRevenueAndProfit(salesOrdersThisMonth);
  const yearStats = sumRevenueAndProfit(salesOrdersThisYear);
  const grossMargin = monthStats.revenue > 0 ? (monthStats.profit / monthStats.revenue) * 100 : 0;

  const receivableOutstanding = toNum(invoiceAgg._sum.totalAmount) - toNum(invoiceAgg._sum.paidAmount);
  const receivableOverdue = toNum(overdueInvoiceAgg._sum.totalAmount) - toNum(overdueInvoiceAgg._sum.paidAmount);

  const totalWon = quotationWon;
  const totalDecided = quotationWon + quotationLost;
  const conversionRate = totalDecided > 0 ? (totalWon / totalDecided) * 100 : 0;

  const stockValue = materials.reduce((acc, m) => acc + toNum(m.stockQty) * toNum(m.pricePerUnit), 0);
  const belowMinStockMaterials = materials.filter((m) => toNum(m.stockQty) - toNum(m.reservedQty) <= toNum(m.minStockQty));
  const belowMinStock = belowMinStockMaterials.length;
  const avgRejectRate = toNum(rejectAgg._avg.rejectRatePercent);

  // Profitabilitas per customer (tahun berjalan), diambil dari sales order yang sudah dihitung revenue/HPP-nya.
  const profitByCustomer = new Map<string, { name: string; revenue: number; profit: number }>();
  for (const so of salesOrdersThisYear) {
    const revenue = toNum(so.totalAmount);
    const hpp = so.quotation ? toNum(so.quotation.hppAmount) : revenue * 0.72;
    const entry = profitByCustomer.get(so.customerId) ?? { name: so.customer.name, revenue: 0, profit: 0 };
    entry.revenue += revenue;
    entry.profit += revenue - hpp;
    profitByCustomer.set(so.customerId, entry);
  }
  const topProfitableCustomers = Array.from(profitByCustomer.values())
    .map((c) => ({ ...c, margin: c.revenue > 0 ? (c.profit / c.revenue) * 100 : 0 }))
    .sort((a, b) => b.profit - a.profit)
    .slice(0, 6);

  // Business alerts: stok rendah, invoice overdue, WO terlambat & production issue (reject rate tinggi).
  const businessAlerts: BusinessAlert[] = [];

  for (const m of belowMinStockMaterials) {
    const available = toNum(m.stockQty) - toNum(m.reservedQty);
    businessAlerts.push({
      type: "LOW_STOCK",
      text: `Material ${m.name} di bawah stok minimum (${available.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} ${m.unit})`,
    });
  }

  for (const inv of overdueInvoices) {
    const overdueDays = inv.dueDate ? daysBetween(inv.dueDate, now) : 0;
    businessAlerts.push({
      type: "OVERDUE",
      text: `Invoice ${inv.code} jatuh tempo ${overdueDays} hari (${inv.customer.name})`,
    });
  }

  for (const wo of activeWorkOrdersForAlerts) {
    if (wo.deadline && wo.deadline < now) {
      businessAlerts.push({ type: "DELAY", text: `${wo.code} terlambat ${daysBetween(wo.deadline, now)} hari dari jadwal` });
    }
    const rejectRate = toNum(wo.rejectRatePercent);
    if (rejectRate > REJECT_RATE_ALERT_THRESHOLD) {
      businessAlerts.push({ type: "PRODUCTION_ISSUE", text: `${wo.code} memiliki reject rate ${rejectRate.toFixed(1)}%` });
    }
  }

  const pipeline = await prisma.lead.groupBy({
    by: ["stage"],
    where: { isDeleted: false },
    _count: { _all: true },
    _sum: { estimatedValue: true },
  });

  const monthlyTrend = await getMonthlyTrend();

  return {
    revenueThisMonth: monthStats.revenue,
    revenueThisYear: yearStats.revenue,
    grossProfit: monthStats.profit,
    grossMargin,
    receivableOutstanding,
    receivableOverdue,
    workOrderTotal,
    workOrderInProduction,
    workOrderLate,
    prPending,
    prPendingEstimate: toNum(prTotalEstimate._sum.estimatedCost),
    leadsNewCount,
    leadsTotalValue: toNum(leadsTotalValue._sum.estimatedValue),
    quotationActiveCount: quotationActiveAgg._count._all,
    quotationActiveValue: toNum(quotationActiveAgg._sum.totalAmount),
    conversionRate,
    quotationWon,
    quotationLost,
    salesOrderInProductionCount,
    salesOrderReadyCount,
    salesOrderDeliveredThisMonth,
    stockValue,
    belowMinStock,
    avgRejectRate,
    topProfitableCustomers,
    businessAlerts: businessAlerts.slice(0, 12),
    pipeline,
    monthlyTrend,
  };
}

async function getMonthlyTrend() {
  const months: { label: string; start: Date; end: Date }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i -= 1) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    months.push({
      label: start.toLocaleDateString("id-ID", { month: "short" }),
      start,
      end,
    });
  }

  const result = [];
  for (const m of months) {
    const orders = await prisma.salesOrder.findMany({
      where: { createdAt: { gte: m.start, lt: m.end }, isDeleted: false, status: { not: "CANCELLED" } },
      include: { quotation: true },
    });
    let revenue = 0;
    let hpp = 0;
    for (const so of orders) {
      revenue += toNum(so.totalAmount);
      hpp += so.quotation ? toNum(so.quotation.hppAmount) : toNum(so.totalAmount) * 0.72;
    }
    result.push({ month: m.label, revenue, profit: revenue - hpp });
  }
  return result;
}
