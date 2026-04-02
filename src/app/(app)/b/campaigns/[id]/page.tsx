"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  DollarSign,
  Eye,
  Heart,
  FileText,
  Users,
  Star,
  CheckCircle,
  XCircle,
  MessageCircle,
  Send,
  Clock,
  BarChart3,
  Image as ImageIcon,
  RotateCcw,
  MapPin,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  CAMPAIGN_STATUS_COLORS,
  PLATFORM_LABELS,
  NICHE_KEYS,
  getMarketLabel,
  formatCurrency,
} from "@/lib/constants";
import { useTranslation } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/context";
import {
  acceptApplication,
  rejectApplication,
  counterOffer,
} from "@/app/actions/applications";
import { approveContent, requestRevision } from "@/app/actions/content";
import { toast } from "sonner";
import type { CampaignStatus, Platform, Niche } from "@/lib/constants";
import { createClient } from "@/lib/supabase/client";
import { ReviewDialog } from "@/components/shared/review-dialog";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CampaignRow {
  id: string;
  title: string;
  status: string;
  platforms: string[];
  markets: string[];
  niches: string[];
  budget_min: number | null;
  budget_max: number | null;
  total_spend: number | null;
  max_creators: number | null;
  brief_description: string | null;
  brief_requirements: string | null;
  brief_dos: string | null;
  brief_donts: string | null;
  application_deadline: string | null;
  content_due_date: string | null;
  posting_window_start: string | null;
  posting_window_end: string | null;
  max_revisions: number | null;
  created_at: string;
}

interface ApplicationRow {
  id: string;
  proposed_rate: number | null;
  pitch: string | null;
  status: string;
  created_at: string;
  profiles: {
    full_name: string;
    avatar_url: string | null;
  } | null;
  creator_profiles: {
    slug: string;
    primary_market: string | null;
    niches: string[];
    rating: number;
  } | null;
}

interface MemberRow {
  id: string;
  creator_id: string;
  accepted_rate: number | null;
  payment_status: string;
  profiles: {
    full_name: string;
    avatar_url: string | null;
  } | null;
  creator_profiles: {
    primary_market: string | null;
    tiktok: unknown;
    instagram: unknown;
    snapchat: unknown;
    youtube: unknown;
    facebook: unknown;
  } | null;
}

interface SubmissionRow {
  id: string;
  content_url: string | null;
  caption: string | null;
  platform: string | null;
  status: string;
  version: number;
  feedback: string | null;
  revision_count: number | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  campaign_members: {
    profiles: {
      full_name: string;
      avatar_url: string | null;
    } | null;
  } | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function timeAgo(
  dateStr: string,
  tc: (key: string, vars?: Record<string, string>) => string,
  locale = "en",
): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return tc("time.justNow");
  if (minutes < 60) return tc("time.minutesAgo", { count: String(minutes) });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return tc("time.hoursAgo", { count: String(hours) });
  const days = Math.floor(hours / 24);
  if (days === 1) return tc("time.yesterday");
  if (days < 7) return tc("time.daysAgo", { count: String(days) });
  return new Date(dateStr).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
  });
}

function formatDate(dateStr: string | null, locale = "en"): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getPrimaryPlatform(cp: MemberRow["creator_profiles"]): string | null {
  if (!cp) return null;
  const keys = ["tiktok", "instagram", "snapchat", "youtube", "facebook"] as const;
  for (const k of keys) {
    if (cp[k]) return k;
  }
  return null;
}

const submissionStatusStyles: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700",
  submitted: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  revision_requested: "bg-red-100 text-red-700",
  published: "bg-blue-100 text-blue-700",
};

const submissionStatusKeys: Record<string, string> = {
  draft: "status.draft",
  submitted: "status.submitted",
  approved: "status.approved",
  revision_requested: "status.revisionRequested",
  published: "status.published",
};

const paymentStatusStyles: Record<string, string> = {
  pending: "bg-slate-100 text-slate-700",
  invoiced: "bg-amber-100 text-amber-700",
  paid: "bg-emerald-100 text-emerald-700",
  overdue: "bg-red-100 text-red-700",
};

