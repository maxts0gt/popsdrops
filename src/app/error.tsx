"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="mx-auto max-w-sm text-center">
        <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-slate-100">
          <AlertTriangle className="size-6 text-slate-500" />
        </div>
        <h2 className="mb-2 text-lg font-semibold text-slate-900">
          Something went wrong
        </h2>
        <p className="mb-6 text-sm text-slate-500">
          An unexpected error occurred. Please try again.
        </p>
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          <RotateCcw className="size-4" />
          Try again
        </button>
      </div>
    </div>
  );
}
