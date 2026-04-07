"use client";

import { Clock, CheckCircle2, Mail, LogOut } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";

export default function PendingApprovalPage() {
  const { t } = useTranslation("auth.pending");

  return (
    <div className="rounded-xl border border-border bg-card p-8 text-center shadow-sm">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100">
        <Clock className="h-7 w-7 text-amber-600" />
      </div>
      <h1 className="mt-4 text-xl font-bold text-foreground">
        {t("title")}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {t("description")}
      </p>

      <div className="mt-8 space-y-4 text-start">
        <h2 className="text-sm font-semibold text-foreground">
          {t("whatsNext")}
        </h2>
        {[
          {
            icon: CheckCircle2,
            text: t("step.verify"),
          },
          {
            icon: Mail,
            text: t("step.email"),
          },
          {
            icon: Clock,
            text: t("step.explore"),
          },
        ].map((step, i) => (
          <div key={i} className="flex items-center gap-3">
            <step.icon className="h-4 w-4 shrink-0 text-foreground" />
            <span className="text-sm text-muted-foreground">{step.text}</span>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-col gap-2">
        <Link
          href="mailto:hello@popsdrops.com"
          className="text-sm text-foreground hover:underline"
        >
          {t("contactSupport")}
        </Link>
        <Link
          href="/"
          className="inline-flex items-center justify-center gap-1 text-sm text-muted-foreground/70 hover:text-muted-foreground"
        >
          <LogOut className="h-3 w-3" />
          {t("backHome")}
        </Link>
      </div>
    </div>
  );
}
