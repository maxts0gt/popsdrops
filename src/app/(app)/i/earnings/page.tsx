"use client";

import { useState, useEffect } from "react";
import {
  Clock,
  DollarSign,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlatformIcon } from "@/components/platform-icons";
import { LinkButton } from "@/components/ui/link-button";
import { formatCurrency, type Platform } from "@/lib/constants";
import { useI18n, useTranslation } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { getSingleRelation } from "@/lib/supabase/relations";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EarningEntry {
  campaign_id: string;
  campaign_title: string;
  brand_name: string;
  platforms: Platform[];
  accepted_rate: number;
  payment_status: string;
  joined_at: string;
}

interface EarningRecord {
  accepted_rate: number | null;
  payment_status: string | null;
  joined_at: string;
  campaigns:
    | {
        id: string;
        title: string | null;
        platforms: Platform[] | null;
        profiles:
          | { full_name: string | null }
          | { full_name: string | null }[]
          | null;
      }
    | {
        id: string;
        title: string | null;
        platforms: Platform[] | null;
        profiles:
          | { full_name: string | null }
          | { full_name: string | null }[]
          | null;
      }[]
    | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateStr: string, locale = "en"): string {
  return new Date(dateStr).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const statusStyles: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400",
  invoiced: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  paid: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  overdue: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400",
};

const statusLabelKeys: Record<string, string> = {
  pending: "status.pending",
  invoiced: "status.invoiced",
  paid: "status.paid",
  overdue: "status.overdue",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function EarningsPage() {
  const { locale } = useI18n();
  const { t } = useTranslation("creator.earnings");
  const [earnings, setEarnings] = useState<EarningEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("campaign_members")
        .select(
          `accepted_rate, payment_status, joined_at,
           campaigns (
             id, title, platforms,
             profiles!campaigns_brand_id_fkey ( full_name )
           )`
        )
        .eq("creator_id", user.id)
        .order("joined_at", { ascending: false });

      if (data) {
        const mapped: EarningEntry[] = (data as EarningRecord[]).map((membership) => {
          const campaign = getSingleRelation(membership.campaigns);
          const brand = getSingleRelation(campaign?.profiles);

          return {
            campaign_id: campaign?.id || "",
            campaign_title: campaign?.title || "Campaign",
            brand_name: brand?.full_name || "Brand",
            platforms: campaign?.platforms || [],
            accepted_rate: membership.accepted_rate || 0,
            payment_status: membership.payment_status || "pending",
            joined_at: membership.joined_at,
          };
        });
        setEarnings(mapped);
      }
      setLoading(false);
    }
    load();
  }, []);

  // Compute summary stats
  const totalEarned = earnings
    .filter((e) => e.payment_status === "paid")
    .reduce((sum, e) => sum + e.accepted_rate, 0);
  const pending = earnings
    .filter((e) => e.payment_status !== "paid")
    .reduce((sum, e) => sum + e.accepted_rate, 0);
  const avgDeal =
    earnings.length > 0
      ? Math.round(
          earnings.reduce((sum, e) => sum + e.accepted_rate, 0) /
            earnings.length
        )
      : 0;

  const stats = [
    {
      label: t("total"),
      value: formatCurrency(totalEarned, locale),
      icon: DollarSign,
      sublabel: t("campaigns", { count: String(earnings.filter((e) => e.payment_status === "paid").length) }),
    },
    {
      label: t("pending"),
      value: formatCurrency(pending, locale),
      icon: Clock,
      sublabel: t("campaigns", { count: String(earnings.filter((e) => e.payment_status !== "paid").length) }),
    },
    {
      label: t("avgDeal"),
      value: avgDeal > 0 ? formatCurrency(avgDeal, locale) : "—",
      icon: TrendingUp,
      sublabel: t("total.label", { count: String(earnings.length) }),
    },
    {
      label: t("lifetime"),
      value: formatCurrency(totalEarned + pending, locale),
      icon: Wallet,
      sublabel: t("allTime"),
    },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 lg:p-6">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">
        {t("title")}
      </h1>

      {loading ? (
        <div className="space-y-3">
          {/* Summary KPI skeletons */}
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="rounded-xl border border-border/60 bg-card p-4"
              >
                <div className="flex items-center gap-2.5">
                  <div className="size-9 animate-pulse rounded-lg bg-muted/50" />
                  <div className="flex-1 space-y-2">
                    <div className="h-5 w-14 animate-pulse rounded bg-muted" />
                    <div className="h-3 w-20 animate-pulse rounded bg-muted/50" />
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/* Earnings table skeleton */}
          <div className="rounded-xl border border-border/60 bg-card">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="h-4 w-28 animate-pulse rounded bg-muted" />
            </div>
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 border-t border-border/30 px-5 py-3">
                <div className="size-8 animate-pulse rounded-lg bg-muted/50" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-32 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-20 animate-pulse rounded bg-muted/50" />
                </div>
                <div className="h-3 w-14 animate-pulse rounded bg-muted/50" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3">
            {stats.map((s) => (
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
                  <p className="mt-1.5 text-[11px] text-muted-foreground/70">
                    {s.sublabel}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Earnings list */}
          {earnings.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center">
                <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-muted/50">
                  <DollarSign className="size-5 text-muted-foreground/70" />
                </div>
                <p className="text-sm font-medium text-foreground">
                  {t("empty")}
                </p>
                <p className="mt-1 text-xs text-muted-foreground/70">
                  {t("empty.detail")}
                </p>
                <LinkButton
                  href="/i/discover"
                  variant="default"
                  size="sm"
                  className="mt-4"
                >
                  {t("empty.cta")}
                </LinkButton>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">{t("campaignEarnings")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {earnings.map((e, i) => {
                    const style =
                      statusStyles[e.payment_status] || statusStyles.pending;
                    const labelKey =
                      statusLabelKeys[e.payment_status] || "status.pending";
                    return (
                      <div
                        key={`${e.campaign_id}-${i}`}
                        className="flex items-center gap-3 rounded-lg p-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-foreground">
                            {e.campaign_title}
                          </p>
                          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground/70">
                            <span>{e.brand_name}</span>
                            {e.platforms.slice(0, 2).map((p) => {
                              const Icon = PlatformIcon[p];
                              return (
                                <span
                                  key={p}
                                  className="inline-flex items-center gap-0.5"
                                >
                                  <Icon className="size-3" />
                                </span>
                              );
                            })}
                            <span className="tabular-nums">
                              {formatDate(e.joined_at, locale)}
                            </span>
                          </div>
                        </div>
                        <div className="text-end">
                          <p className="text-sm font-semibold tabular-nums text-foreground">
                            {formatCurrency(e.accepted_rate, locale)}
                          </p>
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${style}`}
                          >
                            {t(labelKey)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
