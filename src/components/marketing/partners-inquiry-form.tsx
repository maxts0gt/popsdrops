"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { submitPartnerInquiry } from "@/app/actions/partners";
import { Turnstile } from "@/components/security/turnstile";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/lib/i18n";

type InquiryType = "brand" | "distributor";

export function PartnersInquiryForm({
  type,
  onTypeChange,
}: {
  type: InquiryType;
  onTypeChange: (type: InquiryType) => void;
}) {
  const { t } = useTranslation("marketing.partners");
  const requiresTurnstile =
    process.env.NODE_ENV === "production" ||
    Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [website, setWebsite] = useState("");
  const [market, setMarket] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(
    requiresTurnstile ? null : "dev-turnstile-bypass",
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (requiresTurnstile && !turnstileToken) {
      toast.error(t("form.verification"));
      return;
    }

    setLoading(true);
    try {
      const result = await submitPartnerInquiry(
        {
          type,
          full_name: fullName,
          email,
          company_name: companyName,
          website: website || undefined,
          market,
          reason,
        },
        turnstileToken,
      );

      if (!result.success) {
        toast.error(result.error);
        return;
      }

      setSuccess(true);
    } catch {
      toast.error(t("form.error"));
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-6 py-8 text-center sm:px-8">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-emerald-600 shadow-sm">
          <Check className="h-6 w-6" />
        </div>
        <p className="mt-5 text-lg font-bold text-slate-900">
          {t("form.success.title")}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          {t("form.success.body")}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_8px_40px_-20px_rgba(15,23,42,0.16)] sm:p-8">
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-1">
        <div className="grid grid-cols-2 gap-1">
          {(["brand", "distributor"] as const).map((track) => {
            const isActive = track === type;
            return (
              <button
                key={track}
                type="button"
                onClick={() => onTypeChange(track)}
                className={`rounded-lg px-4 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-900"
                }`}
              >
                {track === "brand" ? t("form.track.brand") : t("form.track.distributor")}
              </button>
            );
          })}
        </div>
      </div>

      <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label
              htmlFor="partner-full-name"
              className="text-sm font-medium text-slate-900"
            >
              {t("form.fullName")}
            </label>
            <Input
              id="partner-full-name"
              className="mt-1.5 h-11 rounded-xl border-slate-200 px-3.5"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder={t("form.fullName.placeholder")}
              required
            />
          </div>
          <div>
            <label
              htmlFor="partner-email"
              className="text-sm font-medium text-slate-900"
            >
              {t("form.email")}
            </label>
            <Input
              id="partner-email"
              type="email"
              className="mt-1.5 h-11 rounded-xl border-slate-200 px-3.5"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t("form.email.placeholder")}
              required
            />
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label
              htmlFor="partner-company"
              className="text-sm font-medium text-slate-900"
            >
              {t("form.companyName")}
            </label>
            <Input
              id="partner-company"
              className="mt-1.5 h-11 rounded-xl border-slate-200 px-3.5"
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              placeholder={t("form.companyName.placeholder")}
              required
            />
          </div>
          <div>
            <label
              htmlFor="partner-website"
              className="text-sm font-medium text-slate-900"
            >
              {t("form.website")}
            </label>
            <Input
              id="partner-website"
              type="url"
              className="mt-1.5 h-11 rounded-xl border-slate-200 px-3.5"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
              placeholder={t("form.website.placeholder")}
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="partner-market"
            className="text-sm font-medium text-slate-900"
          >
            {type === "brand"
              ? t("form.market.brand")
              : t("form.market.distributor")}
          </label>
          <Input
            id="partner-market"
            className="mt-1.5 h-11 rounded-xl border-slate-200 px-3.5"
            value={market}
            onChange={(event) => setMarket(event.target.value)}
            placeholder={
              type === "brand"
                ? t("form.market.placeholder.brand")
                : t("form.market.placeholder.distributor")
            }
            required
          />
        </div>

        <div>
          <label
            htmlFor="partner-reason"
            className="text-sm font-medium text-slate-900"
          >
            {type === "brand"
              ? t("form.reason.brand")
              : t("form.reason.distributor")}
          </label>
          <Textarea
            id="partner-reason"
            className="mt-1.5 min-h-32 rounded-xl border-slate-200 px-3.5 py-3"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={
              type === "brand"
                ? t("form.reason.placeholder.brand")
                : t("form.reason.placeholder.distributor")
            }
            required
          />
        </div>

        {requiresTurnstile ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
            <Turnstile onTokenChange={setTurnstileToken} />
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading || (requiresTurnstile && !turnstileToken)}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : null}
          <span>
            {type === "brand"
              ? t("form.submit.brand")
              : t("form.submit.distributor")}
          </span>
        </button>
      </form>
    </div>
  );
}
