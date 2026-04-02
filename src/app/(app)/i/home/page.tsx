"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  FileEdit,
  Search,
  Star,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";
import { PlatformChip } from "@/components/platform-icons";
import { useI18n, useTranslation } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { formatBudgetRange, type Platform } from "@/lib/constants";
import { getSingleRelation } from "@/lib/supabase/relations";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProfileSummary {
  full_name: string;
  completeness: number;
  missingFields: string[];
}

interface ActionItem {
  id: string;
  type: "revision" | "due" | "counter";
  title: string;
  campaign: string;
  brand: string;
  detail: string;
  href: string;
}

interface CampaignMatch {
  id: string;
  title: string;
  brand: string;
  platforms: Platform[];
  budget_min: number | null;
  budget_max: number | null;
  application_deadline: string | null;
}

interface BrandRelationRecord {
  full_name: string | null;
}

interface MembershipCampaignRecord {
  id: string;
  title: string;
  content_due_date: string | null;
  status: string | null;
  profiles: BrandRelationRecord | BrandRelationRecord[] | null;
}

interface MembershipRecord {
  campaign_id: string;
  campaigns: MembershipCampaignRecord | MembershipCampaignRecord[] | null;
}

interface ApplicationCampaignRecord {
  title: string;
  profiles: BrandRelationRecord | BrandRelationRecord[] | null;
}

interface ApplicationRecord {
  id: string;
  campaign_id: string;
  status: string;
  counter_rate: number | null;
  proposed_rate: number | null;
  campaigns: ApplicationCampaignRecord | ApplicationCampaignRecord[] | null;
}

interface RecommendationRecord {
  id: string;
  title: string;
  platforms: Platform[] | null;
  budget_min: number | null;
  budget_max: number | null;
  application_deadline: string | null;
  profiles: BrandRelationRecord | BrandRelationRecord[] | null;
}

interface CreatorProfileRecord {
  bio: string | null;
  tiktok: unknown;
  instagram: unknown;
  snapchat: unknown;
  youtube: unknown;
  facebook: unknown;
  niches: string[] | null;
  rate_card: Record<string, unknown> | null;
  primary_market: string | null;
  languages: string[] | null;
  profile_completeness: number | null;
  rating: number | null;
  avg_response_time_hours: number | null;
}

// ---------------------------------------------------------------------------
// Greeting
// ---------------------------------------------------------------------------

