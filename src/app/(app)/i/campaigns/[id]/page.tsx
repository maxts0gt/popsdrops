"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Check,
  CheckCircle2,
  Circle,
  Clock,
  DollarSign,
  FileUp,
  Globe,
  ExternalLink,
  Shield,
  ThumbsDown,
  ThumbsUp,
  Users,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { PlatformIcon } from "@/components/platform-icons";
import {
  PLATFORM_LABELS,
  FORMAT_KEYS,
  getMarketLabel,
  type Platform,
  type Market,
  type ContentFormat,
} from "@/lib/constants";
import { useI18n, useTranslation } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";
import { ReviewDialog } from "@/components/shared/review-dialog";
import { ContentSubmitForm } from "@/components/shared/content-submit-form";
import { PerformanceForm } from "@/components/shared/performance-form";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CampaignRoom {
  id: string;
  title: string;
  brand_id: string;
  brand_name: string;
  brand_description: string | null;
  brand_website: string | null;
  brand_rating: number;
  brief_description: string | null;
  brief_requirements: string | null;
  brief_dos: string | null;
  brief_donts: string | null;
  platforms: Platform[];
  markets: string[];
  status: string;
  content_due_date: string | null;
  posting_window_start: string | null;
  posting_window_end: string | null;
  max_revisions: number;
  compliance_notes: string | null;
  accepted_rate: number;
  member_id: string;
  joined_at: string;
}

interface Deliverable {
  id: string;
  platform: Platform;
  content_type: string;
  quantity: number;
  notes: string | null;
}

