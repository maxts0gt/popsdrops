import { CheckCircle2, AlertCircle } from "lucide-react";
import type { MetricDataSource } from "@/types/database";

interface MetricSourceBadgeProps {
  source: MetricDataSource;
  className?: string;
}

/**
 * Small badge showing whether metrics are API-verified or self-reported.
 * Used next to performance data in brand dashboards and campaign reports.
 */
export function MetricSourceBadge({ source, className = "" }: MetricSourceBadgeProps) {
  if (source === "api") {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-500/10 ${className}`}
      >
        <CheckCircle2 className="size-3" />
        Verified
      </span>
    );
  }

  if (source === "api_partial") {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 ring-1 ring-blue-500/10 ${className}`}
      >
        <CheckCircle2 className="size-3" />
        Partial
      </span>
    );
  }

  // manual
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-muted/50 px-2 py-0.5 text-[10px] font-medium text-muted-foreground ring-1 ring-ring/[0.06] ${className}`}
    >
      <AlertCircle className="size-3" />
      Self-reported
    </span>
  );
}