function getGreetingKey(
  currentTime: number,
): "greeting" | "greeting.afternoon" | "greeting.evening" {
  const hour = new Date(currentTime).getHours();
  if (hour < 12) return "greeting";
  if (hour < 18) return "greeting.afternoon";
  return "greeting.evening";
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CreatorHomePage() {
  const { locale } = useI18n();
  const { t } = useTranslation("creator.home");
  const { t: tc } = useTranslation("ui.common");

  const [profileSummary, setProfileSummary] = useState<ProfileSummary | null>(null);
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignMatch[]>([]);
  const [activeCampaignCount, setActiveCampaignCount] = useState(0);
  const [pendingAppCount, setPendingAppCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [creatorRating, setCreatorRating] = useState<number | null>(null);
  const [creatorResponseTime, setCreatorResponseTime] = useState<number | null>(null);
  const [renderNow, setRenderNow] = useState(() => Date.now());

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [profileRes, creatorRes, membersRes, appsRes, campaignsRes] = await Promise.all([
        supabase.from("profiles").select("full_name, avatar_url").eq("id", user.id).single(),
        supabase.from("creator_profiles").select("bio, tiktok, instagram, snapchat, youtube, facebook, niches, rate_card, primary_market, languages, profile_completeness, rating, avg_response_time_hours").eq("profile_id", user.id).single(),
        // Active campaign memberships
        supabase
          .from("campaign_members")
          .select(`campaign_id, campaigns ( id, title, content_due_date, status, profiles!campaigns_brand_id_fkey ( full_name ) )`)
          .eq("creator_id", user.id),
        // Pending/counter-offer applications
        supabase
          .from("campaign_applications")
          .select(`id, campaign_id, status, counter_rate, proposed_rate, campaigns ( title, profiles!campaigns_brand_id_fkey ( full_name ) )`)
          .eq("creator_id", user.id)
          .in("status", ["pending", "counter_offer"]),
        // Recruiting campaigns for recommendations
        supabase
          .from("campaigns")
          .select(`id, title, platforms, budget_min, budget_max, application_deadline, profiles!campaigns_brand_id_fkey ( full_name )`)
          .eq("status", "recruiting")
          .order("application_deadline", { ascending: true })
          .limit(3),
      ]);

      // Profile summary
      if (profileRes.data && creatorRes.data) {
        const c = creatorRes.data as CreatorProfileRecord;
        const missing: string[] = [];
        if (!profileRes.data.avatar_url) missing.push(t("profile.missing.photo"));
        if (!c.bio) missing.push(t("profile.missing.bio"));
        const socialCount = [c.tiktok, c.instagram, c.snapchat, c.youtube, c.facebook].filter(Boolean).length;
        if (socialCount < 2) missing.push(t("profile.missing.socials"));
        if (!c.niches || c.niches.length === 0) missing.push(t("profile.missing.niches"));
        if (!c.rate_card || Object.keys(c.rate_card).length === 0) missing.push(t("profile.missing.rates"));

        setProfileSummary({
          full_name: profileRes.data.full_name,
          completeness: Math.round((c.profile_completeness || 0) * 100),
          missingFields: missing,
        });

        setCreatorRating(c.rating ?? null);
        setCreatorResponseTime(c.avg_response_time_hours ?? null);
      }

      // Build action items
      const actionItems: ActionItem[] = [];

      // Counter offers
      if (appsRes.data) {
        const applicationRows = appsRes.data as ApplicationRecord[];
        const counterOffers = applicationRows.filter(
          (application) => application.status === "counter_offer",
        );
        for (const a of counterOffers) {
          const c = getSingleRelation(a.campaigns);
          const brand = getSingleRelation(c?.profiles);
          actionItems.push({
            id: a.id,
            type: "counter",
            title: t("action.counter", { rate: String(a.counter_rate) }),
            campaign: c?.title || "Campaign",
            brand: brand?.full_name || "Brand",
            detail: t("action.counterDetail", { rate: String(a.proposed_rate) }),
            href: `/i/discover/${a.campaign_id}`,
          });
        }
        setPendingAppCount(
          applicationRows.filter((application) => application.status === "pending")
            .length,
        );
      }

      // Active campaigns with approaching deadlines
      if (membersRes.data) {
        const membershipRows = membersRes.data as MembershipRecord[];
        const active = membershipRows.filter((membership) => {
          const status = getSingleRelation(membership.campaigns)?.status;
          return status && status !== "completed" && status !== "cancelled";
        });
        setActiveCampaignCount(active.length);

        for (const membership of active) {
          const c = getSingleRelation(membership.campaigns);
          const brand = getSingleRelation(c?.profiles);
          if (c?.content_due_date) {
            const daysLeft = Math.ceil(
              (new Date(c.content_due_date).getTime() - Date.now()) /
                (1000 * 60 * 60 * 24)
            );
            if (daysLeft >= 0 && daysLeft <= 5) {
              actionItems.push({
                id: c.id,
                type: "due",
                title: daysLeft === 0 ? t("action.dueToday") : t("action.due", { days: String(daysLeft) }),
                campaign: c.title || "Campaign",
                brand: brand?.full_name || "Brand",
                detail: t("action.submitDeadline"),
                href: `/i/campaigns/${c.id}`,
              });
            }
          }
        }
      }

      setActions(actionItems);

      // Campaign recommendations
      if (campaignsRes.data) {
        setCampaigns(
          (campaignsRes.data as RecommendationRecord[]).map((campaign) => ({
            id: campaign.id,
            title: campaign.title,
            brand:
              getSingleRelation(campaign.profiles)?.full_name || "Brand",
            platforms: campaign.platforms || [],
            budget_min: campaign.budget_min,
            budget_max: campaign.budget_max,
            application_deadline: campaign.application_deadline,
          }))
        );
      }

      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setRenderNow(Date.now());
    }, 60_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  const greetingKey = getGreetingKey(renderNow);

  const stats = [
    { labelKey: "stat.active", value: String(activeCampaignCount), icon: Zap, color: "text-foreground" },
    { labelKey: "stat.pending", value: String(pendingAppCount), icon: Clock, color: "text-amber-500" },
    { labelKey: "stat.rating", value: creatorRating && creatorRating > 0 ? creatorRating.toFixed(1) : "—", icon: Star, color: "text-amber-500" },
    { labelKey: "stat.response", value: creatorResponseTime ? `${creatorResponseTime}h` : "—", icon: TrendingUp, color: "text-foreground" },
  ];

  const actionIcon = {
    revision: AlertTriangle,
    due: Clock,
    counter: FileEdit,
  };

  const actionColor = {
    revision: "text-amber-500",
    due: "text-red-500",
    counter: "text-foreground",
  };

  const firstName = profileSummary?.full_name.split(" ")[0] || "";

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-4 lg:p-6">
        {/* Greeting skeleton */}
        <div className="space-y-2">
          <div className="h-6 w-44 animate-pulse rounded-lg bg-muted" />
          <div className="h-4 w-28 animate-pulse rounded bg-muted/50" />
        </div>
        {/* Stats skeleton */}
        <div className="grid grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl border border-border/60 bg-card p-3">
              <div className="flex flex-col items-center gap-1.5">
                <div className="size-4 animate-pulse rounded bg-muted" />
                <div className="h-5 w-8 animate-pulse rounded bg-muted" />
                <div className="h-2.5 w-12 animate-pulse rounded bg-muted/50" />
              </div>
            </div>
          ))}
        </div>
        {/* Action cards skeleton */}
        <div className="space-y-2">
          <div className="h-3 w-28 animate-pulse rounded bg-muted" />
          {[1, 2].map((i) => (
            <div key={i} className="rounded-xl border border-border/60 bg-card p-4">
              <div className="flex items-start gap-3">
                <div className="size-8 animate-pulse rounded-lg bg-muted/50" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 w-40 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-28 animate-pulse rounded bg-muted/50" />
                </div>
                <div className="size-4 animate-pulse rounded bg-muted/50" />
              </div>
            </div>
          ))}
        </div>
        {/* Campaign cards skeleton */}
        <div className="space-y-2">
          <div className="h-3 w-32 animate-pulse rounded bg-muted" />
          {[1, 2].map((i) => (
            <div key={i} className="rounded-xl border border-border/60 bg-card p-4">
              <div className="space-y-2">
                <div className="h-3.5 w-36 animate-pulse rounded bg-muted" />
                <div className="h-3 w-20 animate-pulse rounded bg-muted/50" />
                <div className="mt-2 flex gap-2">
                  <div className="h-5 w-16 animate-pulse rounded-full bg-muted/50" />
                  <div className="h-5 w-14 animate-pulse rounded-full bg-muted/50" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 lg:p-6">
      {/* Greeting */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {t(greetingKey, { name: firstName })}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>

      {/* Profile completeness */}
      {profileSummary && profileSummary.completeness < 100 && (
        <Card>
          <CardContent className="flex items-center gap-4">
            <div className="flex-1">
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">
                  {t("profile.complete", {
                    percent: String(profileSummary.completeness),
                  })}
                </span>
                <Link
                  href="/i/profile"
                  className="text-sm font-medium text-foreground hover:underline"
                >
                  {t("profile.action")}
                </Link>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${profileSummary.completeness}%` }}
                />
              </div>
              {profileSummary.missingFields.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {profileSummary.missingFields.map((f) => (
                    <span
                      key={f}
                      className="text-xs text-muted-foreground/70"
                    >
                      {f}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-4 gap-3">
        {stats.map((s) => (
          <Card key={s.labelKey}>
            <CardContent className="flex flex-col items-center gap-1 py-3 text-center">
              <s.icon className={`size-4 ${s.color}`} />
              <span className="text-lg font-semibold tabular-nums text-foreground">
                {s.value}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {t(s.labelKey)}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Action required */}
      {actions.length > 0 ? (
        <section>
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/70">
            {t("section.actionRequired")}
          </h2>
          <div className="space-y-2">
            {actions.map((a) => {
              const Icon = actionIcon[a.type];
              return (
                <Link key={a.id} href={a.href} className="block">
                  <Card className="transition-shadow hover:shadow-md">
                    <CardContent className="flex items-start gap-3">
                      <div
                        className={`mt-0.5 rounded-lg bg-muted/50 p-2 ${actionColor[a.type]}`}
                      >
                        <Icon className="size-4" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-foreground">
                          {a.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {a.campaign} · {a.brand}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground/70">
                          {a.detail}
                        </p>
                      </div>
                      <ArrowRight className="icon-directional mt-1 size-4 text-muted-foreground/50" />
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      ) : (
        /* Empty state — no actions */
        <Card>
          <CardContent className="py-8 text-center">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-muted/50">
              <Zap className="size-5 text-muted-foreground/70" />
            </div>
            <p className="text-sm font-medium text-foreground">
              {t("empty.noTasks")}
            </p>
            <p className="mt-1 text-xs text-muted-foreground/70">
              {t("empty.noTasksDetail")}
            </p>
            <LinkButton
              href="/i/discover"
              variant="default"
              size="sm"
              className="mt-4"
            >
              <Search className="me-1.5 size-3.5" />
              {t("action.discover")}
            </LinkButton>
          </CardContent>
        </Card>
      )}

      {/* Recommended campaigns */}
      {campaigns.length > 0 ? (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/70">
              {t("section.recommended")}
            </h2>
            <LinkButton href="/i/discover" variant="ghost" size="xs">
              {tc("action.seeAll")}
            </LinkButton>
          </div>
          <div className="space-y-2">
            {campaigns.map((c) => {
              const budgetStr = formatBudgetRange(c.budget_min, c.budget_max, locale);
              const daysLeft = c.application_deadline
                ? Math.max(
                    0,
                    Math.ceil(
                      (new Date(c.application_deadline).getTime() -
                        renderNow) /
                        (1000 * 60 * 60 * 24)
                    )
                  )
                : null;
              return (
                <Link
                  key={c.id}
                  href={`/i/discover/${c.id}`}
                  className="block"
                >
                  <Card className="transition-shadow hover:shadow-md">
                    <CardContent>
                      <div className="flex items-start justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {c.title}
                          </p>
                          <p className="text-xs text-muted-foreground">{c.brand}</p>
                        </div>
                        <ArrowRight className="icon-directional mt-0.5 size-4 shrink-0 text-muted-foreground/50" />
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {c.platforms.map((p) => (
                          <PlatformChip key={p} platform={p} />
                        ))}
                        {budgetStr !== "—" && (
                          <span className="text-xs font-medium tabular-nums text-muted-foreground">
                            {budgetStr}
                          </span>
                        )}
                        {daysLeft !== null && (
                          <span
                            className={`text-xs ${
                              daysLeft <= 3
                                ? "font-medium text-red-500"
                                : "text-muted-foreground/70"
                            }`}
                          >
                            {t("card.daysLeft", { days: String(daysLeft) })}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      ) : (
        /* Empty state — no campaigns yet, show explore CTA */
        <Card>
            <CardContent className="py-8 text-center">
              <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-muted/50">
                <Search className="size-5 text-muted-foreground/70" />
              </div>
              <p className="text-sm font-medium text-foreground">
                {t("empty.findCampaign")}
              </p>
              <p className="mt-1 text-xs text-muted-foreground/70">
                {t("empty.findCampaignDetail")}
              </p>
              <LinkButton
                href="/i/discover"
                variant="default"
                size="sm"
                className="mt-4"
              >
                {t("action.explore")}
              </LinkButton>
            </CardContent>
          </Card>
      )}
    </div>
  );
}
