"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import NextImage from "next/image";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  Globe,
  MapPin,
  Shield,
  ThumbsDown,
  ThumbsUp,
  Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { PlatformIcon } from "@/components/platform-icons";
import {
  PLATFORMS,
  PLATFORM_LABELS,
  FORMAT_KEYS,
  getMarketLabel,
  formatBudgetPerCreatorRange,
  type Platform,
  type ContentFormat,
} from "@/lib/constants";
import { useI18n, useTranslation } from "@/lib/i18n";
import {
  getCreatorReportingEligibility,
  type EligibilityRequirement,
} from "@/lib/reporting/eligibility";
import {
  getReportingPlatformLabel,
  type ReportingAccountRequirement,
  type ReportingEvidenceType,
  type ReportingPlatform,
} from "@/lib/reporting/platform-templates";
import {
  mapCampaignAssetRow,
  pickCreatorFacingHeroAsset,
} from "@/lib/campaigns/creative-kit";
import {
  getCampaignApplicationClosedReason,
  isCampaignApplicationOpen,
  type CampaignApplicationClosedReason,
} from "@/lib/campaigns/application-deadline";
import { createClient, getBrowserUser } from "@/lib/supabase/client";
import type {
  CampaignAssetStatus,
  CampaignAssetType,
  CampaignAssetVisibility,
  CampaignReportingCadence,
} from "@/types/database";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const publicApplicationClosedDetailKeys: Record<
  CampaignApplicationClosedReason,
  string
> = {
  not_open: "closedDetail.notOpen",
  deadline_passed: "closedDetail.deadline",
  work_started: "closedDetail.workStarted",
  paused: "closedDetail.paused",
  completed: "closedDetail.completed",
  cancelled: "closedDetail.cancelled",
};

const publicPrivateInviteClosedDetailKeys: Record<
  CampaignApplicationClosedReason,
  string
> = {
  not_open: "privateInvite.closedDetail.notOpen",
  deadline_passed: "privateInvite.closedDetail.deadline",
  work_started: "privateInvite.closedDetail.workStarted",
  paused: "privateInvite.closedDetail.paused",
  completed: "privateInvite.closedDetail.completed",
  cancelled: "privateInvite.closedDetail.cancelled",
};

interface CampaignPublic {
  id: string;
  title: string;
  status: string;
  brief_description: string | null;
  brief_requirements: string | null;
  brief_dos: string | null;
  brief_donts: string | null;
  brief_translated: Record<string, Record<string, string>> | null;
  platforms: string[];
  markets: string[];
  niches: string[];
  budget_min: number | null;
  budget_max: number | null;
  budget_currency: string;
  max_creators: number | null;
  application_deadline: string | null;
  content_due_date: string | null;
  performance_due_date: string | null;
  posting_window_start: string | null;
  posting_window_end: string | null;
  usage_rights_duration: string | null;
  usage_rights_territory: string | null;
  usage_rights_paid_ads: boolean | null;
  max_revisions: number | null;
  compliance_notes: string | null;
  campaign_deliverables: { platform: string; content_type: string; quantity: number }[];
  campaign_assets: CampaignPublicAsset[];
  reporting_requirements: CampaignReportingRequirement[];
  reporting_plan: CampaignReportingPlan | null;
  agreement_preview: {
    required: boolean;
    gate_mode: string | null;
    title: string | null;
    version: number | null;
    preview_enabled: boolean;
    preview_summary: Record<string, string>;
  };
  brand: {
    company_name: string;
    website: string | null;
    rating: number;
    review_count: number;
  };
}

type CampaignReportingPlan = {
  cadence: CampaignReportingCadence;
  starts_at: string | null;
  ends_at: string | null;
};

type CampaignReportingRequirement = {
  platform: ReportingPlatform;
  platform_label: string | null;
  content_format: string;
  account_requirement: ReportingAccountRequirement;
  evidence_types: ReportingEvidenceType[];
  required_metric_keys: string[];
};

