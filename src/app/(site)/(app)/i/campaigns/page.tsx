"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  FolderOpen,
  Send,
  XCircle,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlatformIcon } from "@/components/platform-icons";
import { LinkButton } from "@/components/ui/link-button";
import { respondToCounterOffer } from "@/app/actions";
import { PLATFORM_LABELS, type Platform } from "@/lib/constants";
import {
  getCreatorRoomNextAction,
  type CreatorRoomNextAction,
} from "@/lib/campaigns/creator-room-next-action";
import { useI18n, useTranslation } from "@/lib/i18n";
import { createClient, getBrowserUser } from "@/lib/supabase/client";
import { getSingleRelation } from "@/lib/supabase/relations";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ActiveCampaign {
  id: string;
  member_id: string;
  title: string;
  brand_name: string;
  platforms: Platform[];
  status: string;
  accepted_rate: number | null;
  content_due_date: string | null;
  nextAction: CreatorCampaignListNextAction;
}

type CreatorCampaignListNextAction = CreatorRoomNextAction;

interface CompletedCampaign {
  id: string;
  title: string;
  brand_name: string;
  platforms: Platform[];
  status: string;
  accepted_rate: number | null;
  completed_at: string | null;
  total_views: number | null;
  total_engagements: number | null;
  has_reviewed: boolean;
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

interface CampaignMembershipRecord {
  id: string;
  accepted_rate: number | null;
  campaigns:
    | {
        id: string;
        title: string;
        platforms: Platform[] | null;
        status: string;
        content_due_date: string | null;
        completed_at: string | null;
        profiles:
          | { full_name: string | null }
          | { full_name: string | null }[]
          | null;
      }
    | {
        id: string;
        title: string;
        platforms: Platform[] | null;
        status: string;
        content_due_date: string | null;
        completed_at: string | null;
        profiles:
          | { full_name: string | null }
          | { full_name: string | null }[]
          | null;
      }[]
    | null;
}

interface CreatorCampaignListSubmissionRecord {
  id: string;
  campaign_member_id: string;
  parent_submission_id: string | null;
  status: string;
  published_url: string | null;
}

interface CreatorCampaignListReportTaskRecord {
  campaign_member_id: string;
  status: string;
  due_at: string | null;
}

interface ApplicationRecord {
  id: string;
  campaign_id: string;
  status: string;
  proposed_rate: number | null;
  counter_rate: number | null;
  created_at: string;
  campaigns:
    | {
        title: string | null;
        platforms: Platform[] | null;
        profiles:
          | { full_name: string | null }
          | { full_name: string | null }[]
          | null;
      }
    | {
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

function formatRate(rate: number | null, locale = "en"): string {
  if (!rate) return "-";
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
  pending: { icon: Send, style: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400" },
  counter_offer: { icon: Clock, style: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400" },
  accepted: { icon: CheckCircle2, style: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400" },
  rejected: { icon: XCircle, style: "bg-muted/50 text-muted-foreground" },
  withdrawn: { icon: XCircle, style: "bg-muted/50 text-muted-foreground/70" },
} as const;

const applicationLabelKeys: Record<string, string> = {
  pending: "status.applied",
  counter_offer: "status.counterOffer",
  accepted: "status.accepted",
  rejected: "status.notSelected",
  withdrawn: "status.withdrawn",
};

const applicationNextActionByStatus: Record<
  string,
  { titleKey: string; actionKey: string; href: string | null }
> = {
  pending: {
    titleKey: "applicationNext.pending",
    actionKey: "applicationAction.wait",
    href: null,
  },
  counter_offer: {
    titleKey: "applicationNext.counterOffer",
    actionKey: "applicationAction.decide",
    href: null,
  },
  accepted: {
    titleKey: "applicationNext.accepted",
    actionKey: "applicationAction.open",
    href: "campaign",
  },
  rejected: {
    titleKey: "applicationNext.rejected",
    actionKey: "applicationAction.browse",
    href: "/i/discover",
  },
  withdrawn: {
    titleKey: "applicationNext.withdrawn",
    actionKey: "applicationAction.browse",
    href: "/i/discover",
  },
};

function getDefaultCreatorCampaignListNextAction(): CreatorCampaignListNextAction {
  return getCreatorRoomNextAction({
    submissions: [],
    reportTasks: [],
  });
}

function getCreatorApplicationNextAction(application: Application) {
  const nextAction =
    applicationNextActionByStatus[application.status] ??
    applicationNextActionByStatus.pending;

  return {
    ...nextAction,
    href:
      nextAction.href === "campaign"
        ? `/i/campaigns/${application.campaign_id}`
        : nextAction.href,
  };
}

function getCreatorCompletedCampaignNextAction(campaign: CompletedCampaign) {
  if (campaign.status !== "completed") {
    return {
      titleKey: "completedNext.closed",
      actionKey: "completedAction.view",
    };
  }

  if (!campaign.has_reviewed) {
    return {
      titleKey: "completedNext.review",
      actionKey: "completedAction.review",
    };
  }

  return {
    titleKey: "completedNext.complete",
    actionKey: "completedAction.view",
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MyCampaignsPage() {
  const { t } = useTranslation("creator.campaigns");
  const { t: tRoom } = useTranslation("creator.campaign");
  const { t: tc } = useTranslation("ui.common");
  const { locale } = useI18n();
  const [activeCampaigns, setActiveCampaigns] = useState<ActiveCampaign[]>([]);
  const [completedCampaigns, setCompletedCampaigns] = useState<CompletedCampaign[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [counterActionKey, setCounterActionKey] = useState<string | null>(null);
  const [counterResponseError, setCounterResponseError] = useState<string | null>(null);

  const loadCreatorCampaigns = useCallback(async (
    isMounted: () => boolean = () => true,
  ) => {
    const supabase = createClient();
    const {
      data: { user },
    } = await getBrowserUser();
    if (!isMounted()) return;
    if (!user) {
      setLoading(false);
      return;
    }

    setActiveCampaigns([]);
    setCompletedCampaigns([]);
    setApplications([]);

    // Fetch campaigns (user is a member)
    const { data: memberData } = await supabase
      .from("campaign_members")
      .select(
        `id, accepted_rate,
           campaigns (
             id, title, platforms, status, content_due_date, completed_at,
             profiles!campaigns_brand_id_fkey ( full_name )
           )`
      )
      .eq("creator_id", user.id);

    if (!isMounted()) return;

    if (memberData) {
      const records = memberData as CampaignMembershipRecord[];
      const active: ActiveCampaign[] = [];
      const completed: CompletedCampaign[] = [];
      const defaultNextAction = getDefaultCreatorCampaignListNextAction();

      for (const membership of records) {
        const campaign = getSingleRelation(membership.campaigns);
        const brand = getSingleRelation(campaign?.profiles);
        if (!campaign) continue;

        if (campaign.status === "completed" || campaign.status === "cancelled") {
          completed.push({
            id: campaign.id,
            title: campaign.title,
            brand_name: brand?.full_name || "Brand",
            platforms: campaign.platforms || [],
            status: campaign.status,
            accepted_rate: membership.accepted_rate,
            completed_at: campaign.completed_at,
            total_views: null,
            total_engagements: null,
            has_reviewed: false,
          });
        } else {
          active.push({
            id: campaign.id,
            member_id: membership.id,
            title: campaign.title,
            brand_name: brand?.full_name || "Brand",
            platforms: campaign.platforms || [],
            status: campaign.status,
            accepted_rate: membership.accepted_rate,
            content_due_date: campaign.content_due_date,
            nextAction: defaultNextAction,
          });
        }
      }

      const activeMemberIds = active.map((campaign) => campaign.member_id);
      if (activeMemberIds.length > 0) {
        const [{ data: submissionData }, { data: reportTaskData }] =
          await Promise.all([
            supabase
              .from("content_submissions")
              .select(
                "id, campaign_member_id, parent_submission_id, status, published_url",
              )
              .in("campaign_member_id", activeMemberIds),
            supabase
              .from("campaign_report_tasks")
              .select("campaign_member_id, status, due_at")
              .in("campaign_member_id", activeMemberIds),
          ]);
        const submissionsByMemberId = new Map<
          string,
          CreatorCampaignListSubmissionRecord[]
        >();
        const reportTasksByMemberId = new Map<
          string,
          CreatorCampaignListReportTaskRecord[]
        >();

        for (const submission of
          (submissionData ?? []) as CreatorCampaignListSubmissionRecord[]) {
          const rows = submissionsByMemberId.get(submission.campaign_member_id) ?? [];
          rows.push(submission);
          submissionsByMemberId.set(submission.campaign_member_id, rows);
        }

        for (const task of
          (reportTaskData ?? []) as CreatorCampaignListReportTaskRecord[]) {
          const rows = reportTasksByMemberId.get(task.campaign_member_id) ?? [];
          rows.push(task);
          reportTasksByMemberId.set(task.campaign_member_id, rows);
        }

        for (const campaign of active) {
          const submissions = submissionsByMemberId.get(campaign.member_id) ?? [];
          const reportTasks = reportTasksByMemberId.get(campaign.member_id) ?? [];
          campaign.nextAction = getCreatorRoomNextAction({
            submissions: submissions.map((submission) => ({
              id: submission.id,
              parentSubmissionId: submission.parent_submission_id,
              status: submission.status,
              publishedUrl: submission.published_url,
            })),
            reportTasks: reportTasks.map((task) => ({
              status: task.status,
              dueAt: task.due_at,
            })),
          });
        }
      }

      setActiveCampaigns(active);
      setCompletedCampaigns(completed);
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

    if (!isMounted()) return;

    if (appData) {
      const mapped = (appData as ApplicationRecord[]).map((application) => {
        const campaign = getSingleRelation(application.campaigns);
        const brand = getSingleRelation(campaign?.profiles);

        return {
          id: application.id,
          campaign_id: application.campaign_id,
          campaign_title: campaign?.title || "Campaign",
          brand_name: brand?.full_name || "Brand",
          platforms: campaign?.platforms || [],
          status: application.status,
          proposed_rate: application.proposed_rate,
          counter_rate: application.counter_rate,
          created_at: application.created_at,
        };
      });
      setApplications(mapped);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    let isMounted = true;
    void loadCreatorCampaigns(() => isMounted);
    return () => {
      isMounted = false;
    };
  }, [loadCreatorCampaigns]);

  async function handleCounterResponse(applicationId: string, accept: boolean) {
    const actionKey = `${applicationId}:${accept ? "accept" : "decline"}`;
    setCounterActionKey(actionKey);
    setCounterResponseError(null);

    try {
      await respondToCounterOffer(applicationId, accept);
      await loadCreatorCampaigns();
    } catch {
      setCounterResponseError(tc("error.generic"));
    } finally {
      setCounterActionKey(null);
    }
  }

  const activeCount = activeCampaigns.length;
  const completedCount = completedCampaigns.length;
  const appCount = applications.length;

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 lg:p-6">
      <h1 className="text-xl font-semibold tracking-tight text-foreground">
        {t("title")}
      </h1>

      {loading ? (
        <div className="space-y-4">
          {/* Tab bar skeleton */}
          <div className="flex gap-1">
            <div className="h-9 w-20 animate-pulse rounded-lg bg-muted" />
            <div className="h-9 w-28 animate-pulse rounded-lg bg-muted/50" />
          </div>
          {/* Campaign card skeletons */}
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border border-border/60 bg-card p-4">
              <div className="flex items-start gap-3">
                <div className="size-10 animate-pulse rounded-xl bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="h-4 w-36 animate-pulse rounded bg-muted" />
                    <div className="size-4 animate-pulse rounded bg-muted/50" />
                  </div>
                  <div className="h-3 w-20 animate-pulse rounded bg-muted/50" />
                  <div className="flex gap-2 pt-1">
                    <div className="h-5 w-16 animate-pulse rounded-full bg-muted/50" />
                    <div className="h-5 w-14 animate-pulse rounded-full bg-muted/50" />
                    <div className="h-3 w-10 animate-pulse rounded bg-muted/50" />
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
                <span className="ms-1.5 inline-flex size-4 items-center justify-center rounded-full bg-foreground text-[10px] font-bold text-background">
                  {activeCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="applications">
              {t("tab.applications")}
              {appCount > 0 && (
                <span className="ms-1.5 inline-flex size-4 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                  {appCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="completed">
              {t("tab.completed")}
              {completedCount > 0 && (
                <span className="ms-1.5 inline-flex size-4 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
                  {completedCount}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Active Campaigns */}
          <TabsContent value="active" className="mt-4 space-y-3">
            {activeCampaigns.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center">
                  <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-muted/50">
                    <FolderOpen className="size-5 text-muted-foreground/70" />
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    {t("empty.active")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground/70">
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
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-xs font-bold text-muted-foreground">
                          {brandInitials(c.brand_name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <h3 className="truncate text-sm font-medium text-foreground">
                              {c.title}
                            </h3>
                            <ArrowRight className="size-4 shrink-0 text-muted-foreground/50" />
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {c.brand_name}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground/70">
                            {c.platforms.slice(0, 3).map((p) => {
                              const Icon = PlatformIcon[p];
                              return (
                                <span
                                  key={p}
                                  className="inline-flex items-center gap-1 rounded-full bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-border/50"
                                >
                                  <Icon className="size-3" />
                                  {PLATFORM_LABELS[p]}
                                </span>
                              );
                            })}
                            {c.accepted_rate && (
                              <>
                                <span className="text-muted-foreground/30">·</span>
                                <span className="font-medium tabular-nums text-foreground">
                                  {formatRate(c.accepted_rate, locale)}
                                </span>
                              </>
                            )}
                            {c.content_due_date && (
                              <>
                                <span className="text-muted-foreground/30">·</span>
                                <span className="inline-flex items-center gap-1">
                                  <Clock className="size-3" />
                                  {t("due", { date: formatDate(c.content_due_date, locale) })}
                                </span>
                              </>
                            )}
                          </div>
                          <div
                            className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-slate-50 px-3 py-2"
                            data-testid="creator-campaign-card-next-action"
                          >
                            <div className="min-w-0">
                              <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                                {tRoom("next.label")}
                              </p>
                              <p className="truncate text-xs font-semibold text-foreground">
                                {tRoom(`next.${c.nextAction.key}.title`)}
                              </p>
                              {c.nextAction.dueAt && (
                                <p className="text-[11px] text-muted-foreground">
                                  {tRoom("next.due", {
                                    date: formatDate(c.nextAction.dueAt, locale),
                                  })}
                                </p>
                              )}
                            </div>
                            <span className="shrink-0 rounded-md bg-white px-2.5 py-1 text-[11px] font-semibold text-foreground ring-1 ring-border">
                              {tRoom(`next.${c.nextAction.key}.action`)}
                            </span>
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
                  <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-muted/50">
                    <Send className="size-5 text-muted-foreground/70" />
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    {t("empty.applications")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground/70">
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
                const nextAction = getCreatorApplicationNextAction(a);
                return (
                  <Card key={a.id}>
                    <CardContent>
                      <div className="flex items-start gap-3">
                        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-xs font-bold text-muted-foreground">
                          {brandInitials(a.brand_name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="truncate text-sm font-medium text-foreground">
                              {a.campaign_title}
                            </h3>
                            <span
                              className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${iconConfig.style}`}
                            >
                              <Icon className="size-3" />
                              {t(labelKey)}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {a.brand_name}
                          </p>
                          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground/70">
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
                            <span className="font-medium tabular-nums text-muted-foreground">
                              {formatRate(a.proposed_rate, locale)}
                            </span>
                          </div>

                          {/* Counter offer banner */}
                          {a.status === "counter_offer" &&
                            a.counter_rate && (
                              <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 ring-1 ring-amber-500/10 dark:bg-amber-950/50">
                                <p>
                                  {t("counterOffer.detail", {
                                    offer: formatRate(a.counter_rate, locale),
                                    asked: formatRate(a.proposed_rate, locale),
                                  })}
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  <Button
                                    size="sm"
                                    className="h-8 px-3 text-xs"
                                    disabled={counterActionKey != null}
                                    onClick={() => handleCounterResponse(a.id, true)}
                                  >
                                    {counterActionKey === `${a.id}:accept`
                                      ? t("counterOffer.accepting")
                                      : t("counterOffer.accept")}
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 bg-white px-3 text-xs text-foreground hover:bg-white/80 dark:bg-background"
                                    disabled={counterActionKey != null}
                                    onClick={() => handleCounterResponse(a.id, false)}
                                  >
                                    {counterActionKey === `${a.id}:decline`
                                      ? t("counterOffer.declining")
                                      : t("counterOffer.decline")}
                                  </Button>
                                </div>
                                {counterResponseError && (
                                  <p className="mt-2 text-[11px] text-red-600">
                                    {counterResponseError}
                                  </p>
                                )}
                              </div>
                            )}
                          <div
                            className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-slate-50 px-3 py-2"
                            data-testid="creator-application-card-next-action"
                          >
                            <div className="min-w-0">
                              <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                                {tRoom("next.label")}
                              </p>
                              <p className="truncate text-xs font-semibold text-foreground">
                                {t(nextAction.titleKey)}
                              </p>
                            </div>
                            {nextAction.href ? (
                              <LinkButton
                                href={nextAction.href}
                                variant="outline"
                                size="xs"
                                className="shrink-0 bg-white"
                              >
                                {t(nextAction.actionKey)}
                              </LinkButton>
                            ) : (
                              <span className="shrink-0 rounded-md bg-white px-2.5 py-1 text-[11px] font-semibold text-muted-foreground ring-1 ring-border">
                                {t(nextAction.actionKey)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          {/* Completed Campaigns */}
          <TabsContent value="completed" className="mt-4 space-y-3">
            {completedCampaigns.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center">
                  <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-muted/50">
                    <CheckCircle2 className="size-5 text-muted-foreground/70" />
                  </div>
                  <p className="text-sm font-medium text-foreground">
                    {t("empty.completed")}
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
              completedCampaigns.map((c) => {
                const nextAction = getCreatorCompletedCampaignNextAction(c);
                return (
                  <Link
                    key={c.id}
                    href={`/i/campaigns/${c.id}`}
                    className="block"
                  >
                    <Card className="transition-shadow hover:shadow-md">
                      <CardContent>
                        <div className="flex items-start gap-3">
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-xs font-bold text-muted-foreground">
                            {brandInitials(c.brand_name)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <h3 className="truncate text-sm font-medium text-foreground">
                                {c.title}
                              </h3>
                              <span
                                className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                                  c.status === "completed"
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-muted/50 text-muted-foreground"
                                }`}
                              >
                                {c.status === "completed"
                                  ? t("status.completed")
                                  : t("status.withdrawn")}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {c.brand_name}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground/70">
                              {c.platforms.slice(0, 3).map((p) => {
                                const Icon = PlatformIcon[p];
                                return (
                                  <span
                                    key={p}
                                    className="inline-flex items-center gap-1 rounded-full bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-border/50"
                                  >
                                    <Icon className="size-3" />
                                    {PLATFORM_LABELS[p]}
                                  </span>
                                );
                              })}
                              {c.accepted_rate && (
                                <>
                                  <span className="text-muted-foreground/30">·</span>
                                  <span className="font-medium tabular-nums text-foreground">
                                    {formatRate(c.accepted_rate, locale)}
                                  </span>
                                </>
                              )}
                              {c.completed_at && (
                                <>
                                  <span className="text-muted-foreground/30">·</span>
                                  <span>{formatDate(c.completed_at, locale)}</span>
                                </>
                              )}
                            </div>
                            <div
                              className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-slate-50 px-3 py-2"
                              data-testid="creator-completed-card-next-action"
                            >
                              <div className="min-w-0">
                                <p className="text-[10px] font-semibold uppercase text-muted-foreground">
                                  {tRoom("next.label")}
                                </p>
                                <p className="truncate text-xs font-semibold text-foreground">
                                  {t(nextAction.titleKey)}
                                </p>
                              </div>
                              <span className="shrink-0 rounded-md bg-white px-2.5 py-1 text-[11px] font-semibold text-foreground ring-1 ring-border">
                                {t(nextAction.actionKey)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
