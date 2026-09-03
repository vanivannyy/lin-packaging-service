import { Search, LogOut } from "lucide-react";
import { logoutAction } from "@/app/login/actions";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { NotificationBell } from "@/components/layout/NotificationBell";

export async function Topbar() {
  const session = await getSession();
  const [notifications, unreadCount] = session
    ? await Promise.all([
        prisma.notification.findMany({
          where: { userId: session.userId },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: { id: true, title: true, message: true, href: true, isRead: true, createdAt: true },
        }),
        prisma.notification.count({ where: { userId: session.userId, isRead: false } }),
      ])
    : [[], 0];

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-gray-200 bg-white px-4">
      <div className="relative w-full max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Cari customer, QT, SO, material..."
          className="w-full rounded-md border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-1 focus:ring-blue-400"
        />
      </div>

      <div className="flex items-center gap-3">
        <NotificationBell
          unreadCount={unreadCount}
          notifications={notifications.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() }))}
        />

        <form action={logoutAction}>
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            <LogOut size={14} />
            Keluar
          </button>
        </form>
      </div>
    </header>
  );
}
