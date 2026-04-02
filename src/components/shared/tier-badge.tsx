import { cn } from "@/lib/utils";
import {
  CREATOR_TIER_LABELS,
  CREATOR_TIER_COLORS,
  type CreatorTier,
} from "@/lib/constants";

interface TierBadgeProps {
  tier: CreatorTier;
  className?: string;
}

export function TierBadge({ tier, className }: TierBadgeProps) {
  if (tier === "new") return null;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        CREATOR_TIER_COLORS[tier],
        className
      )}
    >
      {CREATOR_TIER_LABELS[tier]}
    </span>
  );
}
