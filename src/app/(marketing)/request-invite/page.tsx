"use client";

import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { Turnstile } from "@/components/security/turnstile";
import { Building2, Sparkles, ArrowRight, Check, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { submitWaitlistRequest } from "@/app/actions/waitlist";
import { useTranslation } from "@/lib/i18n/context";
import {
  PLATFORMS,
  PLATFORM_LABELS,
  INDUSTRIES,
  INDUSTRY_LABELS,
} from "@/lib/constants";
import type { WaitlistInput } from "@/lib/validations";
import type { PlatformType } from "@/types/database";

const BUDGET_RANGES = [
  { value: "under_5k", labelKey: "budget.under5k" },
  { value: "5k_25k", labelKey: "budget.5k25k" },
  { value: "25k_100k", labelKey: "budget.25k100k" },
  { value: "100k_plus", labelKey: "budget.100kPlus" },
] as const;

const FOLLOWER_RANGES = [
  { value: "under_10k", labelKey: "followers.under10k" },
  { value: "10k_50k", labelKey: "followers.10k50k" },
  { value: "50k_100k", labelKey: "followers.50k100k" },
  { value: "100k_500k", labelKey: "followers.100k500k" },
  { value: "500k_plus", labelKey: "followers.500kPlus" },
] as const;

export default function RequestInvitePage() {
  const searchParams = useSearchParams();
  const initialType = searchParams.get("type") === "creator" ? "creator" : "brand";
  const { t } = useTranslation("marketing.requestInvite");
  const requiresTurnstile =
    process.env.NODE_ENV === "production" ||
    Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

  const [type, setType] = useState<"brand" | "creator">(initialType);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(
    requiresTurnstile ? null : "dev-turnstile-bypass",
  );

  // Shared fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");

  // Brand fields
  const [companyName, setCompanyName] = useState("");
  const [industry, setIndustry] = useState("");
  const [website, setWebsite] = useState("");
  const [budgetRange, setBudgetRange] = useState("");

  // Creator fields
  const [socialPlatform, setSocialPlatform] = useState("");
  const [socialUrl, setSocialUrl] = useState("");
  const [followerRange, setFollowerRange] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const base = {
      full_name: fullName,
      email,
      reason: reason || undefined,
    };

    let input: WaitlistInput;

    if (type === "brand") {
      input = {
        ...base,
        type: "brand" as const,
        company_name: companyName,
        industry: industry as typeof INDUSTRIES[number] || undefined,
        website: website || undefined,
        budget_range: (budgetRange as "under_5k" | "5k_25k" | "25k_100k" | "100k_plus") || undefined,
      };
    } else {
      input = {
        ...base,
        type: "creator" as const,
        social_url: socialUrl,
        social_platform: socialPlatform as PlatformType,
        follower_range: (followerRange as "under_10k" | "10k_50k" | "50k_100k" | "100k_500k" | "500k_plus") || undefined,
      };
    }

    if (requiresTurnstile && !turnstileToken) {
      toast.error("Complete the verification challenge.");
      return;
    }

    setLoading(true);
    const result = await submitWaitlistRequest(input, turnstileToken);
    setLoading(false);

    if (result.success) {
      setSuccess(true);
    } else {
      toast.error(result.error);
    }
  }

  if (success) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mx-auto max-w-md text-center"
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
            <Check className="h-8 w-8 text-emerald-600" />
          </div>
          <h1 className="mt-6 text-2xl font-bold tracking-tight text-slate-900">
            {t("success.title")}
          </h1>
          <p className="mt-3 text-sm text-slate-500">
            {t("success.message")}
          </p>
          <Link
            href="/"
            className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-slate-900 hover:text-slate-600 transition-colors"
          >
            {t("success.back")}
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 pb-24 pt-32 sm:pt-40">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {t("title")}
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {t("subtitle")}
        </p>
      </motion.div>

      {/* Type Toggle */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="mt-8"
      >
        <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1">
          <button
            type="button"
            onClick={() => setType("brand")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
              type === "brand"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Building2 className="h-4 w-4" />
            {t("tab.brand")}
          </button>
          <button
            type="button"
            onClick={() => setType("creator")}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all ${
              type === "creator"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Sparkles className="h-4 w-4" />
            {t("tab.creator")}
          </button>
        </div>
      </motion.div>

      {/* Form */}
      <motion.form
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        onSubmit={handleSubmit}
        className="mt-8 space-y-5"
      >
        {/* Shared: Name + Email */}
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <Label htmlFor="fullName">{t("field.fullName")}</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={t("field.fullName.placeholder")}
              required
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="email">{t("field.email")}</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("field.email.placeholder")}
              required
              className="mt-1.5"
            />
          </div>
        </div>

        {/* Type-specific fields */}
        <AnimatePresence mode="wait">
          {type === "brand" ? (
            <motion.div
              key="brand"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.15 }}
              className="space-y-5"
            >
              <div>
                <Label htmlFor="companyName">{t("brand.companyName")}</Label>
                <Input
                  id="companyName"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder={t("brand.companyName.placeholder")}
                  required
                  className="mt-1.5"
                />
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <Label htmlFor="industry">{t("brand.industry")}</Label>
                  <select
                    id="industry"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                  >
                    <option value="">{t("brand.industry.placeholder")}</option>
                    {INDUSTRIES.map((i) => (
                      <option key={i} value={i}>
                        {INDUSTRY_LABELS[i]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="budgetRange">{t("brand.budgetRange")}</Label>
                  <select
                    id="budgetRange"
                    value={budgetRange}
                    onChange={(e) => setBudgetRange(e.target.value)}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                  >
                    <option value="">{t("brand.budgetRange.placeholder")}</option>
                    {BUDGET_RANGES.map((r) => (
                      <option key={r.value} value={r.value}>
                        {t(r.labelKey)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <Label htmlFor="website">{t("brand.website")}</Label>
                <Input
                  id="website"
                  type="url"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder={t("brand.website.placeholder")}
                  className="mt-1.5"
                />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="creator"
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              className="space-y-5"
            >
              <div>
                <Label>{t("creator.platform")}</Label>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {PLATFORMS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setSocialPlatform(p)}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
                        socialPlatform === p
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {PLATFORM_LABELS[p]}
                    </button>
                  ))}
                </div>
              </div>
              {socialPlatform && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                >
                  <Label htmlFor="socialUrl">{t("creator.socialUrl")}</Label>
                  <Input
                    id="socialUrl"
                    type="url"
                    value={socialUrl}
                    onChange={(e) => setSocialUrl(e.target.value)}
                    placeholder={t("creator.socialUrl.placeholder")}
                    required
                    className="mt-1.5"
                  />
                </motion.div>
              )}
              <div>
                <Label htmlFor="followerRange">{t("creator.followerRange")}</Label>
                <select
                  id="followerRange"
                  value={followerRange}
                  onChange={(e) => setFollowerRange(e.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="">{t("creator.followerRange.placeholder")}</option>
                  {FOLLOWER_RANGES.map((r) => (
                    <option key={r.value} value={r.value}>
                      {t(r.labelKey)}
                    </option>
                  ))}
                </select>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Shared: Reason */}
        <div>
          <Label htmlFor="reason">
            {t("field.reason")}
            <span className="ms-1 text-xs font-normal text-slate-400">{t("field.optional")}</span>
          </Label>
          <Textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("field.reason.placeholder")}
            rows={3}
            className="mt-1.5"
          />
        </div>

        <Turnstile onTokenChange={setTurnstileToken} />

        {/* Submit */}
        <Button
          type="submit"
          disabled={loading || (requiresTurnstile && !turnstileToken)}
          className="w-full gap-2"
          size="lg"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              {t("action.submit")}
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>

        <p className="text-center text-xs text-slate-400">
          {t("haveAccess")}{" "}
          <Link href="/login" className="font-medium text-slate-900 hover:underline">
            {t("logIn")}
          </Link>
        </p>
      </motion.form>
    </div>
  );
}
