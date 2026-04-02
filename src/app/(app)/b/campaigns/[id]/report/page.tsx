"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Eye,
  Heart,
  DollarSign,
  TrendingUp,
  Zap,
  BarChart3,
  Star,
  Download,
} from "lucide-react";
import { exportReportPDF } from "@/lib/export-report-pdf";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  PLATFORM_LABELS,
  getMarketLabel,
  formatCurrency,
} from "@/lib/constants";
import { useTranslation } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/context";
import type { Platform } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CampaignRow {
  id: string;
  title: string;
  total_spend: number | null;
  posting_window_start: string | null;
  posting_window_end: string | null;
  report_data: Record<string, unknown> | null;
}

interface MemberPerformance {
  member_id: string;
  name: string;
  avatar_url: string | null;
  market: string | null;
  platform: string | null;
  rate: number | null;
  views: number;
  engagements: number;
  er: number;
  cpe: number;
  rating: number;
  topPerformer: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

function formatDate(dateStr: string | null, locale = "en"): string {
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

export default function CampaignReportPage() {
  const { t } = useTranslation("brand.report");
  const { locale } = useI18n();
  const params = useParams();
  const campaignId = params.id as string;

  const [campaign, setCampaign] = useState<CampaignRow | null>(null);
  const [performers, setPerformers] = useState<MemberPerformance[]>([]);
  const [loading, setLoading] = useState(true);

  // Aggregate stats
  const [totalReach, setTotalReach] = useState(0);
  const [totalEngagements, setTotalEngagements] = useState(0);

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      // Fetch campaign
      const { data: camp } = await supabase
        .from("campaigns")
        .select("id, title, total_spend, posting_window_start, posting_window_end, report_data")
        .eq("id", campaignId)
        .single();

      if (camp) setCampaign(camp as CampaignRow);

      // Fetch members with their performance data
      const { data: members } = await supabase
        .from("campaign_members")
        .select(
          `id, accepted_rate, creator_id,
           profiles!campaign_members_creator_id_fkey ( full_name, avatar_url )`,
        )
        .eq("campaign_id", campaignId);

      if (members) {
        // Fetch creator_profiles separately (no direct FK from campaign_members)
        const creatorIds = members.map((m: Record<string, unknown>) => m.creator_id as string).filter(Boolean);
        const cpMap = new Map<string, Record<string, unknown>>();
        if (creatorIds.length > 0) {
          const { data: cps } = await supabase
            .from("creator_profiles")
            .select("profile_id, primary_market, rating, tiktok, instagram, snapchat, youtube, facebook")
            .in("profile_id", creatorIds);
          if (cps) {
            for (const cp of cps) cpMap.set(cp.profile_id, cp);
          }
        }

        // Fetch performance for all submissions via member IDs
        const memberIds = members.map((m: Record<string, unknown>) => m.id as string);
        let submissions: Record<string, unknown>[] | null = null;
        if (memberIds.length > 0) {
          const { data } = await supabase
            .from("content_submissions")
            .select(
              `id, campaign_member_id, platform,
               content_performance ( views, likes, comments, shares, saves )`,
            )
            .in("campaign_member_id", memberIds);
          submissions = data as Record<string, unknown>[] | null;
        }

        // Aggregate performance per member
        const perfMap = new Map<
          string,
          { views: number; engagements: number; platform: string | null }
        >();

        if (submissions) {
          for (const sub of submissions) {
            const perf = Array.isArray(sub.content_performance)
              ? sub.content_performance
              : sub.content_performance
                ? [sub.content_performance]
                : [];

            let views = 0;
            let engagements = 0;
            for (const p of perf as Array<Record<string, number | null>>) {
              views += p.views || 0;
              engagements += (p.likes || 0) + (p.comments || 0) + (p.shares || 0) + (p.saves || 0);
            }

            const memberId = sub.campaign_member_id as string;
            const existing = perfMap.get(memberId) || {
              views: 0,
              engagements: 0,
              platform: sub.platform as string | null,
            };
            perfMap.set(memberId, {
              views: existing.views + views,
              engagements: existing.engagements + engagements,
              platform: existing.platform || (sub.platform as string | null),
            });
          }
        }

        let sumReach = 0;
        let sumEng = 0;
        let topViews = 0;
        const result: MemberPerformance[] = [];

        for (const m of members) {
          const prof = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
          const cp = cpMap.get(m.creator_id as string) ?? null;
          const perf = perfMap.get(m.id) || { views: 0, engagements: 0, platform: null };

          const name = (prof as Record<string, string> | null)?.full_name || "";
          const avatarUrl = (prof as Record<string, string | null> | null)?.avatar_url || null;
          const market = (cp as Record<string, string | null> | null)?.primary_market || null;
          const rating = (cp as Record<string, number> | null)?.rating || 0;
          const rate = m.accepted_rate as number | null;

          // Detect platform from creator profile if not from submissions
          let platform = perf.platform;
          if (!platform && cp) {
            const keys = ["tiktok", "instagram", "snapchat", "youtube", "facebook"] as const;
            for (const k of keys) {
              if ((cp as Record<string, unknown>)[k]) {
                platform = k;
                break;
              }
            }
          }

          const er = perf.views > 0 ? (perf.engagements / perf.views) * 100 : 0;
          const cpe = perf.engagements > 0 && rate ? rate / perf.engagements : 0;

          sumReach += perf.views;
          sumEng += perf.engagements;
          if (perf.views > topViews) topViews = perf.views;

          result.push({
            member_id: m.id,
            name,
            avatar_url: avatarUrl,
            market,
            platform,
            rate,
            views: perf.views,
            engagements: perf.engagements,
            er,
            cpe,
            rating,
            topPerformer: false,
          });
        }

        // Mark top performer
        if (result.length > 0) {
          const topIdx = result.reduce((best, cur, i) =>
            cur.views > result[best].views ? i : best, 0);
          result[topIdx].topPerformer = true;
        }

        setPerformers(result);
        setTotalReach(sumReach);
        setTotalEngagements(sumEng);
      }

      setLoading(false);
    }
    load();
  }, [campaignId]);

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="space-y-2">
          <div className="h-4 w-20 animate-pulse rounded bg-muted" />
          <div className="h-7 w-56 animate-pulse rounded bg-muted" />
          <div className="h-4 w-32 animate-pulse rounded bg-muted/50" />
        </div>
        {/* KPI cards */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="rounded-xl border border-border/60 bg-card p-5">
              <div className="space-y-2">
                <div className="h-6 w-16 animate-pulse rounded bg-muted" />
                <div className="h-3 w-24 animate-pulse rounded bg-muted/50" />
              </div>
            </div>
          ))}
        </div>
        {/* Table skeleton */}
        <div className="rounded-xl border border-border/60 bg-card">
          <div className="flex gap-4 border-b border-border/50 px-6 py-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-3 flex-1 animate-pulse rounded bg-muted" />
            ))}
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 border-b border-border/30 px-6 py-4 last:border-0">
              <div className="size-7 animate-pulse rounded-full bg-muted" />
              {[1, 2, 3, 4].map((j) => (
                <div key={j} className="h-3 flex-1 animate-pulse rounded bg-muted/50" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!campaign) return null;

  const totalSpend = campaign.total_spend || 0;
  const avgER = totalReach > 0 ? (totalEngagements / totalReach) * 100 : 0;
  const avgCPE = totalEngagements > 0 && totalSpend > 0 ? totalSpend / totalEngagements : 0;

  // KPI cards config
  const kpiCards = [
    {
      label: t("kpi.reach"),
      value: formatNumber(totalReach),
      icon: Eye,
    },
    {
      label: t("kpi.engagements"),
      value: formatNumber(totalEngagements),
      icon: Heart,
    },
    {
      label: t("kpi.engagementRate"),
      value: `${avgER.toFixed(1)}%`,
      icon: TrendingUp,
    },
    {
      label: t("kpi.cpe"),
      value: avgCPE > 0 ? formatCurrency(avgCPE, locale, "USD", 2) : "—",
      icon: Zap,
    },
    {
      label: t("kpi.totalSpend"),
      value: formatCurrency(totalSpend, locale),
      icon: DollarSign,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          href={`/b/campaigns/${campaign.id}`}
          className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" /> {t("back")}
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
            <p className="text-sm text-muted-foreground">
              {campaign.title} &middot; {formatDate(campaign.posting_window_start, locale)} — {formatDate(campaign.posting_window_end, locale)}
            </p>
          </div>
          <button
            onClick={() =>
              exportReportPDF({
                campaignTitle: campaign.title,
                dateRange: `${formatDate(campaign.posting_window_start, locale)} — ${formatDate(campaign.posting_window_end, locale)}`,
                kpis: kpiCards.map((k) => ({ label: k.label, value: k.value })),
                creators: performers.map((c) => ({
                  name: c.name,
                  market: c.market ? getMarketLabel(c.market, locale) : "—",
                  platform: c.platform
                    ? PLATFORM_LABELS[c.platform as Platform] || c.platform
                    : "—",
                  views: formatNumber(c.views),
                  engagements: formatNumber(c.engagements),
                  er: `${c.er.toFixed(1)}%`,
                  cpe:
                    c.cpe > 0
                      ? formatCurrency(c.cpe, locale, "USD", 2)
                      : "—",
                  spent:
                    c.rate != null ? formatCurrency(c.rate, locale) : "—",
                  rating: c.rating > 0 ? c.rating.toFixed(1) : "—",
                })),
              })
            }
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary/90"
          >
            <Download className="size-4" />
            {t("exportPdf")}
          </button>
        </div>
      </div>

      {/* Executive Summary */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-5">
        {kpiCards.map((card) => (
          <Card key={card.label}>
            <CardContent>
              <div className="mb-2 inline-flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <card.icon className="size-4" />
              </div>
              <p className="text-xl font-bold text-foreground">{card.value}</p>
              <p className="text-xs text-muted-foreground">{card.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Creator Performance Table */}
      {performers.length > 0 ? (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>{t("section.creatorPerformance")}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("table.creator")}</TableHead>
                  <TableHead>{t("table.market")}</TableHead>
                  <TableHead>{t("table.platform")}</TableHead>
                  <TableHead className="text-end">{t("table.reach")}</TableHead>
                  <TableHead className="text-end">{t("table.engagements")}</TableHead>
                  <TableHead className="text-end">{t("table.er")}</TableHead>
                  <TableHead className="text-end">{t("table.cpe")}</TableHead>
                  <TableHead className="text-end">{t("table.spent")}</TableHead>
                  <TableHead className="text-end">{t("table.rating")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {performers.map((c) => (
                  <TableRow key={c.member_id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar className="size-7">
                          {c.avatar_url && <AvatarImage src={c.avatar_url} />}
                          <AvatarFallback className="text-xs">{getInitials(c.name)}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">
                          {c.name}
                          {c.topPerformer && (
                            <Star className="ms-1 inline size-3 fill-amber-400 text-amber-400" />
                          )}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {c.market ? getMarketLabel(c.market, locale) : "—"}
                    </TableCell>
                    <TableCell>
                      {c.platform ? PLATFORM_LABELS[c.platform as Platform] || c.platform : "—"}
                    </TableCell>
                    <TableCell className="text-end">{formatNumber(c.views)}</TableCell>
                    <TableCell className="text-end">{formatNumber(c.engagements)}</TableCell>
                    <TableCell className="text-end font-medium">{c.er.toFixed(1)}%</TableCell>
                    <TableCell className="text-end">
                      {c.cpe > 0 ? formatCurrency(c.cpe, locale, "USD", 2) : "—"}
                    </TableCell>
                    <TableCell className="text-end">
                      {c.rate != null ? formatCurrency(c.rate, locale) : "—"}
                    </TableCell>
                    <TableCell className="text-end">
                      {c.rating > 0 ? c.rating.toFixed(1) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <div className="mb-8 rounded-lg border border-dashed border-border py-12 text-center">
          <BarChart3 className="mx-auto mb-3 size-8 text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">{t("empty")}</p>
        </div>
      )}
    </div>
  );
}
