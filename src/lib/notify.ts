import { prisma } from "@/lib/prisma";
import { rolesForModule } from "@/lib/roles";

type NotifyParams = {
  title: string;
  message: string;
  href: string;
  module: string;
  referenceCode?: string;
  type?: "STATUS" | "APPROVAL" | "ACTION";
  /** User yang melakukan aksi — tidak dikirimi notifikasi sendiri. */
  excludeUserId?: string;
  /** Modul yang aksesnya menentukan penerima (role yang boleh ubah status). */
  moduleKeys: string[];
  /** Penerima tambahan (pemilik dokumen, requester, dll). */
  extraUserIds?: Array<string | null | undefined>;
};

export async function notifyStatusChange(params: NotifyParams) {
  try {
    const roles = [...new Set(params.moduleKeys.flatMap((key) => rolesForModule(key)))];
    const moduleUsers =
      roles.length === 0
        ? []
        : await prisma.user.findMany({
            where: {
              isActive: true,
              isDeleted: false,
              role: { in: roles },
              ...(params.excludeUserId ? { id: { not: params.excludeUserId } } : {}),
            },
            select: { id: true },
          });

    const userIds = new Set(moduleUsers.map((u) => u.id));
    for (const extra of params.extraUserIds ?? []) {
      if (extra && extra !== params.excludeUserId) userIds.add(extra);
    }
    if (userIds.size === 0) return;

    await prisma.notification.createMany({
      data: [...userIds].map((userId) => ({
        userId,
        title: params.title,
        message: params.message,
        href: params.href,
        module: params.module,
        referenceCode: params.referenceCode,
        type: params.type ?? "STATUS",
      })),
    });
  } catch (error) {
    console.error("Gagal mengirim notifikasi:", error);
  }
}
