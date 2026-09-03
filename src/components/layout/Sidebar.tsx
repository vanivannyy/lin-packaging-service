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
}: {
  userName: string;
  userRole: UserRole;
}) {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col bg-navy-950 text-slate-300">
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-blue-600 text-sm font-bold text-white">
          LP
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight text-white">LIN PACKAGING</p>
          <p className="text-[10px] uppercase tracking-widest text-slate-500">Service</p>
        </div>
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
                        className={clsx(
                          "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
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
