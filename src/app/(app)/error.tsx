"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error:", error);
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
          We hit an unexpected error. Your data is safe.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
          >
            <RotateCcw className="size-4" />
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Home className="size-4" />
            Home
          </a>
        </div>
      </div>
    </div>
  );
}
