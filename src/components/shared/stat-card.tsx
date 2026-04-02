import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  detail?: string;
  icon?: LucideIcon;
  trend?: "up" | "down" | "neutral";
  className?: string;
}

export function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  trend,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl bg-white p-4 shadow-sm border border-slate-200",
        className
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-500">{label}</p>
        {Icon && <Icon className="h-4 w-4 text-slate-400" />}
      </div>
      <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
      {detail && (
        <p
          className={cn(
            "mt-0.5 text-xs",
            trend === "up" && "text-emerald-600",
            trend === "down" && "text-red-500",
            (!trend || trend === "neutral") && "text-slate-400"
          )}
        >
          {detail}
        </p>
      )}
    </div>
  );
}
