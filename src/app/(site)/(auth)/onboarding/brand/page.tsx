"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, ArrowLeft } from "lucide-react";
import { useTranslation } from "@/lib/i18n/context";
import {
  MARKETS,
  MARKET_LABELS,
  INDUSTRIES,
  INDUSTRY_LABELS,
} from "@/lib/constants";
import { brandOnboardingSchema } from "@/lib/validations";
import { submitBrandOnboarding } from "@/app/actions";

export default function BrandOnboardingPage() {
  const router = useRouter();
  const { t } = useTranslation("onboarding.brand");
  const [isPending, startTransition] = useTransition();

  // Step 1
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState("");
  const [targetMarket, setTargetMarket] = useState("");

  // Step 2
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");

  // Validation errors
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit() {
    const result = brandOnboardingSchema.safeParse({
      company_name: companyName,
      industry,
      primary_market: targetMarket,
      description: description || undefined,
      website: website || undefined,
    });

    if (!result.success) {
      const errs: Record<string, string> = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as string;
        if (!errs[key]) errs[key] = issue.message;
      }
      setFieldErrors(errs);
      const firstMsg = result.error.issues[0]?.message;
      toast.error(firstMsg || t("error.fillAll"));
      return;
    }
    setFieldErrors({});

    startTransition(async () => {
      try {
        await submitBrandOnboarding({
          company_name: result.data.company_name,
          industry: result.data.industry,
          primary_market: result.data.primary_market,
          description: result.data.description || undefined,
          website: result.data.website || undefined,
        });
        router.push("/pending-approval");
      } catch (error) {
        if (error instanceof Error && error.message === "Not authenticated") {
          toast.error(t("error.sessionExpired"));
          router.push("/login");
          return;
        }

        toast.error(t("error.brandFailed"));
      }
    });
  }

  return (
    <div className="rounded-xl border border-border bg-card p-8 shadow-sm ring-1 ring-ring/[0.03]">
      <div className="mb-6 flex gap-2">
        <div className="h-1 flex-1 rounded-full bg-foreground" />
        <div className="h-1 flex-1 rounded-full bg-foreground" />
      </div>

      <div>
        <h1 className="text-xl font-bold text-foreground">
          {t("step1.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("step1.desc")}
        </p>

        <div className="mt-6 space-y-6">
          <div className="space-y-4">
            <div>
              <Label htmlFor="company">{t("field.companyName")}</Label>
              <Input
                id="company"
                placeholder={t("field.companyName.placeholder")}
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                className="mt-1.5"
              />
              {fieldErrors.company_name && (
                <p className="mt-1 text-xs text-red-500">{fieldErrors.company_name}</p>
              )}
            </div>

            <div>
              <Label htmlFor="industry">{t("field.industry")}</Label>
              <Select value={industry} onValueChange={(v) => v && setIndustry(v)}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder={t("field.industry.placeholder")} />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map((i) => (
                    <SelectItem key={i} value={i}>
                      {INDUSTRY_LABELS[i]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="market">{t("field.targetMarket")}</Label>
              <Select value={targetMarket} onValueChange={(v) => v && setTargetMarket(v)}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder={t("field.targetMarket.placeholder")} />
                </SelectTrigger>
                <SelectContent>
                  {MARKETS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {MARKET_LABELS[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4 border-t border-border pt-6">
            <div>
              <Label htmlFor="description">{t("field.description")}</Label>
              <Textarea
                id="description"
                placeholder={t("field.description.placeholder")}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1.5"
                rows={3}
              />
              <p className="mt-1 text-xs text-muted-foreground/70">
                {t("field.description.count", { count: String(description.length) })}
              </p>
            </div>

            <div>
              <Label htmlFor="website">{t("field.website")}</Label>
              <Input
                id="website"
                type="url"
                placeholder={t("field.website.placeholder")}
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="mt-1.5"
              />
              {fieldErrors.website && (
                <p className="mt-1 text-xs text-red-500">{fieldErrors.website}</p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <Button
            variant="outline"
            onClick={() => router.push("/onboarding")}
            className="flex-1"
          >
            <ArrowLeft className="me-2 h-4 w-4 rtl:rotate-180" />
            {t("action.back")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending}
            className="flex-1"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              t("action.submit")
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
