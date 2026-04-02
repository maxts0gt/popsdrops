"use client";

import { useState, useEffect } from "react";
import {
  BarChart3,
  TrendingUp,
  Users,
  Heart,
  Globe,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
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

function ChartPlaceholder({
  title,
  icon: Icon,
}: {
  title: string;
  icon: typeof BarChart3;
}) {
  return (
    <div className="flex aspect-[16/9] items-center justify-center rounded-lg border border-dashed border-border bg-muted/50">
      <div className="text-center">
        <Icon className="mx-auto mb-2 size-8 text-muted-foreground/50" />
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <p className="text-xs text-muted-foreground/70">
          Chart visualization coming soon
        </p>
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
    messages: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

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
        { count: allMessages },
      ] = await Promise.all([
        supabase
          .from("campaign_applications")
          .select("id", { count: "exact", head: true }),
        supabase
          .from("content_submissions")
          .select("id", { count: "exact", head: true }),
        supabase
          .from("campaign_messages")
          .select("id", { count: "exact", head: true }),
      ]);

      setEngagementCounts({
        applications: allApplications ?? 0,
        submissions: allSubmissions ?? 0,
        messages: allMessages ?? 0,
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
          <div className="grid gap-6 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>User Signups (30d)</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartPlaceholder title="Signup Trend Line" icon={TrendingUp} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Campaign Creation (30d)</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartPlaceholder
                  title="Campaign Trend Line"
                  icon={BarChart3}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>User Breakdown by Role</CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-32 w-full" />
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-lg border border-border px-4 py-2.5">
                      <span className="text-sm text-muted-foreground">
                        Creators
                      </span>
                      <span className="text-sm font-semibold text-foreground">
                        {growth?.creatorsTotal ?? 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-border px-4 py-2.5">
                      <span className="text-sm text-muted-foreground">
                        Brands
                      </span>
                      <span className="text-sm font-semibold text-foreground">
                        {growth?.brandsTotal ?? 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-border px-4 py-2.5">
                      <span className="text-sm text-muted-foreground">
                        Admins
                      </span>
                      <span className="text-sm font-semibold text-foreground">
                        {growth?.adminsTotal ?? 0}
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Application Volume</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartPlaceholder title="Bar Chart" icon={BarChart3} />
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ---- Engagement ---- */}
        <TabsContent value="engagement">
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
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
            <MetricCard
              label="Total Messages"
              value={String(engagementCounts?.messages ?? 0)}
              loading={loading}
            />
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>ER by Platform (30d)</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartPlaceholder
                  title="Grouped Bar Chart"
                  icon={Heart}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Top Performing Content Formats</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartPlaceholder
                  title="Horizontal Bar Chart"
                  icon={BarChart3}
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
                <CardTitle>Completion Rate Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartPlaceholder title="Line Chart" icon={Activity} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Response Time Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartPlaceholder title="Histogram" icon={BarChart3} />
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
                <ChartPlaceholder
                  title="Market Map Visualization"
                  icon={Globe}
                />
              </div>
              {loading ? (
                <Skeleton className="h-48 w-full" />
              ) : markets && markets.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                        <th className="pb-3 pr-4">Market</th>
                        <th className="pb-3 pr-4 text-right">Creators</th>
                        <th className="pb-3 text-right">Campaigns</th>
                      </tr>
                    </thead>
                    <tbody>
                      {markets.map((m) => (
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
                  <Globe className="mx-auto mb-3 size-8 text-muted-foreground/50" />
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
