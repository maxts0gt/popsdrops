"use client";

import { useState, useEffect, useMemo } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GrowthMetrics {
  newUsers7d: number;
  newCampaigns7d: number;
  applications7d: number;
  submissions7d: number;
  creatorsTotal: number;
  brandsTotal: number;
  adminsTotal: number;
}

interface HealthMetrics {
  avgCampaignsPerBrand: number;
  avgApplicationsPerCampaign: number;
  completionRate: number;
  totalCompleted: number;
  totalCampaigns: number;
}

interface MarketRow {
  market: string;
  creators: number;
  campaigns: number;
}

type MarketSortKey = "market" | "creators" | "campaigns";
type SortDir = "asc" | "desc";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function MetricCard({
  label,
  value,
  loading,
}: {
  label: string;
  value: string;
  loading: boolean;
}) {
  return (
    <Card>
      <CardContent>
        {loading ? (
          <>
            <Skeleton className="mb-1 h-7 w-16" />
            <Skeleton className="h-3 w-24" />
          </>
        ) : (
          <>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function MarketSortableHead({
  label,
  sortKey,
  currentKey,
  currentDir,
  onSort,
  align = "start",
}: {
  label: string;
  sortKey: MarketSortKey;
  currentKey: MarketSortKey;
  currentDir: SortDir;
  onSort: (key: MarketSortKey) => void;
  align?: "start" | "end";
}) {
  const isActive = currentKey === sortKey;
  const ariaSort = isActive ? (currentDir === "asc" ? "ascending" : "descending") : "none";
  const alignClass = align === "end" ? "text-right" : "text-left";
  const buttonClass = align === "end" ? "justify-end" : "";

  return (
    <th className={`pb-3 pr-4 ${alignClass}`} aria-sort={ariaSort}>
      <button
        type="button"
        data-testid="admin-market-sort-header"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 transition-colors hover:text-foreground ${buttonClass}`}
      >
        {label}
        {isActive ? (
          currentDir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />
        ) : (
          <ArrowUpDown className="size-3 opacity-30" />
        )}
      </button>
    </th>
  );
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: value >= 10000 ? "compact" : "standard",
    maximumFractionDigits: value >= 10000 ? 1 : 0,
  }).format(value);
}

function formatMarketName(market: string) {
  return market.replace(/_/g, " ");
}

function barWidth(value: number, max: number) {
  if (value <= 0 || max <= 0) return "0%";
  return `${Math.max(8, Math.round((value / max) * 100))}%`;
}

function SignalBarList({
  rows,
  loading,
}: {
  rows: Array<{
    label: string;
    value: number;
    note?: string;
  }>;
  loading: boolean;
}) {
  const max = Math.max(...rows.map((row) => row.value), 0);

  if (loading) {
    return (
      <div className="space-y-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-2.5 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {rows.map((row) => (
        <div key={row.label} className="space-y-2">
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-foreground">
                {row.label}
              </p>
              {row.note ? (
                <p className="text-xs text-muted-foreground">{row.note}</p>
              ) : null}
            </div>
            <span className="font-mono text-sm font-semibold text-foreground">
              {formatNumber(row.value)}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-slate-900"
              style={{ width: barWidth(row.value, max) }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function RoleMixPanel({
  growth,
  loading,
}: {
  growth: GrowthMetrics | null;
  loading: boolean;
}) {
  const rows = [
    { label: "Creators", value: growth?.creatorsTotal ?? 0 },
    { label: "Brands", value: growth?.brandsTotal ?? 0 },
    { label: "Admins", value: growth?.adminsTotal ?? 0 },
  ];
  const total = rows.reduce((sum, row) => sum + row.value, 0);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-3 w-full rounded-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex h-3 overflow-hidden rounded-full bg-slate-100">
        {rows.map((row, index) => (
          <div
            key={row.label}
            className={[
              "h-full",
              index === 0
                ? "bg-slate-900"
                : index === 1
                  ? "bg-slate-500"
                  : "bg-slate-300",
            ].join(" ")}
            style={{ width: total > 0 ? `${(row.value / total) * 100}%` : "0%" }}
          />
        ))}
      </div>
      <div className="space-y-3">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between rounded-lg border border-border px-4 py-2.5"
          >
            <span className="text-sm text-muted-foreground">{row.label}</span>
            <span className="font-mono text-sm font-semibold text-foreground">
              {formatNumber(row.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HealthSignalPanel({
  health,
  engagementCounts,
  loading,
}: {
  health: HealthMetrics | null;
  engagementCounts: {
    applications: number;
    submissions: number;
  } | null;
  loading: boolean;
}) {
  const applications = engagementCounts?.applications ?? 0;
  const submissions = engagementCounts?.submissions ?? 0;
  const submissionRate =
    applications > 0 ? Math.round((submissions / applications) * 100) : 0;

  const rows = [
    {
      label: "Completion",
      value: health?.completionRate ?? 0,
      display: `${health?.completionRate ?? 0}%`,
    },
    {
      label: "Submission conversion",
      value: submissionRate,
      display: `${submissionRate}%`,
    },
    {
      label: "Applications per campaign",
      value: Math.min((health?.avgApplicationsPerCampaign ?? 0) * 10, 100),
      display: String(health?.avgApplicationsPerCampaign ?? 0),
    },
    {
      label: "Campaigns per brand",
      value: Math.min((health?.avgCampaignsPerBrand ?? 0) * 20, 100),
      display: String(health?.avgCampaignsPerBrand ?? 0),
    },
  ];

  if (loading) {
    return (
      <div className="space-y-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="space-y-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-2.5 w-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {rows.map((row) => (
        <div key={row.label} className="space-y-2">
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-sm font-medium text-foreground">
              {row.label}
            </span>
            <span className="font-mono text-sm font-semibold text-foreground">
              {row.display}
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-slate-900"
              style={{ width: `${Math.max(0, Math.min(row.value, 100))}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function MarketBalancePanel({
  markets,
  loading,
}: {
  markets: MarketRow[] | null;
  loading: boolean;
}) {
  const topMarkets = [...(markets ?? [])]
    .sort((a, b) => b.creators + b.campaigns - (a.creators + a.campaigns))
    .slice(0, 5);
  const maxCreators = Math.max(...topMarkets.map((row) => row.creators), 0);
  const maxCampaigns = Math.max(...topMarkets.map((row) => row.campaigns), 0);

  if (loading) {
    return (
      <div className="space-y-4">
        {[0, 1, 2, 3, 4].map((item) => (
          <div key={item} className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-2.5 w-full" />
            <Skeleton className="h-2.5 w-4/5" />
          </div>
        ))}
      </div>
    );
  }

  if (topMarkets.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border px-4 py-8 text-center">
        <p className="text-sm font-medium text-foreground">
          No market coverage yet
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Markets appear after creators and campaigns define coverage.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {topMarkets.map((row) => (
        <div key={row.market} className="space-y-2">
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-sm font-medium capitalize text-foreground">
              {formatMarketName(row.market)}
            </span>
            <span className="font-mono text-xs text-muted-foreground">
              {formatNumber(row.creators)} creators / {formatNumber(row.campaigns)} campaigns
            </span>
          </div>
          <div className="space-y-1.5">
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-slate-900"
                style={{ width: barWidth(row.creators, maxCreators) }}
              />
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-slate-500"
                style={{ width: barWidth(row.campaigns, maxCampaigns) }}
              />
            </div>
          </div>
        </div>
      ))}
      <div className="flex gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <span className="size-2 rounded-full bg-slate-900" />
          Creator supply
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="size-2 rounded-full bg-slate-500" />
          Campaign demand
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminAnalyticsPage() {
  const [growth, setGrowth] = useState<GrowthMetrics | null>(null);
  const [health, setHealth] = useState<HealthMetrics | null>(null);
  const [markets, setMarkets] = useState<MarketRow[] | null>(null);
  const [engagementCounts, setEngagementCounts] = useState<{
    applications: number;
    submissions: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [marketSortKey, setMarketSortKey] = useState<MarketSortKey>("market");
  const [marketSortDir, setMarketSortDir] = useState<SortDir>("asc");

  function handleMarketSort(key: MarketSortKey) {
    if (marketSortKey === key) {
      setMarketSortDir((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setMarketSortKey(key);
      setMarketSortDir("asc");
    }
  }

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const oneWeekAgo = new Date(
        Date.now() - 7 * 24 * 60 * 60 * 1000
      ).toISOString();

      // --- Growth ---
      const [
        { count: newUsers7d },
        { count: newCampaigns7d },
        { count: applications7d },
        { count: submissions7d },
        { count: creatorsTotal },
        { count: brandsTotal },
        { count: adminsTotal },
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .gt("created_at", oneWeekAgo),
        supabase
          .from("campaigns")
          .select("id", { count: "exact", head: true })
          .gt("created_at", oneWeekAgo),
        supabase
          .from("campaign_applications")
          .select("id", { count: "exact", head: true })
          .gt("created_at", oneWeekAgo),
        supabase
          .from("content_submissions")
          .select("id", { count: "exact", head: true })
          .gt("created_at", oneWeekAgo),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "creator"),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "brand"),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "admin"),
      ]);

      setGrowth({
        newUsers7d: newUsers7d ?? 0,
        newCampaigns7d: newCampaigns7d ?? 0,
        applications7d: applications7d ?? 0,
        submissions7d: submissions7d ?? 0,
        creatorsTotal: creatorsTotal ?? 0,
        brandsTotal: brandsTotal ?? 0,
        adminsTotal: adminsTotal ?? 0,
      });

      // --- Engagement counts (all-time) ---
      const [
        { count: allApplications },
        { count: allSubmissions },
      ] = await Promise.all([
        supabase
          .from("campaign_applications")
          .select("id", { count: "exact", head: true }),
        supabase
          .from("content_submissions")
          .select("id", { count: "exact", head: true }),
      ]);

      setEngagementCounts({
        applications: allApplications ?? 0,
        submissions: allSubmissions ?? 0,
      });

      // --- Health ---
      const [
        { count: totalCampaigns },
        { count: completedCampaigns },
        { count: totalBrands },
      ] = await Promise.all([
        supabase
          .from("campaigns")
          .select("id", { count: "exact", head: true }),
        supabase
          .from("campaigns")
          .select("id", { count: "exact", head: true })
          .eq("status", "completed"),
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "brand"),
      ]);

      const tc = totalCampaigns ?? 0;
      const cc = completedCampaigns ?? 0;
      const tb = totalBrands ?? 0;

      // avg applications per campaign
      let avgAppsPerCampaign = 0;
      if (tc > 0) {
        const { count: totalApps } = await supabase
          .from("campaign_applications")
          .select("id", { count: "exact", head: true });
        avgAppsPerCampaign = Math.round(((totalApps ?? 0) / tc) * 10) / 10;
      }

      setHealth({
        avgCampaignsPerBrand: tb > 0 ? Math.round((tc / tb) * 10) / 10 : 0,
        avgApplicationsPerCampaign: avgAppsPerCampaign,
        completionRate: tc > 0 ? Math.round((cc / tc) * 100) : 0,
        totalCompleted: cc,
        totalCampaigns: tc,
      });

      // --- Markets ---
      // Get creator primary markets
      const { data: creatorMarkets } = await supabase
        .from("creator_profiles")
        .select("primary_market");

      // Get campaign markets
      const { data: campaignData } = await supabase
        .from("campaigns")
        .select("markets");

      // Aggregate creator counts by market
      const creatorCountByMarket: Record<string, number> = {};
      (creatorMarkets ?? []).forEach((row) => {
        const m = row.primary_market;
        if (m) creatorCountByMarket[m] = (creatorCountByMarket[m] || 0) + 1;
      });

      // Aggregate campaign counts by market (campaigns can target multiple markets)
      const campaignCountByMarket: Record<string, number> = {};
      (campaignData ?? []).forEach((row) => {
        const arr = row.markets as string[] | null;
        (arr ?? []).forEach((m) => {
          campaignCountByMarket[m] = (campaignCountByMarket[m] || 0) + 1;
        });
      });

      // Combine into a sorted list
      const allMarketKeys = new Set([
        ...Object.keys(creatorCountByMarket),
        ...Object.keys(campaignCountByMarket),
      ]);
      const marketRows: MarketRow[] = Array.from(allMarketKeys)
        .map((market) => ({
          market,
          creators: creatorCountByMarket[market] || 0,
          campaigns: campaignCountByMarket[market] || 0,
        }))
        .sort((a, b) => b.creators - a.creators);

      setMarkets(marketRows);
      setLoading(false);
    }
    load();
  }, []);

  const sortedMarkets = useMemo(() => {
    const direction = marketSortDir === "asc" ? 1 : -1;

    return [...(markets ?? [])].sort((a, b) => {
      const aVal = a[marketSortKey];
      const bVal = b[marketSortKey];
      if (typeof aVal === "number" && typeof bVal === "number") {
        return (aVal - bVal) * direction;
      }
      return String(aVal).localeCompare(String(bVal), "en-US", {
        numeric: true,
        sensitivity: "base",
      }) * direction;
    });
  }, [marketSortDir, marketSortKey, markets]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">
          Platform Analytics
        </h1>
        <p className="text-sm text-muted-foreground">
          Platform-wide metrics and trends
        </p>
      </div>

      <Tabs defaultValue="growth">
        <TabsList variant="line" className="mb-6">
          <TabsTrigger value="growth">Growth</TabsTrigger>
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
          <TabsTrigger value="health">Health</TabsTrigger>
          <TabsTrigger value="markets">Markets</TabsTrigger>
        </TabsList>

        {/* ---- Growth ---- */}
        <TabsContent value="growth">
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <MetricCard
              label="New Users (7d)"
              value={String(growth?.newUsers7d ?? 0)}
              loading={loading}
            />
            <MetricCard
              label="New Campaigns (7d)"
              value={String(growth?.newCampaigns7d ?? 0)}
              loading={loading}
            />
            <MetricCard
              label="Applications (7d)"
              value={String(growth?.applications7d ?? 0)}
              loading={loading}
            />
            <MetricCard
              label="Content Submitted (7d)"
              value={String(growth?.submissions7d ?? 0)}
              loading={loading}
            />
          </div>
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <Card>
              <CardHeader>
                <CardTitle>Seven day activity</CardTitle>
              </CardHeader>
              <CardContent>
                <SignalBarList
                  loading={loading}
                  rows={[
                    {
                      label: "New users",
                      value: growth?.newUsers7d ?? 0,
                    },
                    {
                      label: "New campaigns",
                      value: growth?.newCampaigns7d ?? 0,
                    },
                    {
                      label: "Applications",
                      value: growth?.applications7d ?? 0,
                    },
                    {
                      label: "Content submitted",
                      value: growth?.submissions7d ?? 0,
                    },
                  ]}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>User Breakdown by Role</CardTitle>
              </CardHeader>
              <CardContent>
                <RoleMixPanel growth={growth} loading={loading} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ---- Engagement ---- */}
        <TabsContent value="engagement">
          <div className="mb-6 grid grid-cols-2 gap-4">
            <MetricCard
              label="Total Applications"
              value={String(engagementCounts?.applications ?? 0)}
              loading={loading}
            />
            <MetricCard
              label="Total Submissions"
              value={String(engagementCounts?.submissions ?? 0)}
              loading={loading}
            />
          </div>
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <Card>
              <CardHeader>
                <CardTitle>Work volume</CardTitle>
              </CardHeader>
              <CardContent>
                <SignalBarList
                  loading={loading}
                  rows={[
                    {
                      label: "Applications",
                      value: engagementCounts?.applications ?? 0,
                      note: "Creators asking to join campaigns",
                    },
                    {
                      label: "Content submissions",
                      value: engagementCounts?.submissions ?? 0,
                      note: "Creator work entering review",
                    },
                  ]}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Handoff pressure</CardTitle>
              </CardHeader>
              <CardContent>
                <SignalBarList
                  loading={loading}
                  rows={[
                    {
                      label: "Applications this week",
                      value: growth?.applications7d ?? 0,
                    },
                    {
                      label: "Submissions this week",
                      value: growth?.submissions7d ?? 0,
                    },
                    {
                      label: "Total submissions",
                      value: engagementCounts?.submissions ?? 0,
                    },
                  ]}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ---- Health ---- */}
        <TabsContent value="health">
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <MetricCard
              label="Campaign Completion Rate"
              value={health ? `${health.completionRate}%` : "0%"}
              loading={loading}
            />
            <MetricCard
              label="Avg Campaigns per Brand"
              value={String(health?.avgCampaignsPerBrand ?? 0)}
              loading={loading}
            />
            <MetricCard
              label="Avg Applications per Campaign"
              value={String(health?.avgApplicationsPerCampaign ?? 0)}
              loading={loading}
            />
            <MetricCard
              label="Completed Campaigns"
              value={`${health?.totalCompleted ?? 0} / ${health?.totalCampaigns ?? 0}`}
              loading={loading}
            />
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Operational health</CardTitle>
              </CardHeader>
              <CardContent>
                <HealthSignalPanel
                  health={health}
                  engagementCounts={engagementCounts}
                  loading={loading}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Campaign state</CardTitle>
              </CardHeader>
              <CardContent>
                <SignalBarList
                  loading={loading}
                  rows={[
                    {
                      label: "Completed",
                      value: health?.totalCompleted ?? 0,
                    },
                    {
                      label: "Open",
                      value: Math.max(
                        (health?.totalCampaigns ?? 0) -
                          (health?.totalCompleted ?? 0),
                        0,
                      ),
                    },
                    {
                      label: "Total campaigns",
                      value: health?.totalCampaigns ?? 0,
                    },
                  ]}
                />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ---- Markets ---- */}
        <TabsContent value="markets">
          <Card>
            <CardHeader>
              <CardTitle>Market Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="mb-6">
                <MarketBalancePanel markets={markets} loading={loading} />
              </div>
              {loading ? (
                <Skeleton className="h-48 w-full" />
              ) : markets && markets.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                        <MarketSortableHead label="Market" sortKey="market" currentKey={marketSortKey} currentDir={marketSortDir} onSort={handleMarketSort} />
                        <MarketSortableHead label="Creators" sortKey="creators" currentKey={marketSortKey} currentDir={marketSortDir} onSort={handleMarketSort} align="end" />
                        <MarketSortableHead label="Campaigns" sortKey="campaigns" currentKey={marketSortKey} currentDir={marketSortDir} onSort={handleMarketSort} align="end" />
                      </tr>
                    </thead>
                    <tbody>
                      {sortedMarkets.map((m) => (
                        <tr
                          key={m.market}
                          className="border-b border-border/50 last:border-0"
                        >
                          <td className="py-2.5 pr-4 font-medium text-foreground capitalize">
                            {m.market.replace(/_/g, " ")}
                          </td>
                          <td className="py-2.5 pr-4 text-right text-muted-foreground">
                            {m.creators}
                          </td>
                          <td className="py-2.5 text-right text-muted-foreground">
                            {m.campaigns}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-lg border border-dashed border-border py-12 text-center">
                  <p className="text-sm text-muted-foreground">
                    No market data yet
                  </p>
                  <p className="text-xs text-muted-foreground/70">
                    Markets will appear once creators and campaigns are added
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
