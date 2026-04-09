"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Sparkles, Building2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/context";

export default function OnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const suggestedRole = searchParams.get("role");
  const { t } = useTranslation("auth.onboarding");
  const { t: tCreator } = useTranslation("onboarding.creator");
  const [selectedRole, setSelectedRole] = useState<"creator" | "brand" | null>(
    suggestedRole === "creator" || suggestedRole === "brand"
      ? suggestedRole
      : null
  );

  function continueToRole() {
    if (!selectedRole) {
      return;
    }

    router.push(`/onboarding/${selectedRole}`);
  }

  return (
    <div>
      <div className="mb-6 flex gap-2">
        <div className="h-1 flex-1 rounded-full bg-foreground" />
        <div className="h-1 flex-1 rounded-full bg-border" />
      </div>

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
          type="button"
          onClick={() => setSelectedRole("creator")}
          className={cn(
            "group rounded-xl border-2 p-6 text-start transition-all hover:border-foreground hover:shadow-md",
            selectedRole === "creator"
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
          type="button"
          onClick={() => setSelectedRole("brand")}
          className={cn(
            "group rounded-xl border-2 p-6 text-start transition-all hover:border-foreground hover:shadow-md",
            selectedRole === "brand"
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

      <Button
        className="mt-6 w-full"
        disabled={!selectedRole}
        onClick={continueToRole}
      >
        {tCreator("action.continue")}
        <ArrowRight className="ms-2 h-4 w-4 rtl:rotate-180" />
      </Button>
    </div>
  );
}
