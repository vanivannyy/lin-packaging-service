import { Search, LogOut } from "lucide-react";
import { logoutAction } from "@/app/login/actions";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { NotificationBell } from "@/components/layout/NotificationBell";
import { MobileMenuButton } from "@/components/layout/MobileMenuButton";

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
    <header className="flex min-h-14 shrink-0 items-center gap-2 border-b border-gray-200 bg-white px-3 pt-[env(safe-area-inset-top)] sm:gap-4 sm:px-4">
      <MobileMenuButton />

      <div className="relative min-w-0 flex-1 max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="search"
          placeholder="Cari customer, QT, SO..."
          className="w-full rounded-md border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-1 focus:ring-blue-400"
          aria-label="Cari"
        />
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <NotificationBell
          unreadCount={unreadCount}
          notifications={notifications.map((n) => ({ ...n, createdAt: n.createdAt.toISOString() }))}
        />

        <form action={logoutAction}>
          <button
            type="submit"
            className="flex h-9 items-center gap-1.5 rounded-md border border-gray-200 px-2 text-sm font-medium text-gray-600 hover:bg-gray-50 sm:px-3"
            aria-label="Keluar"
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">Keluar</span>
          </button>
        </form>
      </div>
    </header>
  );
}
