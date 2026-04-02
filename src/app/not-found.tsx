import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4">
      <div className="mx-auto max-w-sm text-center">
        <p className="mb-2 text-6xl font-bold text-muted-foreground/30">404</p>
        <h2 className="mb-2 text-lg font-semibold text-foreground">
          Page not found
        </h2>
        <p className="mb-6 text-sm text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background hover:bg-foreground/90"
        >
          <ArrowLeft className="size-4" />
          Back to home
        </Link>
      </div>
    </div>
  );
}
