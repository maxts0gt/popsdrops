"use client";

import { useState, useEffect, useTransition } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Bookmark,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  DollarSign,
  ExternalLink,
  Globe,
  Shield,
  Star,
  ThumbsDown,
  ThumbsUp,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { PlatformIcon } from "@/components/platform-icons";
import {
  PLATFORM_LABELS,
  FORMAT_KEYS,
  getMarketLabel,
  formatBudgetRange,
  type Platform,
  type Market,
  type ContentFormat,
} from "@/lib/constants";
import { useI18n, useTranslation } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { submitApplication } from "@/app/actions/applications";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CampaignDetail {
  id: string;
  title: string;
  brief_description: string | null;
  brief_requirements: string | null;
  brief_dos: string | null;
  brief_donts: string | null;
  platforms: Platform[];
  markets: string[];
  niches: string[];
  budget_min: number | null;
  budget_max: number | null;
  budget_currency: string;
  max_creators: number | null;
  status: string;
  application_deadline: string | null;
  content_due_date: string | null;
  posting_window_start: string | null;
  posting_window_end: string | null;
  usage_rights_duration: string | null;
  usage_rights_territory: string | null;
  usage_rights_paid_ads: boolean;
  max_revisions: number;
  compliance_notes: string | null;
  brief_translated: Record<string, Record<string, string>> | null;
  created_at: string;
}

interface BrandInfo {
  company_name: string;
  industry: string | null;
  website: string | null;
  description: string | null;
  rating: number;
  review_count: number;
  logo_url: string | null;
}

