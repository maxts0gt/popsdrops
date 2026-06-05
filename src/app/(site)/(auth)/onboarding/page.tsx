"use client";

import { ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n/context";

export default function OnboardingPage() {
  const { t } = useTranslation("auth.pending");

  return (
    <div className="rounded-xl border border-border bg-card p-8 text-center shadow-sm">
      {/* Closed launch fallback for old onboarding links. */}
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
        <ShieldCheck className="h-7 w-7 text-foreground" />
      </div>
      <h1 className="mt-4 text-xl font-bold text-foreground">
        {t("title")}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {t("description")}
      </p>
      <div className="mt-8 flex flex-col gap-2">
        <Link
          href="/request-invite"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-foreground px-4 text-sm font-semibold text-background"
        >
          {t("contactSupport")}
        </Link>
        <Link
          href="/"
          className="inline-flex h-10 items-center justify-center text-sm text-muted-foreground hover:text-foreground"
        >
          {t("backHome")}
        </Link>
      </div>
    </div>
  );
}
