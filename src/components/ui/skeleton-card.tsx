/**
 * Content-shaped skeleton loading cards.
 * Use these instead of spinners — they match the layout the user is about to see.
 */

export function SkeletonKPICards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-xl border border-border/60 bg-card p-5">
          <div className="flex items-center gap-3">
            <div className="size-9 animate-pulse rounded-lg bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-5 w-16 animate-pulse rounded bg-muted" />
              <div className="h-3 w-24 animate-pulse rounded bg-muted/50" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card">
      {/* Header */}
      <div className="flex gap-4 border-b border-border/50 px-6 py-4">
        {Array.from({ length: cols }, (_, i) => (
          <div key={i} className="h-3 flex-1 animate-pulse rounded bg-muted" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-b border-muted/50 px-6 py-4 last:border-0">
          <div className="size-7 animate-pulse rounded-full bg-muted" />
          {Array.from({ length: cols - 1 }, (_, j) => (
            <div key={j} className="h-3 flex-1 animate-pulse rounded bg-muted/50" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-6">
      <div className="space-y-4">
        <div className="h-5 w-32 animate-pulse rounded bg-muted" />
        <div className="h-3 w-full animate-pulse rounded bg-muted/50" />
        <div className="h-3 w-3/4 animate-pulse rounded bg-muted/50" />
      </div>
    </div>
  );
}

export function SkeletonPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="h-7 w-48 animate-pulse rounded-lg bg-muted" />
        <div className="h-4 w-72 animate-pulse rounded bg-muted/50" />
      </div>
      {/* KPIs */}
      <SkeletonKPICards />
      {/* Content */}
      <SkeletonTable />
    </div>
  );
}
