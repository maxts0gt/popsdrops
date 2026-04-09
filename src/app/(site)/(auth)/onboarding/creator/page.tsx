"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { Loader2, ArrowLeft, Plus, X } from "lucide-react";
import { useTranslation } from "@/lib/i18n/context";
import {
  PLATFORMS,
  PLATFORM_LABELS,
  NICHES,
  NICHE_LABELS,
  MARKETS,
  MARKET_LABELS,
  type Platform,
} from "@/lib/constants";
import { creatorOnboardingSchema } from "@/lib/validations";
import { submitCreatorOnboarding } from "@/app/actions";

interface SocialAccountInput {
  id: string;
  platform: string;
  value: string;
}

export default function CreatorOnboardingPage() {
  const router = useRouter();
  const { t } = useTranslation("onboarding.creator");
  const [isPending, startTransition] = useTransition();
  const nextSocialId = useRef(1);

  // Step 1 fields
  const [fullName, setFullName] = useState("");
  const [primaryMarket, setPrimaryMarket] = useState("");
  const [socialAccounts, setSocialAccounts] = useState<SocialAccountInput[]>([
    { id: "social-0", platform: "", value: "" },
  ]);

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

  function getFirstAvailablePlatform(accounts: SocialAccountInput[]) {
    const used = new Set(
      accounts
        .map((account) => account.platform)
        .filter((platform): platform is Platform => PLATFORMS.includes(platform as Platform))
    );

    return PLATFORMS.find((platform) => !used.has(platform)) ?? "";
  }

  function getSocialAccountPayload() {
    return socialAccounts.map((account) => ({
      platform: account.platform as Platform,
      value: account.value,
    }));
  }

  function mapIssuesToFieldErrors(
    issues: Array<{ path: PropertyKey[]; message: string }>,
  ) {
    const errs: Record<string, string> = {};

    for (const issue of issues) {
      const key = issue.path.map(String).join(".");
      if (!errs[key]) errs[key] = issue.message;
    }

    return errs;
  }

  function updateSocialAccount(id: string, patch: Partial<SocialAccountInput>) {
    setSocialAccounts((prev) =>
      prev.map((account) =>
        account.id === id ? { ...account, ...patch } : account
      )
    );
  }

  function addSocialAccount() {
    setSocialAccounts((prev) => {
      if (prev.length >= PLATFORMS.length) {
        return prev;
      }

      return [
        ...prev,
        {
          id: `social-${nextSocialId.current++}`,
          platform: getFirstAvailablePlatform(prev),
          value: "",
        },
      ];
    });
  }

  function removeSocialAccount(id: string) {
    setSocialAccounts((prev) =>
      prev.length === 1
        ? [{ ...prev[0], platform: "", value: "" }]
        : prev.filter((account) => account.id !== id)
    );
  }

  async function handleSubmit() {
    const profileSlugValue = slug || generateSlug(fullName);
    const result = creatorOnboardingSchema.safeParse({
      full_name: fullName,
      primary_market: primaryMarket,
      social_accounts: getSocialAccountPayload(),
      niches: selectedNiches,
      base_rate: baseRate || 0,
      slug: profileSlugValue,
    });

    if (!result.success) {
      const errs = mapIssuesToFieldErrors(result.error.issues);
      setFieldErrors(errs);
      const firstMsg = result.error.issues[0]?.message;
      toast.error(firstMsg || t("error.fillAll"));
      return;
    }

    setFieldErrors({});

    startTransition(async () => {
      try {
        await submitCreatorOnboarding({
          full_name: result.data.full_name,
          primary_market: result.data.primary_market,
          social_accounts: result.data.social_accounts,
          niches: result.data.niches,
          base_rate: result.data.base_rate,
          slug: result.data.slug,
        });
        router.push("/pending-approval");
      } catch (error) {
        if (error instanceof Error && error.message === "Not authenticated") {
          toast.error(t("error.sessionExpired"));
          router.push("/login");
          return;
        }

        if (error instanceof Error && error.message === "SLUG_TAKEN") {
          toast.error(t("error.slugTaken"));
          return;
        }

        toast.error(t("error.creatorFailed"));
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
              <p className="mt-1 text-xs text-muted-foreground/70">
                {t("field.addSocial.hint")}
              </p>
              <div className="mt-3 space-y-3">
                {socialAccounts.map((account, index) => {
                  const platformError =
                    fieldErrors[`social_accounts.${index}.platform`];
                  const valueError =
                    fieldErrors[`social_accounts.${index}.value`];
                  const availablePlatforms = PLATFORMS.filter(
                    (platform) =>
                      platform === account.platform ||
                      !socialAccounts.some(
                        (otherAccount) =>
                          otherAccount.id !== account.id &&
                          otherAccount.platform === platform
                      )
                  );

                  return (
                    <div
                      key={account.id}
                      className="rounded-lg border border-border bg-background p-3"
                    >
                      <div className="grid gap-3 sm:grid-cols-[minmax(0,180px)_minmax(0,1fr)_auto]">
                        <div>
                          <Label>{t("field.platform")}</Label>
                          <Select
                            value={account.platform || undefined}
                            onValueChange={(value) =>
                              updateSocialAccount(account.id, {
                                platform: value ?? "",
                              })
                            }
                          >
                            <SelectTrigger className="mt-1.5">
                              <SelectValue
                                placeholder={t("field.platform.placeholder")}
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {availablePlatforms.map((platform) => (
                                <SelectItem key={platform} value={platform}>
                                  {PLATFORM_LABELS[platform]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {platformError && (
                            <p className="mt-1 text-xs text-red-500">
                              {platformError}
                            </p>
                          )}
                        </div>

                        <div>
                          <Label>{t("field.socialHandle")}</Label>
                          <Input
                            value={account.value}
                            onChange={(e) =>
                              updateSocialAccount(account.id, {
                                value: e.target.value,
                              })
                            }
                            className="mt-1.5"
                            placeholder={t("field.socialHandle.placeholder")}
                          />
                          {valueError && (
                            <p className="mt-1 text-xs text-red-500">
                              {valueError}
                            </p>
                          )}
                        </div>

                        <div className="flex items-end">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => removeSocialAccount(account.id)}
                            disabled={socialAccounts.length === 1}
                            aria-label={t("action.removePlatform")}
                            className="h-10 w-10 shrink-0"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              {fieldErrors.social_accounts && (
                <p className="mt-1 text-xs text-red-500">
                  {fieldErrors.social_accounts}
                </p>
              )}

              <Button
                type="button"
                variant="outline"
                onClick={addSocialAccount}
                disabled={socialAccounts.length >= PLATFORMS.length}
                className="mt-3"
              >
                <Plus className="me-2 h-4 w-4" />
                {t("action.addPlatform")}
              </Button>
            </div>
          </div>

          <div className="space-y-4 border-t border-border pt-6">
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
                className="mt-1.5"
                placeholder={t("field.profileUrl.placeholder")}
              />
              {fieldErrors.slug && (
                <p className="mt-1 text-xs text-red-500">{fieldErrors.slug}</p>
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
