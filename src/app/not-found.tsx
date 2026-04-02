import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="mx-auto max-w-sm text-center">
        <p className="mb-2 text-6xl font-bold text-slate-200">404</p>
        <h2 className="mb-2 text-lg font-semibold text-slate-900">
          Page not found
        </h2>
        <p className="mb-6 text-sm text-slate-500">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <a
          href="/"
          className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          <ArrowLeft className="size-4" />
          Back to home
        </a>
      </div>
    </div>
  );
}
