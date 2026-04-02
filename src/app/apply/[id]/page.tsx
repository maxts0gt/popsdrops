"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  DollarSign,
  ExternalLink,
  Globe,
  MapPin,
  Star,
  ThumbsDown,
  ThumbsUp,
  Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { PlatformIcon } from "@/components/platform-icons";
import {
  PLATFORM_LABELS,
  FORMAT_KEYS,
  getMarketLabel,
  formatBudgetRange,
  type Platform,
  type ContentFormat,
} from "@/lib/constants";
import { useI18n, useTranslation } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { getSingleRelation } from "@/lib/supabase/relations";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CampaignPublic {
  id: string;
  title: string;
  status: string;
  brief_description: string | null;
  brief_requirements: string | null;
  brief_dos: string | null;
  brief_donts: string | null;
  platforms: string[];
  markets: string[];
  niches: string[];
  budget_min: number | null;
  budget_max: number | null;
  budget_currency: string;
  max_creators: number | null;
  application_deadline: string | null;
  campaign_deliverables: { platform: string; content_type: string; quantity: number }[];
  brand: {
    company_name: string;
    website: string | null;
    rating: number;
    review_count: number;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function splitLines(text: string): string[] {
  return text.split("\n").filter(Boolean);
}

function formatDate(dateStr: string | null, locale: string): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PublicApplyPage() {
  const params = useParams();
  const id = params.id as string;
  const { t } = useTranslation("public.apply");
  const { locale, t: tGlobal } = useI18n();

  const [campaign, setCampaign] = useState<CampaignPublic | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [hasApplied, setHasApplied] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      // Fetch campaign with brand info
      const { data: campaignData } = await supabase
        .from("campaigns")
        .select(
          `id, title, status, brief_description, brief_requirements,
           brief_dos, brief_donts, platforms, markets, niches,
           budget_min, budget_max, budget_currency, max_creators,
           application_deadline,
           campaign_deliverables (platform, content_type, quantity),
           profiles!campaigns_brand_id_fkey (
             full_name,
             brand_profiles (
               company_name, website, rating, review_count
             )
           )`
        )
        .eq("id", id)
        .single();

      if (!campaignData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      const profile = getSingleRelation(
        (campaignData as Record<string, unknown>).profiles as
          | Record<string, unknown>
          | Record<string, unknown>[]
          | null
      );
      const bp = getSingleRelation(
        profile?.brand_profiles as
          | Record<string, unknown>
          | Record<string, unknown>[]
          | null
      );

      setCampaign({
        ...campaignData,
        brand: bp
          ? (bp as unknown as CampaignPublic["brand"])
          : {
              company_name: (profile?.full_name as string) || "Brand",
              website: null,
              rating: 0,
              review_count: 0,
            },
      });

      // Check if user is logged in and has already applied
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();
        if (profileData) setUserRole(profileData.role);

        // Check existing application
        const { data: appData } = await supabase
          .from("campaign_applications")
          .select("id")
          .eq("campaign_id", id)
          .eq("creator_id", user.id)
          .maybeSingle();
        if (appData) setHasApplied(true);
      }

      setLoading(false);
    }
    load();
  }, [id]);

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

  const isClosed =
    campaign.status !== "recruiting" &&
    campaign.status !== "draft";
  const dosItems = campaign.brief_dos
    ? splitLines(campaign.brief_dos)
    : [];
  const dontsItems = campaign.brief_donts
    ? splitLines(campaign.brief_donts)
    : [];

  return (
    <div className="min-h-svh bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          <Link href="/" className="text-lg font-bold text-foreground">
            PopsDrops
          </Link>
          <Link
            href="/login"
            className="text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            {tGlobal("ui.common", "nav.login")}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        {/* Brand info */}
        <div className="mb-1 flex items-center gap-2">
          <p className="text-sm font-medium text-muted-foreground">
            {t("by", { brand: campaign.brand.company_name })}
          </p>
          {campaign.brand.rating > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-amber-500">
              <Star className="size-3 fill-amber-500" />
              {campaign.brand.rating.toFixed(1)}
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
        <div className="mt-6 flex flex-wrap items-center gap-6 text-sm">
          <div className="flex items-center gap-1.5">
            <DollarSign className="size-4 text-muted-foreground" />
            <span className="font-semibold text-foreground">
              {formatBudgetRange(
                campaign.budget_min,
                campaign.budget_max,
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

        <Separator className="my-8" />

        {/* Brief */}
        {campaign.brief_description && (
          <div className="mb-6">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              {t("brief")}
            </h2>
            <p className="break-words text-sm leading-relaxed text-foreground">
              {campaign.brief_description}
            </p>
          </div>
        )}

        {/* Requirements */}
        {campaign.brief_requirements && (
          <div className="mb-6">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              {t("requirements")}
            </h2>
            <p className="break-words text-sm text-muted-foreground">
              {campaign.brief_requirements}
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
              {tGlobal("ui.common", "nav.home")}
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
                  Website
                  <ExternalLink className="size-2.5" />
                </a>
              )}
              {campaign.brand.rating > 0 && (
                <span className="inline-flex items-center gap-1">
                  <Star className="size-3 fill-amber-500 text-amber-500" />
                  {campaign.brand.rating.toFixed(1)} ({campaign.brand.review_count})
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* CTA */}
        <div className="sticky bottom-0 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] pt-4">
          {isClosed ? (
            <p className="text-center text-sm text-muted-foreground">
              {t("closed")}
            </p>
          ) : hasApplied ? (
            <div className="flex items-center justify-center gap-2 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4" />
              {t("alreadyApplied")}
            </div>
          ) : userRole === "creator" ? (
            <Link href={`/i/discover/${campaign.id}`}>
              <Button size="lg" className="w-full">
                {t("applyNow")}
              </Button>
            </Link>
          ) : userRole ? (
            // Logged in but not a creator (brand/admin)
            <p className="text-center text-sm text-muted-foreground">
              {t("loginToApply")}
            </p>
          ) : (
            <Link href={`/login?redirect=/apply/${campaign.id}`}>
              <Button size="lg" className="w-full">
                {t("signUpToApply")}
              </Button>
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}
