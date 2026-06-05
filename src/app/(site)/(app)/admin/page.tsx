import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  CircleDollarSign,
  MailWarning,
  Megaphone,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";
import { getUser } from "@/app/actions/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type AttentionTone = "danger" | "warning" | "neutral";

type AttentionItem = {
  action: string;
  detail: string;
  href: string;
  label: string;
  tone: AttentionTone;
  value: number;
};

type SummaryItem = {
  detail: string;
  href: string;
  icon: typeof ShieldCheck;
  label: string;
  value: string;
};

type ControlTowerStats = {
  activeCampaigns: number;
  brandCount: number;
  creatorCount: number;
  failedEmails: number;
  functionFailures: number;
  launchBlockedCampaigns: number;
  paymentExceptions: number;
  pendingEmails: number;
  pendingProfiles: number;
  pendingWaitlist: number;
  reportExceptions: number;
  reviewSlaBreaches: number;
  submittedEvidence: number;
  totalCampaigns: number;
  totalUsers: number;
  overdueProfiles: number;
  overdueWaitlist: number;
};

async function assertAdmin() {
  const user = await getUser();
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") notFound();
}

async function countRows<T>(query: PromiseLike<{ count: number | null; error: T | null }>) {
  const { count, error } = await query;
  if (error) {
    const message =
      typeof error === "object" && error !== null && "message" in error
        ? String(error.message)
        : "Failed to load admin count";
    throw new Error(message);
  }
  return count ?? 0;
}

async function fetchControlTowerStats(): Promise<ControlTowerStats> {
  const admin = createAdminClient();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const reviewSlaCutoff = oneDayAgo;
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    totalUsers,
    creatorCount,
    brandCount,
    pendingProfiles,
    overdueProfiles,
    pendingWaitlist,
    overdueWaitlist,
    totalCampaigns,
    activeCampaigns,
    paymentExceptions,
    launchBlockedCampaigns,
    reportExceptions,
    reviewSlaBreaches,
    submittedEvidence,
    failedEmails,
    pendingEmails,
    functionFailures,
  ] = await Promise.all([
    countRows(admin.from("profiles").select("id", { count: "exact", head: true })),
    countRows(
      admin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "creator"),
    ),
    countRows(
      admin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "brand"),
    ),
    countRows(
      admin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
    ),
    countRows(
      admin
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
        .lt("created_at", oneDayAgo),
    ),
    countRows(
      admin
        .from("waitlist")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
    ),
    countRows(
      admin
        .from("waitlist")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
        .lt("created_at", oneDayAgo),
    ),
    countRows(admin.from("campaigns").select("id", { count: "exact", head: true })),
    countRows(
      admin
        .from("campaigns")
        .select("id", { count: "exact", head: true })
        .in("status", ["recruiting", "in_progress", "publishing", "monitoring"]),
    ),
    countRows(
      admin
        .from("campaigns")
        .select("id", { count: "exact", head: true })
        .in("service_fee_status", ["overdue", "failed", "refunded", "disputed"]),
    ),
    countRows(
      admin
        .from("campaigns")
        .select("id", { count: "exact", head: true })
        .eq("status", "draft")
        .neq("service_fee_status", "paid"),
    ),
    countRows(
      admin
        .from("campaign_report_tasks")
        .select("id", { count: "exact", head: true })
        .in("status", ["missed", "needs_revision"]),
    ),
    countRows(
      admin
        .from("content_performance_evidence")
        .select("id", { count: "exact", head: true })
        .eq("verification_status", "submitted")
        .lt("created_at", reviewSlaCutoff),
    ),
    countRows(
      admin
        .from("content_performance_evidence")
        .select("id", { count: "exact", head: true })
        .eq("verification_status", "submitted"),
    ),
    countRows(
      admin
        .from("notification_queue")
        .select("id", { count: "exact", head: true })
        .eq("status", "failed"),
    ),
    countRows(
      admin
        .from("notification_queue")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending"),
    ),
    countRows(
      admin
        .from("function_execution_log")
        .select("id", { count: "exact", head: true })
        .eq("status", "error")
        .gte("created_at", oneWeekAgo),
    ),
  ]);

  return {
    activeCampaigns,
    brandCount,
    creatorCount,
    failedEmails,
    functionFailures,
    launchBlockedCampaigns,
    paymentExceptions,
    pendingEmails,
    pendingProfiles,
    pendingWaitlist,
    reportExceptions,
    reviewSlaBreaches,
    submittedEvidence,
    totalCampaigns,
    totalUsers,
    overdueProfiles,
    overdueWaitlist,
  };
}

