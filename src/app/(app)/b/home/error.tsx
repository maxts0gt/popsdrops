"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function BrandHomeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Brand home error:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-sm text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-slate-100">
          <AlertTriangle className="size-6 text-slate-500" />
        </div>
        <h2 className="mb-2 text-lg font-semibold text-slate-900">
          Couldn&apos;t load your dashboard
        </h2>
        <p className="mb-6 text-sm text-slate-500">
          Something went wrong. Your campaigns and data are safe.
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-slate-800"
        >
          <RotateCcw className="size-4" />
          Try again
        </button>
      </div>
    </div>
  );
}
