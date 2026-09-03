import clsx from "clsx";

const STATUS_STYLE: Record<string, string> = {
  // generic
  ACTIVE: "bg-emerald-50 text-emerald-700 border-emerald-200",
  INACTIVE: "bg-gray-100 text-gray-500 border-gray-200",
  DRAFT: "bg-gray-100 text-gray-600 border-gray-200",
  SENT: "bg-blue-50 text-blue-700 border-blue-200",
  ACCEPTED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  REJECTED: "bg-red-50 text-red-700 border-red-200",
  EXPIRED: "bg-gray-100 text-gray-500 border-gray-200",
  // sales order / production
  MATERIAL_CHECK: "bg-amber-50 text-amber-700 border-amber-200",
  PRODUCTION: "bg-blue-50 text-blue-700 border-blue-200",
  READY_DELIVERY: "bg-emerald-50 text-emerald-700 border-emerald-200",
  DELIVERED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CANCELLED: "bg-red-50 text-red-700 border-red-200",
  // purchasing
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  APPROVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  RECEIVED: "bg-blue-50 text-blue-700 border-blue-200",
  // invoice
  UNPAID: "bg-amber-50 text-amber-700 border-amber-200",
  PARTIAL: "bg-blue-50 text-blue-700 border-blue-200",
  PAID: "bg-emerald-50 text-emerald-700 border-emerald-200",
  OVERDUE: "bg-red-50 text-red-700 border-red-200",
  // priority
  NORMAL: "bg-gray-100 text-gray-600 border-gray-200",
  URGENT: "bg-red-50 text-red-700 border-red-200",
};

const STATUS_LABEL: Record<string, string> = {
  MATERIAL_CHECK: "Material Check",
  READY_DELIVERY: "Ready Delivery",
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLE[status] ?? "bg-gray-100 text-gray-600 border-gray-200";
  const label = STATUS_LABEL[status] ?? status.replaceAll("_", " ");
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        style
      )}
    >
      {label}
    </span>
  );
}
