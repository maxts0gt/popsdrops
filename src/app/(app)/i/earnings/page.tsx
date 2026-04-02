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
import { PLATFORM_LABELS, formatCurrency, type Platform } from "@/lib/constants";
import { useI18n, useTranslation } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";

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
  pending: "bg-amber-50 text-amber-700",
  invoiced: "bg-blue-50 text-blue-700",
  paid: "bg-emerald-50 text-emerald-700",
  overdue: "bg-red-50 text-red-700",
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
        const mapped: EarningEntry[] = data.map((m: any) => ({
          campaign_id: m.campaigns?.id || "",
          campaign_title: m.campaigns?.title || "Campaign",
          brand_name: m.campaigns?.profiles?.full_name || "Brand",
          platforms: m.campaigns?.platforms || [],
          accepted_rate: m.accepted_rate || 0,
          payment_status: m.payment_status || "pending",
          joined_at: m.joined_at,
        }));
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
      <h1 className="text-xl font-semibold tracking-tight text-slate-900">
        {t("title")}
      </h1>

      {loading ? (
        <div className="space-y-3">
          {/* Summary KPI skeletons */}
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="rounded-xl border border-slate-200/60 bg-white p-4"
              >
                <div className="flex items-center gap-2.5">
                  <div className="size-9 animate-pulse rounded-lg bg-slate-50" />
                  <div className="flex-1 space-y-2">
                    <div className="h-5 w-14 animate-pulse rounded bg-slate-100" />
                    <div className="h-3 w-20 animate-pulse rounded bg-slate-50" />
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/* Earnings table skeleton */}
          <div className="rounded-xl border border-slate-200/60 bg-white">
            <div className="flex items-center justify-between px-5 py-4">
              <div className="h-4 w-28 animate-pulse rounded bg-slate-100" />
            </div>
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-4 border-t border-slate-50 px-5 py-3">
                <div className="size-8 animate-pulse rounded-lg bg-slate-50" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3.5 w-32 animate-pulse rounded bg-slate-100" />
                  <div className="h-3 w-20 animate-pulse rounded bg-slate-50" />
                </div>
                <div className="h-3 w-14 animate-pulse rounded bg-slate-50" />
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
                    <div className="flex size-9 items-center justify-center rounded-lg bg-slate-50 text-slate-500">
                      <s.icon className="size-4" />
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-400">{s.label}</p>
                      <p className="text-lg font-semibold tabular-nums text-slate-900">
                        {s.value}
                      </p>
                    </div>
                  </div>
                  <p className="mt-1.5 text-[11px] text-slate-400">
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
                <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-slate-50">
                  <DollarSign className="size-5 text-slate-400" />
                </div>
                <p className="text-sm font-medium text-slate-700">
                  {t("empty")}
                </p>
                <p className="mt-1 text-xs text-slate-400">
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
                          <p className="truncate text-sm font-medium text-slate-900">
                            {e.campaign_title}
                          </p>
                          <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-400">
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
                          <p className="text-sm font-semibold tabular-nums text-slate-900">
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
