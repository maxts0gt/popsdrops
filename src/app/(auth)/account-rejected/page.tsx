"use client";

import { XCircle, LogOut } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "@/lib/i18n";

export default function AccountRejectedPage() {
  const { t } = useTranslation("auth.rejected");

  return (
    <div className="rounded-xl border border-border bg-card p-8 text-center shadow-sm">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100">
        <XCircle className="h-7 w-7 text-red-600" />
      </div>
      <h1 className="mt-4 text-xl font-bold text-foreground">
        {t("title")}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {t("description")}
      </p>
      <div className="mt-6 flex flex-col gap-2">
        <Link
          href="mailto:hello@popsdrops.com"
          className="text-sm text-foreground hover:underline"
        >
          {t("contactReapply")}
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
