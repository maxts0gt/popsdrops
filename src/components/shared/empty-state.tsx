import type { LucideIcon } from "lucide-react";
import { LinkButton } from "@/components/ui/link-button";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Icon className="h-12 w-12 text-slate-300" />
      <h3 className="mt-4 text-lg font-medium text-slate-900">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>
      {actionLabel && actionHref && (
        <LinkButton href={actionHref} className="mt-4">
          {actionLabel}
        </LinkButton>
      )}
    </div>
  );
}
