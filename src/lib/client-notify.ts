import { prisma } from "@/lib/prisma";

type NotifyClientParams = {
  customerId: string;
  title: string;
  message: string;
  href?: string;
  type?: "STATUS" | "LOW_STOCK";
  referenceCode?: string;
};

/** Kirim notifikasi in-app ke semua akun aktif milik satu Customer (bisa lebih dari 1 PIC). */
export async function notifyClientAccounts(params: NotifyClientParams) {
  try {
    const accounts = await prisma.clientAccount.findMany({
      where: { customerId: params.customerId, isActive: true, isDeleted: false },
      select: { id: true },
    });
    if (accounts.length === 0) return;

    await prisma.clientNotification.createMany({
      data: accounts.map((a) => ({
        clientAccountId: a.id,
        title: params.title,
        message: params.message,
        href: params.href,
        referenceCode: params.referenceCode,
        type: params.type ?? "STATUS",
      })),
    });
  } catch (error) {
    console.error("Gagal mengirim notifikasi client app:", error);
  }
}
