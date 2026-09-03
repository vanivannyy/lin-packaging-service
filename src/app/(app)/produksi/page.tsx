import { Download } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { formatPercent } from "@/lib/format";
import { ProduksiKanbanBoard } from "./KanbanBoard";
import { requireModule } from "@/lib/require-session";

export default async function ProduksiPage() {
  await requireModule("produksi");
  const [workOrders, total, inProduction, done, late, rejectAgg] = await Promise.all([
    prisma.workOrder.findMany({
      where: { isDeleted: false },
      include: {
        salesOrder: {
          include: {
            customer: true,
            product: { include: { defaultMaterial: true } },
            quotation: true,
          },
        },
        stepProgress: true,
        productionLogs: { include: { user: true }, orderBy: { createdAt: "desc" }, take: 30 },
        qcChecks: { include: { user: true }, orderBy: { createdAt: "desc" }, take: 20 },
      },
      orderBy: { deadline: "asc" },
    }),
    prisma.workOrder.count({ where: { isDeleted: false } }),
    prisma.workOrder.count({ where: { isDeleted: false, stage: { in: ["IN_PRODUCTION", "QC", "REWORK"] } } }),
    prisma.workOrder.count({ where: { isDeleted: false, stage: "DONE" } }),
    prisma.workOrder.count({ where: { isDeleted: false, stage: { not: "DONE" }, deadline: { lt: new Date() } } }),
    prisma.workOrder.aggregate({ _avg: { rejectRatePercent: true }, where: { isDeleted: false, rejectRatePercent: { gt: 0 } } }),
  ]);

  const avgRejectRate = Number(rejectAgg._avg.rejectRatePercent ?? 0);

  const cards = workOrders.map((wo) => ({
    id: wo.id,
    code: wo.code,
    priority: wo.priority,
    stage: wo.stage,
    process: wo.process,
    progressPercent: wo.progressPercent,
    deadline: wo.deadline ? wo.deadline.toISOString() : null,
    customerName: wo.salesOrder.customer.name,
    productName: wo.salesOrder.product?.name ?? wo.salesOrder.productNote ?? "-",
    qty: wo.salesOrder.qty,
    soCode: wo.salesOrder.code,
    goodQtyTotal: wo.goodQtyTotal,
    rejectQtyTotal: wo.rejectQtyTotal,
    qcPassed: wo.qcPassed,
    prepressDesignUrl: wo.prepressDesignUrl,
    prepressDesignUploadedAt: wo.prepressDesignUploadedAt ? wo.prepressDesignUploadedAt.toISOString() : null,
    isInRevision: wo.isInRevision,
    revisionCount: wo.revisionCount,
    revisionNote: wo.revisionNote,
    materialSpec: (wo.salesOrder.quotation?.materialSpec as Record<string, unknown> | null) ?? null,
    defaultMaterialName: wo.salesOrder.product?.defaultMaterial?.name ?? null,
    stepProgress: wo.stepProgress.map((s) => ({
      process: s.process,
      status: s.status,
      goodQty: s.goodQty,
      rejectQty: s.rejectQty,
    })),
    productionLogs: wo.productionLogs.map((log) => ({
      id: log.id,
      process: log.process,
      goodQty: log.goodQty,
      rejectQty: log.rejectQty,
      downtimeMinutes: log.downtimeMinutes,
      note: log.note,
      userName: log.user?.name ?? "System",
      createdAt: log.createdAt.toISOString(),
    })),
    qcChecks: wo.qcChecks.map((qcCheck) => ({
      id: qcCheck.id,
      checkType: qcCheck.checkType,
      passed: qcCheck.passed,
      note: qcCheck.note,
      userName: qcCheck.user?.name ?? "System",
      createdAt: qcCheck.createdAt.toISOString(),
    })),
  }));

  return (
    <div>
      <PageHeader
        eyebrow="Work Order"
        title="Papan Produksi"
        actions={
          <a
            href="/api/export/produksi"
            className="flex items-center gap-1.5 rounded-md border border-gray-200 px-3.5 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            <Download size={14} /> Excel
          </a>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatCard label="Total Work Order" value={total} />
        <StatCard label="Sedang Produksi" value={inProduction} valueColor="blue" />
        <StatCard label="Selesai" value={done} valueColor="green" />
        <StatCard label="Terlambat" value={late} valueColor="red" />
        <StatCard label="Rata-rata Reject" value={formatPercent(avgRejectRate)} />
      </div>

      <p className="mb-3 -mt-2 text-xs text-gray-400">Geser (drag) kartu work order antar kolom untuk memindahkan stage.</p>

      <ProduksiKanbanBoard workOrders={cards} />
    </div>
  );
}
