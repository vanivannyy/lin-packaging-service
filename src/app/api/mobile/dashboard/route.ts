import { prisma } from "@/lib/prisma";
import { requireMobileSession } from "@/lib/mobile-auth";
import { daysBetween } from "@/lib/format";

function toNum(v: unknown) {
  return v === null || v === undefined ? 0 : Number(v);
}

type Alert = { type: "LOW_STOCK" | "OVERDUE" | "DELAY"; text: string };

export async function GET(req: Request) {
  const authResult = await requireMobileSession(req);
  if (authResult instanceof Response) return authResult;

  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfYesterday = new Date(startOfToday.getTime() - 24 * 60 * 60 * 1000);

  const [
    ordersToday,
    ordersYesterday,
    materials,
    pendingPurchaseAgg,
    workOrderInProduction,
    workOrderLateCount,
    deliveryReady,
    deliveryInDelivery,
    overdueInvoiceAgg,
    overdueInvoices,
    lateWorkOrders,
  ] = await Promise.all([
    prisma.salesOrder.aggregate({
      _count: { _all: true },
      _sum: { totalAmount: true },
      where: { isDeleted: false, status: { not: "CANCELLED" }, createdAt: { gte: startOfToday } },
    }),
    prisma.salesOrder.aggregate({
      _count: { _all: true },
      _sum: { totalAmount: true },
      where: {
        isDeleted: false,
        status: { not: "CANCELLED" },
        createdAt: { gte: startOfYesterday, lt: startOfToday },
      },
    }),
    prisma.material.findMany({ where: { isDeleted: false } }),
    prisma.purchaseRequest.aggregate({
      _count: { _all: true },
      _sum: { estimatedCost: true },
      where: { isDeleted: false, status: "PENDING" },
    }),
    prisma.workOrder.count({ where: { isDeleted: false, stage: { in: ["IN_PRODUCTION", "QC", "REWORK"] } } }),
    prisma.workOrder.count({ where: { isDeleted: false, stage: { not: "DONE" }, deadline: { lt: now } } }),
    prisma.deliveryOrder.count({ where: { isDeleted: false, stage: "READY" } }),
    prisma.deliveryOrder.count({ where: { isDeleted: false, stage: "IN_DELIVERY" } }),
    prisma.invoice.aggregate({
      _count: { _all: true },
      _sum: { totalAmount: true, paidAmount: true },
      where: { isDeleted: false, status: "OVERDUE" },
    }),
    prisma.invoice.findMany({
      where: { isDeleted: false, status: "OVERDUE" },
      include: { customer: true },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
    prisma.workOrder.findMany({
      where: { isDeleted: false, stage: { not: "DONE" }, deadline: { lt: now } },
      orderBy: { deadline: "asc" },
      take: 5,
    }),
  ]);

  const belowMinStockMaterials = materials.filter(
    (m) => toNum(m.stockQty) - toNum(m.reservedQty) <= toNum(m.minStockQty),
  );

  const alerts: Alert[] = [];
  for (const m of belowMinStockMaterials.slice(0, 5)) {
    const available = toNum(m.stockQty) - toNum(m.reservedQty);
    alerts.push({
      type: "LOW_STOCK",
      text: `Stok ${m.name} tinggal ${available.toLocaleString("id-ID", { maximumFractionDigits: 1 })} ${m.unit}`,
    });
  }
  for (const inv of overdueInvoices) {
    const overdueDays = inv.dueDate ? daysBetween(inv.dueDate, now) : 0;
    alerts.push({ type: "OVERDUE", text: `Invoice ${inv.code} (${inv.customer.name}) telat ${overdueDays} hari` });
  }
  for (const wo of lateWorkOrders) {
    alerts.push({
      type: "DELAY",
      text: `${wo.code} lewat deadline ${wo.deadline ? daysBetween(wo.deadline, now) : 0} hari`,
    });
  }

  return Response.json({
    salesToday: {
      orderCount: ordersToday._count._all,
      amount: toNum(ordersToday._sum.totalAmount),
    },
    salesYesterday: {
      orderCount: ordersYesterday._count._all,
      amount: toNum(ordersYesterday._sum.totalAmount),
    },
    stock: {
      lowStockCount: belowMinStockMaterials.length,
    },
    purchaseRequest: {
      pendingCount: pendingPurchaseAgg._count._all,
      pendingEstimate: toNum(pendingPurchaseAgg._sum.estimatedCost),
    },
    production: {
      inProductionCount: workOrderInProduction,
      lateCount: workOrderLateCount,
    },
    delivery: {
      readyCount: deliveryReady,
      inDeliveryCount: deliveryInDelivery,
    },
    invoice: {
      overdueCount: overdueInvoiceAgg._count._all,
      overdueAmount: toNum(overdueInvoiceAgg._sum.totalAmount) - toNum(overdueInvoiceAgg._sum.paidAmount),
    },
    alerts: alerts.slice(0, 8),
  });
}
