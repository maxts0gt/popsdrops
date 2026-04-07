"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/context";

export default function OnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const suggestedRole = searchParams.get("role");
  const { t } = useTranslation("auth.onboarding");

  function selectRole(role: "creator" | "brand") {
    router.push(`/onboarding/${role}`);
  }

  return (
    <div>
      <div className="text-center">
        <h1 className="text-2xl font-bold text-foreground">
          {t("selectRole.title")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("selectRole.subtitle")}
        </p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <button
          onClick={() => selectRole("creator")}
          className={cn(
            "group rounded-xl border-2 p-6 text-start transition-all hover:border-foreground hover:shadow-md",
            suggestedRole === "creator"
              ? "border-foreground bg-muted/50"
              : "border-border bg-card"
          )}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
            <Sparkles className="h-6 w-6 text-muted-foreground" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-foreground">
            {t("selectRole.creator")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("selectRole.creator.desc")}
          </p>
        </button>

        <button
          onClick={() => selectRole("brand")}
          className={cn(
            "group rounded-xl border-2 p-6 text-start transition-all hover:border-foreground hover:shadow-md",
            suggestedRole === "brand"
              ? "border-foreground bg-muted/50"
              : "border-border bg-card"
          )}
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
            <Building2 className="h-6 w-6 text-muted-foreground" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-foreground">
            {t("selectRole.brand")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("selectRole.brand.desc")}
          </p>
        </button>
      </div>
    </div>
  );
}
