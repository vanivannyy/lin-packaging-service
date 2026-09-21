import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireMobileSession } from "@/lib/mobile-auth";
import { canAccessModule } from "@/lib/roles";
import { findWorkOrderByCode } from "@/lib/mobile-work-order";
import { logAudit } from "@/lib/audit";

const checkSchema = z.object({
  checkType: z.enum(["PRINTING", "FINISHING"]),
  passed: z.boolean(),
  note: z.string().trim().max(1000).optional(),
});

// Checklist inspeksi QC (mis. "QC Printing" / "QC Finishing") — riwayat inspeksi,
// tidak menimpa data lama (sesuai model web WorkOrderQcCheck).
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Body harus JSON" }, { status: 400 });
  }

  const parsed = checkSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Data tidak valid" }, { status: 422 });
  }
  const { checkType, passed, note } = parsed.data;

  const check = await prisma.workOrderQcCheck.create({
    data: { workOrderId: workOrder.id, checkType, passed, note: note || null, userId: authResult.userId },
  });

  await logAudit({
    userId: authResult.userId,
    module: "production",
    action: passed ? "APPROVE" : "REJECT",
    referenceCode: workOrder.code,
    newValue: { checkType, passed, note },
  });

  return Response.json({
    id: check.id,
    checkType: check.checkType,
    passed: check.passed,
    note: check.note,
    createdAt: check.createdAt.toISOString(),
  });
}
