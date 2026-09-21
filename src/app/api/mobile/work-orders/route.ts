import { prisma } from "@/lib/prisma";
import { requireMobileSession } from "@/lib/mobile-auth";
import { canAccessModule } from "@/lib/roles";
import type { WorkOrderStage } from "@prisma/client";

export async function GET(req: Request) {
  const authResult = await requireMobileSession(req);
  if (authResult instanceof Response) return authResult;

  if (!canAccessModule(authResult.role, "produksi")) {
    return Response.json({ error: "Akun ini tidak memiliki akses ke modul Produksi" }, { status: 403 });
  }

  const url = new URL(req.url);
  const stageParam = url.searchParams.get("stage") as WorkOrderStage | null;

  const workOrders = await prisma.workOrder.findMany({
    where: { isDeleted: false, stage: stageParam ?? "QC" },
    include: { salesOrder: { include: { customer: true, product: true } } },
    orderBy: { deadline: "asc" },
    take: 40,
  });

  return Response.json({
    items: workOrders.map((wo) => ({
      code: wo.code,
      stage: wo.stage,
      process: wo.process,
      progressPercent: wo.progressPercent,
      qcPassed: wo.qcPassed,
      deadline: wo.deadline ? wo.deadline.toISOString() : null,
      customerName: wo.salesOrder.customer.name,
      productName: wo.salesOrder.product?.name ?? wo.salesOrder.productNote ?? "-",
      qty: wo.salesOrder.qty,
    })),
  });
}
