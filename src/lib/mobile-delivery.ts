import { prisma } from "@/lib/prisma";

export async function findDeliveryByCode(rawCode: string) {
  const code = rawCode.trim().toUpperCase();
  return prisma.deliveryOrder.findFirst({
    where: {
      isDeleted: false,
      OR: [{ code: { equals: code, mode: "insensitive" } }, { salesOrder: { code: { equals: code, mode: "insensitive" } } }],
    },
    include: { salesOrder: { include: { customer: true, product: true } } },
  });
}
