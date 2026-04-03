import { cn } from "@/lib/utils";
import {
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_STATUS_COLORS,
  type CampaignStatus,
} from "@/lib/constants";

interface StatusBadgeProps {
  status: CampaignStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center text-xs font-medium",
        CAMPAIGN_STATUS_COLORS[status],
        className
      )}
    >
      {CAMPAIGN_STATUS_LABELS[status]}
    </span>
  );
}
