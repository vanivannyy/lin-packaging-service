import clsx from "clsx";
import type { LucideIcon } from "lucide-react";

const VALUE_COLOR: Record<string, string> = {
  default: "text-gray-900",
  green: "text-emerald-600",
  red: "text-red-600",
  amber: "text-amber-600",
  blue: "text-blue-600",
};

export function StatCard({
  label,
  value,
  sublabel,
  icon: Icon,
  valueColor = "default",
}: {
  label: string;
  value: React.ReactNode;
  sublabel?: React.ReactNode;
  icon?: LucideIcon;
  valueColor?: keyof typeof VALUE_COLOR;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="pr-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
        {Icon ? <Icon size={15} className="text-gray-400" /> : null}
      </div>
      <p className={clsx("break-words text-xl font-bold tracking-tight sm:text-2xl", VALUE_COLOR[valueColor])}>{value}</p>
      {sublabel ? <p className="mt-1 text-xs text-gray-400">{sublabel}</p> : null}
    </div>
  );
}
