"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import {
  Plus,
  Users,
  Eye,
  FileText,
  Megaphone,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LinkButton } from "@/components/ui/link-button";
import { PlatformIcon } from "@/components/platform-icons";
import {
  CAMPAIGN_STATUS_COLORS,
  CAMPAIGN_STATUS_LABELS,
  PLATFORM_LABELS,
} from "@/lib/constants";
import { useI18n, useTranslation } from "@/lib/i18n";
import type { CampaignStatus, Platform } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Campaign {
  id: string;
  title: string;
  status: CampaignStatus;
  platforms: Platform[];
  markets: string[];
  max_creators: number;
  budget_max: number | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(amount: number | null, locale = "en"): string {
  if (!amount) return "—";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string, locale = "en"): string {
  return new Date(dateStr).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CampaignCard({
  campaign,
  t,
  locale,
}: {
  campaign: Campaign;
  t: (key: string, vars?: Record<string, string>) => string;
  locale: string;
}) {
  return (
    <Link href={`/b/campaigns/${campaign.id}`} className="block">
      <Card className="transition-shadow hover:shadow-md">
        <CardContent className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-medium text-foreground">{campaign.title}</h3>
            <span
              className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${CAMPAIGN_STATUS_COLORS[campaign.status]}`}
            >
              {CAMPAIGN_STATUS_LABELS[campaign.status]}
            </span>
          </div>

          {/* Platforms */}
          <div className="flex flex-wrap gap-1.5">
            {campaign.platforms.map((p) => {
              const Icon = PlatformIcon[p];
              return (
                <span
                  key={p}
                  className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                >
                  <Icon className="size-3" />
                  {PLATFORM_LABELS[p]}
                </span>
              );
            })}
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-4 border-t border-border/50 pt-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Users className="size-3.5" />
              {campaign.max_creators} {t("label.maxCreators")}
            </span>
            <span className="tabular-nums">{formatDate(campaign.created_at, locale)}</span>
            <span className="ms-auto font-medium tabular-nums text-foreground">
              {formatCurrency(campaign.budget_max, locale)}
            </span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function CampaignList({
  items,
  t,
  locale,
}: {
  items: Campaign[];
  t: (key: string, vars?: Record<string, string>) => string;
  locale: string;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border py-12 text-center">
        <Megaphone className="mx-auto mb-3 size-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">{t("empty.noCampaigns")}</p>
        <LinkButton
          href="/b/campaigns/new"
          variant="outline"
          size="sm"
          className="mt-3"
        >
          <Plus className="size-3.5" /> {t("action.create")}
        </LinkButton>
      </div>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {items.map((c) => (
        <CampaignCard key={c.id} campaign={c} t={t} locale={locale} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BrandCampaignsPage() {
  const { t } = useTranslation("brand.campaigns");
  const { locale } = useI18n();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("campaigns")
        .select("id, title, status, platforms, markets, max_creators, budget_max, created_at")
        .eq("brand_id", user.id)
        .order("created_at", { ascending: false });

      if (data) {
        setCampaigns(
          data.map((c) => ({
            ...c,
            platforms: c.platforms || [],
            markets: c.markets || [],
          }))
        );
      }
      setLoading(false);
    }
    load();
  }, []);

  const byStatus = (status: CampaignStatus) =>
    campaigns.filter((c) => c.status === status);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("count", { count: String(campaigns.length) })}
          </p>
        </div>
        <LinkButton href="/b/campaigns/new" size="lg" className="shrink-0">
          <Plus className="size-4" />
          {t("action.create")}
        </LinkButton>
      </div>

      {loading ? (
        <div className="space-y-4">
          {/* Tab bar skeleton */}
          <div className="flex gap-1">
            {["w-12", "w-14", "w-16", "w-20", "w-14"].map((w, i) => (
              <div key={i} className={`h-9 ${w} animate-pulse rounded-lg ${i === 0 ? "bg-muted" : "bg-muted/50"}`} />
            ))}
          </div>
          {/* Campaign card grid skeleton */}
          <div className="grid gap-4 sm:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="rounded-xl border border-border/60 bg-card p-5"
              >
                <div className="flex items-start justify-between">
                  <div className="space-y-2">
                    <div className="h-4 w-36 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-20 animate-pulse rounded bg-muted/50" />
                  </div>
                  <div className="h-5 w-16 animate-pulse rounded-full bg-muted/50" />
                </div>
                <div className="mt-4 flex gap-2">
                  <div className="h-5 w-16 animate-pulse rounded-full bg-muted/50" />
                  <div className="h-5 w-14 animate-pulse rounded-full bg-muted/50" />
                </div>
                <div className="mt-3 flex gap-4">
                  <div className="h-3 w-12 animate-pulse rounded bg-muted/50" />
                  <div className="h-3 w-10 animate-pulse rounded bg-muted/50" />
                  <div className="h-3 w-14 animate-pulse rounded bg-muted/50" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <Tabs defaultValue="all">
          <TabsList variant="line" className="mb-6 overflow-x-auto">
            <TabsTrigger value="all">
              {t("tab.all")} ({campaigns.length})
            </TabsTrigger>
            <TabsTrigger value="draft">
              {t("tab.draft")} ({byStatus("draft").length})
            </TabsTrigger>
            <TabsTrigger value="recruiting">
              {t("tab.recruiting")} ({byStatus("recruiting").length})
            </TabsTrigger>
            <TabsTrigger value="active">
              {t("tab.active")} (
              {byStatus("in_progress").length +
                byStatus("publishing").length +
                byStatus("monitoring").length}
              )
            </TabsTrigger>
            <TabsTrigger value="completed">
              {t("tab.completed")} ({byStatus("completed").length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <CampaignList items={campaigns} t={t} locale={locale} />
          </TabsContent>
          <TabsContent value="draft">
            <CampaignList items={byStatus("draft")} t={t} locale={locale} />
          </TabsContent>
          <TabsContent value="recruiting">
            <CampaignList items={byStatus("recruiting")} t={t} locale={locale} />
          </TabsContent>
          <TabsContent value="active">
            <CampaignList
              items={campaigns.filter((c) =>
                ["in_progress", "publishing", "monitoring"].includes(c.status)
              )}
              t={t}
              locale={locale}
            />
          </TabsContent>
          <TabsContent value="completed">
            <CampaignList items={byStatus("completed")} t={t} locale={locale} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
