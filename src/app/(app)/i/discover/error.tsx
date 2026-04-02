"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function DiscoverError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Discover page error:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 lg:px-6">
      <div className="mx-auto max-w-sm text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-muted">
          <AlertTriangle className="size-6 text-muted-foreground" />
        </div>
        <h2 className="mb-2 text-lg font-semibold text-foreground">
          Couldn&apos;t load campaigns
        </h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Something went wrong loading available campaigns.
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90"
        >
          <RotateCcw className="size-4" />
          Try again
        </button>
      </div>
    </div>
  );
}
