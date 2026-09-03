import type { UserRole } from "@prisma/client";
import { NAV_GROUPS } from "@/lib/nav";

export const ROLE_LABEL: Record<UserRole, string> = {
  OWNER: "Owner",
  SALES_MANAGER: "Sales Manager",
  SALES: "Sales",
  FINANCE: "Finance",
  WAREHOUSE: "Warehouse",
  QC: "QC",
  PURCHASING: "Purchasing",
  PRODUCTION_PLANNER: "Production Planner",
};

// Modul yang boleh diakses tiap role. OWNER selalu akses semua.
export const ROLE_MODULES: Record<UserRole, string[]> = {
  OWNER: ["*"],
  SALES_MANAGER: [
    "dashboard",
    "laporan",
    "crm",
    "customer",
    "quotation",
    "sales-order",
    "produksi",
    "delivery",
    "invoice",
    "produk",
    "produk-kategori",
    "design-master",
    "kalkulator-hpp",
    "price-master",
  ],
  SALES: ["dashboard", "crm", "customer", "quotation", "sales-order", "kalkulator-hpp", "design-master"],
  FINANCE: ["dashboard", "laporan", "invoice", "customer"],
  WAREHOUSE: ["dashboard", "material-stok", "purchase-request", "delivery"],
  QC: ["dashboard", "produksi"],
  PURCHASING: ["dashboard", "purchase-request", "material-stok"],
  PRODUCTION_PLANNER: ["dashboard", "produksi", "delivery", "sales-order", "material-stok", "design-master"],
};

const API_MODULE_PREFIXES: Array<[string, string]> = [
  ["/api/export/sales-order", "sales-order"],
  ["/api/export/quotation", "quotation"],
  ["/api/export/produksi", "produksi"],
  ["/api/export/invoice", "invoice"],
  ["/api/export/laporan", "laporan"],
];

export function canAccessModule(role: UserRole, moduleKey: string): boolean {
  const allowed = ROLE_MODULES[role];
  return allowed.includes("*") || allowed.includes(moduleKey);
}

export function rolesForModule(moduleKey: string): UserRole[] {
  return (Object.entries(ROLE_MODULES) as [UserRole, string[]][])
    .filter(([, modules]) => modules.includes("*") || modules.includes(moduleKey))
    .map(([role]) => role);
}

export function getModuleFromPath(pathname: string): string | null {
  const path = pathname.split("?")[0];

  for (const [prefix, moduleKey] of API_MODULE_PREFIXES) {
    if (path === prefix || path.startsWith(`${prefix}/`)) return moduleKey;
  }

  const items = NAV_GROUPS.flatMap((group) => group.items).sort((a, b) => b.href.length - a.href.length);
  for (const item of items) {
    if (path === item.href || path.startsWith(`${item.href}/`)) return item.key;
  }

  return null;
}

export function canAccessPath(role: UserRole, pathname: string): boolean {
  const moduleKey = getModuleFromPath(pathname);
  if (!moduleKey) return true;
  return canAccessModule(role, moduleKey);
}
