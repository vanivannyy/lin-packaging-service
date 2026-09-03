"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  LayoutGrid,
  BarChart3,
  Users,
  Building2,
  FileText,
  ClipboardList,
  KanbanSquare,
  Truck,
  ShoppingCart,
  Boxes,
  Receipt,
  Calculator,
  Tag,
  Package,
  Layers,
  Palette,
  UserCog,
  History,
  Settings,
  X,
  type LucideIcon,
} from "lucide-react";
import { NAV_GROUPS, type NavItem } from "@/lib/nav";
import { ROLE_LABEL, canAccessModule } from "@/lib/roles";
import type { UserRole } from "@prisma/client";

const ICON_MAP: Record<NavItem["icon"], LucideIcon> = {
  dashboard: LayoutGrid,
  report: BarChart3,
  crm: Users,
  customer: Building2,
  quotation: FileText,
  salesOrder: ClipboardList,
  production: KanbanSquare,
  delivery: Truck,
  purchase: ShoppingCart,
  material: Boxes,
  invoice: Receipt,
  calculator: Calculator,
  priceTag: Tag,
  product: Package,
  category: Layers,
  design: Palette,
  userRole: UserCog,
  audit: History,
  settings: Settings,
};

export function Sidebar({
  userName,
  userRole,
  open,
  onClose,
}: {
  userName: string;
  userRole: UserRole;
  open: boolean;
  onClose: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={clsx(
        "flex h-[100dvh] w-[min(16.5rem,85vw)] shrink-0 flex-col bg-navy-950 text-slate-300",
        "fixed inset-y-0 left-0 z-50 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
        "transition-transform duration-200 ease-out",
        "shadow-xl md:static md:h-full md:w-60 md:translate-x-0 md:pt-0 md:pb-0 md:shadow-none",
        open ? "translate-x-0" : "-translate-x-full pointer-events-none md:pointer-events-auto"
      )}
    >
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-blue-600 text-sm font-bold text-white">
          LP
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold leading-tight text-white">LIN PACKAGING</p>
          <p className="text-[10px] uppercase tracking-widest text-slate-500">Service</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-white/10 hover:text-white md:hidden"
          aria-label="Tutup menu"
        >
          <X size={16} />
        </button>
      </div>

      <nav className="scrollbar-thin flex-1 overflow-y-auto px-3 pb-4">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((item) => canAccessModule(userRole, item.key));
          if (items.length === 0) return null;
          return (
            <div key={group.title} className="mb-4">
              <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-slate-600">
                {group.title}
              </p>
              <ul className="space-y-0.5">
                {items.map((item) => {
                  const Icon = ICON_MAP[item.icon];
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <li key={item.key}>
                      <Link
                        href={item.href}
                        onClick={onClose}
                        className={clsx(
                          "flex min-h-10 items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors md:min-h-0",
                          active
                            ? "bg-blue-600 text-white"
                            : "text-slate-300 hover:bg-white/5 hover:text-white"
                        )}
                      >
                        <Icon size={16} strokeWidth={2} />
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-white/10 px-4 py-3">
        <p className="truncate text-sm font-medium text-white">{userName}</p>
        <p className="text-[11px] uppercase tracking-wide text-slate-500">{ROLE_LABEL[userRole]}</p>
      </div>
    </aside>
  );
}
