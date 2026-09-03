"use client";

import { Menu } from "lucide-react";
import { useSidebar } from "./AppShell";

export function MobileMenuButton() {
  const { open, toggle } = useSidebar();

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 md:hidden"
      aria-label={open ? "Tutup menu" : "Buka menu"}
      aria-expanded={open}
    >
      <Menu size={18} />
    </button>
  );
}
