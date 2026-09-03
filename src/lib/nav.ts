export type NavItem = {
  key: string;
  label: string;
  href: string;
  icon:
    | "dashboard"
    | "report"
    | "crm"
    | "customer"
    | "quotation"
    | "salesOrder"
    | "production"
    | "delivery"
    | "purchase"
    | "material"
    | "invoice"
    | "calculator"
    | "priceTag"
    | "product"
    | "category"
    | "design"
    | "userRole"
    | "audit"
    | "settings";
};

export type NavGroup = {
  title: string;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Kontrol",
    items: [
      { key: "dashboard", label: "Dashboard", href: "/dashboard", icon: "dashboard" },
      { key: "laporan", label: "Laporan", href: "/laporan", icon: "report" },
    ],
  },
  {
    title: "Penjualan",
    items: [
      { key: "crm", label: "CRM / Leads", href: "/crm", icon: "crm" },
      { key: "customer", label: "Customer", href: "/customer", icon: "customer" },
      { key: "quotation", label: "Quotation", href: "/quotation", icon: "quotation" },
      { key: "sales-order", label: "Sales Order", href: "/sales-order", icon: "salesOrder" },
    ],
  },
  {
    title: "Produksi & Stok",
    items: [
      { key: "produksi", label: "Papan Produksi", href: "/produksi", icon: "production" },
      { key: "delivery", label: "Delivery", href: "/delivery", icon: "delivery" },
      { key: "purchase-request", label: "Purchase Request", href: "/purchase-request", icon: "purchase" },
      { key: "material-stok", label: "Material & Stok", href: "/material-stok", icon: "material" },
    ],
  },
  {
    title: "Keuangan",
    items: [{ key: "invoice", label: "Invoice & Piutang", href: "/invoice", icon: "invoice" }],
  },
  {
    title: "Harga & Master",
    items: [
      { key: "kalkulator-hpp", label: "Kalkulator HPP", href: "/kalkulator-hpp", icon: "calculator" },
      { key: "price-master", label: "Price Master", href: "/price-master", icon: "priceTag" },
      { key: "produk", label: "Produk", href: "/produk", icon: "product" },
      { key: "produk-kategori", label: "Kategori Produk", href: "/produk-kategori", icon: "category" },
      { key: "design-master", label: "Master Design", href: "/design-master", icon: "design" },
    ],
  },
  {
    title: "Sistem",
    items: [
      { key: "user-role", label: "User & Role", href: "/user-role", icon: "userRole" },
      { key: "audit-trail", label: "Audit Trail", href: "/audit-trail", icon: "audit" },
      { key: "pengaturan", label: "Pengaturan", href: "/pengaturan", icon: "settings" },
    ],
  },
];
