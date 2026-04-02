"use client";

import { useState, useEffect } from "react";
import {
  Megaphone,
  Users,
  FileCheck,
  Star,
  Plus,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";
import { CAMPAIGN_STATUS_COLORS, CAMPAIGN_STATUS_LABELS } from "@/lib/constants";
import { useI18n, useTranslation } from "@/lib/i18n";
import type { CampaignStatus } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ActiveCampaign {
  id: string;
  title: string;
  status: CampaignStatus;
  max_creators: number;
  budget_min: number | null;
  budget_max: number | null;
  member_count: number;
  submission_count: number;
}

interface BrandStats {
  companyName: string;
  activeCampaigns: number;
  pendingApplications: number;
  contentAwaiting: number;
  avgRating: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(amount: number | null, locale = "en"): string {
  if (!amount) return "$0";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BrandHomePage() {
  const { t } = useTranslation("brand.home");
  const { t: tc } = useTranslation("ui.common");
  const { locale } = useI18n();
  const [campaigns, setCampaigns] = useState<ActiveCampaign[]>([]);
  const [stats, setStats] = useState<BrandStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch brand profile
      const { data: brandProfile } = await supabase
        .from("brand_profiles")
        .select("company_name, rating")
        .eq("profile_id", user.id)
        .single();

      // Fetch active campaigns
      const { data: campaignData } = await supabase
        .from("campaigns")
        .select("id, title, status, max_creators, budget_min, budget_max")
        .eq("brand_id", user.id)
        .not("status", "in", '("completed","cancelled","draft")')
        .order("created_at", { ascending: false });

      // Fetch pending applications count
      const { count: pendingApps } = await supabase
        .from("campaign_applications")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
        .in(
          "campaign_id",
          (campaignData || []).map((c) => c.id)
        );

      // Fetch content awaiting review count
      const { count: contentAwaiting } = await supabase
        .from("content_submissions")
        .select("id", { count: "exact", head: true })
        .eq("status", "submitted");

      // Fetch member + submission counts per campaign
      const enriched: ActiveCampaign[] = [];
      for (const c of campaignData || []) {
        const { count: memberCount } = await supabase
          .from("campaign_members")
          .select("id", { count: "exact", head: true })
          .eq("campaign_id", c.id);

        const { count: submissionCount } = await supabase
          .from("content_submissions")
          .select("id", { count: "exact", head: true })
          .eq("campaign_member_id", c.id);

        enriched.push({
          ...c,
          status: c.status as CampaignStatus,
          member_count: memberCount || 0,
          submission_count: submissionCount || 0,
        });
      }

      setCampaigns(enriched);
      setStats({
        companyName: brandProfile?.company_name || "",
        activeCampaigns: enriched.length,
        pendingApplications: pendingApps || 0,
        contentAwaiting: contentAwaiting || 0,
        avgRating: brandProfile?.rating || 0,
      });
      setLoading(false);
    }
    load();
  }, []);

  const kpis = stats
    ? [
        {
          labelKey: "kpi.activeCampaigns",
          value: String(stats.activeCampaigns),
          icon: Megaphone,
          color: "text-slate-600 bg-slate-100",
        },
        {
          labelKey: "kpi.pendingApplications",
          value: String(stats.pendingApplications),
          icon: Users,
          color: "text-slate-600 bg-slate-100",
        },
        {
          labelKey: "kpi.contentAwaitingReview",
          value: String(stats.contentAwaiting),
          icon: FileCheck,
          color: "text-slate-600 bg-slate-100",
        },
        {
          labelKey: "kpi.avgRating",
          value: stats.avgRating > 0 ? stats.avgRating.toFixed(1) : "—",
          icon: Star,
          color: "text-slate-600 bg-slate-100",
        },
      ]
    : [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t("title")}</h1>
          {stats && (
            <p className="text-sm text-slate-500">
              {t("greeting", { name: stats.companyName })}
            </p>
          )}
        </div>
        <LinkButton href="/b/campaigns/new" size="lg">
          <Plus className="size-4" />
          {t("action.newCampaign")}
        </LinkButton>
      </div>

      {loading ? (
        <div className="space-y-6">
          {/* KPI card skeletons */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="rounded-xl border border-slate-200/60 bg-white p-5"
              >
                <div className="flex items-center gap-3">
                  <div className="size-10 animate-pulse rounded-lg bg-slate-100" />
                  <div className="flex-1 space-y-2">
                    <div className="h-6 w-10 animate-pulse rounded bg-slate-100" />
                    <div className="h-3 w-24 animate-pulse rounded bg-slate-50" />
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/* Campaign list skeleton */}
          <div className="rounded-xl border border-slate-200/60 bg-white">
            <div className="flex items-center justify-between p-5 pb-3">
              <div className="h-5 w-32 animate-pulse rounded bg-slate-100" />
              <div className="h-4 w-16 animate-pulse rounded bg-slate-50" />
            </div>
            <div className="space-y-3 p-5 pt-2">
              {[1, 2].map((i) => (
                <div key={i} className="rounded-lg border border-slate-100 p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="h-4 w-40 animate-pulse rounded bg-slate-100" />
                      <div className="h-3 w-24 animate-pulse rounded bg-slate-50" />
                    </div>
                    <div className="h-5 w-16 animate-pulse rounded-full bg-slate-50" />
                  </div>
                  <div className="mt-3 space-y-1.5">
                    <div className="flex justify-between">
                      <div className="h-3 w-16 animate-pulse rounded bg-slate-50" />
                      <div className="h-3 w-8 animate-pulse rounded bg-slate-50" />
                    </div>
                    <div className="h-1.5 w-full animate-pulse rounded-full bg-slate-50" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {kpis.map((kpi) => (
              <Card key={kpi.labelKey}>
                <CardContent className="flex items-center gap-3">
                  <div
                    className={`flex size-10 items-center justify-center rounded-lg ${kpi.color}`}
                  >
                    <kpi.icon className="size-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">
                      {kpi.value}
                    </p>
                    <p className="text-xs text-slate-500">
                      {t(kpi.labelKey)}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Active Campaigns */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>{t("section.activeCampaigns")}</CardTitle>
              <LinkButton href="/b/campaigns" variant="ghost" size="sm">
                {tc("action.viewAll")}{" "}
                <ArrowRight className="icon-directional size-3.5" />
              </LinkButton>
            </CardHeader>
            <CardContent>
              {campaigns.length === 0 ? (
                <div className="py-8 text-center">
                  <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-slate-50">
                    <Megaphone className="size-5 text-slate-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-700">
                    {t("empty.campaigns")}
                  </p>
                  <LinkButton
                    href="/b/campaigns/new"
                    variant="default"
                    size="sm"
                    className="mt-4"
                  >
                    {t("action.newCampaign")}
                  </LinkButton>
                </div>
              ) : (
                <div className="space-y-4">
                  {campaigns.map((campaign) => (
                    <a
                      key={campaign.id}
                      href={`/b/campaigns/${campaign.id}`}
                      className="block rounded-lg border border-slate-200 p-4 transition-colors hover:bg-slate-50"
                    >
                      <div className="mb-3 flex items-start justify-between">
                        <div>
                          <h3 className="font-medium text-slate-900">
                            {campaign.title}
                          </h3>
                          <div className="mt-1 flex items-center gap-3 text-xs text-slate-500">
                            <span>
                              {formatCurrency(campaign.budget_max, locale)}{" "}
                              {t("label.budget")}
                            </span>
                          </div>
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${CAMPAIGN_STATUS_COLORS[campaign.status]}`}
                        >
                          {CAMPAIGN_STATUS_LABELS[campaign.status]}
                        </span>
                      </div>
                      {/* Creator progress */}
                      <div className="mb-2">
                        <div className="mb-1 flex justify-between text-xs text-slate-500">
                          <span>{t("label.creators")}</span>
                          <span>
                            {campaign.member_count}/{campaign.max_creators}
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-slate-100">
                          <div
                            className="h-1.5 rounded-full bg-slate-900 transition-all"
                            style={{
                              width: `${Math.min(100, (campaign.member_count / (campaign.max_creators || 1)) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
