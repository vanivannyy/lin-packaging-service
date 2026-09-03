import { prisma } from "@/lib/prisma";
import type { AuditAction, Prisma } from "@prisma/client";

type LogAuditParams = {
  userId?: string | null;
  module: string;
  action: AuditAction;
  referenceCode?: string;
  oldValue?: Prisma.InputJsonValue | null;
  newValue?: Prisma.InputJsonValue | null;
};

// Audit trail wajib untuk setiap aksi penting - tidak boleh hard delete (lihat .cursorrules).
export async function logAudit(params: LogAuditParams) {
  await prisma.auditTrail.create({
    data: {
      userId: params.userId ?? null,
      module: params.module,
      action: params.action,
      referenceCode: params.referenceCode,
      oldValue: params.oldValue ?? undefined,
      newValue: params.newValue ?? undefined,
    },
  });
}
