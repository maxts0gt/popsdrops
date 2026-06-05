import { notFound } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileWarning,
  ShieldCheck,
  UploadCloud,
} from "lucide-react";
import { getUser } from "@/app/actions/auth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";
import {
  buildReportCommandCenter,
  formatReportCommandDateTime as formatDateTime,
  toneForReportCommandKind as toneForKind,
  type ReportCommandCampaignMeta as CampaignMeta,
  type ReportCommandCenter as ReportCommandCenter,
  type ReportCommandEvidenceRow as EvidenceRow,
  type ReportCommandExportJobRow as ReportExportJobRow,
  type ReportCommandTaskRow as ReportTaskRow,
} from "@/lib/admin/report-command-center";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

async function assertAdmin() {
  const user = await getUser();
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") notFound();
}

function singleRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

async function loadCampaigns(campaignIds: string[]): Promise<Map<string, CampaignMeta>> {
  const admin = createAdminClient();
  if (campaignIds.length === 0) return new Map();

  const { data, error } = await admin
    .from("campaigns")
    .select("id, title, status, brand:profiles!campaigns_brand_id_fkey(full_name)")
    .in("id", campaignIds);

  if (error) throw new Error(error.message);

  return new Map(
    ((data ?? []) as Array<{
      id: string;
      title: string | null;
      status: string | null;
      brand?: { full_name: string | null } | Array<{ full_name: string | null }> | null;
    }>).map((campaign) => {
      const brand = singleRelation(campaign.brand);
      return [
        campaign.id,
        {
          brandName: brand?.full_name ?? "Unknown brand",
          id: campaign.id,
          status: campaign.status ?? "unknown",
          title: campaign.title ?? "Unknown campaign",
        },
      ];
    }),
  );
}

