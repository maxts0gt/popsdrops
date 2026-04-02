"use client";

import { useState, useEffect } from "react";
import {
  BarChart3,
  Clock,
  TrendingUp,
  CheckCircle2,
  Star,
  Eye,
  Heart,
  Zap,
  DollarSign,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";
import { PlatformIcon } from "@/components/platform-icons";
import {
  PLATFORM_LABELS,
  PLATFORM_COLORS,
  formatCurrency,
  type Platform,
} from "@/lib/constants";
import { useTranslation } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/context";
import { createClient } from "@/lib/supabase/client";
import { getSingleRelation } from "@/lib/supabase/relations";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlatformStat {
  platform: Platform;
  followers: number | null;
  totalViews: number;
  totalEngagements: number;
  er: number;
  contentCount: number;
}

interface CampaignPerformance {
  campaign_title: string;
  platform: Platform | null;
  views: number;
  engagements: number;
  er: number;
  earned: number;
}

interface ProfileStats {
  full_name: string;
  rating: number;
  review_count: number;
  campaigns_completed: number;
  completion_rate: number;
  avg_response_time_hours: number | null;
  niches: string[];
  primary_market: string | null;
  platforms: PlatformStat[];
  // Aggregated performance
  totalViews: number;
  totalEngagements: number;
  avgER: number;
  totalEarned: number;
  avgCPE: number;
  campaignPerformances: CampaignPerformance[];
}

interface MembershipCampaignRecord {
  title: string | null;
}

interface MembershipRecord {
  id: string;
  accepted_rate: number | null;
  campaigns: MembershipCampaignRecord | MembershipCampaignRecord[] | null;
}

interface ContentPerformanceRecord {
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
}

interface SubmissionPerformanceRecord {
  id: string;
  platform: Platform | null;
  campaign_member_id: string;
  content_performance:
    | ContentPerformanceRecord
    | ContentPerformanceRecord[]
    | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatNumber(n: number | null): string {
  if (n === null || n === undefined) return "—";
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AnalyticsPage() {
  const { t } = useTranslation("creator.analytics");
  const { locale } = useI18n();
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch creator profile
      const { data: creator } = await supabase
        .from("creator_profiles")
        .select(
          "rating, review_count, campaigns_completed, completion_rate, avg_response_time_hours, niches, primary_market, tiktok, instagram, snapchat, youtube, facebook"
        )
        .eq("profile_id", user.id)
        .single();

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      // Fetch campaign memberships with accepted rates
      const { data: memberships } = await supabase
        .from("campaign_members")
        .select(
          `id, accepted_rate,
           campaigns ( title, platforms )`
        )
        .eq("creator_id", user.id);

      // Fetch content submissions + performance for this creator
      const membershipRows = (memberships ?? []) as MembershipRecord[];
      const memberIds = membershipRows.map((membership) => membership.id);
      let allPerformance: SubmissionPerformanceRecord[] = [];
      if (memberIds.length > 0) {
        const { data: submissions } = await supabase
          .from("content_submissions")
          .select(
            `id, platform, campaign_member_id,
             content_performance ( views, likes, comments, shares, saves )`
          )
          .in("campaign_member_id", memberIds);

        allPerformance = (submissions ?? []) as SubmissionPerformanceRecord[];
      }

      if (creator && profile) {
        // Build platform stats from profile data
        const platformMap = new Map<
          Platform,
          { followers: number | null; views: number; engagements: number; contentCount: number }
        >();
        const platformKeys = ["tiktok", "instagram", "snapchat", "youtube", "facebook"] as const;
        for (const p of platformKeys) {
          const val = creator[p] as { followers?: number } | string | null;
          if (val) {
            const followers =
              typeof val === "object" && val.followers ? val.followers : null;
            platformMap.set(p as Platform, {
              followers,
              views: 0,
              engagements: 0,
              contentCount: 0,
            });
          }
        }

        // Aggregate performance by platform and campaign
        let totalViews = 0;
        let totalEngagements = 0;
        let totalEarned = 0;

        const campaignPerfMap = new Map<
          string,
          { title: string; platform: Platform | null; views: number; engagements: number; earned: number }
        >();
        const membershipById = new Map(
          membershipRows.map((membership) => [membership.id, membership]),
        );

        for (const sub of allPerformance) {
          const perfs = Array.isArray(sub.content_performance)
            ? sub.content_performance
            : sub.content_performance
              ? [sub.content_performance]
              : [];

          let subViews = 0;
          let subEng = 0;
          for (const p of perfs) {
            subViews += p.views || 0;
            subEng += (p.likes || 0) + (p.comments || 0) + (p.shares || 0) + (p.saves || 0);
          }

          totalViews += subViews;
          totalEngagements += subEng;

          // Aggregate into platform stats
          const platform = sub.platform as Platform | null;
          if (platform && platformMap.has(platform)) {
            const ps = platformMap.get(platform)!;
            ps.views += subViews;
            ps.engagements += subEng;
            ps.contentCount += 1;
          }

          // Aggregate into campaign performance
          const membership = membershipById.get(sub.campaign_member_id);
          if (membership) {
            const campaign = getSingleRelation(membership.campaigns);
            const campaignTitle = campaign?.title || "Campaign";
            const key = sub.campaign_member_id;

            if (!campaignPerfMap.has(key)) {
              campaignPerfMap.set(key, {
                title: campaignTitle,
                platform,
                views: 0,
                engagements: 0,
                earned: membership.accepted_rate ?? 0,
              });
            }
            const cp = campaignPerfMap.get(key)!;
            cp.views += subViews;
            cp.engagements += subEng;
          }
        }

        // Calculate total earned from all memberships
        for (const membership of membershipRows) {
          totalEarned += membership.accepted_rate ?? 0;
        }

        const avgER = totalViews > 0 ? (totalEngagements / totalViews) * 100 : 0;
        const avgCPE =
          totalEngagements > 0 && totalEarned > 0
            ? totalEarned / totalEngagements
            : 0;

        // Build platform stats array
        const platforms: PlatformStat[] = [];
        for (const [platform, data] of platformMap) {
          platforms.push({
            platform,
            followers: data.followers,
            totalViews: data.views,
            totalEngagements: data.engagements,
            er: data.views > 0 ? (data.engagements / data.views) * 100 : 0,
            contentCount: data.contentCount,
          });
        }

        // Build campaign performances array
        const campaignPerformances: CampaignPerformance[] = [];
        for (const [, cp] of campaignPerfMap) {
          campaignPerformances.push({
            campaign_title: cp.title,
            platform: cp.platform,
            views: cp.views,
            engagements: cp.engagements,
            er: cp.views > 0 ? (cp.engagements / cp.views) * 100 : 0,
            earned: cp.earned,
          });
        }

        setStats({
          full_name: profile.full_name,
          rating: creator.rating || 0,
          review_count: creator.review_count || 0,
          campaigns_completed: creator.campaigns_completed || 0,
          completion_rate: creator.completion_rate || 0,
          avg_response_time_hours: creator.avg_response_time_hours,
          niches: creator.niches || [],
          primary_market: creator.primary_market,
          platforms,
          totalViews,
          totalEngagements,
          avgER,
          totalEarned,
          avgCPE,
          campaignPerformances,
        });
      }

      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4 lg:p-6">
        <div className="h-6 w-24 animate-pulse rounded bg-muted" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="rounded-xl border border-border/60 bg-card p-4"
            >
              <div className="flex items-center gap-2.5">
                <div className="size-9 animate-pulse rounded-lg bg-muted/50" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 w-12 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-20 animate-pulse rounded bg-muted/50" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="mx-auto max-w-2xl p-4 lg:p-6">
        <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>
        <Card className="mt-6">
          <CardContent className="py-12 text-center">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-muted/50">
              <BarChart3 className="size-5 text-muted-foreground/70" />
            </div>
            <p className="text-sm font-medium text-foreground">
              {t("empty.profile")}
            </p>
            <LinkButton
              href="/i/profile"
              variant="default"
              size="sm"
              className="mt-4"
            >
              {t("empty.profileCta")}
            </LinkButton>
          </CardContent>
        </Card>
      </div>
    );
  }

  const profileMetrics = [
    {
      label: t("metric.campaignsCompleted"),
      value: String(stats.campaigns_completed),
      icon: CheckCircle2,
    },
    {
      label: t("metric.avgRating"),
      value: stats.rating > 0 ? `${stats.rating.toFixed(1)}/5` : "—",
      detail:
        stats.review_count > 0
          ? t("label.reviews", { count: String(stats.review_count) })
          : null,
      icon: Star,
    },
    {
      label: t("metric.completionRate"),
      value:
        stats.completion_rate > 0
          ? `${Math.round(stats.completion_rate * 100)}%`
          : "—",
      icon: TrendingUp,
    },
    {
      label: t("metric.responseTime"),
      value: stats.avg_response_time_hours
        ? `${stats.avg_response_time_hours.toFixed(1)}h`
        : "—",
      icon: Clock,
    },
  ];

  const performanceMetrics = [
    {
      label: t("metric.totalViews"),
      value: formatNumber(stats.totalViews),
      icon: Eye,
    },
    {
      label: t("metric.totalEngagements"),
      value: formatNumber(stats.totalEngagements),
      icon: Heart,
    },
    {
      label: t("metric.avgEngRate"),
      value: stats.avgER > 0 ? `${stats.avgER.toFixed(1)}%` : "—",
      icon: Zap,
    },
    {
      label: t("metric.totalEarned"),
      value: stats.totalEarned > 0 ? formatCurrency(stats.totalEarned, locale) : "—",
      icon: DollarSign,
    },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 lg:p-6">
      <h1 className="text-xl font-semibold text-foreground">{t("title")}</h1>

      <Tabs defaultValue="performance">
        <TabsList>
          <TabsTrigger value="performance">{t("section.performance")}</TabsTrigger>
          <TabsTrigger value="profile">{t("section.overview")}</TabsTrigger>
          <TabsTrigger value="platforms">{t("section.platforms")}</TabsTrigger>
        </TabsList>

        {/* Performance — aggregated from real campaign data */}
        <TabsContent value="performance" className="mt-4 space-y-6">
          <div className="grid grid-cols-2 gap-3">
            {performanceMetrics.map((s) => (
              <Card key={s.label}>
                <CardContent className="py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground">
                      <s.icon className="size-4" />
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground/70">{s.label}</p>
                      <p className="text-lg font-semibold tabular-nums text-foreground">
                        {s.value}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Per-campaign breakdown */}
          {stats.campaignPerformances.length > 0 ? (
            <Card>
              <CardContent>
                <h3 className="mb-3 text-sm font-medium text-foreground">
                  {t("section.campaignBreakdown")}
                </h3>
                <div className="space-y-1">
                  {stats.campaignPerformances.map((cp, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-lg p-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">
                          {cp.campaign_title}
                        </p>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground/70">
                          {cp.platform && (
                            <span className="inline-flex items-center gap-0.5">
                              {(() => {
                                const Icon = PlatformIcon[cp.platform];
                                return <Icon className="size-3" />;
                              })()}
                              {PLATFORM_LABELS[cp.platform]}
                            </span>
                          )}
                          <span>{t("label.views", { count: formatNumber(cp.views) })}</span>
                          <span>{t("label.engagements", { count: formatNumber(cp.engagements) })}</span>
                        </div>
                      </div>
                      <div className="text-end">
                        <p className="text-sm font-semibold tabular-nums text-foreground">
                          {cp.er > 0 ? `${cp.er.toFixed(1)}%` : "—"}
                        </p>
                        <p className="text-[11px] text-muted-foreground/70">{t("label.er")}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-sm font-medium text-foreground">
                  {t("empty.campaigns")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground/70">
                  {t("empty.campaignsDetail")}
                </p>
                <LinkButton
                  href="/i/discover"
                  variant="default"
                  size="sm"
                  className="mt-4"
                >
                  {t("empty.campaignsCta")}
                </LinkButton>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Profile Overview */}
        <TabsContent value="profile" className="mt-4 space-y-6">
          <div className="grid grid-cols-2 gap-3">
            {profileMetrics.map((s) => (
              <Card key={s.label}>
                <CardContent className="py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground">
                      <s.icon className="size-4" />
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground/70">{s.label}</p>
                      <p className="text-lg font-semibold tabular-nums text-foreground">
                        {s.value}
                      </p>
                    </div>
                  </div>
                  {"detail" in s && s.detail && (
                    <p className="mt-1.5 text-[11px] text-muted-foreground/70">
                      {s.detail}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Platforms */}
        <TabsContent value="platforms" className="mt-4 space-y-4">
          {stats.platforms.length > 0 ? (
            <div className="space-y-3">
              {stats.platforms.map((p) => {
                return (
                  <Card key={p.platform}>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${PLATFORM_COLORS[p.platform]}`}
                          >
                            {PLATFORM_LABELS[p.platform]}
                          </span>
                        </div>
                        <p className="text-lg font-bold tabular-nums text-foreground">
                          {formatNumber(p.followers)}
                          <span className="ms-1 text-xs font-normal text-muted-foreground/70">
                            {t("label.followers")}
                          </span>
                        </p>
                      </div>
                      {/* Platform-specific performance */}
                      {p.contentCount > 0 && (
                        <div className="mt-3 flex items-center gap-4 border-t border-border/50 pt-3 text-xs text-muted-foreground">
                          <span className="tabular-nums">
                            {t("label.views", { count: formatNumber(p.totalViews) })}
                          </span>
                          <span className="tabular-nums">
                            {t("label.engagements", { count: formatNumber(p.totalEngagements) })}
                          </span>
                          <span className="tabular-nums">
                            {p.er.toFixed(1)}% {t("label.er")}
                          </span>
                          <span className="tabular-nums">
                            {p.contentCount === 1
                              ? t("label.pieceSingular")
                              : t("label.pieces", { count: String(p.contentCount) })}
                          </span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-sm font-medium text-foreground">
                  {t("empty.platforms")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground/70">
                  {t("empty.platformsDetail")}
                </p>
                <LinkButton
                  href="/i/profile"
                  variant="default"
                  size="sm"
                  className="mt-4"
                >
                  {t("empty.platformsCta")}
                </LinkButton>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
