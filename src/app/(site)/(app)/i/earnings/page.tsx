"use client";

import { useState, useEffect } from "react";
import { Clock, DollarSign, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlatformIcon } from "@/components/platform-icons";
import { LinkButton } from "@/components/ui/link-button";
import { formatCurrency, type Platform } from "@/lib/constants";
import { useI18n, useTranslation } from "@/lib/i18n";
import { createClient, getBrowserUser } from "@/lib/supabase/client";
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

interface PaymentStatusMeta {
  labelKey: string;
  className: string;
  group: "paid" | "open" | "attention";
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

const paymentStatusMeta: Record<string, PaymentStatusMeta> = {
  pending: {
    labelKey: "status.pending",
    className: "bg-amber-50 text-amber-700 ring-amber-200/70",
    group: "open",
  },
  invoiced: {
    labelKey: "status.invoiced",
    className: "bg-sky-50 text-sky-700 ring-sky-200/70",
    group: "open",
  },
  paid: {
    labelKey: "status.paid",
    className: "bg-emerald-50 text-emerald-700 ring-emerald-200/70",
    group: "paid",
  },
  overdue: {
    labelKey: "status.overdue",
    className: "bg-rose-50 text-rose-700 ring-rose-200/70",
    group: "attention",
  },
  failed: {
    labelKey: "status.failed",
    className: "bg-slate-100 text-slate-700 ring-slate-200",
    group: "attention",
  },
  refunded: {
    labelKey: "status.refunded",
    className: "bg-slate-100 text-slate-700 ring-slate-200",
    group: "attention",
  },
  disputed: {
    labelKey: "status.disputed",
    className: "bg-rose-50 text-rose-700 ring-rose-200/70",
    group: "attention",
  },
};

function getPaymentStatusMeta(status: string): PaymentStatusMeta {
  return paymentStatusMeta[status] ?? paymentStatusMeta.pending;
}

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
      } = await getBrowserUser();
      if (!user) return;

      const { data } = await supabase
        .from("campaign_members")
        .select(
          `accepted_rate, payment_status, joined_at,
           campaigns (
             id, title, platforms,
             profiles!campaigns_brand_id_fkey ( full_name )
           )`,
        )
        .eq("creator_id", user.id)
        .order("joined_at", { ascending: false });

      if (data) {
        const mapped: EarningEntry[] = (data as EarningRecord[]).map(
          (membership) => {
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
          },
        );
        setEarnings(mapped);
      }
      setLoading(false);
    }
    load();
  }, []);

  const paidTotal = earnings
    .filter((e) => e.payment_status === "paid")
    .reduce((sum, e) => sum + e.accepted_rate, 0);
  const openTotal = earnings
    .filter((e) => getPaymentStatusMeta(e.payment_status).group !== "paid")
    .reduce((sum, e) => sum + e.accepted_rate, 0);
  const trackedTotal = paidTotal + openTotal;

  const stats = [
    {
      label: t("paidTotal"),
      value: formatCurrency(paidTotal, locale),
      icon: DollarSign,
      sublabel: t("campaigns", {
        count: String(
          earnings.filter((e) => e.payment_status === "paid").length,
        ),
      }),
    },
    {
      label: t("openTotal"),
      value: formatCurrency(openTotal, locale),
      icon: Clock,
      sublabel: t("campaigns", {
        count: String(
          earnings.filter(
            (e) => getPaymentStatusMeta(e.payment_status).group !== "paid",
          ).length,
        ),
      }),
    },
    {
      label: t("trackedTotal"),
      value: formatCurrency(trackedTotal, locale),
      icon: Wallet,
      sublabel: t("total.label", { count: String(earnings.length) }),
    },
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4 lg:p-6">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {t("title")}
        </h1>
        <p className="max-w-xl text-sm text-muted-foreground">
          {t("trackingOnly")}
        </p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {/* Summary KPI skeletons */}
          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
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
              <div
                key={i}
                className="flex items-center gap-4 border-t border-border/30 px-5 py-3"
              >
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
          <div className="grid grid-cols-3 gap-3">
            {stats.map((s) => (
              <Card key={s.label}>
                <CardContent className="py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex size-9 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground">
                      <s.icon className="size-4" />
                    </div>
                    <div>
                      <p className="text-[11px] text-muted-foreground/70">
                        {s.label}
                      </p>
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
                <CardTitle className="text-sm">{t("campaignLedger")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  data-testid="creator-earnings-ledger"
                  className="space-y-1"
                >
                  <div className="hidden grid-cols-[minmax(0,1fr)_7rem_7rem] gap-3 px-2 pb-2 text-[11px] font-medium text-muted-foreground sm:grid">
                    <span>{t("campaign")}</span>
                    <span>{t("status")}</span>
                    <span className="text-end">{t("amount")}</span>
                  </div>
                  {earnings.map((e, i) => {
                    const status = getPaymentStatusMeta(e.payment_status);
                    return (
                      <div
                        key={`${e.campaign_id}-${i}`}
                        data-testid="creator-earnings-row"
                        className="grid gap-3 rounded-lg border border-border/50 p-3 sm:grid-cols-[minmax(0,1fr)_7rem_7rem] sm:items-center sm:border-0 sm:px-2 sm:py-3"
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
                              {t("accepted")} {formatDate(e.joined_at, locale)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-3 sm:block">
                          <span className="text-xs text-muted-foreground sm:hidden">
                            {t("status")}
                          </span>
                          <span
                            data-testid="creator-earnings-status"
                            className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ${status.className}`}
                          >
                            {t(status.labelKey)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3 sm:block sm:text-end">
                          <span className="text-xs text-muted-foreground sm:hidden">
                            {t("amount")}
                          </span>
                          <p className="text-sm font-semibold tabular-nums text-foreground">
                            <span data-testid="creator-earnings-amount">
                              {formatCurrency(e.accepted_rate, locale)}
                            </span>
                          </p>
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
