import { requireMobileSession } from "@/lib/mobile-auth";
import { canAccessModule } from "@/lib/roles";
import { findWorkOrderByCode } from "@/lib/mobile-work-order";

export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const authResult = await requireMobileSession(req);
  if (authResult instanceof Response) return authResult;

  if (!canAccessModule(authResult.role, "produksi")) {
    return Response.json({ error: "Akun ini tidak memiliki akses ke modul Produksi" }, { status: 403 });
  }

  const { code } = await params;
  const workOrder = await findWorkOrderByCode(decodeURIComponent(code));

  if (!workOrder) {
    return Response.json({ error: `Work Order ${code} tidak ditemukan` }, { status: 404 });
  }

  return Response.json({
    code: workOrder.code,
    stage: workOrder.stage,
    process: workOrder.process,
    progressPercent: workOrder.progressPercent,
    priority: workOrder.priority,
    qcPassed: workOrder.qcPassed,
    rejectRatePercent: Number(workOrder.rejectRatePercent),
    goodQtyTotal: workOrder.goodQtyTotal,
    rejectQtyTotal: workOrder.rejectQtyTotal,
    deadline: workOrder.deadline ? workOrder.deadline.toISOString() : null,
    customerName: workOrder.salesOrder.customer.name,
    productName: workOrder.salesOrder.product?.name ?? workOrder.salesOrder.productNote ?? "-",
    qty: workOrder.salesOrder.qty,
    soCode: workOrder.salesOrder.code,
    qcChecks: workOrder.qcChecks.map((c) => ({
      id: c.id,
      checkType: c.checkType,
      passed: c.passed,
      note: c.note,
      userName: c.user?.name ?? null,
      createdAt: c.createdAt.toISOString(),
    })),
  });
}