interface Submission {
  id: string;
  platform: Platform | null;
  content_type: string | null;
  status: string;
  caption: string | null;
  feedback: string | null;
  version: number;
  revision_count: number;
  submitted_at: string | null;
  reviewed_at: string | null;
  published_url: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(amount: number, locale = "en"): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string | null, locale = "en"): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function brandInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function splitLines(text: string | null): string[] {
  if (!text) return [];
  return text
    .split(/\n|(?<=\.)(?:\s)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const submissionStatusStyles: Record<string, string> = {
  draft: "bg-slate-50 text-slate-500",
  submitted: "bg-blue-50 text-blue-700",
  approved: "bg-emerald-50 text-emerald-700",
  revision_requested: "bg-amber-50 text-amber-700",
  published: "bg-slate-900 text-white",
};

const submissionStatusKeys: Record<string, string> = {
  draft: "status.draft",
  submitted: "status.submitted",
  approved: "status.approved",
  revision_requested: "status.revisionRequested",
  published: "status.published",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CampaignRoomPage() {
  const { t } = useTranslation("creator.campaign");
  const { t: tc } = useTranslation("ui.common");
  const { locale, t: tGlobal } = useI18n();
  const params = useParams();
  const campaignId = params.id as string;

  const [room, setRoom] = useState<CampaignRoom | null>(null);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch membership + campaign + brand in one query
      const { data: memberData } = await supabase
        .from("campaign_members")
        .select(
          `id, accepted_rate, joined_at,
           campaigns (
             id, title, status, brand_id, platforms, markets,
             brief_description, brief_requirements, brief_dos, brief_donts,
             content_due_date, posting_window_start, posting_window_end,
             max_revisions, compliance_notes,
             profiles!campaigns_brand_id_fkey (
               full_name,
               brand_profiles (
                 company_name, description, website, rating
               )
             )
           )`
        )
        .eq("campaign_id", campaignId)
        .eq("creator_id", user.id)
        .single();

      if (memberData) {
        const c = (memberData as any).campaigns;
        const bp =
          c?.profiles?.brand_profiles?.[0] || c?.profiles?.brand_profiles;
        setRoom({
          id: c.id,
          title: c.title,
          brand_id: c.brand_id,
          brand_name: bp?.company_name || c?.profiles?.full_name || "Brand",
          brand_description: bp?.description || null,
          brand_website: bp?.website || null,
          brand_rating: bp?.rating || 0,
          brief_description: c.brief_description,
          brief_requirements: c.brief_requirements,
          brief_dos: c.brief_dos,
          brief_donts: c.brief_donts,
          platforms: c.platforms || [],
          markets: c.markets || [],
          status: c.status,
          content_due_date: c.content_due_date,
          posting_window_start: c.posting_window_start,
          posting_window_end: c.posting_window_end,
          max_revisions: c.max_revisions ?? 3,
          compliance_notes: c.compliance_notes,
          accepted_rate: memberData.accepted_rate || 0,
          member_id: memberData.id,
          joined_at: memberData.joined_at,
        });
      }

      // Fetch deliverables
      const { data: delData } = await supabase
        .from("campaign_deliverables")
        .select("*")
        .eq("campaign_id", campaignId)
        .order("platform", { ascending: true });

      if (delData) setDeliverables(delData as Deliverable[]);

      // Fetch submissions for this member
      if (memberData) {
        const { data: subData } = await supabase
          .from("content_submissions")
          .select("*")
          .eq("campaign_member_id", memberData.id)
          .order("created_at", { ascending: false });

        if (subData) setSubmissions(subData as Submission[]);
      }

      setLoading(false);
    }
    load();
  }, [campaignId]);

  // Loading skeleton — content-shaped to match page layout
  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4 lg:p-6">
        {/* Back link */}
        <div className="h-4 w-24 animate-pulse rounded bg-slate-100" />
        {/* Header: brand initials + title + meta */}
        <div className="flex items-start gap-3">
          <div className="size-10 animate-pulse rounded-xl bg-slate-100" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-48 animate-pulse rounded bg-slate-100" />
            <div className="flex gap-3">
              <div className="h-3 w-20 animate-pulse rounded bg-slate-50" />
              <div className="h-3 w-16 animate-pulse rounded bg-slate-50" />
              <div className="h-3 w-12 animate-pulse rounded bg-slate-50" />
            </div>
          </div>
        </div>
        {/* Action banner */}
        <div className="h-16 animate-pulse rounded-xl bg-blue-50/50" />
        {/* Tab bar */}
        <div className="flex gap-1">
          <div className="h-9 w-16 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-9 w-16 animate-pulse rounded-lg bg-slate-50" />
          <div className="h-9 w-16 animate-pulse rounded-lg bg-slate-50" />
        </div>
        {/* Brief content */}
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="h-3 w-20 animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-full animate-pulse rounded bg-slate-50" />
            <div className="h-3 w-3/4 animate-pulse rounded bg-slate-50" />
          </div>
          <div className="space-y-2">
            <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
            <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-3">
              <div className="size-8 animate-pulse rounded-lg bg-slate-100" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 w-32 animate-pulse rounded bg-slate-100" />
                <div className="h-3 w-20 animate-pulse rounded bg-slate-50" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="mx-auto max-w-2xl p-4 lg:p-6">
        <Link
          href="/i/campaigns"
          className="mb-6 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="size-4" />
          {tc("nav.campaigns")}
        </Link>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm font-medium text-slate-700">
              {t("room.notFound")}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {t("room.notFoundDetail")}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const dueDays = daysUntil(room.content_due_date);
  const hasRevisionNeeded = submissions.some(
    (s) => s.status === "revision_requested"
  );
  const allApproved =
    submissions.length > 0 && submissions.every((s) => s.status === "approved" || s.status === "published");
  const hasSubmissions = submissions.length > 0;

  // Build task checklist from campaign state
  const tasks = [
    { label: t("task.joined"), done: true },
    { label: t("task.reviewBrief"), done: true },
    {
      label: t("task.submitContent"),
      done: hasSubmissions,
    },
    {
      label: t("task.contentApproved"),
      done: allApproved,
    },
    {
      label: t("task.publishContent"),
      done: submissions.some((s) => s.status === "published"),
    },
  ];

  // Determine next action banner
  let banner: { text: string; detail: string; style: string } | null = null;
  if (hasRevisionNeeded) {
    const revSub = submissions.find((s) => s.status === "revision_requested");
    banner = {
      text: t("room.revisionRequested"),
      detail: revSub?.feedback || t("room.revisionDetail"),
      style: "border-amber-200 bg-amber-50 text-amber-800",
    };
  } else if (!hasSubmissions) {
    banner = {
      text: dueDays !== null ? t("room.contentDueIn", { days: String(dueDays) }) : t("room.uploadContent"),
      detail: t("room.submitForReview"),
      style: "border-blue-200 bg-blue-50 text-blue-800",
    };
  } else if (allApproved) {
    banner = {
      text: t("room.contentApproved"),
      detail: t("room.publishPrompt"),
      style: "border-emerald-200 bg-emerald-50 text-emerald-800",
    };
  }

  return (
    <div className="mx-auto max-w-2xl p-4 lg:p-6">
      {/* Back */}
      <Link
        href="/i/campaigns"
        className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 transition-colors hover:text-slate-900"
      >
        <ArrowLeft className="size-4" />
        {tc("nav.campaigns")}
      </Link>

      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xs font-bold text-slate-600">
          {brandInitials(room.brand_name)}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold tracking-tight text-slate-900">
            {room.title}
          </h1>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <span>{room.brand_name}</span>
            {dueDays !== null && (
              <span
                className={`inline-flex items-center gap-1 ${
                  dueDays <= 3
                    ? "font-medium text-red-500"
                    : ""
                }`}
              >
                <Clock className="size-3" />
                {dueDays === 0
                  ? t("status.dueToday")
                  : t("status.dueIn", { days: String(dueDays) })}
              </span>
            )}
            <span className="font-medium tabular-nums text-slate-700">
              {formatCurrency(room.accepted_rate, locale)}
            </span>
          </div>
        </div>
      </div>

      {/* Next action banner */}
      {banner && (
        <div
          className={`mt-4 rounded-xl border px-4 py-3 ${banner.style}`}
        >
          <p className="text-sm font-medium">{banner.text}</p>
          <p className="mt-0.5 text-xs opacity-75">{banner.detail}</p>
        </div>
      )}

      {/* Review CTA for completed campaigns */}
      {room.status === "completed" && (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3">
          <div>
            <p className="text-sm font-medium text-slate-900">{t("room.completed")}</p>
            <p className="mt-0.5 text-xs text-slate-500">{t("room.completedDetail", { name: room.brand_name })}</p>
          </div>
          <ReviewDialog
            campaignId={room.id}
            revieweeId={room.brand_id}
            revieweeName={room.brand_name}
          >
            <Button size="sm">{t("room.leaveReview")}</Button>
          </ReviewDialog>
        </div>
      )}

      {/* Tabs */}
      <div className="mt-6">
        <Tabs defaultValue="brief">
          <TabsList>
            <TabsTrigger value="brief">{t("tab.brief")}</TabsTrigger>
            <TabsTrigger value="tasks">{t("tab.tasks")}</TabsTrigger>
            <TabsTrigger value="submit">
              {t("tab.submit")}
              {hasRevisionNeeded && (
                <span className="ms-1.5 inline-flex size-1.5 rounded-full bg-amber-500" />
              )}
            </TabsTrigger>
          </TabsList>

          {/* Brief tab */}
          <TabsContent value="brief" className="mt-4 space-y-6">
            {room.brief_description && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {t("brief.label")}
                </h3>
                <p className="text-sm leading-relaxed text-slate-600">
                  {room.brief_description}
                </p>
              </div>
            )}

            {/* Deliverables */}
            {deliverables.length > 0 && (
              <div>
                <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {t("brief.deliverables")}
                </h3>
                <div className="space-y-2">
                  {deliverables.map((d) => {
                    const Icon = PlatformIcon[d.platform];
                    return (
                      <div
                        key={d.id}
                        className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-900/[0.04]"
                      >
                        <div className="flex size-8 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm">
                          <Icon className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-900">
                            {d.quantity}×{" "}
                            {FORMAT_KEYS[d.content_type as ContentFormat] ? tGlobal("ui.common", FORMAT_KEYS[d.content_type as ContentFormat]) : d.content_type}
                          </p>
                          <p className="text-xs text-slate-500">
                            {PLATFORM_LABELS[d.platform]}
                            {d.notes && ` · ${d.notes}`}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Requirements */}
            {room.brief_requirements && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {t("brief.requirements")}
                </h3>
                <ul className="space-y-1.5">
                  {splitLines(room.brief_requirements).map((req, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-sm text-slate-600"
                    >
                      <span className="mt-2 size-1 shrink-0 rounded-full bg-slate-400" />
                      {req}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Do's and Don'ts */}
            {(room.brief_dos || room.brief_donts) && (
              <div className="grid gap-4 sm:grid-cols-2">
                {room.brief_dos && (
                  <div className="rounded-xl bg-emerald-50/50 p-4 ring-1 ring-emerald-500/10">
                    <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                      <ThumbsUp className="size-3.5" />
                      {t("brief.dos")}
                    </div>
                    <ul className="space-y-1.5">
                      {splitLines(room.brief_dos).map((item, i) => (
                        <li
                          key={i}
                          className="text-xs leading-relaxed text-emerald-800"
                        >
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {room.brief_donts && (
                  <div className="rounded-xl bg-red-50/50 p-4 ring-1 ring-red-500/10">
                    <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-red-700">
                      <ThumbsDown className="size-3.5" />
                      {t("brief.donts")}
                    </div>
                    <ul className="space-y-1.5">
                      {splitLines(room.brief_donts).map((item, i) => (
                        <li
                          key={i}
                          className="text-xs leading-relaxed text-red-800"
                        >
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Timeline */}
            <div>
              <h3 className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                {t("brief.timeline")}
              </h3>
              <div className="space-y-2">
                {[
                  { label: t("timeline.contentDue"), date: room.content_due_date },
                  {
                    label: t("timeline.postingWindow"),
                    date: room.posting_window_start,
                  },
                  { label: t("timeline.postingEnds"), date: room.posting_window_end },
                ]
                  .filter((item) => item.date)
                  .map((item, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-sm"
                    >
                      <span className="text-slate-500">{item.label}</span>
                      <span className="font-medium tabular-nums text-slate-900">
                        {formatDate(item.date, locale)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>

            {/* Usage rights */}
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-600">
              <span>{t("brief.maxRevisions", { count: String(room.max_revisions) })}</span>
            </div>

            {/* Compliance */}
            {room.compliance_notes && (
              <div className="flex items-start gap-2 rounded-xl bg-amber-50/50 p-3 ring-1 ring-amber-500/10">
                <Shield className="mt-0.5 size-4 shrink-0 text-amber-600" />
                <p className="text-xs leading-relaxed text-amber-800">
                  {room.compliance_notes}
                </p>
              </div>
            )}
          </TabsContent>

          {/* Tasks tab */}
          <TabsContent value="tasks" className="mt-4">
            <div className="space-y-1">
              {tasks.map((t, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm ${
                    t.done ? "text-slate-400" : "text-slate-700"
                  }`}
                >
                  {t.done ? (
                    <CheckCircle2 className="size-5 shrink-0 text-emerald-500" />
                  ) : (
                    <Circle className="size-5 shrink-0 text-slate-300" />
                  )}
                  <span className={t.done ? "line-through" : ""}>
                    {t.label}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-4 text-xs text-slate-400">
              {t("task.progress", { done: String(tasks.filter((tk) => tk.done).length), total: String(tasks.length) })}
            </div>
          </TabsContent>

          {/* Submit tab */}
          <TabsContent value="submit" className="mt-4 space-y-4">
            {/* Existing submissions */}
            {submissions.map((s) => {
              const statusStyle =
                submissionStatusStyles[s.status] ||
                submissionStatusStyles.draft;
              const statusKey =
                submissionStatusKeys[s.status] || "status.draft";
              return (
                <Card key={s.id}>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileUp className="size-4 text-slate-400" />
                        <span className="text-sm font-medium text-slate-900">
                          {s.platform
                            ? PLATFORM_LABELS[s.platform]
                            : t("label.content")}{" "}
                          — v{s.version}
                        </span>
                      </div>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${statusStyle}`}
                      >
                        {tc(statusKey)}
                      </span>
                    </div>
                    {s.submitted_at && (
                      <p className="mt-1 text-xs text-slate-400">
                        {t("room.submitted", { date: formatDate(s.submitted_at, locale) })}
                      </p>
                    )}
                    {s.caption && (
                      <p className="mt-2 text-xs text-slate-500">{s.caption}</p>
                    )}
                    {s.status === "revision_requested" && s.feedback && (
                      <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 ring-1 ring-amber-500/10">
                        <span className="font-medium">{t("room.brandFeedback")} </span>
                        {s.feedback}
                      </div>
                    )}
                    {s.status === "approved" && !s.published_url && (
                      <p className="mt-2 text-xs text-emerald-600">
                        ✓ {t("room.approvedPublish")}
                      </p>
                    )}
                    {s.published_url && (
                      <a
                        href={s.published_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-slate-900"
                      >
                        <ExternalLink className="size-3" />
                        {t("room.viewPublished")}
                      </a>
                    )}
                  </CardContent>
                </Card>
              );
            })}

            {/* Content submission form */}
            <Card>
              <CardContent>
                <h3 className="mb-4 text-sm font-semibold text-slate-900">
                  {hasRevisionNeeded ? t("submit.titleRevised") : t("submit.title")}
                </h3>
                <ContentSubmitForm
                  campaignMemberId={room.member_id}
                  platforms={room.platforms}
                  onSuccess={() => window.location.reload()}
                />
              </CardContent>
            </Card>

            {/* Performance reporting — only show for published submissions */}
            {submissions.some((s) => s.status === "published") && (
              <Card>
                <CardContent>
                  <h3 className="mb-4 text-sm font-semibold text-slate-900">
                    {t("submit.reportPerformance")}
                  </h3>
                  <p className="mb-4 text-xs text-slate-500">
                    {t("submit.reportPerformanceDetail")}
                  </p>
                  {submissions
                    .filter((s) => s.status === "published" && s.platform)
                    .map((s) => (
                      <PerformanceForm
                        key={s.id}
                        submissionId={s.id}
                        platform={s.platform!}
                        measurementType="initial_48h"
                      />
                    ))}
                </CardContent>
              </Card>
            )}

            {submissions.length === 0 && (
              <p className="text-center text-xs text-slate-400">
                {t("room.noSubmissions")}
              </p>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
