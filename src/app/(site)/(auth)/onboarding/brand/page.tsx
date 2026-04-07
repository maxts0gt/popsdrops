"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
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
import { Loader2, ArrowRight, ArrowLeft } from "lucide-react";
import { useTranslation } from "@/lib/i18n/context";
import {
  MARKETS,
  MARKET_LABELS,
  INDUSTRIES,
  INDUSTRY_LABELS,
} from "@/lib/constants";
import {
  brandOnboardingStep1Schema,
  brandOnboardingStep2Schema,
} from "@/lib/validations";

export default function BrandOnboardingPage() {
  const router = useRouter();
  const supabase = createClient();
  const { t } = useTranslation("onboarding.brand");
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

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
    const step2Result = brandOnboardingStep2Schema.safeParse({
      description: description || undefined,
      website: website || undefined,
    });
    if (!step2Result.success) {
      const errs: Record<string, string> = {};
      for (const issue of step2Result.error.issues) {
        const key = issue.path[0] as string;
        if (!errs[key]) errs[key] = issue.message;
      }
      setFieldErrors(errs);
      const firstMsg = step2Result.error.issues[0]?.message;
      toast.error(firstMsg || t("error.fillAll"));
      return;
    }
    setFieldErrors({});

    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      toast.error(t("error.sessionExpired"));
      router.push("/login");
      return;
    }

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: user.id,
      role: "brand",
      full_name: user.user_metadata?.full_name ?? companyName,
      email: user.email!,
      avatar_url: user.user_metadata?.avatar_url ?? null,
      status: "pending",
      onboarding_completed: true,
    });

    if (profileError) {
      toast.error(t("error.profileFailed"));
      setLoading(false);
      return;
    }

    const { error: brandError } = await supabase.from("brand_profiles").insert({
      profile_id: user.id,
      company_name: companyName,
      industry,
      target_markets: [targetMarket],
      description: description || null,
      website: website || null,
      contact_name: user.user_metadata?.full_name ?? "",
      contact_email: user.email!,
    });

    if (brandError) {
      toast.error(t("error.brandFailed"));
      setLoading(false);
      return;
    }

    router.push("/pending-approval");
  }

  return (
    <div className="rounded-xl border border-border bg-card p-8 shadow-sm ring-1 ring-ring/[0.03]">
      {/* Progress */}
      <div className="mb-6 flex gap-2">
        <div
          className={`h-1 flex-1 rounded-full ${step >= 1 ? "bg-foreground" : "bg-border"}`}
        />
        <div
          className={`h-1 flex-1 rounded-full ${step >= 2 ? "bg-foreground" : "bg-border"}`}
        />
      </div>

      {step === 1 && (
        <div>
          <h1 className="text-xl font-bold text-foreground">
            {t("step1.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("step1.desc")}
          </p>

          <div className="mt-6 space-y-4">
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

          <Button
            className="mt-6 w-full"
            onClick={() => {
              const result = brandOnboardingStep1Schema.safeParse({
                company_name: companyName,
                industry,
                primary_market: targetMarket,
              });
              if (!result.success) {
                const errs: Record<string, string> = {};
                for (const issue of result.error.issues) {
                  const key = issue.path[0] as string;
                  if (!errs[key]) errs[key] = issue.message;
                }
                setFieldErrors(errs);
                const firstMsg = result.error.issues[0]?.message;
                toast.error(firstMsg || t("error.fillFields"));
                return;
              }
              setFieldErrors({});
              setStep(2);
            }}
          >
            {t("action.continue")}
            <ArrowRight className="ms-2 h-4 w-4 rtl:rotate-180" />
          </Button>
        </div>
      )}

      {step === 2 && (
        <div>
          <h1 className="text-xl font-bold text-foreground">
            {t("step2.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("step2.desc")}
          </p>

          <div className="mt-6 space-y-4">
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

          <div className="mt-6 flex gap-3">
            <Button
              variant="outline"
              onClick={() => setStep(1)}
              className="flex-1"
            >
              <ArrowLeft className="me-2 h-4 w-4 rtl:rotate-180" />
              {t("action.back")}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                t("action.submit")
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