async function fetchReportCommandCenter(): Promise<ReportCommandCenter> {
  const admin = createAdminClient();
  const [
    { data: taskData, error: taskError },
    { data: evidenceData, error: evidenceError },
    { data: exportData, error: exportError },
  ] = await Promise.all([
    admin
      .from("campaign_report_tasks")
      .select(
        "id, campaign_id, campaign_member_id, due_at, missed_at, review_note, status, submitted_at, updated_at",
      )
      .in("status", ["submitted", "missed", "needs_revision"])
      .order("updated_at", { ascending: false })
      .limit(80),
    admin
      .from("content_performance_evidence")
      .select(
        "id, campaign_id, campaign_member_id, report_task_id, file_name, verification_status, review_note, created_at",
      )
      .in("verification_status", ["submitted", "rejected", "verified"])
      .order("created_at", { ascending: false })
      .limit(80),
    admin
      .from("report_export_jobs")
      .select("id, campaign_id, format, status, file_name, error_message, created_at")
      .eq("status", "failed")
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  if (taskError) throw new Error(taskError.message);
  if (evidenceError) throw new Error(evidenceError.message);
  if (exportError) throw new Error(exportError.message);

  const tasks = (taskData ?? []) as ReportTaskRow[];
  const evidenceRows = (evidenceData ?? []) as EvidenceRow[];
  const exportRows = (exportData ?? []) as ReportExportJobRow[];
  const campaignIds = Array.from(
    new Set([
      ...tasks.map((row) => row.campaign_id),
      ...evidenceRows.map((row) => row.campaign_id),
      ...exportRows.map((row) => row.campaign_id),
    ]),
  );
  const campaignMap = await loadCampaigns(campaignIds);

  return buildReportCommandCenter({
    campaigns: campaignMap,
    evidenceRows,
    exportRows,
    tasks,
  });
}

function SummaryCard({
  detail,
  icon: Icon,
  label,
  value,
  valueTestId,
}: {
  detail: string;
  icon: typeof ShieldCheck;
  label: string;
  value: number;
  valueTestId?: string;
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p
              data-testid={valueTestId}
              className="mt-2 text-2xl font-semibold tabular-nums text-slate-800"
            >
              {value}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
          </div>
          <div className="flex size-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-600">
            <Icon className="size-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default async function AdminReportsPage() {
  await assertAdmin();
  const command = await fetchReportCommandCenter();
  const priorityException = command.rows[0] ?? null;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            Proof room exceptions
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">
            Report command center
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Evidence review, missed report tasks, correction requests, and failed
            exports before they reach leadership.
          </p>
        </div>
        <LinkButton href="/admin/campaigns" variant="outline" size="sm">
          Open campaign queue
        </LinkButton>
      </div>

      <div
        data-testid="admin-report-priority-rail"
        className="overflow-hidden rounded-xl border border-slate-900 bg-slate-950 text-white shadow-sm"
      >
        <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              Priority intervention
            </p>
            {priorityException ? (
              <>
                <div className="mt-3 flex min-w-0 flex-wrap items-center gap-2">
                  <span
                    data-testid="admin-report-priority-kind"
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${toneForKind(priorityException.kind)}`}
                  >
                    {priorityException.label}
                  </span>
                  <p
                    data-testid="admin-report-priority-title"
                    className="truncate text-lg font-semibold leading-tight text-white"
                  >
                    {priorityException.title}
                  </p>
                </div>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                  {priorityException.detail}
                </p>
                <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1.45fr)]">
                  <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Leadership impact
                    </p>
                    <p
                      data-testid="admin-report-priority-impact"
                      className="mt-1 text-xs leading-5 text-slate-200"
                    >
                      {priorityException.impact}
                    </p>
                  </div>
                  <div
                    data-testid="admin-report-priority-share-gate-panel"
                    className="rounded-xl border border-white/15 bg-white/[0.07] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Leadership share gate
                    </p>
                    <p
                      data-testid="admin-report-priority-share-gate"
                      className="mt-1 text-sm font-medium leading-6 text-white"
                    >
                      {priorityException.shareGate}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">
                      Keep the report out of leadership handoff until this gate clears.
                    </p>
                  </div>
                </div>
                <div
                  data-testid="admin-report-priority-operations"
                  className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4"
                >
                  <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Waiting
                    </p>
                    <p
                      data-testid="admin-report-priority-age"
                      className="mt-1 text-xs leading-5 text-slate-200"
                    >
                      {priorityException.waitingLabel}
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Next move
                    </p>
                    <p
                      data-testid="admin-report-priority-next-step"
                      className="mt-1 text-xs leading-5 text-slate-200"
                    >
                      {priorityException.nextStep}
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Escalation owner
                    </p>
                    <p
                      data-testid="admin-report-priority-owner"
                      className="mt-1 text-xs leading-5 text-slate-200"
                    >
                      {priorityException.owner}
                    </p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Clears when
                    </p>
                    <p
                      data-testid="admin-report-priority-clearance"
                      className="mt-1 text-xs leading-5 text-slate-200"
                    >
                      {priorityException.clearance}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-xs text-slate-400">
                  {priorityException.campaign.title} /{" "}
                  {priorityException.campaign.brandName} /{" "}
                  {formatDateTime(priorityException.createdAt)}
                </p>
              </>
            ) : (
              <>
                <p
                  data-testid="admin-report-priority-title"
                  className="mt-3 text-lg font-semibold leading-tight text-white"
                >
                  No open report exceptions
                </p>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
                  Evidence review, missed-task, correction, and export queues are clear.
                </p>
              </>
            )}
          </div>
          <div className="grid gap-2 sm:grid-cols-3 lg:w-[360px]">
            <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
              <p className="text-[11px] font-medium text-slate-400">Open</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-white">
                {command.rows.length}
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
              <p className="text-[11px] font-medium text-slate-400">SLA</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-white">
                {command.reviewSlaBreachCount}
              </p>
            </div>
            <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
              <p className="text-[11px] font-medium text-slate-400">Exports</p>
              <p className="mt-1 text-xl font-semibold tabular-nums text-white">
                {command.exportFailureCount}
              </p>
            </div>
          </div>
          {priorityException ? (
            <div className="lg:col-start-2 lg:flex lg:justify-end">
              <LinkButton
                href={priorityException.actionHref}
                variant="secondary"
                size="sm"
              >
                {priorityException.actionLabel}
              </LinkButton>
            </div>
          ) : null}
        </div>
      </div>

      <div
        data-testid="admin-report-command-summary"
        className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6"
      >
        <SummaryCard
          detail="Creator proof submitted, brand review pending"
          icon={UploadCloud}
          label="Needs brand review"
          value={command.evidenceReviewCount}
        />
        <SummaryCard
          detail="Submitted report tasks with no proof attached"
          icon={FileWarning}
          label="Missing proof"
          value={command.missingEvidenceCount}
        />
        <SummaryCard
          detail="Creator reads missed their reporting window"
          icon={Clock}
          label="Missed reports"
          value={command.missedCount}
        />
        <SummaryCard
          detail="Rejected evidence or correction tasks still open"
          icon={FileWarning}
          label="Correction requests"
          value={command.correctionCount}
        />
        <SummaryCard
          detail="Submitted proof waiting more than 24 hours"
          icon={Clock}
          label="SLA breaches"
          value={command.reviewSlaBreachCount}
          valueTestId="admin-report-sla-breach-count"
        />
        <SummaryCard
          detail="Report artifacts that failed to generate"
          icon={AlertTriangle}
          label="Export failures"
          value={command.exportFailureCount}
        />
      </div>

      <Card data-testid="admin-report-campaign-readiness">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Campaign leadership readiness</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Campaigns held from leadership sharing, grouped by top proof-room
                blocker.
              </p>
            </div>
            <Badge
              data-testid="admin-report-campaign-readiness-count"
              variant="secondary"
              className="shrink-0"
            >
              {command.campaignHoldCount} on hold
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {command.campaignReadiness.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 px-4 py-8 text-center">
              <CheckCircle2 className="mx-auto size-7 text-slate-400" />
              <p className="mt-3 text-sm font-semibold text-slate-900">
                Every campaign is leadership-shareable
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                No report blockers are holding executive handoff.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border rounded-lg border border-border">
              {command.campaignReadiness.map((row) => (
                <div
                  key={row.campaign.id}
                  data-testid="admin-report-campaign-readiness-row"
                  className="grid gap-3 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(11rem,0.35fr)_auto] lg:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span
                        data-testid="admin-report-campaign-readiness-status"
                        className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-700"
                      >
                        {row.leadershipStatus}
                      </span>
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {row.campaign.title}
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {row.campaign.brandName} / {row.campaign.status} /{" "}
                      {row.blockerCount} blocker{row.blockerCount === 1 ? "" : "s"}
                    </p>
                    <p
                      data-testid="admin-report-campaign-readiness-primary"
                      className="mt-2 text-sm text-slate-700"
                    >
                      {row.summary}
                    </p>
                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                      <p
                        data-testid="admin-report-campaign-readiness-share-gate"
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-slate-600"
                      >
                        <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Leadership share gate
                        </span>
                        {row.shareGate}
                      </p>
                      <p
                        data-testid="admin-report-campaign-readiness-clearance"
                        className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600"
                      >
                        <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Clears when
                        </span>
                        {row.clearance}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                      Top gate
                    </p>
                    <p className="mt-1 text-sm font-semibold text-slate-900">
                      {row.primaryLabel}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {row.waitingLabel}
                    </p>
                  </div>
                  <LinkButton href={row.actionHref} variant="outline" size="sm">
                    {row.actionLabel}
                  </LinkButton>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>Proof room exceptions</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Sorted by newest operational risk. Every row drills into the
                exact campaign reporting blocker.
              </p>
            </div>
            <Badge variant="secondary" className="shrink-0">
              {command.rows.length} open
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {command.rows.length === 0 ? (
            <div
              data-testid="admin-report-empty-state"
              className="rounded-lg border border-dashed border-slate-200 px-4 py-10 text-center"
            >
              <CheckCircle2 className="mx-auto size-7 text-slate-400" />
              <p className="mt-3 text-sm font-semibold text-slate-900">
                No open report exceptions
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Evidence review, correction, missed-task, and export queues are clear.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border rounded-lg border border-border">
              {command.rows.map((row) => (
                <div
                  key={row.id}
                  data-testid="admin-report-exception-row"
                  className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${toneForKind(row.kind)}`}
                      >
                        {row.label}
                      </span>
                      <p className="truncate text-sm font-semibold text-slate-900">
                        {row.title}
                      </p>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {row.detail}
                    </p>
                    <div
                      data-testid="admin-report-exception-decision-grid"
                      className="mt-3 grid gap-2 lg:grid-cols-2"
                    >
                      <p
                        data-testid="admin-report-exception-impact"
                        className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600"
                      >
                        <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Leadership impact
                        </span>
                        {row.impact}
                      </p>
                      <p
                        data-testid="admin-report-exception-share-gate"
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-slate-600"
                      >
                        <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Leadership share gate
                        </span>
                        {row.shareGate}
                      </p>
                    </div>
                    <div
                      data-testid="admin-report-exception-operations-grid"
                      className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4"
                    >
                      <p
                        data-testid="admin-report-exception-age"
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-slate-600"
                      >
                        <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Waiting
                        </span>
                        {row.waitingLabel}
                      </p>
                      <p
                        data-testid="admin-report-exception-next-step"
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-slate-600"
                      >
                        <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Next move
                        </span>
                        {row.nextStep}
                      </p>
                      <p
                        data-testid="admin-report-exception-owner"
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-slate-600"
                      >
                        <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Escalation owner
                        </span>
                        {row.owner}
                      </p>
                      <p
                        data-testid="admin-report-exception-clearance"
                        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs leading-5 text-slate-600"
                      >
                        <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                          Clears when
                        </span>
                        {row.clearance}
                      </p>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {row.campaign.title} / {row.campaign.brandName} /{" "}
                      {formatDateTime(row.createdAt)}
                    </p>
                  </div>
                  <LinkButton href={row.actionHref} variant="outline" size="sm">
                    {row.actionLabel}
                  </LinkButton>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
