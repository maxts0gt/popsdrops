"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import NextImage from "next/image";
import {
  ArrowLeft,
  Bookmark,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  DollarSign,
  ExternalLink,
  Globe,
  Shield,
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
  PLATFORMS,
  PLATFORM_LABELS,
  FORMAT_KEYS,
  getMarketLabel,
  formatBudgetPerCreatorRange,
  getBudgetPerCreatorAmount,
  type Platform,
  type ContentFormat,
} from "@/lib/constants";
import { useI18n, useTranslation } from "@/lib/i18n";
import { createClient, getBrowserUser } from "@/lib/supabase/client";
import { getSingleRelation } from "@/lib/supabase/relations";
import {
  getCreatorCampaignInviteContext,
  submitApplication,
} from "@/app/actions/applications";
import {
  mapCampaignAssetRow,
  pickCreatorFacingHeroAsset,
  type CampaignCreativeAsset,
} from "@/lib/campaigns/creative-kit";
import {
  getCampaignApplicationDeadlineDaysLeft,
  getCampaignApplicationClosedReason,
  isCampaignApplicationOpen,
  type CampaignApplicationClosedReason,
} from "@/lib/campaigns/application-deadline";
import { requiresVerifiedInviteForApplication } from "@/lib/campaigns/recruitment-visibility";
import { isCampaignServiceFeeUnlocked } from "@/lib/campaigns/service-fee-visibility";
import {
  getCreatorDeclaredPlatforms,
  getCreatorReportingEligibility,
  type EligibilityRequirement,
} from "@/lib/reporting/eligibility";
import {
  getReportingPlatformLabel,
  type ReportingAccountRequirement,
  type ReportingEvidenceType,
  type ReportingPlatform,
} from "@/lib/reporting/platform-templates";
import type {
  CampaignAssetStatus,
  CampaignAssetType,
  CampaignAssetVisibility,
  CampaignReportingCadence,
} from "@/types/database";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const creatorApplicationClosedDetailKeys: Record<
  CampaignApplicationClosedReason,
  string
> = {
  not_open: "apply.closedDetail.notOpen",
  deadline_passed: "apply.closedDetail.deadline",
  work_started: "apply.closedDetail.workStarted",
  paused: "apply.closedDetail.paused",
  completed: "apply.closedDetail.completed",
  cancelled: "apply.closedDetail.cancelled",
};

const creatorPrivateInviteClosedDetailKeys: Record<
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
  service_fee_cents: number | null;
  service_fee_status: string | null;
  recruitment_visibility: string | null;
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

interface CampaignAssetRecord {
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
}

interface CampaignReportingRequirement {
  platform: ReportingPlatform;
  platform_label: string | null;
  content_format: string;
  account_requirement: ReportingAccountRequirement;
  evidence_types: ReportingEvidenceType[];
  required_metric_keys: string[];
}

interface CampaignReportingPlan {
  cadence: CampaignReportingCadence;
  starts_at: string | null;
  ends_at: string | null;
}

type CampaignDetailRecord = CampaignDetail & {
  profiles?:
    | {
        full_name: string | null;
        brand_profiles: BrandInfo | BrandInfo[] | null;
      }
    | {
        full_name: string | null;
        brand_profiles: BrandInfo | BrandInfo[] | null;
      }[]
    | null;
};