function plural(count: number, singular: string, pluralValue = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralValue}`;
}

function verb(count: number, singular: string, pluralValue: string) {
  return count === 1 ? singular : pluralValue;
}

function attentionToneClass(tone: AttentionTone) {
  if (tone === "danger") return "border-red-200 bg-red-50 text-red-700";
  if (tone === "warning") return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function buildAttentionItems(stats: ControlTowerStats): AttentionItem[] {
  const overdueAccess = stats.overdueProfiles + stats.overdueWaitlist;
  const pendingAccess = stats.pendingProfiles + stats.pendingWaitlist;
  const items: AttentionItem[] = [];

  if (overdueAccess > 0) {
    items.push({
      action: "Review access",
      detail: `${plural(overdueAccess, "request")} past the 24h review target.`,
      href: "/admin/approvals",
      label: "Access overdue",
      tone: "danger",
      value: overdueAccess,
    });
  } else if (pendingAccess > 0) {
    items.push({
      action: "Review access",
      detail: `${plural(pendingAccess, "request")} waiting for approval.`,
      href: "/admin/approvals",
      label: "Access queue",
      tone: "warning",
      value: pendingAccess,
    });
  }

  if (stats.paymentExceptions > 0) {
    items.push({
      action: "Open revenue",
      detail: `${plural(stats.paymentExceptions, "campaign")} with failed, disputed, refunded, or overdue service fee state.`,
      href: "/admin/revenue#service-fees",
      label: "Payment exception",
      tone: "danger",
      value: stats.paymentExceptions,
    });
  }

  if (stats.launchBlockedCampaigns > 0) {
    items.push({
      action: "Open campaigns",
      detail: `${plural(stats.launchBlockedCampaigns, "draft")} cannot launch until fee or setup blockers clear.`,
      href: "/admin/campaigns",
      label: "Launch blocked",
      tone: "warning",
      value: stats.launchBlockedCampaigns,
    });
  }

  if (stats.reviewSlaBreaches > 0) {
    items.push({
      action: "Open reports",
      detail: `${plural(stats.reviewSlaBreaches, "submitted proof", "submitted proof items")} older than the 24h review target.`,
      href: "/admin/reports",
      label: "Proof review SLA",
      tone: "danger",
      value: stats.reviewSlaBreaches,
    });
  }

  const reviewReadyEvidence = Math.max(
    stats.submittedEvidence - stats.reviewSlaBreaches,
    0,
  );

  if (stats.reportExceptions > 0 || reviewReadyEvidence > 0) {
    const parts = [
      stats.reportExceptions > 0
        ? plural(stats.reportExceptions, "report task")
        : null,
      reviewReadyEvidence > 0
        ? `${plural(reviewReadyEvidence, "evidence item")} awaiting review`
        : null,
    ].filter(Boolean);
    items.push({
      action: "Review reporting",
      detail: parts.join(", "),
      href: "/admin/reports",
      label: "Reporting queue",
      tone: stats.reportExceptions > 0 ? "warning" : "neutral",
      value: stats.reportExceptions + reviewReadyEvidence,
    });
  }

  if (stats.failedEmails > 0) {
    items.push({
      action: "Open communications",
      detail: `${plural(stats.failedEmails, "email")} failed delivery and may need retry.`,
      href: "/admin/communications?status=failed",
      label: "Email delivery",
      tone: "danger",
      value: stats.failedEmails,
    });
  }

  if (stats.functionFailures > 0) {
    items.push({
      action: "Review logs",
      detail: `${plural(stats.functionFailures, "function error")} recorded in the last 7 days.`,
      href: "/admin/audit",
      label: "Backend health",
      tone: "warning",
      value: stats.functionFailures,
    });
  }

  return items;
}

function buildSummaryItems(stats: ControlTowerStats): SummaryItem[] {
  const pendingAccess = stats.pendingProfiles + stats.pendingWaitlist;
  const campaignExceptions =
    stats.paymentExceptions +
    stats.launchBlockedCampaigns +
    stats.reportExceptions +
    stats.submittedEvidence;

  return [
    {
      detail:
        pendingAccess > 0
          ? `${stats.overdueProfiles + stats.overdueWaitlist} overdue in review`
          : "No pending access",
      href: "/admin/approvals",
      icon: ShieldCheck,
      label: "Access",
      value: String(pendingAccess),
    },
    {
      detail: `${plural(stats.activeCampaigns, "active campaign")}`,
      href: "/admin/campaigns",
      icon: Megaphone,
      label: "Campaign exceptions",
      value: String(campaignExceptions),
    },
    {
      detail: `${stats.failedEmails} failed, ${stats.pendingEmails} pending`,
      href: "/admin/communications",
      icon: MailWarning,
      label: "Email queue",
      value: String(stats.failedEmails + stats.pendingEmails),
    },
    {
      detail: `${plural(stats.creatorCount, "creator")} / ${plural(stats.brandCount, "brand")}`,
      href: "/admin/users",
      icon: Users,
      label: "Network",
      value: String(stats.totalUsers),
    },
  ];
}

export default async function AdminDashboardPage() {
  await assertAdmin();
  const stats = await fetchControlTowerStats();
  const attentionItems = buildAttentionItems(stats);
  const summaryItems = buildSummaryItems(stats);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Admin</p>
          <h1 className="mt-1 text-2xl font-bold text-foreground">Control tower</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Exceptions that need PopsDrops attention across access, campaigns,
            payments, reporting, and email.
          </p>
        </div>
        <LinkButton href="/admin/approvals" variant="outline" size="sm">
          Open access queue
        </LinkButton>
      </div>

      <div
        data-testid="admin-control-tower-summary"
        className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
      >
        {summaryItems.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="rounded-xl border border-border bg-white p-4 shadow-sm transition-colors hover:bg-slate-50"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  {item.label}
                </p>
                <p className="mt-3 text-3xl font-semibold tabular-nums text-foreground">
                  {item.value}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
              </div>
              <div className="flex size-9 items-center justify-center rounded-lg border border-border bg-slate-50 text-muted-foreground">
                <item.icon className="size-4" />
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <Card>
          <CardContent className="p-0">
            <div className="border-b border-border px-5 py-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-base font-semibold text-foreground">
                    What needs attention
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Open queues ordered by operational risk.
                  </p>
                </div>
                <span className="rounded-full border border-border bg-slate-50 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  {attentionItems.length} open
                </span>
              </div>
            </div>

            {attentionItems.length > 0 ? (
              <div className="divide-y divide-border">
                {attentionItems.map((item) => (
                  <div
                    key={item.label}
                    data-testid="admin-attention-row"
                    className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${attentionToneClass(item.tone)}`}
                        >
                          {item.label}
                        </span>
                        <span className="text-sm font-semibold tabular-nums text-foreground">
                          {item.value}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {item.detail}
                      </p>
                    </div>
                    <Link
                      href={item.href}
                      className="inline-flex h-9 w-fit items-center justify-center gap-2 rounded-lg border border-border bg-white px-3 text-sm font-medium text-foreground transition-colors hover:bg-slate-50"
                    >
                      {item.action}
                      <ArrowRight className="size-3.5 rtl:rotate-180" />
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-5 py-12 text-center">
                <CheckCircle2 className="mx-auto mb-3 size-8 text-muted-foreground/50" />
                <p className="text-sm font-semibold text-foreground">
                  No open exceptions
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Access, campaign, payment, report, and email queues are clear.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg border border-border bg-slate-50 text-muted-foreground">
                  <CircleDollarSign className="size-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">
                    Revenue watch
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {stats.paymentExceptions > 0
                      ? `${plural(stats.paymentExceptions, "service fee")} needs finance review.`
                      : "No payment exceptions right now."}
                  </p>
                  <Link
                    href="/admin/revenue"
                    className="mt-3 inline-flex text-sm font-medium text-foreground hover:text-muted-foreground"
                  >
                    View revenue
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="flex size-9 items-center justify-center rounded-lg border border-border bg-slate-50 text-muted-foreground">
                  <BarChart3 className="size-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-foreground">
                    Reporting watch
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {stats.reportExceptions + stats.submittedEvidence > 0
                      ? stats.reviewSlaBreaches > 0
                        ? `${plural(stats.reviewSlaBreaches, "stale proof", "stale proof items")} need report command review.`
                        : `${plural(stats.reportExceptions + stats.submittedEvidence, "item")} ${verb(stats.reportExceptions + stats.submittedEvidence, "needs", "need")} report review.`
                      : "No reporting exceptions right now."}
                  </p>
                  <Link
                    href="/admin/reports"
                    className="mt-3 inline-flex text-sm font-medium text-foreground hover:text-muted-foreground"
                  >
                    View report queue
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>

          {stats.functionFailures > 0 && (
            <Card>
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className="flex size-9 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-800">
                    <AlertTriangle className="size-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-foreground">
                      Function errors
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {plural(stats.functionFailures, "backend error")} in the last 7
                      days.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
