"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  FileCheck,
  FolderOpen,
  Send,
  XCircle,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { PlatformIcon } from "@/components/platform-icons";
import { LinkButton } from "@/components/ui/link-button";
import { PLATFORM_LABELS, type Platform } from "@/lib/constants";
import { useI18n, useTranslation } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ActiveCampaign {
  id: string;
  title: string;
  brand_name: string;
  platforms: Platform[];
  status: string;
  accepted_rate: number | null;
  content_due_date: string | null;
}

interface Application {
  id: string;
  campaign_id: string;
  campaign_title: string;
  brand_name: string;
  platforms: Platform[];
  status: string;
  proposed_rate: number | null;
  counter_rate: number | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRate(rate: number | null, locale = "en"): string {
  if (!rate) return "—";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(rate);
}

function formatDate(dateStr: string, locale = "en"): string {
  return new Date(dateStr).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
  });
}

function brandInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const applicationIcons = {
  pending: { icon: Send, style: "bg-blue-50 text-blue-700" },
  counter_offer: { icon: Clock, style: "bg-amber-50 text-amber-700" },
  accepted: { icon: CheckCircle2, style: "bg-emerald-50 text-emerald-700" },
  rejected: { icon: XCircle, style: "bg-slate-50 text-slate-500" },
  withdrawn: { icon: XCircle, style: "bg-slate-50 text-slate-400" },
} as const;

