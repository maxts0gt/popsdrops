"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  PLATFORMS,
  PLATFORM_LABELS,
  NICHES,
  NICHE_LABELS,
  MARKETS,
  MARKET_LABELS,
} from "@/lib/constants";
import {
  creatorOnboardingStep1Schema,
  creatorOnboardingStep2Schema,
} from "@/lib/validations";

export default function CreatorOnboardingPage() {
  const router = useRouter();
  const supabase = createClient();
  const { t } = useTranslation("onboarding.creator");
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1 fields
  const [fullName, setFullName] = useState("");
  const [primaryMarket, setPrimaryMarket] = useState("");
  const [platformUrl, setPlatformUrl] = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState("");

  // Step 2 fields
  const [selectedNiches, setSelectedNiches] = useState<string[]>([]);
  const [baseRate, setBaseRate] = useState("");
  const [slug, setSlug] = useState("");

  // Validation errors
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function toggleNiche(niche: string) {
    setSelectedNiches((prev) =>
      prev.includes(niche)
        ? prev.filter((n) => n !== niche)
        : prev.length < 5
          ? [...prev, niche]
          : prev
    );
  }

  function generateSlug(name: string) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  async function handleSubmit() {
    const profileSlugValue = slug || generateSlug(fullName);
    const step2Result = creatorOnboardingStep2Schema.safeParse({
      niches: selectedNiches,
      base_rate: baseRate || 0,
      slug: profileSlugValue,
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

    const profileSlug = slug || generateSlug(fullName);

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: user.id,
      role: "creator",
      full_name: fullName,
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

    const { error: creatorError } = await supabase
      .from("creator_profiles")
      .insert({
        profile_id: user.id,
        slug: profileSlug,
        primary_market: primaryMarket,
        [selectedPlatform]: { url: platformUrl },
        niches: selectedNiches,
        markets: [primaryMarket],
        rate_card: baseRate
          ? { [selectedPlatform]: { post: parseInt(baseRate) } }
          : null,
        rate_currency: "USD",
      });

    if (creatorError) {
      if (creatorError.code === "23505") {
        toast.error(t("error.slugTaken"));
      } else {
        toast.error(t("error.creatorFailed"));
      }
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
              <Label htmlFor="name">{t("field.displayName")}</Label>
              <Input
                id="name"
                placeholder={t("field.displayName.placeholder")}
                value={fullName}
                onChange={(e) => {
                  setFullName(e.target.value);
                  if (!slug) setSlug(generateSlug(e.target.value));
                }}
                className="mt-1.5"
              />
              {fieldErrors.full_name && (
                <p className="mt-1 text-xs text-red-500">{fieldErrors.full_name}</p>
              )}
            </div>

            <div>
              <Label htmlFor="market">{t("field.primaryMarket")}</Label>
              <Select value={primaryMarket} onValueChange={(v) => v && setPrimaryMarket(v)}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder={t("field.primaryMarket.placeholder")} />
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

            <div>
              <Label>{t("field.addSocial")}</Label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {PLATFORMS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setSelectedPlatform(p)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      selectedPlatform === p
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {PLATFORM_LABELS[p]}
                  </button>
                ))}
              </div>
              {selectedPlatform && (
                <Input
                  placeholder={`Your ${PLATFORM_LABELS[selectedPlatform as keyof typeof PLATFORM_LABELS]} profile URL`}
                  value={platformUrl}
                  onChange={(e) => setPlatformUrl(e.target.value)}
                  className="mt-2"
                />
              )}
              {fieldErrors.social_url && (
                <p className="mt-1 text-xs text-red-500">{fieldErrors.social_url}</p>
              )}
              {fieldErrors.social_platform && (
                <p className="mt-1 text-xs text-red-500">{fieldErrors.social_platform}</p>
              )}
            </div>
          </div>

          <Button
            className="mt-6 w-full"
            onClick={() => {
              const result = creatorOnboardingStep1Schema.safeParse({
                full_name: fullName,
                primary_market: primaryMarket,
                social_url: platformUrl,
                social_platform: selectedPlatform,
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
              <Label>{t("field.niches")}</Label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {NICHES.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => toggleNiche(n)}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      selectedNiches.includes(n)
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {NICHE_LABELS[n]}
                  </button>
                ))}
              </div>
              {fieldErrors.niches && (
                <p className="mt-1 text-xs text-red-500">{fieldErrors.niches}</p>
              )}
            </div>

            <div>
              <Label htmlFor="rate">{t("field.baseRate")}</Label>
              <Input
                id="rate"
                type="number"
                placeholder={t("field.baseRate.placeholder")}
                value={baseRate}
                onChange={(e) => setBaseRate(e.target.value)}
                className="mt-1.5"
              />
              <p className="mt-1 text-xs text-muted-foreground/70">
                {t("field.baseRate.hint")}
              </p>
              {fieldErrors.base_rate && (
                <p className="mt-1 text-xs text-red-500">{fieldErrors.base_rate}</p>
              )}
            </div>

            <div>
              <Label htmlFor="slug">{t("field.profileUrl")}</Label>
              <div className="mt-1.5 flex items-center gap-0">
                <span className="rounded-s-lg border border-e-0 border-border bg-muted/50 px-3 py-2.5 text-xs text-muted-foreground">
                  popsdrops.com/c/
                </span>
                <Input
                  id="slug"
                  value={slug}
                  onChange={(e) =>
                    setSlug(
                      e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9-]/g, "")
                    )
                  }
                  className="rounded-s-none"
                  placeholder={t("field.profileUrl.placeholder")}
                />
              </div>
              {fieldErrors.slug && (
                <p className="mt-1 text-xs text-red-500">{fieldErrors.slug}</p>
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
