"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { formatRelativeTime } from "@/lib/format";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/app/(app)/notifications/actions";

export type NotificationItem = {
  id: string;
  title: string;
  message: string;
  href: string | null;
  isRead: boolean;
  createdAt: string;
};

export function NotificationBell({
  notifications,
  unreadCount,
}: {
  notifications: NotificationItem[];
  unreadCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const wrapRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function openItem(item: NotificationItem) {
    startTransition(async () => {
      if (!item.isRead) await markNotificationReadAction(item.id);
      setOpen(false);
      if (item.href) router.push(item.href);
    });
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative flex h-9 w-9 items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50"
        aria-label="Notifikasi"
      >
        <Bell size={16} />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-[22rem] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-gray-100 px-3 py-2">
            <p className="text-sm font-semibold text-gray-800">Notifikasi</p>
            {unreadCount > 0 ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => startTransition(() => markAllNotificationsReadAction())}
                className="text-[11px] font-semibold text-blue-600 hover:underline disabled:opacity-50"
              >
                Tandai semua dibaca
              </button>
            ) : null}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-gray-400">Belum ada notifikasi.</p>
            ) : (
              notifications.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openItem(item)}
                  className={`block w-full border-b border-gray-50 px-3 py-2.5 text-left last:border-b-0 hover:bg-gray-50 ${
                    item.isRead ? "bg-white" : "bg-blue-50/60"
                  }`}
                >
                  <p className={`text-sm ${item.isRead ? "font-medium text-gray-700" : "font-semibold text-gray-900"}`}>
                    {item.title}
                  </p>
                  <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{item.message}</p>
                  <p className="mt-1 text-[11px] text-gray-400">{formatRelativeTime(item.createdAt)}</p>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