const applicationLabelKeys: Record<string, string> = {
  pending: "status.applied",
  counter_offer: "status.counterOffer",
  accepted: "status.accepted",
  rejected: "status.notSelected",
  withdrawn: "status.withdrawn",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MyCampaignsPage() {
  const { t } = useTranslation("creator.campaigns");
  const { locale } = useI18n();
  const [activeCampaigns, setActiveCampaigns] = useState<ActiveCampaign[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch active campaigns (user is a member)
      const { data: memberData } = await supabase
        .from("campaign_members")
        .select(
          `accepted_rate,
           campaigns (
             id, title, platforms, status, content_due_date,
             profiles!campaigns_brand_id_fkey ( full_name )
           )`
        )
        .eq("creator_id", user.id);

      if (memberData) {
        const mapped = memberData
          .map((m: any) => ({
            id: m.campaigns.id,
            title: m.campaigns.title,
            brand_name: m.campaigns.profiles?.full_name || "Brand",
            platforms: m.campaigns.platforms || [],
            status: m.campaigns.status,
            accepted_rate: m.accepted_rate,
            content_due_date: m.campaigns.content_due_date,
          }))
          .filter(
            (c: ActiveCampaign) =>
              c.status !== "completed" && c.status !== "cancelled"
          );
        setActiveCampaigns(mapped);
      }

      // Fetch applications
      const { data: appData } = await supabase
        .from("campaign_applications")
        .select(
          `id, campaign_id, status, proposed_rate, counter_rate, created_at,
           campaigns (
             title, platforms,
             profiles!campaigns_brand_id_fkey ( full_name )
           )`
        )
        .eq("creator_id", user.id)
        .order("created_at", { ascending: false });

      if (appData) {
        const mapped = appData.map((a: any) => ({
          id: a.id,
          campaign_id: a.campaign_id,
          campaign_title: a.campaigns?.title || "Campaign",
          brand_name: a.campaigns?.profiles?.full_name || "Brand",
          platforms: a.campaigns?.platforms || [],
          status: a.status,
          proposed_rate: a.proposed_rate,
          counter_rate: a.counter_rate,
          created_at: a.created_at,
        }));
        setApplications(mapped);
      }

      setLoading(false);
    }
    load();
  }, []);

  const activeCount = activeCampaigns.length;
  const appCount = applications.length;

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 lg:p-6">
      <h1 className="text-xl font-semibold tracking-tight text-slate-900">
        {t("title")}
      </h1>

      {loading ? (
        <div className="space-y-4">
          {/* Tab bar skeleton */}
          <div className="flex gap-1">
            <div className="h-9 w-20 animate-pulse rounded-lg bg-slate-100" />
            <div className="h-9 w-28 animate-pulse rounded-lg bg-slate-50" />
          </div>
          {/* Campaign card skeletons */}
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-slate-200/60 bg-white p-4">
              <div className="flex items-start gap-3">
                <div className="size-10 animate-pulse rounded-xl bg-slate-100" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="h-4 w-36 animate-pulse rounded bg-slate-100" />
                    <div className="size-4 animate-pulse rounded bg-slate-50" />
                  </div>
                  <div className="h-3 w-20 animate-pulse rounded bg-slate-50" />
                  <div className="flex gap-2 pt-1">
                    <div className="h-5 w-16 animate-pulse rounded-full bg-slate-50" />
                    <div className="h-5 w-14 animate-pulse rounded-full bg-slate-50" />
                    <div className="h-3 w-10 animate-pulse rounded bg-slate-50" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Tabs defaultValue="active">
          <TabsList>
            <TabsTrigger value="active">
              {t("tab.active")}
              {activeCount > 0 && (
                <span className="ms-1.5 inline-flex size-4 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white">
                  {activeCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="applications">
              {t("tab.applications")}
              {appCount > 0 && (
                <span className="ms-1.5 inline-flex size-4 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600">
                  {appCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Active Campaigns */}
          <TabsContent value="active" className="mt-4 space-y-3">
            {activeCampaigns.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center">
                  <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-slate-50">
                    <FolderOpen className="size-5 text-slate-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-700">
                    {t("empty.active")}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {t("empty.activeDetail")}
                  </p>
                  <LinkButton
                    href="/i/discover"
                    variant="default"
                    size="sm"
                    className="mt-4"
                  >
                    {t("empty.activeCta")}
                  </LinkButton>
                </CardContent>
              </Card>
            ) : (
              activeCampaigns.map((c) => (
                <Link
                  key={c.id}
                  href={`/i/campaigns/${c.id}`}
                  className="block"
                >
                  <Card className="transition-shadow hover:shadow-md">
                    <CardContent>
                      <div className="flex items-start gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs font-bold text-slate-600">
                          {brandInitials(c.brand_name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <h3 className="truncate text-sm font-medium text-slate-900">
                              {c.title}
                            </h3>
                            <ArrowRight className="size-4 shrink-0 text-slate-300" />
                          </div>
                          <p className="text-xs text-slate-500">
                            {c.brand_name}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                            {c.platforms.slice(0, 3).map((p) => {
                              const Icon = PlatformIcon[p];
                              return (
                                <span
                                  key={p}
                                  className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-slate-900/[0.04]"
                                >
                                  <Icon className="size-3" />
                                  {PLATFORM_LABELS[p]}
                                </span>
                              );
                            })}
                            {c.accepted_rate && (
                              <>
                                <span className="text-slate-200">·</span>
                                <span className="font-medium tabular-nums text-slate-700">
                                  {formatRate(c.accepted_rate, locale)}
                                </span>
                              </>
                            )}
                            {c.content_due_date && (
                              <>
                                <span className="text-slate-200">·</span>
                                <span className="inline-flex items-center gap-1">
                                  <Clock className="size-3" />
                                  {t("due", { date: formatDate(c.content_due_date, locale) })}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))
            )}
          </TabsContent>

          {/* Applications */}
          <TabsContent value="applications" className="mt-4 space-y-3">
            {applications.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center">
                  <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-slate-50">
                    <Send className="size-5 text-slate-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-700">
                    {t("empty.applications")}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {t("empty.applicationsDetail")}
                  </p>
                  <LinkButton
                    href="/i/discover"
                    variant="default"
                    size="sm"
                    className="mt-4"
                  >
                    {t("empty.applicationsCta")}
                  </LinkButton>
                </CardContent>
              </Card>
            ) : (
              applications.map((a) => {
                const iconConfig =
                  applicationIcons[
                    a.status as keyof typeof applicationIcons
                  ] || applicationIcons.pending;
                const Icon = iconConfig.icon;
                const labelKey = applicationLabelKeys[a.status] || "status.applied";
                return (
                  <Card key={a.id}>
                    <CardContent>
                      <div className="flex items-start gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs font-bold text-slate-600">
                          {brandInitials(a.brand_name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="truncate text-sm font-medium text-slate-900">
                              {a.campaign_title}
                            </h3>
                            <span
                              className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${iconConfig.style}`}
                            >
                              <Icon className="size-3" />
                              {t(labelKey)}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500">
                            {a.brand_name}
                          </p>
                          <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
                            {a.platforms.slice(0, 2).map((p) => {
                              const PIcon = PlatformIcon[p];
                              return (
                                <span
                                  key={p}
                                  className="inline-flex items-center gap-1"
                                >
                                  <PIcon className="size-3" />
                                  {PLATFORM_LABELS[p]}
                                </span>
                              );
                            })}
                            <span className="tabular-nums">
                              {formatDate(a.created_at, locale)}
                            </span>
                            <span className="font-medium tabular-nums text-slate-600">
                              {formatRate(a.proposed_rate, locale)}
                            </span>
                          </div>

                          {/* Counter offer banner */}
                          {a.status === "counter_offer" &&
                            a.counter_rate && (
                              <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 ring-1 ring-amber-500/10">
                                {t("counterOffer.detail", {
                                  offer: formatRate(a.counter_rate, locale),
                                  asked: formatRate(a.proposed_rate, locale),
                                })}
                              </div>
                            )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