interface Deliverable {
  id: string;
  platform: Platform;
  content_type: string;
  quantity: number;
  notes: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string | null, locale = "en"): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function brandInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function splitLines(text: string | null): string[] {
  if (!text) return [];
  return text
    .split(/\n|(?<=\.)(?:\s)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CampaignDetailPage() {
  const { t } = useTranslation("creator.campaign");
  const { t: tc } = useTranslation("ui.common");
  const { locale, t: tGlobal } = useI18n();
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id as string;

  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [brand, setBrand] = useState<BrandInfo | null>(null);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  // Apply form state
  const [rate, setRate] = useState("");
  const [pitch, setPitch] = useState("");
  const [applying, startApplying] = useTransition();
  const [applied, setApplied] = useState(false);
  const [existingStatus, setExistingStatus] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [briefLang, setBriefLang] = useState<"original" | "translated">(
    locale !== "en" ? "translated" : "original"
  );

  // Resolve brief field: show translated if available and selected
  function getBriefField(field: "description" | "requirements" | "dos" | "donts"): string | null {
    if (!campaign) return null;
    const original = campaign[`brief_${field}` as keyof CampaignDetail] as string | null;
    if (briefLang === "translated" && campaign.brief_translated) {
      const translated = campaign.brief_translated[locale]?.[field];
      if (translated) return translated;
    }
    return original;
  }

  const hasTranslation = campaign?.brief_translated?.[locale] != null;

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const [campaignRes, deliverablesRes, applicationRes] = await Promise.all([
        supabase
          .from("campaigns")
          .select(
            `*,
             profiles!campaigns_brand_id_fkey (
               full_name,
               brand_profiles (
                 company_name, industry, website, description, rating, review_count, logo_url
               )
             )`
          )
          .eq("id", campaignId)
          .single(),
        supabase
          .from("campaign_deliverables")
          .select("*")
          .eq("campaign_id", campaignId)
          .order("platform", { ascending: true }),
        user
          ? supabase
              .from("campaign_applications")
              .select("status")
              .eq("campaign_id", campaignId)
              .eq("creator_id", user.id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      if (campaignRes.data) {
        const { profiles: brandProfile, ...rest } = campaignRes.data as any;
        setCampaign(rest);
        const bp = brandProfile?.brand_profiles?.[0] || brandProfile?.brand_profiles;
        setBrand(
          bp || {
            company_name: brandProfile?.full_name || "Unknown Brand",
            industry: null,
            website: null,
            description: null,
            rating: 0,
            review_count: 0,
            logo_url: null,
          }
        );
      }
      if (deliverablesRes.data) {
        setDeliverables(deliverablesRes.data as Deliverable[]);
      }
      if (applicationRes?.data) {
        setExistingStatus(applicationRes.data.status);
        setApplied(true);
      }
      setLoading(false);
    }
    load();
  }, [campaignId]);

  // Loading skeleton
  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4 lg:p-6">
        {/* Back link */}
        <div className="h-4 w-20 animate-pulse rounded bg-slate-100" />
        {/* Brand + title */}
        <div className="flex items-center gap-2">
          <div className="size-8 animate-pulse rounded-lg bg-slate-100" />
          <div className="space-y-1.5">
            <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
            <div className="h-2.5 w-16 animate-pulse rounded bg-slate-50" />
          </div>
        </div>
        <div className="h-6 w-3/4 animate-pulse rounded bg-slate-100" />
        {/* Platform pills */}
        <div className="flex gap-1.5">
          <div className="h-5 w-20 animate-pulse rounded-full bg-slate-50" />
          <div className="h-5 w-16 animate-pulse rounded-full bg-slate-50" />
          <div className="h-5 w-14 animate-pulse rounded-full bg-slate-50" />
        </div>
        {/* Meta row */}
        <div className="flex gap-4">
          <div className="h-3 w-16 animate-pulse rounded bg-slate-100" />
          <div className="h-3 w-14 animate-pulse rounded bg-slate-50" />
          <div className="h-3 w-12 animate-pulse rounded bg-slate-50" />
        </div>
        {/* Brief section */}
        <div className="rounded-xl border border-slate-200/60 bg-white p-5">
          <div className="mb-3 h-3 w-16 animate-pulse rounded bg-slate-100" />
          <div className="space-y-2">
            <div className="h-3 w-full animate-pulse rounded bg-slate-50" />
            <div className="h-3 w-full animate-pulse rounded bg-slate-50" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-slate-50" />
          </div>
        </div>
        {/* Deliverables section */}
        <div className="rounded-xl border border-slate-200/60 bg-white p-5">
          <div className="mb-3 h-3 w-24 animate-pulse rounded bg-slate-100" />
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg bg-slate-50 p-3">
                <div className="size-8 animate-pulse rounded-lg bg-slate-100" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-28 animate-pulse rounded bg-slate-100" />
                  <div className="h-3 w-16 animate-pulse rounded bg-slate-50" />
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Apply section */}
        <div className="rounded-xl border border-slate-200/60 bg-white p-5">
          <div className="space-y-3">
            <div className="h-4 w-28 animate-pulse rounded bg-slate-100" />
            <div className="h-10 w-full animate-pulse rounded-lg bg-slate-50" />
            <div className="h-20 w-full animate-pulse rounded-lg bg-slate-50" />
            <div className="h-10 w-full animate-pulse rounded-lg bg-slate-100" />
          </div>
        </div>
      </div>
    );
  }

  if (!campaign || !brand) {
    return (
      <div className="mx-auto max-w-2xl p-4 lg:p-6">
        <Link
          href="/i/discover"
          className="mb-6 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="size-4 rtl:rotate-180" />
          {t("nav.back")}
        </Link>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm font-medium text-slate-700">
              {t("detail.notFound")}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {t("detail.notFoundDetail")}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const deadlineDays = daysUntil(campaign.application_deadline);
  const budgetStr = formatBudgetRange(
    campaign.budget_min,
    campaign.budget_max,
    locale,
    campaign.budget_currency || "USD"
  );

  return (
    <div className="mx-auto max-w-2xl p-4 pb-40 lg:p-6 lg:pb-6">
      {/* Back */}
      <Link
        href="/i/discover"
        className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-slate-900"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" />
        {t("nav.discover")}
      </Link>

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-600">
          {brandInitials(brand.company_name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-slate-500">
            {brand.company_name}
            {brand.rating > 0 && (
              <span className="ms-1.5 text-slate-400">
                ★ {brand.rating.toFixed(1)}
              </span>
            )}
          </p>
          <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-slate-900">
            {campaign.title}
          </h1>
        </div>
        <button
          onClick={() => setSaved(!saved)}
          className="shrink-0 rounded-lg p-2 text-slate-300 transition-colors hover:text-slate-600"
        >
          <Bookmark
            className={`size-5 ${saved ? "fill-slate-900 text-slate-900" : ""}`}
          />
        </button>
      </div>

      {/* Meta pills */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {campaign.platforms.map((p) => {
          const Icon = PlatformIcon[p];
          return (
            <span
              key={p}
              className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-900/[0.04]"
            >
              <Icon className="size-3" />
              {PLATFORM_LABELS[p]}
            </span>
          );
        })}
        {campaign.markets.map((m) => (
          <span
            key={m}
            className="rounded-full bg-slate-50 px-2.5 py-1 text-xs text-slate-500 ring-1 ring-slate-900/[0.04]"
          >
            {getMarketLabel(m, locale)}
          </span>
        ))}
      </div>

      {/* Key numbers */}
      <div className="mt-4 flex items-center gap-5 text-xs">
        <span className="inline-flex items-center gap-1.5">
          <DollarSign className="size-3.5 text-slate-400" />
          <span className="font-semibold tabular-nums text-slate-900">
            {budgetStr}
          </span>
          <span className="text-slate-400">{t("detail.perCreator")}</span>
        </span>
        {deadlineDays !== null && (
          <span
            className={`inline-flex items-center gap-1 ${
              deadlineDays <= 3
                ? "font-medium text-red-500"
                : "text-slate-500"
            }`}
          >
            <Clock className="size-3.5" />
            {deadlineDays === 0
              ? t("apply.lastDay")
              : t("detail.daysLeft", { count: String(deadlineDays) })}
          </span>
        )}
        {campaign.max_creators && (
          <span className="inline-flex items-center gap-1 text-slate-500">
            <Users className="size-3.5" />
            {t("detail.spots", { count: String(campaign.max_creators) })}
          </span>
        )}
      </div>

      <Separator className="my-6" />

      {/* Brief */}
      <section className="space-y-6">
        {/* Language toggle */}
        {hasTranslation && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setBriefLang("original")}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                briefLang === "original"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
            >
              English
            </button>
            <button
              onClick={() => setBriefLang("translated")}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                briefLang === "translated"
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200"
              }`}
            >
              {new Intl.DisplayNames([locale], { type: "language" }).of(locale)}
            </button>
          </div>
        )}

        {getBriefField("description") && (
          <div>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              {t("brief.label")}
            </h2>
            <p className="text-sm leading-relaxed text-slate-600">
              {getBriefField("description")}
            </p>
          </div>
        )}

        {/* Deliverables */}
        {deliverables.length > 0 && (
          <div>
            <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
              {t("brief.deliverables")}
            </h2>
            <div className="space-y-2">
              {deliverables.map((d) => {
                const Icon = PlatformIcon[d.platform];
                return (
                  <div
                    key={d.id}
                    className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-900/[0.04]"
                  >
                    <div className="flex size-8 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm">
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900">
                        {d.quantity}× {FORMAT_KEYS[d.content_type as ContentFormat] ? tGlobal("ui.common", FORMAT_KEYS[d.content_type as ContentFormat]) : d.content_type}
                      </p>
                      <p className="text-xs text-slate-500">
                        {PLATFORM_LABELS[d.platform]}
                        {d.notes && ` · ${d.notes}`}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Requirements */}
        {getBriefField("requirements") && (
          <div>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              {t("brief.requirements")}
            </h2>
            <ul className="space-y-1.5">
              {splitLines(getBriefField("requirements")!).map((req, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-slate-600"
                >
                  <span className="mt-2 size-1 shrink-0 rounded-full bg-slate-400" />
                  {req}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Do's and Don'ts */}
        {(getBriefField("dos") || getBriefField("donts")) && (
          <div className="grid gap-4 sm:grid-cols-2">
            {getBriefField("dos") && (
              <div className="rounded-xl bg-emerald-50/50 p-4 ring-1 ring-emerald-500/10">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                  <ThumbsUp className="size-3.5" />
                  {t("brief.dos")}
                </div>
                <ul className="space-y-1.5">
                  {splitLines(getBriefField("dos")!).map((item, i) => (
                    <li
                      key={i}
                      className="text-xs leading-relaxed text-emerald-800"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {getBriefField("donts") && (
              <div className="rounded-xl bg-red-50/50 p-4 ring-1 ring-red-500/10">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-red-700">
                  <ThumbsDown className="size-3.5" />
                  {t("brief.donts")}
                </div>
                <ul className="space-y-1.5">
                  {splitLines(getBriefField("donts")!).map((item, i) => (
                    <li
                      key={i}
                      className="text-xs leading-relaxed text-red-800"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Timeline */}
        <div>
          <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
            {t("brief.timeline")}
          </h2>
          <div className="space-y-2">
            {[
              { label: t("apply.closesIn"), date: campaign.application_deadline },
              { label: t("timeline.contentDue"), date: campaign.content_due_date },
              { label: t("timeline.postingWindow"), date: campaign.posting_window_start },
              { label: t("timeline.postingEnds"), date: campaign.posting_window_end },
            ]
              .filter((t) => t.date)
              .map((t, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-slate-500">{t.label}</span>
                  <span className="tabular-nums font-medium text-slate-900">
                    {formatDate(t.date, locale)}
                  </span>
                </div>
              ))}
          </div>
        </div>

        {/* Usage rights */}
        {(campaign.usage_rights_duration ||
          campaign.usage_rights_territory ||
          campaign.usage_rights_paid_ads) && (
          <div>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              {t("usage.title")}
            </h2>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
              {campaign.usage_rights_duration && (
                <span>{t("usage.duration", { value: campaign.usage_rights_duration })}</span>
              )}
              {campaign.usage_rights_territory && (
                <span>{t("usage.territory", { value: campaign.usage_rights_territory })}</span>
              )}
              <span>
                {t("usage.paidAds", { value: campaign.usage_rights_paid_ads ? t("usage.paidAds.yes") : t("usage.paidAds.no") })}
              </span>
              <span>{t("usage.maxRevisions", { count: String(campaign.max_revisions) })}</span>
            </div>
          </div>
        )}

        {/* Compliance */}
        {campaign.compliance_notes && (
          <div className="flex items-start gap-2 rounded-xl bg-amber-50/50 p-3 ring-1 ring-amber-500/10">
            <Shield className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <p className="text-xs leading-relaxed text-amber-800">
              {campaign.compliance_notes}
            </p>
          </div>
        )}
      </section>

      <Separator className="my-6" />

      {/* About the Brand */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{t("brand.about", { name: brand.company_name })}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {brand.description && (
            <p className="text-sm leading-relaxed text-slate-600">
              {brand.description}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
            {brand.website && (
              <a
                href={brand.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-slate-700 hover:text-slate-900"
              >
                <Globe className="size-3" />
                {t("detail.website")}
                <ExternalLink className="size-3" />
              </a>
            )}
            {brand.rating > 0 && (
              <span className="inline-flex items-center gap-1">
                <Star className="size-3 text-amber-500" />
                {brand.rating.toFixed(1)} ({brand.review_count} reviews)
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Apply Form */}
      <Card className="mt-6" id="apply-form">
        <CardHeader>
          <CardTitle className="text-sm">{t("apply.title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {applied ? (
            <div className="py-4 text-center">
              <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-emerald-50">
                <Check className="size-6 text-emerald-600" />
              </div>
              <p className="text-sm font-medium text-slate-900">
                {existingStatus === "accepted"
                  ? t("status.accepted")
                  : existingStatus === "rejected"
                    ? t("status.notSelected")
                    : t("status.applied")}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {existingStatus === "accepted"
                  ? t("apply.acceptedMessage")
                  : existingStatus === "rejected"
                    ? t("apply.rejectedMessage")
                    : t("apply.pendingMessage")}
              </p>
              {existingStatus === "accepted" && (
                <Link
                  href="/i/campaigns"
                  className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-slate-900 hover:underline"
                >
                  {tc("nav.campaigns")}
                  <ChevronRight className="size-3.5" />
                </Link>
              )}
            </div>
          ) : (
            <>
              <div>
                <Label
                  htmlFor="rate"
                  className="mb-1.5 text-xs text-slate-500"
                >
                  {t("apply.yourRate")} ({campaign.budget_currency.toUpperCase()})
                </Label>
                <div className="relative">
                  <DollarSign className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-slate-400" />
                  <Input
                    id="rate"
                    type="number"
                    min={0}
                    placeholder={
                      campaign.budget_min
                        ? String(
                            Math.round(
                              ((campaign.budget_min || 0) +
                                (campaign.budget_max || 0)) /
                                2
                            )
                          )
                        : "200"
                    }
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    className="ps-9 tabular-nums"
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  {t("apply.brandBudget", { amount: budgetStr })}
                </p>
              </div>
              <div>
                <Label
                  htmlFor="pitch"
                  className="mb-1.5 text-xs text-slate-500"
                >
                  {t("apply.yourPitch")}
                </Label>
                <Textarea
                  id="pitch"
                  placeholder={t("apply.pitchPlaceholder")}
                  value={pitch}
                  onChange={(e) => setPitch(e.target.value)}
                  className="min-h-20 resize-none"
                  maxLength={500}
                />
                <div className="mt-1 flex justify-end">
                  <span className="text-[11px] tabular-nums text-slate-400">
                    {pitch.length}/500
                  </span>
                </div>
              </div>
              {applyError && (
                <p className="text-xs text-red-500">{applyError}</p>
              )}
              <Button
                className="w-full"
                disabled={
                  applying || !rate || parseInt(rate) <= 0
                }
                onClick={() => {
                  setApplyError(null);
                  startApplying(async () => {
                    try {
                      await submitApplication({
                        campaign_id: campaignId,
                        proposed_rate: parseInt(rate),
                        pitch: pitch.trim(),
                      });
                      setApplied(true);
                      setExistingStatus("pending");
                    } catch (err) {
                      setApplyError(
                        err instanceof Error
                          ? err.message
                          : tc("error.generic")
                      );
                    }
                  });
                }}
              >
                {applying ? t("apply.submitting") : t("apply.submit")}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Mobile sticky apply bar */}
      {!applied && (
        <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+56px)] z-30 border-t border-slate-200 bg-white/95 p-4 backdrop-blur-sm lg:hidden">
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-[11px] text-slate-400">{t("apply.budgetPerCreator")}</p>
              <p className="text-sm font-semibold tabular-nums text-slate-900">
                {budgetStr}
              </p>
            </div>
            <Button
              size="lg"
              onClick={() =>
                document
                  .getElementById("apply-form")
                  ?.scrollIntoView({ behavior: "smooth" })
              }
            >
              {t("apply.now")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
