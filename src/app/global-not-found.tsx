import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { DocumentShell } from "@/components/document-shell";
import "./globals.css";

export default function GlobalNotFound() {
  return (
    <DocumentShell locale="en">
      <main className="flex min-h-svh items-center justify-center bg-background px-4">
        <div className="mx-auto max-w-sm text-center">
          <p className="mb-2 text-6xl font-bold text-muted-foreground/30">
            404
          </p>
          <h1 className="mb-2 text-lg font-semibold text-foreground">
            Page not found
          </h1>
          <p className="mb-6 text-sm text-muted-foreground">
            The page you are looking for does not exist or has moved.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background hover:bg-foreground/90"
          >
            <ArrowLeft className="size-4" />
            Back to home
          </Link>
        </div>
      </main>
    </DocumentShell>
  );
}
