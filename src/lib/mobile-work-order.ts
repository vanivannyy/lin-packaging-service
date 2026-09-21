import { prisma } from "@/lib/prisma";

export async function findWorkOrderByCode(rawCode: string) {
  const code = rawCode.trim().toUpperCase();
  return prisma.workOrder.findFirst({
    where: { isDeleted: false, code: { equals: code, mode: "insensitive" } },
    include: {
      salesOrder: { include: { customer: true, product: true } },
      qcChecks: { orderBy: { createdAt: "desc" }, take: 10, include: { user: true } },
    },
  });
}
