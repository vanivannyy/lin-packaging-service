import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireMobileSession } from "@/lib/mobile-auth";
import { canAccessModule } from "@/lib/roles";
import { findWorkOrderByCode } from "@/lib/mobile-work-order";
import { logAudit } from "@/lib/audit";
import { notifyStatusChange } from "@/lib/notify";

const resultSchema = z.object({
  passed: z.boolean(),
  rejectRatePercent: z.number().min(0).max(100).optional(),
});

// Keputusan akhir QC papan produksi: Lulus -> tetap di kolom QC (tunggu "Ke Packing").
// Reject -> langsung pindah ke Rework. Hanya berlaku saat WO sedang di stage QC.
export async function POST(req: Request, { params }: { params: Promise<{ code: string }> }) {
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
  if (workOrder.stage !== "QC") {
    return Response.json({ error: "Work Order ini tidak sedang berada di tahap QC" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Body harus JSON" }, { status: 400 });
  }

  const parsed = resultSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Data tidak valid" }, { status: 422 });
  }
  const { passed } = parsed.data;
  const rejectRatePercent = passed ? 0 : Math.min(100, Math.max(0, parsed.data.rejectRatePercent ?? 0));

  await prisma.workOrder.update({
    where: { id: workOrder.id },
    data: passed
      ? { qcPassed: true, rejectRatePercent: 0 }
      : {
          qcPassed: false,
          stage: "REWORK",
          process: "REWORK",
          progressPercent: 70,
          completedAt: null,
          rejectRatePercent,
        },
  });

  await logAudit({
    userId: authResult.userId,
    module: "production",
    action: passed ? "APPROVE" : "REJECT",
    referenceCode: workOrder.code,
    newValue: { qcPassed: passed, rejectRatePercent },
  });

  await notifyStatusChange({
    excludeUserId: authResult.userId,
    moduleKeys: ["produksi"],
    module: "produksi",
    type: "STATUS",
    href: "/produksi",
    referenceCode: workOrder.code,
    title: passed ? "QC lulus" : "QC ditolak — masuk Rework",
    message: passed
      ? `${authResult.name} menyatakan ${workOrder.code} Lolos QC (via mobile). Silakan proses ke Packing.`
      : `${authResult.name} menolak QC ${workOrder.code} (reject ${rejectRatePercent}%) via mobile. Work order dipindahkan ke Rework.`,
  });

  return Response.json({
    code: workOrder.code,
    stage: passed ? "QC" : "REWORK",
    qcPassed: passed,
    rejectRatePercent,
  });
}