type PrivateInviteContextState = "none" | "verified" | "unavailable";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string | null, locale = "en"): string {
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

function daysUntil(dateStr: string | null): number | null {
  return getCampaignApplicationDeadlineDaysLeft(dateStr);
}

function brandInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatUsageRight(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function splitLines(text: string | null): string[] {
  if (!text) return [];
  return text
    .split(/\n|(?<=\.)(?:\s)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function formatCreativeAssetCount(
  count: number,
  t: (key: string, vars?: Record<string, string>) => string,
): string {
  return t(count === 1 ? "creativeKit.assetSingular" : "creativeKit.assetPlural", {
    count: String(count),
  });
}

function isCreatorProfilePlatform(platform: ReportingPlatform): platform is Platform {
  return (PLATFORMS as readonly string[]).includes(platform);
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

export default function CampaignDetailPage() {
  const { t } = useTranslation("creator.campaign");
  const { t: tc } = useTranslation("ui.common");
  const { locale, t: tGlobal } = useI18n();
  const params = useParams();
  const searchParams = useSearchParams();
  const campaignId = params.id as string;
  const inviteId = searchParams.get("invite");

  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [brand, setBrand] = useState<BrandInfo | null>(null);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [creativeAssets, setCreativeAssets] = useState<CampaignCreativeAsset[]>([]);
  const [reportingRequirements, setReportingRequirements] = useState<
    CampaignReportingRequirement[]
  >([]);
  const [reportingPlan, setReportingPlan] = useState<CampaignReportingPlan | null>(
    null,
  );
  const [creatorPlatforms, setCreatorPlatforms] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  // Apply form state
  const [rate, setRate] = useState("");
  const [pitch, setPitch] = useState("");
  const [applying, startApplying] = useTransition();
  const [applied, setApplied] = useState(false);
  const [existingStatus, setExistingStatus] = useState<string | null>(null);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [privateInviteContext, setPrivateInviteContext] =
    useState<PrivateInviteContextState>("none");
  const [verifiedInviteId, setVerifiedInviteId] = useState<string | null>(null);
  const [briefLang, setBriefLang] = useState<"original" | "translated">(
    "translated",
  );

  const availableTranslationLocales = Object.entries(
    campaign?.brief_translated ?? {},
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
    campaign?.brief_translated?.[locale] &&
    availableTranslationLocales.includes(locale)
      ? locale
      : availableTranslationLocales[0] ?? null;
  const translatedBriefLocale = activeTranslationLocale
    ? new Intl.DisplayNames([locale || "en"], { type: "language" }).of(
        activeTranslationLocale,
      ) ?? activeTranslationLocale
    : "";

  // Resolve brief field: show translated if available and selected
  function getBriefField(field: "description" | "requirements" | "dos" | "donts"): string | null {
    if (!campaign) return null;
    const original = campaign[`brief_${field}` as keyof CampaignDetail] as string | null;
    if (briefLang === "translated" && activeTranslationLocale) {
      const translated = campaign.brief_translated?.[activeTranslationLocale]?.[field];
      if (translated) return translated;
    }
    return original;
  }

  const hasTranslation = activeTranslationLocale != null;
  const heroAsset = useMemo(
    () => pickCreatorFacingHeroAsset(creativeAssets),
    [creativeAssets],
  );

  useEffect(() => {
    async function load() {
      setVerifiedInviteId(null);
      setPrivateInviteContext(inviteId ? "unavailable" : "none");

      const supabase = createClient();
      const {
        data: { user },
      } = await getBrowserUser();

      const [
        campaignRes,
        deliverablesRes,
        assetsRes,
        applicationRes,
        reportingRequirementsRes,
        reportingPlanRes,
        creatorProfileRes,
      ] = await Promise.all([
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
        supabase
          .from("campaign_assets")
          .select(
            "id, campaign_id, title, description, asset_type, bucket_id, storage_path, file_name, mime_type, size_bytes, visibility, status, created_at",
          )
          .eq("campaign_id", campaignId)
          .neq("status", "archived")
          .order("created_at", { ascending: false }),
        user
          ? supabase
              .from("campaign_applications")
              .select("status")
              .eq("campaign_id", campaignId)
              .eq("creator_id", user.id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
        supabase
          .from("campaign_reporting_requirements")
          .select(
            "platform, platform_label, content_format, account_requirement, evidence_types, required_metric_keys",
          )
          .eq("campaign_id", campaignId)
          .order("sort_order", { ascending: true }),
        supabase
          .from("campaign_reporting_plans")
          .select("cadence, starts_at, ends_at")
          .eq("campaign_id", campaignId)
          .maybeSingle(),
        user
          ? supabase
              .from("creator_profiles")
              .select("platforms, tiktok, instagram, snapchat, youtube, facebook")
              .eq("profile_id", user.id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      if (campaignRes.data) {
        const { profiles: brandProfiles, ...rest } = campaignRes.data as CampaignDetailRecord;
        if (!isCampaignServiceFeeUnlocked(rest)) {
          setLoading(false);
          return;
        }

        const brandProfile = getSingleRelation(brandProfiles);
        const bp = getSingleRelation(brandProfile?.brand_profiles);

        setCampaign(rest);
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
      if (reportingRequirementsRes.data) {
        setReportingRequirements(
          reportingRequirementsRes.data as CampaignReportingRequirement[],
        );
      }
      if (reportingPlanRes.data) {
        setReportingPlan(reportingPlanRes.data as CampaignReportingPlan);
      }
      if (creatorProfileRes.data) {
        setCreatorPlatforms(getCreatorDeclaredPlatforms(creatorProfileRes.data));
      }
      if (assetsRes.data) {
        const assetRows = assetsRes.data as CampaignAssetRecord[];
        const assetPaths = assetRows.map((asset) => asset.storage_path);
        const signedAssetUrls =
          assetPaths.length > 0
            ? await supabase.storage
                .from("campaign-assets")
                .createSignedUrls(assetPaths, 600)
            : { data: [] };
        setCreativeAssets(
          assetRows.map((asset, index) =>
            mapCampaignAssetRow(
              asset,
              signedAssetUrls.data?.[index]?.signedUrl ?? null,
            ),
          ),
        );
      }
      if (applicationRes?.data) {
        setExistingStatus(applicationRes.data.status);
        setApplied(true);
      }
      if (inviteId && user) {
        try {
          const inviteContext = await getCreatorCampaignInviteContext({
            campaign_id: campaignId,
            invite_id: inviteId,
          });
          if (inviteContext.valid && inviteContext.inviteId) {
            setVerifiedInviteId(inviteContext.inviteId);
            setPrivateInviteContext("verified");
          } else {
            setPrivateInviteContext("unavailable");
          }
        } catch {
          setPrivateInviteContext("unavailable");
        }
      }
      setLoading(false);
    }
    load();
  }, [campaignId, inviteId]);

  // Loading skeleton
  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4 lg:p-6">
        {/* Back link */}
        <div className="h-4 w-20 animate-pulse rounded bg-muted" />
        {/* Brand + title */}
        <div className="flex items-center gap-2">
          <div className="size-8 animate-pulse rounded-lg bg-muted" />
          <div className="space-y-1.5">
            <div className="h-3 w-24 animate-pulse rounded bg-muted" />
            <div className="h-2.5 w-16 animate-pulse rounded bg-muted/50" />
          </div>
        </div>
        <div className="h-6 w-3/4 animate-pulse rounded bg-muted" />
        {/* Platform pills */}
        <div className="flex gap-1.5">
          <div className="h-5 w-20 animate-pulse rounded-full bg-muted/50" />
          <div className="h-5 w-16 animate-pulse rounded-full bg-muted/50" />
          <div className="h-5 w-14 animate-pulse rounded-full bg-muted/50" />
        </div>
        {/* Meta row */}
        <div className="flex gap-4">
          <div className="h-3 w-16 animate-pulse rounded bg-muted" />
          <div className="h-3 w-14 animate-pulse rounded bg-muted/50" />
          <div className="h-3 w-12 animate-pulse rounded bg-muted/50" />
        </div>
        {/* Brief section */}
        <div className="rounded-xl border border-border/60 bg-card p-5">
          <div className="mb-3 h-3 w-16 animate-pulse rounded bg-muted" />
          <div className="space-y-2">
            <div className="h-3 w-full animate-pulse rounded bg-muted/50" />
            <div className="h-3 w-full animate-pulse rounded bg-muted/50" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-muted/50" />
          </div>
        </div>
        {/* Deliverables section */}
        <div className="rounded-xl border border-border/60 bg-card p-5">
          <div className="mb-3 h-3 w-24 animate-pulse rounded bg-muted" />
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
                <div className="size-8 animate-pulse rounded-lg bg-muted" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-28 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-16 animate-pulse rounded bg-muted/50" />
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Apply section */}
        <div className="rounded-xl border border-border/60 bg-card p-5">
          <div className="space-y-3">
            <div className="h-4 w-28 animate-pulse rounded bg-muted" />
            <div className="h-10 w-full animate-pulse rounded-lg bg-muted/50" />
            <div className="h-20 w-full animate-pulse rounded-lg bg-muted/50" />
            <div className="h-10 w-full animate-pulse rounded-lg bg-muted" />
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
          className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4 rtl:rotate-180" />
          {t("nav.back")}
        </Link>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm font-medium text-foreground">
              {t("detail.notFound")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              {t("detail.notFoundDetail")}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const deadlineDays = daysUntil(campaign.application_deadline);
  const applicationClosedReason = getCampaignApplicationClosedReason(campaign);
  const applicationClosed = !isCampaignApplicationOpen(campaign);
  const applicationClosedDetailKey = applicationClosedReason
    ? creatorApplicationClosedDetailKeys[applicationClosedReason]
    : "apply.closedDetail";
  const applicationNeedsVerifiedInvite =
    !applied &&
    !applicationClosed &&
    requiresVerifiedInviteForApplication(campaign) &&
    !verifiedInviteId;
  const creatorPrivateInviteClosed = privateInviteContext === "verified" && applicationClosed;
  const creatorPrivateInviteDetailKey =
    creatorPrivateInviteClosed && applicationClosedReason
      ? creatorPrivateInviteClosedDetailKeys[applicationClosedReason]
      : "privateInvite.detail";
  const CreatorPrivateInviteIcon = creatorPrivateInviteClosed ? Shield : CheckCircle2;
  const budgetStr = formatBudgetPerCreatorRange(
    campaign.budget_min,
    campaign.budget_max,
    campaign.max_creators,
    locale,
    campaign.budget_currency || "USD"
  );
  const suggestedRate = getBudgetPerCreatorAmount(
    campaign.budget_min != null && campaign.budget_max != null
      ? (campaign.budget_min + campaign.budget_max) / 2
      : campaign.budget_min ?? campaign.budget_max,
    campaign.max_creators,
  );
  const publicCreativeAssets = creativeAssets.filter(
    (asset) => asset.visibility === "public" && asset.status === "ready",
  );
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
  const isReportingBlocked = reportingEligibility.status === "not_eligible";
  const missingCreatorProfilePlatforms =
    reportingEligibility.missingPlatforms.filter(isCreatorProfilePlatform);
  const requiredReportingPlatformLabels = Array.from(
    new Set(
      reportingRequirements
        .filter((requirement) => isCreatorProfilePlatform(requirement.platform))
        .map((requirement) => getReportingPlatformLabel(requirement.platform)),
    ),
  );
  const missingCreatorProfilePlatformLabels =
    missingCreatorProfilePlatforms.map((platform) =>
      getReportingPlatformLabel(platform),
    );
  const proofRequiresPrivateEvidence = reportingRequirements.some((requirement) =>
    requirement.evidence_types.some((type) => type !== "public_url"),
  );
  const applicationReadinessRows = [
    {
      label: t("readiness.reportingCadence"),
      detail: getReportingCadenceDetail(reportingPlan?.cadence, t),
      ready: true,
    },
    {
      label: t("readiness.profile"),
      detail:
        missingCreatorProfilePlatformLabels.length > 0
          ? t("readiness.missingPlatforms", {
              platforms: formatDisplayList(
                missingCreatorProfilePlatformLabels,
                locale,
              ),
            })
          : t("readiness.profileReady"),
      ready: !isReportingBlocked,
    },
    {
      label: t("readiness.platforms"),
      detail:
        requiredReportingPlatformLabels.length > 0
          ? formatDisplayList(requiredReportingPlatformLabels, locale)
          : t("readiness.platformsAny"),
      ready: true,
    },
    {
      label: t("readiness.proof"),
      detail:
        reportingRequirements.length === 0
          ? t("readiness.proofNone")
          : proofRequiresPrivateEvidence
            ? t("readiness.proofScreenshots")
            : t("readiness.proofPublic"),
      ready: reportingRequirements.length > 0,
    },
  ];
  const creatorCampaignHandoffSteps = [
    t("handoff.brief"),
    t("handoff.deliverables"),
    t("handoff.proof"),
    t("handoff.rules"),
    t("handoff.apply"),
  ];

  function getMissingPlatformProfileHref(platform: Platform): string {
    return `/i/profile?platform=${platform}&returnTo=${encodeURIComponent(
      `/i/discover/${campaignId}`,
    )}`;
  }

  return (
    <div className="mx-auto max-w-2xl p-4 pb-10 lg:p-6 lg:pb-6">
      {/* Back */}
      <Link
        href="/i/discover"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4 rtl:rotate-180" />
        {t("nav.discover")}
      </Link>

      <div
        data-testid="creator-campaign-hero-asset"
        className={`relative mb-5 overflow-hidden rounded-2xl border border-border ${
          heroAsset?.signedUrl ? "aspect-[16/9] bg-muted" : "bg-slate-950 p-4 text-white"
        }`}
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
            data-testid="creator-campaign-hero-fallback-visual"
            className="flex min-h-32 flex-col justify-between gap-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-white/10 text-lg font-bold text-white">
                {brandInitials(brand.company_name)}
              </div>
              <p className="max-w-xs text-end text-xs font-medium leading-snug text-white/60">
                {brand.company_name}
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {campaign.platforms.slice(0, 3).map((platform) => (
                <span
                  key={platform}
                  className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/80"
                >
                  {PLATFORM_LABELS[platform]}
                </span>
              ))}
              {campaign.markets.slice(0, 3).map((market) => (
                <span
                  key={market}
                  className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/80"
                >
                  {getMarketLabel(market, locale)}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted text-sm font-bold text-muted-foreground">
          {brandInitials(brand.company_name)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground">
            {brand.company_name}
            {brand.rating > 0 && (
              <span className="ms-1.5 text-muted-foreground/70">
                {t("brand.rating", { rating: brand.rating.toFixed(1) })}
              </span>
            )}
          </p>
          <h1 className="mt-0.5 text-lg font-semibold tracking-tight text-foreground">
            {campaign.title}
          </h1>
        </div>
        <button
          type="button"
          onClick={() => setSaved(!saved)}
          aria-label={saved ? t("action.removeSavedCampaign") : t("action.saveCampaign")}
          aria-pressed={saved}
          className="shrink-0 rounded-lg p-2 text-muted-foreground/50 transition-colors hover:text-muted-foreground"
        >
          <Bookmark
            className={`size-5 ${saved ? "fill-foreground text-foreground" : ""}`}
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
              className="inline-flex items-center gap-1 rounded-full bg-muted/50 px-2.5 py-1 text-xs font-medium text-muted-foreground ring-1 ring-border/50"
            >
              <Icon className="size-3" />
              {PLATFORM_LABELS[p]}
            </span>
          );
        })}
        {campaign.markets.map((m) => (
          <span
            key={m}
            className="rounded-full bg-muted/50 px-2.5 py-1 text-xs text-muted-foreground ring-1 ring-border/50"
          >
            {getMarketLabel(m, locale)}
          </span>
        ))}
      </div>

      {/* Key numbers */}
      <div
        className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        data-testid="creator-campaign-summary-row"
      >
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
          <span className="inline-flex items-center gap-1.5">
            <DollarSign className="size-3.5 text-muted-foreground/70" />
            <span className="font-semibold tabular-nums text-foreground">
              {budgetStr}
            </span>
            <span className="text-muted-foreground/70">{t("detail.perCreator")}</span>
          </span>
          {deadlineDays !== null && (
            <span
              className={`inline-flex items-center gap-1 ${
                deadlineDays <= 3
                  ? "font-medium text-red-500"
                  : "text-muted-foreground"
              }`}
            >
              <Clock className="size-3.5" />
              {deadlineDays === 0
                ? t("apply.lastDay")
                : t("detail.daysLeft", { count: String(deadlineDays) })}
            </span>
          )}
          {campaign.max_creators && (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <Users className="size-3.5" />
              {t("detail.spots", { count: String(campaign.max_creators) })}
            </span>
          )}
        </div>

        {!applied && !applicationClosed && (
          <Button
            data-testid="creator-campaign-apply-jump"
            variant="outline"
            size="sm"
            className="h-8 shrink-0 self-start rounded-lg px-3 text-muted-foreground hover:text-foreground sm:self-auto"
            onClick={() =>
              document
                .getElementById("apply-form")
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
          >
            {t("apply.now")}
            <ChevronRight className="size-3.5" aria-hidden="true" />
          </Button>
        )}
      </div>

      <section
        data-testid="creator-campaign-handoff-sequence"
        aria-label={t("handoff.title")}
        className="mt-6 rounded-xl border border-border bg-card p-4 shadow-sm"
      >
        <p className="mb-3 text-sm font-semibold text-foreground">
          {t("handoff.title")}
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-5">
          {creatorCampaignHandoffSteps.map((step, index) => (
            <div
              key={step}
              data-testid="creator-campaign-handoff-step"
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
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted"
              }`}
            >
              {t("brief.showOriginal")}
            </button>
            <button
              onClick={() => setBriefLang("translated")}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                briefLang === "translated"
                  ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted"
              }`}
            >
              {translatedBriefLocale || t("brief.showTranslated")}
            </button>
          </div>
        )}

        {publicCreativeAssets.length > 0 && (
          <div data-testid="creator-creative-kit">
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                {t("creativeKit.title")}
              </h2>
              <span className="text-xs tabular-nums text-muted-foreground/70">
                {formatCreativeAssetCount(publicCreativeAssets.length, t)}
              </span>
            </div>
            <div className="grid gap-2">
              {publicCreativeAssets.slice(0, 4).map((asset) => (
                <div
                  key={asset.id}
                  data-testid="creator-creative-kit-asset"
                  className="flex min-w-0 items-center gap-3 rounded-xl border border-border bg-card p-2 shadow-sm"
                >
                  <div className="relative size-16 shrink-0 overflow-hidden rounded-lg bg-slate-950">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(13,148,136,0.24),transparent_36%),radial-gradient(circle_at_20%_80%,rgba(245,158,11,0.16),transparent_34%)]" />
                    {asset.signedUrl && asset.mimeType.startsWith("image/") ? (
                      <NextImage
                        src={asset.signedUrl}
                        alt={asset.title}
                        fill
                        sizes="64px"
                        className="object-cover"
                        unoptimized
                        priority={asset.id === heroAsset?.id}
                        loading="eager"
                      />
                    ) : (
                      <div className="relative flex size-full items-center justify-center text-xs font-semibold text-white/80">
                        {brandInitials(brand.company_name)}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {asset.title}
                    </p>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      <span>
                        {campaign.platforms[0]
                          ? PLATFORM_LABELS[campaign.platforms[0]]
                          : brand.company_name}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {getBriefField("description") && (
          <div>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              {t("brief.label")}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {getBriefField("description")}
            </p>
          </div>
        )}

        {/* Deliverables */}
        {deliverables.length > 0 && (
          <div>
            <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              {t("brief.deliverables")}
            </h2>
            <div className="space-y-2">
              {deliverables.map((d) => {
                const Icon = PlatformIcon[d.platform];
                return (
                  <div
                    key={d.id}
                    className="flex items-start gap-3 rounded-xl bg-muted/50 p-3 ring-1 ring-border/50"
                  >
                    <div className="flex size-8 items-center justify-center rounded-lg bg-card text-muted-foreground shadow-sm">
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">
                        {d.quantity}× {FORMAT_KEYS[d.content_type as ContentFormat] ? tGlobal("ui.common", FORMAT_KEYS[d.content_type as ContentFormat]) : d.content_type}
                      </p>
                      <p className="text-xs text-muted-foreground">
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

        {reportingRequirements.length > 0 && (
          <Card className="rounded-xl border-border shadow-sm">
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
              {isReportingBlocked && missingCreatorProfilePlatforms.length > 0 && (
                <div className="space-y-2 rounded-lg bg-muted p-2">
                  {missingCreatorProfilePlatforms.map((platform) => (
                    <div
                      key={platform}
                      className="flex items-center justify-between gap-3 rounded-md bg-card px-2.5 py-2"
                    >
                      <span className="text-xs font-medium text-muted-foreground">
                        {t("reportingAccountMissing", {
                          platform: getReportingPlatformLabel(platform),
                        })}
                      </span>
                      <Link
                        href={getMissingPlatformProfileHref(platform)}
                        className="shrink-0 rounded-full bg-foreground px-2.5 py-1 text-xs font-medium text-background"
                      >
                        {t("reportingAddPlatform", {
                          platform: getReportingPlatformLabel(platform),
                        })}
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Requirements */}
        {getBriefField("requirements") && (
          <div>
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              {t("brief.requirements")}
            </h2>
            <ul className="space-y-1.5">
              {splitLines(getBriefField("requirements")!).map((req, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-muted-foreground"
                >
                  <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground/50" />
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
              <div className="rounded-xl border border-border p-4">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <ThumbsUp className="size-3.5" />
                  {t("brief.dos")}
                </div>
                <ul className="space-y-1.5">
                  {splitLines(getBriefField("dos")!).map((item, i) => (
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
            {getBriefField("donts") && (
              <div className="rounded-xl border border-border p-4">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <ThumbsDown className="size-3.5" />
                  {t("brief.donts")}
                </div>
                <ul className="space-y-1.5">
                  {splitLines(getBriefField("donts")!).map((item, i) => (
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

        {/* Timeline */}
        <div>
          <h2 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
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
                  <span className="text-muted-foreground">{t.label}</span>
                  <span className="tabular-nums font-medium text-foreground">
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
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              {t("usage.title")}
            </h2>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
              {campaign.usage_rights_duration && (
                <span>{t("usage.duration", { value: formatUsageRight(campaign.usage_rights_duration) })}</span>
              )}
              {campaign.usage_rights_territory && (
                <span>{t("usage.territory", { value: formatUsageRight(campaign.usage_rights_territory) })}</span>
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
          <div className="flex items-start gap-2 rounded-xl bg-amber-50/50 dark:bg-amber-950/30 p-3 ring-1 ring-amber-500/10">
            <Shield className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <p className="text-xs leading-relaxed text-amber-800 dark:text-amber-300">
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
            <p className="text-sm leading-relaxed text-muted-foreground">
              {brand.description}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            {brand.website && (
              <a
                href={brand.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-medium text-foreground hover:text-foreground"
              >
                <Globe className="size-3" />
                {t("detail.website")}
                <ExternalLink className="size-3" />
              </a>
            )}
            {brand.rating > 0 && (
              <span>
                {t("brand.ratingWithReviews", {
                  rating: brand.rating.toFixed(1),
                  count: String(brand.review_count),
                })}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card
        data-testid="creator-apply-readiness"
        className="mt-6 rounded-xl border-border shadow-sm"
      >
        <CardContent className="space-y-3 p-4">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-sm">{t("readiness.title")}</CardTitle>
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                isReportingBlocked
                  ? "bg-muted text-muted-foreground"
                  : "bg-emerald-50 text-emerald-700"
              }`}
            >
              {isReportingBlocked
                ? t("readiness.needsProfile")
                : t("readiness.ready")}
            </span>
          </div>
          <div className="grid gap-2 sm:grid-cols-4">
            {applicationReadinessRows.map((row) => {
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

      {/* Apply Form */}
      <Card
        data-testid="creator-application-card"
        className="mt-6 rounded-xl border-border shadow-sm"
        id="apply-form"
      >
        <CardHeader className="space-y-3 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-sm">{t("apply.title")}</CardTitle>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {t("apply.reviewDetail")}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              {t("apply.reviewTitle")}
            </span>
          </div>
          <div
            data-testid="creator-application-review-summary"
            className="grid grid-cols-3 overflow-hidden rounded-lg border border-border bg-border text-xs"
          >
            {[
              t("apply.rateReview"),
              t("apply.pitchReview"),
              t("apply.roomReview"),
            ].map((item) => (
              <div
                key={item}
                className="min-w-0 bg-background px-2 py-2 text-center font-medium text-muted-foreground"
              >
                {item}
              </div>
            ))}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {privateInviteContext === "verified" && (
            <div
              data-testid="creator-private-invite-context"
              className={`flex items-start gap-3 rounded-lg border border-border px-3 py-2 ${
                creatorPrivateInviteClosed ? "bg-muted/30" : "bg-background"
              }`}
            >
              <CreatorPrivateInviteIcon
                className={`mt-0.5 size-4 shrink-0 ${
                  creatorPrivateInviteClosed
                    ? "text-muted-foreground"
                    : "text-emerald-600"
                }`}
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground">
                  {t("privateInvite.title")}
                </p>
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                  {t(creatorPrivateInviteDetailKey)}
                </p>
              </div>
            </div>
          )}
          {privateInviteContext === "unavailable" && (
            <div
              data-testid="creator-private-invite-unavailable"
              className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2"
            >
              <Shield
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground">
                  {t("privateInvite.unavailableTitle")}
                </p>
                <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
                  {t("privateInvite.unavailableDetail")}
                </p>
              </div>
            </div>
          )}
          {applied ? (
            <div
              data-testid="creator-application-state"
              className="py-4 text-center"
            >
              <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-emerald-50">
                <Check className="size-6 text-emerald-600" />
              </div>
              <p className="text-sm font-medium text-foreground">
                {existingStatus === "accepted"
                  ? t("status.accepted")
                  : existingStatus === "rejected"
                    ? t("status.notSelected")
                    : t("status.applied")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                {existingStatus === "accepted"
                  ? t("apply.acceptedMessage")
                  : existingStatus === "rejected"
                    ? t("apply.rejectedMessage")
                    : t("apply.pendingMessage")}
              </p>
              {existingStatus === "accepted" && (
                <Link
                  data-testid="creator-application-open-room"
                  href={`/i/campaigns/${campaign.id}`}
                  className="mt-3 inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800"
                >
                  {t("apply.openRoom")}
                  <ChevronRight className="size-3.5 rtl:rotate-180" />
                </Link>
              )}
            </div>
          ) : applicationNeedsVerifiedInvite ? (
            <div
              data-testid="creator-application-invite-required"
              className="rounded-lg border border-border bg-muted/30 px-3 py-4 text-center"
            >
              <p className="text-sm font-medium text-foreground">
                {t("apply.inviteRequired")}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {t("apply.inviteRequiredDetail")}
              </p>
            </div>
          ) : applicationClosed ? (
            <div
              data-testid="creator-application-closed"
              className="rounded-lg border border-border bg-muted/30 px-3 py-4 text-center"
            >
              <p className="text-sm font-medium text-foreground">
                {t("apply.closed")}
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {applicationClosedDetailKey === "apply.closedDetail"
                  ? t("apply.closedDetail")
                  : t(applicationClosedDetailKey)}
              </p>
            </div>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-[minmax(150px,180px)_1fr]">
                <div data-testid="creator-application-rate-field">
                  <Label
                    htmlFor="rate"
                    className="mb-1.5 text-xs text-muted-foreground"
                  >
                    {t("apply.yourRate")} ({campaign.budget_currency.toUpperCase()})
                  </Label>
                  <div className="relative">
                    <DollarSign className="pointer-events-none absolute inset-y-0 start-3 my-auto size-4 text-muted-foreground/70" />
                    <Input
                      id="rate"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder={
                        suggestedRate != null
                          ? String(Math.round(suggestedRate))
                          : "200"
                      }
                      value={rate}
                      onChange={(e) => setRate(e.target.value.replace(/\D/g, ""))}
                      className="ps-9 tabular-nums"
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground/70">
                    {t("apply.brandBudget", { amount: budgetStr })}
                  </p>
                </div>
                <div data-testid="creator-application-pitch-field">
                  <Label
                    htmlFor="pitch"
                    className="mb-1.5 text-xs text-muted-foreground"
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
                    <span className="text-[11px] tabular-nums text-muted-foreground/70">
                      {pitch.length}/500
                    </span>
                  </div>
                </div>
              </div>
              {applyError && (
                <p className="text-xs text-red-500">{applyError}</p>
              )}
              {isReportingBlocked && missingCreatorProfilePlatforms.length > 0 && (
                <div className="space-y-2">
                  {missingCreatorProfilePlatforms.map((platform) => (
                    <div
                      key={platform}
                      className="flex items-center justify-between gap-3 rounded-lg bg-muted px-3 py-2"
                    >
                      <span className="text-xs font-medium text-muted-foreground">
                        {t("reportingAccountMissing", {
                          platform: getReportingPlatformLabel(platform),
                        })}
                      </span>
                      <Link
                        href={getMissingPlatformProfileHref(platform)}
                        className="shrink-0 rounded-full bg-foreground px-2.5 py-1 text-xs font-medium text-background"
                      >
                        {t("reportingAddPlatform", {
                          platform: getReportingPlatformLabel(platform),
                        })}
                      </Link>
                    </div>
                  ))}
                </div>
              )}
              <Button
                className="w-full"
                disabled={applying || isReportingBlocked || !rate || parseInt(rate) <= 0}
                onClick={() => {
                  if (isReportingBlocked) return;
                  setApplyError(null);
                  startApplying(async () => {
                    try {
                      await submitApplication({
                        campaign_id: campaignId,
                        invite_id: verifiedInviteId ?? undefined,
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
      {/* End application */}
    </div>
  );
}