const paymentStatusKeys: Record<string, string> = {
  pending: "status.pending",
  invoiced: "status.submitted",
  paid: "status.completed",
  overdue: "status.rejected",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CampaignRoomPage() {
  const { t } = useTranslation("brand.campaign");
  const { t: tc } = useTranslation("ui.common");
  const { locale } = useI18n();
  const params = useParams();
  const campaignId = params.id as string;

  const [campaign, setCampaign] = useState<CampaignRow | null>(null);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [messageInput, setMessageInput] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [counterDialog, setCounterDialog] = useState<string | null>(null);
  const [counterRate, setCounterRate] = useState("");
  const [counterMessage, setCounterMessage] = useState("");
  const [revisionDialog, setRevisionDialog] = useState<string | null>(null);
  const [revisionFeedback, setRevisionFeedback] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      // Fetch campaign
      const { data: camp } = await supabase
        .from("campaigns")
        .select(
          `id, title, status, platforms, markets, niches, budget_min, budget_max,
           total_spend, max_creators, brief_description, brief_requirements,
           brief_dos, brief_donts, application_deadline, content_due_date,
           posting_window_start, posting_window_end, max_revisions, created_at`,
        )
        .eq("id", campaignId)
        .single();

      if (camp) setCampaign(camp as CampaignRow);

      // Fetch applications (profiles joined via FK, creator_profiles fetched separately)
      const { data: apps } = await supabase
        .from("campaign_applications")
        .select(
          `id, proposed_rate, pitch, status, created_at, creator_id,
           profiles!campaign_applications_creator_id_fkey ( full_name, avatar_url )`,
        )
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false });

      if (apps) {
        // Fetch creator_profiles for all applicant creator IDs
        const appCreatorIds = apps.map((a: Record<string, unknown>) => a.creator_id as string).filter(Boolean);
        let cpMap = new Map<string, Record<string, unknown>>();
        if (appCreatorIds.length > 0) {
          const { data: cps } = await supabase
            .from("creator_profiles")
            .select("profile_id, slug, primary_market, niches, rating")
            .in("profile_id", appCreatorIds);
          if (cps) {
            for (const cp of cps) cpMap.set(cp.profile_id, cp);
          }
        }

        setApplications(
          apps.map((a: Record<string, unknown>) => ({
            ...a,
            profiles: Array.isArray(a.profiles) ? a.profiles[0] : a.profiles,
            creator_profiles: cpMap.get(a.creator_id as string) ?? null,
          })) as ApplicationRow[],
        );
      }

      // Fetch members (profiles joined via FK, creator_profiles fetched separately)
      const { data: mems } = await supabase
        .from("campaign_members")
        .select(
          `id, creator_id, accepted_rate, payment_status,
           profiles!campaign_members_creator_id_fkey ( full_name, avatar_url )`,
        )
        .eq("campaign_id", campaignId);

      if (mems) {
        // Fetch creator_profiles for all member creator IDs
        const memCreatorIds = mems.map((m: Record<string, unknown>) => m.creator_id as string).filter(Boolean);
        let memCpMap = new Map<string, Record<string, unknown>>();
        if (memCreatorIds.length > 0) {
          const { data: cps } = await supabase
            .from("creator_profiles")
            .select("profile_id, primary_market, tiktok, instagram, snapchat, youtube, facebook")
            .in("profile_id", memCreatorIds);
          if (cps) {
            for (const cp of cps) memCpMap.set(cp.profile_id, cp);
          }
        }

        setMembers(
          mems.map((m: Record<string, unknown>) => ({
            ...m,
            profiles: Array.isArray(m.profiles) ? m.profiles[0] : m.profiles,
            creator_profiles: memCpMap.get(m.creator_id as string) ?? null,
          })) as MemberRow[],
        );
      }

      // Fetch content submissions via member IDs
      const memberIds = (mems || []).map((m: Record<string, unknown>) => m.id);
      let subs: Record<string, unknown>[] | null = null;
      if (memberIds.length > 0) {
        const { data } = await supabase
          .from("content_submissions")
          .select(
            `id, content_url, caption, platform, status, version, feedback, revision_count, submitted_at, reviewed_at, campaign_member_id,
             campaign_members!content_submissions_campaign_member_id_fkey ( profiles!campaign_members_creator_id_fkey ( full_name, avatar_url ) )`,
          )
          .in("campaign_member_id", memberIds)
          .order("submitted_at", { ascending: false });
        subs = data as Record<string, unknown>[] | null;
      }

      if (subs) {
        setSubmissions(
          subs.map((s: Record<string, unknown>) => {
            const cm = Array.isArray(s.campaign_members) ? s.campaign_members[0] : s.campaign_members;
            return {
              ...s,
              campaign_members: cm
                ? {
                    profiles: Array.isArray((cm as Record<string, unknown>).profiles)
                      ? ((cm as Record<string, unknown>).profiles as unknown[])[0]
                      : (cm as Record<string, unknown>).profiles,
                  }
                : null,
            };
          }) as SubmissionRow[],
        );
      }

      setLoading(false);
    }
    load();
  }, [campaignId]);

  // ---------------------------------------------------------------------------
  // Action handlers
  // ---------------------------------------------------------------------------

  async function handleAccept(appId: string, rate: number | null) {
    setActionLoading(appId);
    try {
      await acceptApplication(appId, rate || 0);
      setApplications((prev) => prev.map((a) => a.id === appId ? { ...a, status: "accepted" } : a));
      toast.success(t("applicants.accept"));
    } catch { toast.error("Failed"); }
    finally { setActionLoading(null); }
  }

  async function handleReject(appId: string) {
    setActionLoading(appId);
    try {
      await rejectApplication(appId);
      setApplications((prev) => prev.map((a) => a.id === appId ? { ...a, status: "rejected" } : a));
    } catch { toast.error("Failed"); }
    finally { setActionLoading(null); }
  }

  async function handleCounter() {
    if (!counterDialog || !counterRate) return;
    setActionLoading(counterDialog);
    try {
      await counterOffer({
        application_id: counterDialog,
        counter_rate: Number(counterRate),
        counter_message: counterMessage || undefined,
      });
      setApplications((prev) => prev.map((a) => a.id === counterDialog ? { ...a, status: "counter_offer" } : a));
      setCounterDialog(null);
      setCounterRate("");
      setCounterMessage("");
    } catch { toast.error("Failed"); }
    finally { setActionLoading(null); }
  }

  async function handleApproveContent(subId: string) {
    setActionLoading(subId);
    try {
      await approveContent(subId);
      setSubmissions((prev) => prev.map((s) => s.id === subId ? { ...s, status: "approved", reviewed_at: new Date().toISOString() } : s));
      toast.success(t("content.approve"));
    } catch { toast.error("Failed"); }
    finally { setActionLoading(null); }
  }

  async function handleRequestRevision() {
    if (!revisionDialog || !revisionFeedback.trim()) return;
    setActionLoading(revisionDialog);
    try {
      await requestRevision(revisionDialog, revisionFeedback.trim());
      setSubmissions((prev) => prev.map((s) => s.id === revisionDialog ? { ...s, status: "revision_requested", feedback: revisionFeedback.trim(), revision_count: (s.revision_count ?? 0) + 1 } : s));
      setRevisionDialog(null);
      setRevisionFeedback("");
    } catch { toast.error("Failed"); }
    finally { setActionLoading(null); }
  }

  // Computed values
  const budget = campaign?.budget_max || campaign?.budget_min || 0;
  const spent = campaign?.total_spend || 0;
  const totalContent = submissions.length;
  const approvedContent = submissions.filter((s) => s.status === "approved" || s.status === "published").length;
  const pendingApps = applications.filter((a) => a.status === "pending");

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        {/* Header skeleton */}
        <div className="space-y-2">
          <div className="h-4 w-24 animate-pulse rounded bg-slate-100" />
          <div className="h-7 w-64 animate-pulse rounded-lg bg-slate-100" />
          <div className="h-4 w-80 animate-pulse rounded bg-slate-50" />
        </div>
        {/* KPI cards skeleton */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl border border-slate-200/60 bg-white p-5">
              <div className="flex items-center gap-3">
                <div className="size-9 animate-pulse rounded-lg bg-slate-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-5 w-16 animate-pulse rounded bg-slate-100" />
                  <div className="h-3 w-24 animate-pulse rounded bg-slate-50" />
                </div>
              </div>
            </div>
          ))}
        </div>
        {/* Tabs skeleton */}
        <div className="flex gap-6 border-b border-slate-200 pb-3">
          {[80, 100, 72, 88].map((w, i) => (
            <div key={i} className="h-4 animate-pulse rounded bg-slate-100" style={{ width: w }} />
          ))}
        </div>
        {/* Content skeleton */}
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200/60 bg-white p-6">
            <div className="space-y-3">
              <div className="h-5 w-32 animate-pulse rounded bg-slate-100" />
              <div className="h-3 w-full animate-pulse rounded bg-slate-50" />
              <div className="h-3 w-3/4 animate-pulse rounded bg-slate-50" />
              <div className="h-3 w-5/6 animate-pulse rounded bg-slate-50" />
            </div>
          </div>
          <div className="rounded-xl border border-slate-200/60 bg-white p-6">
            <div className="space-y-3">
              <div className="h-5 w-24 animate-pulse rounded bg-slate-100" />
              <div className="h-3 w-2/3 animate-pulse rounded bg-slate-50" />
              <div className="h-3 w-1/2 animate-pulse rounded bg-slate-50" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!campaign) return null;

  const dosItems = campaign.brief_dos?.split("\n").filter(Boolean) || [];
  const dontsItems = campaign.brief_donts?.split("\n").filter(Boolean) || [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-6">
        <Link
          href="/b/campaigns"
          className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="size-3.5" /> {t("back")}
        </Link>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900">{campaign.title}</h1>
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  CAMPAIGN_STATUS_COLORS[campaign.status as CampaignStatus] || "bg-slate-100 text-slate-700"
                }`}
              >
                {tc(`status.${campaign.status === "in_progress" ? "inProgress" : campaign.status}`)}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
              {campaign.platforms?.map((p) => (
                <span key={p} className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                  {PLATFORM_LABELS[p as Platform] || p}
                </span>
              ))}
              {campaign.markets?.length > 0 && (
                <>
                  <span className="text-slate-300">|</span>
                  <span>
                    {campaign.markets.map((m) => getMarketLabel(m, locale)).join(", ")}
                  </span>
                </>
              )}
              <span className="text-slate-300">|</span>
              <span>{formatDate(campaign.posting_window_start, locale)} — {formatDate(campaign.posting_window_end, locale)}</span>
            </div>
          </div>
          <Link
            href={`/b/campaigns/${campaign.id}/report`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <BarChart3 className="size-4" /> {t("action.viewReport")}
          </Link>
        </div>
      </div>

      {/* Phase KPI Cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <DollarSign className="size-4" />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">{formatCurrency(spent, locale)}</p>
              <p className="text-xs text-slate-500">
                {t("kpi.budget", { total: formatCurrency(budget, locale) })}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <Users className="size-4" />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">{members.length}</p>
              <p className="text-xs text-slate-500">{tc("metric.creators")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <FileText className="size-4" />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">{approvedContent}/{totalContent}</p>
              <p className="text-xs text-slate-500">{t("kpi.pipeline")}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <Send className="size-4" />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900">{pendingApps.length}</p>
              <p className="text-xs text-slate-500">{t("applicants.title")}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList variant="line" className="mb-6">
          <TabsTrigger value="overview">{t("tab.overview")}</TabsTrigger>
          <TabsTrigger value="applicants">
            {t("tab.applicants")} ({applications.length})
          </TabsTrigger>
          <TabsTrigger value="members">
            {t("tab.members")} ({members.length})
          </TabsTrigger>
          <TabsTrigger value="content">
            {t("tab.content")} ({submissions.length})
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle>{t("section.brief")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {campaign.brief_description && (
                    <p className="text-sm leading-relaxed text-slate-700">{campaign.brief_description}</p>
                  )}
                  {campaign.brief_requirements && (
                    <div>
                      <p className="mb-1 text-xs font-medium uppercase text-slate-400">
                        {t("section.requirements")}
                      </p>
                      <p className="text-sm text-slate-600">{campaign.brief_requirements}</p>
                    </div>
                  )}
                  {(dosItems.length > 0 || dontsItems.length > 0) && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {dosItems.length > 0 && (
                        <div>
                          <p className="mb-2 text-xs font-medium uppercase text-slate-400">
                            {t("section.dos")}
                          </p>
                          <ul className="space-y-1">
                            {dosItems.map((d, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                                <CheckCircle className="mt-0.5 size-3.5 shrink-0 text-emerald-500" />
                                {d}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {dontsItems.length > 0 && (
                        <div>
                          <p className="mb-2 text-xs font-medium uppercase text-slate-400">
                            {t("section.donts")}
                          </p>
                          <ul className="space-y-1">
                            {dontsItems.map((d, i) => (
                              <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                                <XCircle className="mt-0.5 size-3.5 shrink-0 text-red-400" />
                                {d}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>{t("section.timeline")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">{t("label.start")}</span>
                    <span className="font-medium text-slate-900">
                      {formatDate(campaign.posting_window_start, locale)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">{t("label.contentDeadline")}</span>
                    <span className="font-medium text-amber-600">
                      {formatDate(campaign.content_due_date, locale)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">{t("label.end")}</span>
                    <span className="font-medium text-slate-900">
                      {formatDate(campaign.posting_window_end, locale)}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">{t("label.maxRevisions")}</span>
                    <span className="font-medium text-slate-900">
                      {campaign.max_revisions ?? 2}
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t("section.quickActions")}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button variant="outline" className="w-full justify-start">
                    <Users className="size-4" /> {t("action.inviteCreators")}
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <MessageCircle className="size-4" /> {t("action.sendAnnouncement")}
                  </Button>
                  <Button variant="outline" className="w-full justify-start">
                    <Clock className="size-4" /> {t("action.extendDeadline")}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Applicants Tab */}
        <TabsContent value="applicants">
          {applications.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 py-12 text-center">
              <Users className="mx-auto mb-3 size-8 text-slate-300" />
              <p className="text-sm text-slate-500">{t("empty.noApplicants")}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {applications.map((app) => {
                const name = app.profiles?.full_name || "";
                const cp = app.creator_profiles;
                return (
                  <Card key={app.id}>
                    <CardContent>
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex gap-3">
                          <Avatar className="size-10">
                            {app.profiles?.avatar_url && (
                              <AvatarImage src={app.profiles.avatar_url} />
                            )}
                            <AvatarFallback>{getInitials(name)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-medium text-slate-900">{name}</h3>
                              {cp && cp.rating > 0 && (
                                <div className="flex items-center gap-1 text-xs text-amber-500">
                                  <Star className="size-3 fill-amber-500" /> {cp.rating.toFixed(1)}
                                </div>
                              )}
                            </div>
                            <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                              {cp?.primary_market && (
                                <>
                                  <MapPin className="size-3" />
                                  {getMarketLabel(cp.primary_market, locale)}
                                </>
                              )}
                            </div>
                            {cp?.niches && cp.niches.length > 0 && (
                              <div className="mt-1 flex gap-1.5">
                                {cp.niches.slice(0, 3).map((n) => (
                                  <Badge key={n} variant="secondary" className="text-xs">
                                    {NICHE_KEYS[n as Niche] ? tc(NICHE_KEYS[n as Niche]) : n}
                                  </Badge>
                                ))}
                              </div>
                            )}
                            {app.pitch && (
                              <p className="mt-2 text-sm text-slate-600">{app.pitch}</p>
                            )}
                            <p className="mt-1 text-xs text-slate-400">
                              {timeAgo(app.created_at, tc, locale)}
                              {app.proposed_rate != null && ` · $${app.proposed_rate}`}
                            </p>
                          </div>
                        </div>
                        {app.status === "pending" && (
                          <div className="flex shrink-0 gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => { setCounterDialog(app.id); setCounterRate(String(app.proposed_rate || "")); }}
                            >
                              {t("applicants.counter")}
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={actionLoading === app.id}
                              onClick={() => handleReject(app.id)}
                            >
                              {actionLoading === app.id ? t("applicants.rejecting") : t("applicants.reject")}
                            </Button>
                            <Button
                              size="sm"
                              disabled={actionLoading === app.id}
                              onClick={() => handleAccept(app.id, app.proposed_rate)}
                            >
                              {actionLoading === app.id ? t("applicants.accepting") : t("applicants.accept")}
                            </Button>
                          </div>
                        )}
                        {app.status !== "pending" && (
                          <Badge
                            variant="secondary"
                            className={`text-xs ${
                              app.status === "accepted"
                                ? "bg-emerald-100 text-emerald-700"
                                : app.status === "rejected"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-slate-100 text-slate-700"
                            }`}
                          >
                            {tc(`status.${app.status}`)}
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Members Tab */}
        <TabsContent value="members">
          {members.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 py-12 text-center">
              <Users className="mx-auto mb-3 size-8 text-slate-300" />
              <p className="text-sm text-slate-500">{t("empty.noMembers")}</p>
            </div>
          ) : (
            <Card>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-start text-xs font-medium text-slate-500">
                        <th className="pb-3 pe-4">{t("members.creator")}</th>
                        <th className="pb-3 pe-4">{t("members.market")}</th>
                        <th className="pb-3 pe-4">{t("members.platform")}</th>
                        <th className="pb-3 pe-4">{t("members.rate")}</th>
                        <th className="pb-3 pe-4">{t("members.payment")}</th>
                        {campaign.status === "completed" && (
                          <th className="pb-3"></th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {members.map((m) => {
                        const name = m.profiles?.full_name || "";
                        const market = m.creator_profiles?.primary_market;
                        const platform = getPrimaryPlatform(m.creator_profiles);
                        const payStyle = paymentStatusStyles[m.payment_status] || "bg-slate-100 text-slate-700";
                        const payKey = paymentStatusKeys[m.payment_status] || "status.pending";
                        return (
                          <tr key={m.id} className="border-b border-slate-100 last:border-0">
                            <td className="py-3 pe-4">
                              <div className="flex items-center gap-2">
                                <Avatar className="size-7">
                                  {m.profiles?.avatar_url && (
                                    <AvatarImage src={m.profiles.avatar_url} />
                                  )}
                                  <AvatarFallback className="text-xs">
                                    {getInitials(name)}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="font-medium text-slate-900">{name}</span>
                              </div>
                            </td>
                            <td className="py-3 pe-4 text-slate-600">
                              {market ? getMarketLabel(market, locale) : "—"}
                            </td>
                            <td className="py-3 pe-4 text-slate-600">
                              {platform ? PLATFORM_LABELS[platform as Platform] || platform : "—"}
                            </td>
                            <td className="py-3 pe-4 font-medium text-slate-900">
                              {m.accepted_rate != null ? formatCurrency(m.accepted_rate, locale) : "—"}
                            </td>
                            <td className="py-3 pe-4">
                              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${payStyle}`}>
                                {tc(payKey)}
                              </span>
                            </td>
                            {campaign.status === "completed" && (
                              <td className="py-3">
                                <ReviewDialog
                                  campaignId={campaign.id}
                                  revieweeId={m.creator_id}
                                  revieweeName={name}
                                >
                                  <Button variant="ghost" size="sm">
                                    <Star className="me-1 size-3.5" />
                                    Review
                                  </Button>
                                </ReviewDialog>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Content Tab */}
        <TabsContent value="content">
          {submissions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 py-12 text-center">
              <ImageIcon className="mx-auto mb-3 size-8 text-slate-300" />
              <p className="text-sm text-slate-500">{t("empty.noContent")}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {submissions.map((cs) => {
                const creatorName = cs.campaign_members?.profiles?.full_name || "";
                const creatorAvatar = cs.campaign_members?.profiles?.avatar_url;
                const statusStyle = submissionStatusStyles[cs.status] || "bg-slate-100 text-slate-700";
                const statusKey = submissionStatusKeys[cs.status] || "status.pending";
                const platformLabel = cs.platform ? PLATFORM_LABELS[cs.platform as Platform] || cs.platform : "";
                const revCount = cs.revision_count ?? 0;
                const maxRev = campaign.max_revisions ?? 3;

                return (
                  <Card key={cs.id}>
                    <CardContent>
                      {/* Header row: creator + status */}
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <Avatar className="size-9">
                            {creatorAvatar && <AvatarImage src={creatorAvatar} />}
                            <AvatarFallback className="text-xs">{getInitials(creatorName)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-slate-900">{creatorName}</p>
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              {platformLabel && (
                                <span className="rounded bg-slate-100 px-1.5 py-0.5">{platformLabel}</span>
                              )}
                              {cs.submitted_at && (
                                <span>{timeAgo(cs.submitted_at, tc, locale)}</span>
                              )}
                              {cs.version > 1 && (
                                <span>v{cs.version}</span>
                              )}
                            </div>
                          </div>
                        </div>
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusStyle}`}>
                          {tc(statusKey)}
                        </span>
                      </div>

                      {/* Content URL */}
                      {cs.content_url && (
                        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                          <a
                            href={cs.content_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-900 hover:text-teal-700"
                          >
                            <Eye className="size-3.5 shrink-0" />
                            <span className="truncate">{cs.content_url}</span>
                          </a>
                        </div>
                      )}

                      {/* Caption */}
                      {cs.caption && (
                        <div className="mt-3">
                          <p className="text-xs font-medium uppercase text-slate-400">{t("content.caption")}</p>
                          <p className="mt-1 text-sm text-slate-600">{cs.caption}</p>
                        </div>
                      )}

                      {/* Previous feedback (for revision_requested or resubmissions) */}
                      {cs.feedback && cs.status === "revision_requested" && (
                        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                          <p className="text-xs font-medium text-amber-700">{t("content.yourFeedback")}</p>
                          <p className="mt-1 text-sm text-amber-800">{cs.feedback}</p>
                          {revCount > 0 && (
                            <p className="mt-1.5 text-xs text-amber-600">
                              {t("content.revisionCount", { current: String(revCount), max: String(maxRev) })}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Action buttons for submitted content */}
                      {cs.status === "submitted" && (
                        <div className="mt-4 flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => { setRevisionDialog(cs.id); setRevisionFeedback(""); }}
                          >
                            <RotateCcw className="size-3.5" /> {t("content.revise")}
                          </Button>
                          <Button
                            size="sm"
                            disabled={actionLoading === cs.id}
                            onClick={() => handleApproveContent(cs.id)}
                          >
                            <CheckCircle className="size-3.5" />
                            {actionLoading === cs.id ? t("content.approving") : t("content.approve")}
                          </Button>
                        </div>
                      )}

                      {/* Approved — show reviewed date */}
                      {cs.status === "approved" && cs.reviewed_at && (
                        <p className="mt-3 text-xs text-emerald-600">
                          {t("content.approvedOn", {
                            date: new Date(cs.reviewed_at).toLocaleDateString(locale, { month: "short", day: "numeric" }),
                          })}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Counter-Offer Dialog */}
      {counterDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">{t("applicants.counterTitle")}</h3>
            <div className="space-y-4">
              <div>
                <Label>{t("applicants.counterRate")}</Label>
                <Input
                  type="number"
                  value={counterRate}
                  onChange={(e) => setCounterRate(e.target.value)}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label>{t("applicants.counterMessage")}</Label>
                <Textarea
                  value={counterMessage}
                  onChange={(e) => setCounterMessage(e.target.value)}
                  rows={3}
                  className="mt-1.5"
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setCounterDialog(null)}>
                  {tc("action.cancel")}
                </Button>
                <Button
                  onClick={handleCounter}
                  disabled={!counterRate || actionLoading === counterDialog}
                >
                  {actionLoading === counterDialog ? t("applicants.counterSending") : t("applicants.counterSubmit")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Revision Dialog */}
      {revisionDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-slate-900">{t("content.revisionTitle")}</h3>
            <div className="space-y-4">
              <div>
                <Label>{t("content.revisionFeedback")}</Label>
                <Textarea
                  value={revisionFeedback}
                  onChange={(e) => setRevisionFeedback(e.target.value)}
                  placeholder={t("content.revisionPlaceholder")}
                  rows={4}
                  className="mt-1.5"
                />
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setRevisionDialog(null)}>
                  {tc("action.cancel")}
                </Button>
                <Button
                  onClick={handleRequestRevision}
                  disabled={!revisionFeedback.trim() || actionLoading === revisionDialog}
                >
                  {actionLoading === revisionDialog ? t("content.revisionSending") : t("content.revisionSubmit")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
