import { cn } from "@/lib/utils";
import {
  PLATFORM_LABELS,
  PLATFORM_COLORS,
  type Platform,
} from "@/lib/constants";

interface PlatformBadgeProps {
  platform: Platform;
  className?: string;
}

export function PlatformBadge({ platform, className }: PlatformBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
        PLATFORM_COLORS[platform],
        className
      )}
    >
      {PLATFORM_LABELS[platform]}
    </span>
  );
}