type CampaignPublicAsset = {
  id: string;
  campaign_id: string;
  title: string;
  description: string | null;
  asset_type: CampaignAssetType;
  bucket_id: "campaign-assets";
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  visibility: CampaignAssetVisibility;
  status: CampaignAssetStatus;
  created_at: string;
  signed_url: string | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type BriefField = "description" | "requirements" | "dos" | "donts";

function splitLines(text: string): string[] {
  return text.split("\n").filter(Boolean);
}

function formatDate(dateStr: string | null, locale: string): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDisplayList(items: string[], locale: string): string {
  if (items.length === 0) return "";
  return new Intl.ListFormat(locale || "en", {
    style: "short",
    type: "conjunction",
  }).format(items);
}

function formatUsageRight(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isCreatorProfilePlatform(platform: ReportingPlatform): platform is Platform {
  return (PLATFORMS as readonly string[]).includes(platform);
}

function getBrandInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function getReportingCadenceDetail(
  cadence: CampaignReportingCadence | null | undefined,
  t: (key: string, vars?: Record<string, string>) => string,
): string {
  switch (cadence) {
    case "weekly":
      return t("reportingCadence.weekly");
    case "daily_launch_window":
      return t("reportingCadence.daily");
    case "custom":
      return t("reportingCadence.custom");
    case "per_post":
      return t("reportingCadence.perPost");
    case "final_only":
    default:
      return t("reportingCadence.final");
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PublicApplyPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const inviteId = searchParams.get("invite");
  const inviteQuery = inviteId ? `?invite=${encodeURIComponent(inviteId)}` : "";
  const { t } = useTranslation("public.apply");
  const { locale, t: tGlobal } = useI18n();

  const [campaign, setCampaign] = useState<CampaignPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [hasApplied, setHasApplied] = useState(false);
  const [applicationStatus, setApplicationStatus] = useState<string | null>(null);
  const [isAcceptedMember, setIsAcceptedMember] = useState(false);
  const [creatorPlatforms, setCreatorPlatforms] = useState<string[]>([]);
  const [briefLang, setBriefLang] = useState<"original" | "translated">(
    "translated",
  );

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      const campaignResponse = await fetch(
        `/api/public/campaigns/${id}${inviteQuery}`,
        {
          cache: "no-store",
        },
      );

      if (!campaignResponse.ok) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const campaignData = (await campaignResponse.json()) as CampaignPublic;
      setCampaign(campaignData);

      // Check if user is logged in and has already applied
      const {
        data: { user },
      } = await getBrowserUser();
      if (user) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        if (profileData) setUserRole(profileData.role);

        if (profileData?.role === "creator") {
          const { data: creatorProfile } = await supabase
            .from("creator_profiles")
            .select("tiktok, instagram, snapchat, youtube, facebook")
            .eq("profile_id", user.id)
            .maybeSingle();

          if (creatorProfile) {
            const platforms = [
              "tiktok",
              "instagram",
              "snapchat",
              "youtube",
              "facebook",
            ].filter((platform) =>
              Boolean(creatorProfile[platform as keyof typeof creatorProfile]),
            );
            setCreatorPlatforms(platforms);
          }

          const { data: memberData } = await supabase
            .from("campaign_members")
            .select("id")
            .eq("campaign_id", id)
            .eq("creator_id", user.id)
            .maybeSingle();
          if (memberData) setIsAcceptedMember(true);
        }

        // Check existing application
        const { data: appData } = await supabase
          .from("campaign_applications")
          .select("id, status")
          .eq("campaign_id", id)
          .eq("creator_id", user.id)
          .maybeSingle();
        if (appData) {
          setHasApplied(true);
          setApplicationStatus(appData.status);
        }
      }

      setLoading(false);
    }
    load();
  }, [id, inviteQuery]);

  // Not found
  if (notFound) {
    return (
      <div className="flex min-h-svh flex-col items-center justify-center bg-background px-4">
        <div className="mx-auto max-w-sm text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-muted">
            <Globe className="size-7 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-bold text-foreground">{t("notFound")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("notFoundDetail")}
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-foreground hover:underline"
          >
            <ArrowLeft className="size-3.5" />
            {t("backHome")}
          </Link>
        </div>
      </div>
    );
  }

  // Loading
  if (loading || !campaign) {
    return (
      <div className="min-h-svh bg-background">
        <div className="mx-auto max-w-2xl px-4 py-12">
          <div className="animate-pulse space-y-6">
            <div className="h-6 w-32 rounded bg-muted" />
            <div className="h-8 w-3/4 rounded bg-muted" />
            <div className="flex gap-2">
              <div className="h-7 w-20 rounded-full bg-muted" />
              <div className="h-7 w-20 rounded-full bg-muted" />
            </div>
            <div className="space-y-2">
              <div className="h-4 w-full rounded bg-muted" />
              <div className="h-4 w-5/6 rounded bg-muted" />
              <div className="h-4 w-2/3 rounded bg-muted" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const applicationClosedReason = getCampaignApplicationClosedReason(campaign);
  const isClosed = !isCampaignApplicationOpen(campaign);
  const applicationClosedDetailKey = applicationClosedReason
    ? publicApplicationClosedDetailKeys[applicationClosedReason]
    : "closed";
  const availableTranslationLocales = Object.entries(
    campaign.brief_translated ?? {},
  )
    .filter(([, translation]) =>
      Boolean(
        translation.description ||
          translation.requirements ||
          translation.dos ||
          translation.donts,
      ),
    )
    .map(([translationLocale]) => translationLocale);
  const activeTranslationLocale =
    campaign.brief_translated?.[locale] &&
    availableTranslationLocales.includes(locale)
      ? locale
      : availableTranslationLocales[0] ?? null;
  const translatedBriefLocale = activeTranslationLocale
    ? new Intl.DisplayNames([locale || "en"], { type: "language" }).of(
        activeTranslationLocale,
      ) ?? activeTranslationLocale
    : "";

  function getPublicBriefField(field: BriefField): string | null {
    if (!campaign) return null;

    const original = campaign[`brief_${field}` as keyof CampaignPublic] as
      | string
      | null;
    if (briefLang === "translated" && activeTranslationLocale) {
      const translated = campaign.brief_translated?.[activeTranslationLocale]?.[field];
      if (translated) return translated;
    }

    return original;
  }

  const publicBriefDescription = getPublicBriefField("description");
  const publicBriefRequirements = getPublicBriefField("requirements");
  const dosItems = getPublicBriefField("dos")
    ? splitLines(getPublicBriefField("dos")!)
    : [];
  const dontsItems = getPublicBriefField("donts")
    ? splitLines(getPublicBriefField("donts")!)
    : [];
  const headerHref =
    userRole === "creator"
      ? "/i/home"
      : userRole === "brand"
        ? "/b/home"
        : userRole === "admin"
          ? "/admin"
          : "/login";
  const headerLabel = userRole
    ? t("nav.dashboard")
    : tGlobal("ui.common", "nav.login");
  const reportingRequirements = campaign.reporting_requirements ?? [];
  const reportingEligibility = getCreatorReportingEligibility({
    creatorPlatforms,
    requirements: reportingRequirements.map((requirement) => ({
      platform: requirement.platform,
      platformLabel: requirement.platform_label,
      contentFormat: requirement.content_format,
      accountRequirement: requirement.account_requirement,
      evidenceTypes: requirement.evidence_types,
      requiredMetricKeys: requirement.required_metric_keys,
    })) satisfies EligibilityRequirement[],
  });
  const missingReportingPlatform = reportingEligibility.missingPlatforms[0];
  const isReportingBlocked =
    userRole === "creator" && reportingEligibility.status === "not_eligible";
  const creativeAssets = (campaign.campaign_assets ?? []).map((asset) =>
    mapCampaignAssetRow(asset, asset.signed_url),
  );
  const heroAsset = pickCreatorFacingHeroAsset(creativeAssets);
  const requiredReportingPlatformLabels = Array.from(
    new Set(
      reportingRequirements
        .filter((requirement) => isCreatorProfilePlatform(requirement.platform))
        .map((requirement) => getReportingPlatformLabel(requirement.platform)),
    ),
  );
  const missingReportingPlatformLabels = reportingEligibility.missingPlatforms.map(
    (platform) => getReportingPlatformLabel(platform),
  );
  const proofRequiresPrivateEvidence = reportingRequirements.some((requirement) =>
    requirement.evidence_types.some((type) => type !== "public_url"),
  );
  const proofDetail =
    reportingRequirements.length === 0
      ? t("readiness.proofNone")
      : proofRequiresPrivateEvidence
        ? t("readiness.proofScreenshots")
        : t("readiness.proofPublic");
  const profileReadinessDetail =
    userRole === "creator"
      ? isReportingBlocked
        ? t("readiness.missingPlatforms", {
            platforms: formatDisplayList(missingReportingPlatformLabels, locale),
          })
        : t("readiness.profileReady")
      : t("readiness.signInToCheck");
  const publicApplyReadinessRows = [
    {
      label: t("readiness.reportingCadence"),
      detail: getReportingCadenceDetail(campaign.reporting_plan?.cadence, t),
      ready: true,
    },
    {
      label: t("readiness.platforms"),
      detail:
        requiredReportingPlatformLabels.length > 0
          ? formatDisplayList(requiredReportingPlatformLabels, locale)
          : t("readiness.platformsAny"),
      ready: !isReportingBlocked,
    },
    {
      label: t("readiness.proof"),
      detail: proofDetail,
      ready: reportingRequirements.length > 0,
    },
    {
      label: t("readiness.rules"),
      detail: campaign.agreement_preview.required
        ? t("readiness.rulesAfterAcceptance")
        : t("readiness.rulesNone"),
      ready: true,
    },
    {
      label: t("readiness.profile"),
      detail: profileReadinessDetail,
      ready: userRole === "creator" && !isReportingBlocked,
    },
  ];
  const publicApplyTimelineRows = [
    { label: t("timeline.applicationsClose"), date: campaign.application_deadline },
    { label: t("timeline.contentDue"), date: campaign.content_due_date },
    { label: t("timeline.campaignStart"), date: campaign.posting_window_start },
    { label: t("timeline.campaignEnd"), date: campaign.posting_window_end },
    { label: t("timeline.performanceDue"), date: campaign.performance_due_date },
  ].filter((row) => row.date);
  const publicApplyUsageRows = [
    campaign.usage_rights_duration
      ? t("usage.duration", {
          value: formatUsageRight(campaign.usage_rights_duration),
        })
      : null,
    campaign.usage_rights_territory
      ? t("usage.territory", {
          value: formatUsageRight(campaign.usage_rights_territory),
        })
      : null,
    t("usage.paidAds", {
      value: campaign.usage_rights_paid_ads
        ? t("usage.paidAds.yes")
        : t("usage.paidAds.no"),
    }),
    Number.isFinite(campaign.max_revisions)
      ? t("usage.maxRevisions", { count: String(campaign.max_revisions) })
      : null,
  ].filter((row): row is string => Boolean(row));
  const publicApplyHandoffSteps = [
    t("handoff.brief"),
    t("handoff.deliverables"),
    t("handoff.proof"),
    t("handoff.rules"),
    t("handoff.apply"),
  ];
  const publicPrivateInviteClosed = Boolean(inviteId && isClosed);
  const publicPrivateInviteDetailKey =
    publicPrivateInviteClosed && applicationClosedReason
      ? publicPrivateInviteClosedDetailKeys[applicationClosedReason]
      : "privateInvite.detail";
  const PublicPrivateInviteIcon = publicPrivateInviteClosed ? Shield : CheckCircle2;

  return (
    <div className="min-h-svh bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-lg font-bold text-foreground">
            PopsDrops
          </Link>
          <Link
            href={headerHref}
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            {headerLabel}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        <div
          data-testid="public-apply-campaign-image"
          className="relative mb-6 aspect-[16/9] overflow-hidden rounded-2xl border border-border bg-muted"
        >
          {heroAsset?.signedUrl ? (
            <NextImage
              src={heroAsset.signedUrl}
              alt={heroAsset.title}
              fill
              sizes="(max-width: 768px) 100vw, 672px"
              className="object-cover"
              unoptimized
              priority
              loading="eager"
            />
          ) : (
            <div
              data-testid="public-apply-campaign-fallback"
              className="flex size-full flex-col justify-between bg-slate-950 p-5 text-white"
            >
              <div className="flex items-center justify-between gap-4">
                <span className="text-xs font-medium uppercase text-white/60">
                  {t("heroFallback.label")}
                </span>
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 text-sm font-semibold">
                  {getBrandInitials(campaign.brand.company_name) || "PD"}
                </span>
              </div>
              <div className="max-w-[20rem]">
                <p className="text-sm text-white/65">
                  {campaign.brand.company_name}
                </p>
                <p className="mt-2 text-2xl font-semibold leading-tight">
                  {campaign.title}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Brand info */}
        <div className="mb-1 flex items-center gap-2">
          <p className="text-sm font-medium text-muted-foreground">
            {t("by", { brand: campaign.brand.company_name })}
          </p>
          {campaign.brand.rating > 0 && (
            <span className="text-xs text-muted-foreground">
              {t("brand.rating", {
                rating: campaign.brand.rating.toFixed(1),
              })}
            </span>
          )}
        </div>

        {/* Title */}
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          {campaign.title}
        </h1>

        {/* Meta chips */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {campaign.platforms.map((p) => {
            const Icon = PlatformIcon[p as Platform];
            return Icon ? (
              <span
                key={p}
                className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground"
              >
                <Icon className="size-3.5" />
                {PLATFORM_LABELS[p as Platform]}
              </span>
            ) : null;
          })}
          {campaign.markets.slice(0, 4).map((m) => (
            <span
              key={m}
              className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
            >
              <MapPin className="size-3" />
              {getMarketLabel(m, locale)}
            </span>
          ))}
        </div>

        {/* Key stats */}
        <div
          className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          data-testid="public-apply-summary-row"
        >
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            <div className="flex items-baseline gap-1.5">
              <span className="font-semibold text-foreground">
                {formatBudgetPerCreatorRange(
                  campaign.budget_min,
                  campaign.budget_max,
                  campaign.max_creators,
                  locale,
                  campaign.budget_currency || "USD"
                )}
              </span>
              <span className="text-muted-foreground">{t("perCreator")}</span>
            </div>
            {campaign.application_deadline && (
              <div className="flex items-center gap-1.5">
                <Clock className="size-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {t("deadline")}
                </span>
                <span className="font-medium text-foreground">
                  {formatDate(campaign.application_deadline, locale)}
                </span>
              </div>
            )}
            {campaign.max_creators && (
              <div className="flex items-center gap-1.5">
                <Users className="size-4 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {t("spots", { count: String(campaign.max_creators) })}
                </span>
              </div>
            )}
          </div>

          {!isAcceptedMember && !isClosed && !hasApplied && (
            <Button
              data-testid="public-apply-jump"
              variant="outline"
              size="sm"
              className="h-8 shrink-0 self-start rounded-lg px-3 text-muted-foreground hover:text-foreground sm:self-auto"
              onClick={() =>
                document
                  .getElementById("public-apply-action")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
            >
              {t("applyNow")}
              <ChevronRight className="size-3.5" aria-hidden="true" />
            </Button>
          )}
        </div>

        <section
          data-testid="public-apply-handoff-sequence"
          aria-label={t("handoff.title")}
          className="mt-6 rounded-xl border border-border bg-card p-4 shadow-sm"
        >
          <p className="mb-3 text-sm font-semibold text-foreground">
            {t("handoff.title")}
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
            {publicApplyHandoffSteps.map((step, index) => (
              <div
                key={step}
                data-testid="public-apply-handoff-step"
                className="flex min-w-0 items-center gap-2 rounded-lg border border-border/70 bg-background px-3 py-2.5"
              >
                <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-semibold tabular-nums text-white">
                  {index + 1}
                </span>
                <span className="min-w-0 text-[11px] font-semibold leading-tight text-foreground">
                  {step}
                </span>
              </div>
            ))}
          </div>
        </section>

        {inviteId && (
          <Card
            data-testid="public-apply-private-invite"
            className={`mt-4 rounded-xl border-border shadow-sm ${
              publicPrivateInviteClosed ? "bg-muted/30" : "bg-card"
            }`}
          >
            <CardContent className="flex items-start gap-3 p-4">
              <PublicPrivateInviteIcon
                className={`mt-0.5 size-4 shrink-0 ${
                  publicPrivateInviteClosed
                    ? "text-muted-foreground"
                    : "text-emerald-600"
                }`}
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  {t("privateInvite.title")}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {t(publicPrivateInviteDetailKey)}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card
          data-testid="public-apply-readiness"
          className="mt-6 rounded-xl border-border shadow-sm"
        >
          <CardContent className="space-y-3 p-4">
            <p className="text-sm font-semibold text-foreground">
              {t("readiness.title")}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {publicApplyReadinessRows.map((row) => {
                const Icon = row.ready ? CheckCircle2 : Clock;
                return (
                  <div
                    key={row.label}
                    className="flex min-w-0 items-start gap-2 rounded-lg border border-border bg-background px-3 py-2"
                  >
                    <Icon
                      className={`mt-0.5 size-3.5 shrink-0 ${
                        row.ready ? "text-emerald-600" : "text-muted-foreground"
                      }`}
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-foreground">
                        {row.label}
                      </p>
                      <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                        {row.detail}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Separator className="my-8" />

        {activeTranslationLocale && (
          <div className="mb-6 inline-flex rounded-full border border-border bg-muted/40 p-1">
            <button
              type="button"
              onClick={() => setBriefLang("original")}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                briefLang === "original"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("language.original")}
            </button>
            <button
              type="button"
              onClick={() => setBriefLang("translated")}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                briefLang === "translated"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {translatedBriefLocale}
            </button>
          </div>
        )}

        {/* Brief */}
        {publicBriefDescription && (
          <div className="mb-6">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              {t("brief")}
            </h2>
            <p className="break-words text-sm leading-relaxed text-foreground">
              {publicBriefDescription}
            </p>
          </div>
        )}

        {/* Requirements */}
        {publicBriefRequirements && (
          <div className="mb-6">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              {t("requirements")}
            </h2>
            <p className="break-words text-sm text-muted-foreground">
              {publicBriefRequirements}
            </p>
          </div>
        )}

        {/* Deliverables */}
        {campaign.campaign_deliverables && campaign.campaign_deliverables.length > 0 && (
          <div className="mb-6">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              {t("deliverables")}
            </h2>
            <div className="space-y-2">
              {campaign.campaign_deliverables.map((d, i) => {
                const Icon = PlatformIcon[d.platform as Platform];
                return (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-lg border border-border p-3"
                  >
                    {Icon && <Icon className="size-4 text-muted-foreground" />}
                    <span className="text-sm font-medium text-foreground">
                      {d.quantity}x{" "}
                      {FORMAT_KEYS[d.content_type as ContentFormat]
                        ? tGlobal(
                            "ui.common",
                            FORMAT_KEYS[d.content_type as ContentFormat]
                          )
                        : d.content_type}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {PLATFORM_LABELS[d.platform as Platform]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {reportingRequirements.length > 0 && (
          <Card className="mb-8 rounded-xl border-border shadow-sm">
            <CardContent className="space-y-3 p-4">
              <p className="text-sm font-semibold text-foreground">
                {t("reportingRequirements")}
              </p>
              <div className="space-y-2">
                {reportingRequirements.map((requirement) => (
                  <div
                    key={`${requirement.platform}:${requirement.content_format}`}
                    className="rounded-lg border border-border px-3 py-2"
                  >
                    <p className="text-sm font-medium text-foreground">
                      {requirement.platform === "generic"
                        ? requirement.platform_label || t("reportingCustomProof")
                        : getReportingPlatformLabel(requirement.platform)}{" "}
                      {requirement.content_format}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {requirement.evidence_types.includes("screenshot")
                        ? t("reportingScreenshotRequired")
                        : t("reportingPublicRequired")}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {publicApplyTimelineRows.length > 0 && (
          <Card
            data-testid="public-apply-timeline"
            className="mb-6 rounded-xl border-border shadow-sm"
          >
            <CardContent className="space-y-3 p-4">
              <p className="text-sm font-semibold text-foreground">
                {t("timeline.title")}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {publicApplyTimelineRows.map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 text-muted-foreground">{row.label}</span>
                    <span className="shrink-0 tabular-nums text-foreground">
                      {formatDate(row.date ?? null, locale)}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {publicApplyUsageRows.length > 0 && (
          <div
            data-testid="public-apply-usage-rights"
            className="mb-6 rounded-xl border border-border p-4"
          >
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              {t("usage.title")}
            </h2>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
              {publicApplyUsageRows.map((row) => (
                <span key={row}>{row}</span>
              ))}
            </div>
          </div>
        )}

        {campaign.compliance_notes && (
          <div
            data-testid="public-apply-compliance-notes"
            className="mb-8 rounded-xl border border-amber-200/70 bg-amber-50/50 p-4"
          >
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-amber-900/70">
              {t("compliance.title")}
            </h2>
            <p className="text-sm leading-relaxed text-amber-950">
              {campaign.compliance_notes}
            </p>
          </div>
        )}

        {/* Do's / Don'ts */}
        {(dosItems.length > 0 || dontsItems.length > 0) && (
          <div className="mb-8 grid gap-4 sm:grid-cols-2">
            {dosItems.length > 0 && (
              <div className="rounded-xl border border-border p-4">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <ThumbsUp className="size-3.5" />
                  {t("dos")}
                </div>
                <ul className="space-y-1.5">
                  {dosItems.map((item, i) => (
                    <li
                      key={i}
                      className="text-xs leading-relaxed text-muted-foreground"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {dontsItems.length > 0 && (
              <div className="rounded-xl border border-border p-4">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <ThumbsDown className="size-3.5" />
                  {t("donts")}
                </div>
                <ul className="space-y-1.5">
                  {dontsItems.map((item, i) => (
                    <li
                      key={i}
                      className="text-xs leading-relaxed text-muted-foreground"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* About brand */}
        <Card className="mb-8">
          <CardContent>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              {t("brand.about")}
            </p>
            <h3 className="mt-1 font-medium text-foreground">
              {campaign.brand.company_name}
            </h3>
            <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
              {campaign.brand.website && (
                <a
                  href={campaign.brand.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 hover:text-foreground"
                >
                  <Globe className="size-3" />
                  {t("brand.website")}
                  <ExternalLink className="size-2.5" />
                </a>
              )}
              {campaign.brand.rating > 0 && (
                <span>
                  {t("brand.ratingWithReviews", {
                    rating: campaign.brand.rating.toFixed(1),
                    count: String(campaign.brand.review_count),
                  })}
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {campaign.agreement_preview.required && (
          <Card
            data-testid="apply-agreement-preview"
            className="mb-8 border-border bg-card"
          >
            <CardContent className="flex items-start gap-3 p-4">
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  {t("agreement.previewTitle")}
                </p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {t("agreement.signAfterAcceptance")}
                </p>
                {Object.values(campaign.agreement_preview.preview_summary)
                  .length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Object.values(
                      campaign.agreement_preview.preview_summary,
                    ).map((item) => (
                      <span
                        key={item}
                        className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* CTA */}
        <div
          id="public-apply-action"
          data-testid="public-apply-action"
          className="mt-6 rounded-xl border border-border bg-card p-4 shadow-sm"
        >
          {isAcceptedMember ? (
            <Link
              href={`/i/campaigns/${campaign.id}`}
              data-testid="public-apply-open-room"
              className="block sm:inline-flex"
            >
              <Button size="lg" className="w-full sm:w-auto">
                {t("openCampaignRoom")}
              </Button>
            </Link>
          ) : isClosed ? (
            <div className="rounded-lg bg-muted p-4 text-center">
              <p className="text-sm font-semibold text-foreground">
                {t("closed")}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t(applicationClosedDetailKey)}
              </p>
            </div>
          ) : hasApplied ? (
            <div className="flex items-center justify-center gap-2 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4" />
              {applicationStatus === "rejected"
                ? t("closed")
                : t("applicationSubmitted")}
            </div>
          ) : isReportingBlocked && missingReportingPlatform ? (
            <Button size="lg" className="w-full sm:w-auto" disabled>
              {t("reportingAccountMissing", {
                platform: getReportingPlatformLabel(missingReportingPlatform),
              })}
            </Button>
          ) : userRole === "creator" ? (
            <Link
              href={`/i/discover/${campaign.id}${inviteQuery}`}
              className="block sm:inline-flex"
            >
              <Button size="lg" className="w-full sm:w-auto">
                {t("applyNow")}
              </Button>
            </Link>
          ) : userRole ? (
            // Logged in but not a creator (brand/admin)
            <p className="text-center text-sm text-muted-foreground">
              {t("loginToApply")}
            </p>
          ) : (
            <Link
              href={`/login?redirect=/apply/${campaign.id}${inviteQuery}`}
              className="block sm:inline-flex"
            >
              <Button size="lg" className="w-full sm:w-auto">
                {t("signUpToApply")}
              </Button>
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}
