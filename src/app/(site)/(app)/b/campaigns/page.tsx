"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BriefcaseBusiness,
  CheckCircle2,
  FileCheck2,
  Plus,
  Users,
  Megaphone,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { LinkButton } from "@/components/ui/link-button";
import { PlatformIcon } from "@/components/platform-icons";
import {
  CAMPAIGN_STATUS_COLORS,
  CAMPAIGN_STATUS_LABELS,
  PLATFORM_LABELS,
  getMarketLabel,
  getPlatformLabel,
} from "@/lib/constants";
import { getBrandCampaignListHref } from "@/lib/campaigns/brand-campaign-links";
import { useI18n, useTranslation } from "@/lib/i18n";
import { hasBrandWorkspacePermission } from "@/lib/brand-permissions";
import type { CampaignStatus, Platform } from "@/lib/constants";
import {
  getBrandTeamSettings,
  type BrandTeamMember,
} from "@/app/actions/brand-team";
import { createClient, getBrowserUser } from "@/lib/supabase/client";
import { buildCampaignReportHealth } from "@/lib/reporting/campaign-list-report-health";
import type {
  CampaignResponsibilityKind,
  PerformanceEvidenceVerificationStatus,
  PerformanceVerificationStatus,
  PaymentStatusType,
} from "@/types/database";

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
  service_fee_cents: number | null;
  service_fee_currency: string | null;
  service_fee_status: PaymentStatusType;
  service_package_snapshot: Record<string, unknown> | null;
  created_at: string;
  reportHealth: CampaignReportHealth;
  responsibilities: CampaignResponsibilitySummary[];
}

interface CampaignReportHealth {
  missed: number;
  corrections: number;
  toReview: number;
}

interface EnterpriseConciergeRequest {
  id: string;
  campaign_title: string;
  campaign_mode: "private" | "sourced";
  status: "requested" | "reviewing" | "quoted" | "closed";
  requested_creator_count: number;
  market_count: number;
  markets: string[];
  platforms: string[];
  quoted_service_fee_cents: number | null;
  quoted_service_fee_currency: string;
  quote_note: string | null;
  quoted_at: string | null;
  created_at: string;
  reviewed_at: string | null;
}

interface ReportTaskHealthRow {
  id: string;
  campaign_id: string;
  status: string;
}

interface EvidenceHealthRow {
  id: string;
  campaign_id: string;
  campaign_member_id: string;
  created_at: string | null;
  performance_id: string | null;
  report_task_id: string;
  submission_id: string | null;
  verification_status: PerformanceEvidenceVerificationStatus;
}

interface PerformanceHealthRow {
  id: string;
  campaign_id: string;
  created_at: string | null;
  report_task_id: string | null;
  reported_at: string | null;
  screenshot_url: string | null;
  submission_id: string | null;
  verification_status: PerformanceVerificationStatus | null;
}

interface CampaignResponsibilityAssignmentRow {
  id: string;
  campaign_id: string;
  brand_team_member_id: string;
  responsibility: CampaignResponsibilityKind;
}

interface CampaignResponsibilitySummary {
  kind: CampaignResponsibilityKind;
  labelKey: string;
  assigneeName: string | null;
  brandTeamMemberId: string | null;
  assigned: boolean;
}

type CampaignWorkFilter = "all" | "mine" | "needs_owner";

const campaignResponsibilityKinds: CampaignResponsibilityKind[] = [
  "owner",
  "approvals",
  "reporting",
  "billing",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(amount: number | null, locale = "en"): string {
  if (!amount) return "-";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatCurrencyCents(
  cents: number | null,
  locale = "en",
  currency = "usd",
): string {
  if (cents === null) return "-";
  return new Intl.NumberFormat(locale, {
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0,
    style: "currency",
  }).format(cents / 100);
}

function formatDate(dateStr: string, locale = "en"): string {
  return new Date(dateStr).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getSnapshotNumber(
  snapshot: Record<string, unknown> | null | undefined,
  key: string,
  fallback: number | null = null,
) {
  const value = snapshot?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function getCampaignServiceFeeBalanceDueCents(campaign: Campaign) {
  const balanceDueCents = getSnapshotNumber(
    campaign.service_package_snapshot,
    "balanceDueCents",
  );

  if (balanceDueCents !== null) return Math.max(0, balanceDueCents);
  if (campaign.service_fee_status === "paid") return 0;

  return Math.max(0, campaign.service_fee_cents ?? 0);
}

function getCampaignResponsibilityLabelKey(
  kind: CampaignResponsibilityKind,
) {
  if (kind === "owner") return "responsibility.owner";
  if (kind === "approvals") return "responsibility.approvals";
  if (kind === "reporting") return "responsibility.reporting";
  return "responsibility.billing";
}

function buildCampaignResponsibilitySummaries({
  assignments,
  teamMembersById,
}: {
  assignments: CampaignResponsibilityAssignmentRow[];
  teamMembersById: Map<string, BrandTeamMember>;
}): CampaignResponsibilitySummary[] {
  const assignmentsByKind = new Map(
    assignments.map((assignment) => [assignment.responsibility, assignment]),
  );

  return campaignResponsibilityKinds.map((kind) => {
    const assignment = assignmentsByKind.get(kind);
    const teamMember = assignment
      ? teamMembersById.get(assignment.brand_team_member_id)
      : undefined;

    return {
      kind,
      labelKey: getCampaignResponsibilityLabelKey(kind),
      assigneeName: teamMember?.name ?? null,
      brandTeamMemberId: teamMember?.id ?? null,
      assigned: Boolean(teamMember),
    };
  });
}

function buildCampaignResponsibilitySummariesByCampaign({
  campaignIds,
  responsibilityRows,
  teamMembersById,
}: {
  campaignIds: string[];
  responsibilityRows: CampaignResponsibilityAssignmentRow[];
  teamMembersById: Map<string, BrandTeamMember>;
}): Map<string, CampaignResponsibilitySummary[]> {
  const rowsByCampaignId = new Map<
    string,
    CampaignResponsibilityAssignmentRow[]
  >();

  for (const row of responsibilityRows) {
    const rows = rowsByCampaignId.get(row.campaign_id) ?? [];
    rows.push(row);
    rowsByCampaignId.set(row.campaign_id, rows);
  }

  return new Map(
    campaignIds.map((campaignId) => [
      campaignId,
      buildCampaignResponsibilitySummaries({
        assignments: rowsByCampaignId.get(campaignId) ?? [],
        teamMembersById,
      }),
    ]),
  );
}

function normalizeConciergeStatus(
  status: string,
): EnterpriseConciergeRequest["status"] {
  if (
    status === "requested" ||
    status === "reviewing" ||
    status === "quoted" ||
    status === "closed"
  ) {
    return status;
  }

  return "requested";
}

function formatList(
  values: string[],
  formatter: (value: string) => string,
  emptyLabel: string,
) {
  if (values.length === 0) return emptyLabel;
  const visible = values.slice(0, 3).map(formatter);
  const extraCount = values.length - visible.length;
  return extraCount > 0 ? `${visible.join(", ")} +${extraCount}` : visible.join(", ");
}

function conciergeStatusClass(status: EnterpriseConciergeRequest["status"]) {
  if (status === "requested") return "border-amber-200 bg-amber-50 text-amber-700";
  if (status === "reviewing") return "border-blue-200 bg-blue-50 text-blue-700";
  if (status === "quoted") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  return "border-border bg-white text-muted-foreground";
}

function getConciergeStatusLabel(
  status: EnterpriseConciergeRequest["status"],
  t: (key: string, vars?: Record<string, string>) => string,
) {
  if (status === "requested") return t("concierge.status.requested");
  if (status === "reviewing") return t("concierge.status.reviewing");
  if (status === "quoted") return t("concierge.status.quoted");
  return t("concierge.status.closed");
}

function getConciergeRequestTypeLabel(
  request: EnterpriseConciergeRequest,
  t: (key: string, vars?: Record<string, string>) => string,
) {
  return request.campaign_mode === "private"
    ? t("concierge.type.privateCapacity")
    : t("concierge.type.sourcing");
}

function getReportHealthTotal(reportHealth: CampaignReportHealth) {
  return reportHealth.missed + reportHealth.corrections + reportHealth.toReview;
}

function isActiveCampaign(status: CampaignStatus) {
  return status === "in_progress" || status === "publishing" || status === "monitoring";
}

function isCampaignServiceFeeUnpaid(campaign: Campaign) {
  const serviceFeeRequired = (campaign.service_fee_cents ?? 0) > 0;
  const balanceDueCents = getCampaignServiceFeeBalanceDueCents(campaign);
  if (balanceDueCents > 0) return serviceFeeRequired;

  return serviceFeeRequired && campaign.service_fee_status !== "paid";
}

function getCampaignOperationalPriority(campaign: Campaign) {
  const reportHealth = campaign.reportHealth;

  if (reportHealth.corrections > 0) return 0;
  if (reportHealth.toReview > 0) return 1;
  if (reportHealth.missed > 0) return 2;
  if (isCampaignServiceFeeUnpaid(campaign)) return 3;
  if (campaign.status === "draft") return 4;
  if (isActiveCampaign(campaign.status)) return 5;
  if (campaign.status === "recruiting") return 6;
  if (campaign.status === "completed") return 7;

  return 8;
}

function campaignNeedsAttention(campaign: Campaign) {
  return (
    getReportHealthTotal(campaign.reportHealth) > 0 ||
    isCampaignServiceFeeUnpaid(campaign)
  );
}

function campaignHasAssignedResponsibility(campaign: Campaign) {
  return campaign.responsibilities.some((responsibility) => responsibility.assigned);
}

function campaignHasResponsibilityForMember(
  campaign: Campaign,
  brandTeamMemberId: string | null,
) {
  if (!brandTeamMemberId) return false;
  return campaign.responsibilities.some(
    (responsibility) =>
      responsibility.brandTeamMemberId === brandTeamMemberId,
  );
}

function filterCampaignsByWork({
  campaigns,
  currentBrandTeamMemberId,
  workFilter,
}: {
  campaigns: Campaign[];
  currentBrandTeamMemberId: string | null;
  workFilter: CampaignWorkFilter;
}) {
  if (workFilter === "mine") {
    return campaigns.filter((campaign) =>
      campaignHasResponsibilityForMember(campaign, currentBrandTeamMemberId),
    );
  }

  if (workFilter === "needs_owner") {
    return campaigns.filter((campaign) => !campaignHasAssignedResponsibility(campaign));
  }

  return campaigns;
}

function sortCampaignsForOperations(campaigns: Campaign[]) {
  return [...campaigns].sort((first, second) => {
    const priorityDelta =
      getCampaignOperationalPriority(first) -
      getCampaignOperationalPriority(second);

    if (priorityDelta !== 0) return priorityDelta;

    return (
      new Date(second.created_at).getTime() -
      new Date(first.created_at).getTime()
    );
  });
}

function getCampaignNextAction(
  campaign: Campaign,
  t: (key: string, vars?: Record<string, string>) => string,
  locale = "en",
) {
  const reportHealth = campaign.reportHealth;

  if (reportHealth.corrections > 0) {
    return {
      detail: t("nextAction.reviewCorrections.detail"),
      label: t("nextAction.reviewCorrections"),
    };
  }

  if (reportHealth.toReview > 0) {
    return {
      detail: t("nextAction.reviewReports.detail"),
      label: t("nextAction.reviewReports"),
    };
  }

  if (reportHealth.missed > 0) {
    return {
      detail: t("nextAction.missedReports.detail"),
      label: t("nextAction.missedReports"),
    };
  }

  if (campaign.status === "draft") {
    return {
      detail: t("nextAction.finishSetup.detail"),
      label: t("nextAction.finishSetup"),
    };
  }

  if (isCampaignServiceFeeUnpaid(campaign)) {
    const balanceDueCents = getCampaignServiceFeeBalanceDueCents(campaign);
    const balanceDueDisplay = formatCurrencyCents(
      balanceDueCents,
      locale,
      campaign.service_fee_currency ?? "usd",
    );

    return {
      detail: t("nextAction.payFee.detailAmount", { amount: balanceDueDisplay }),
      label: t("nextAction.payFee"),
    };
  }

  if (campaign.status === "recruiting") {
    return {
      detail: t("nextAction.inviteCreators.detail"),
      label: t("nextAction.inviteCreators"),
    };
  }

  if (campaign.status === "completed") {
    return {
      detail: t("nextAction.viewReport.detail"),
      label: t("nextAction.viewReport"),
    };
  }

  return {
    detail: t("nextAction.monitor.detail"),
    label: t("nextAction.monitor"),
  };
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CampaignOperationsSummary({
  campaigns,
  t,
}: {
  campaigns: Campaign[];
  t: (key: string, vars?: Record<string, string>) => string;
}) {
  const needsAttention = campaigns.filter(campaignNeedsAttention).length;
  const active = campaigns.filter((campaign) => isActiveCampaign(campaign.status)).length;
  const recruiting = campaigns.filter((campaign) => campaign.status === "recruiting").length;
  const completed = campaigns.filter((campaign) => campaign.status === "completed").length;

  return (
    <section
      data-testid="campaign-operations-summary"
      className="mb-5 overflow-hidden rounded-xl border border-border bg-white shadow-sm"
    >
      <div className="grid divide-y divide-border sm:grid-cols-4 sm:divide-x sm:divide-y-0">
        {[
          {
            detail: needsAttention > 0 ? t("summary.needsAttention.detail") : t("summary.clear.detail"),
            icon: needsAttention > 0 ? AlertTriangle : CheckCircle2,
            label: t("summary.needsAttention"),
            value: String(needsAttention),
          },
          {
            detail: t("summary.active.detail"),
            icon: Megaphone,
            label: t("summary.active"),
            value: String(active),
          },
          {
            detail: t("summary.recruiting.detail"),
            icon: Users,
            label: t("summary.recruiting"),
            value: String(recruiting),
          },
          {
            detail: t("summary.completed.detail"),
            icon: FileCheck2,
            label: t("summary.completed"),
            value: String(completed),
          },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-3 px-4 py-4">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <item.icon className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">{item.label}</p>
              <div className="mt-1 flex items-baseline gap-2">
                <p className="text-2xl font-semibold tabular-nums text-foreground">
                  {item.value}
                </p>
                <p className="truncate text-xs text-muted-foreground">{item.detail}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function CampaignWorkFilterBar({
  activeFilter,
  allCount,
  myWorkCount,
  ownerlessCount,
  onChange,
  t,
}: {
  activeFilter: CampaignWorkFilter;
  allCount: number;
  myWorkCount: number;
  ownerlessCount: number;
  onChange: (filter: CampaignWorkFilter) => void;
  t: (key: string, vars?: Record<string, string>) => string;
}) {
  const filters: Array<{
    count: number;
    label: string;
    testId: string;
    value: CampaignWorkFilter;
  }> = [
    {
      count: allCount,
      label: t("workFilter.all"),
      testId: "campaign-work-filter-all",
      value: "all",
    },
    {
      count: myWorkCount,
      label: t("workFilter.mine"),
      testId: "campaign-work-filter-mine",
      value: "mine",
    },
    {
      count: ownerlessCount,
      label: t("workFilter.needsOwner"),
      testId: "campaign-work-filter-needs-owner",
      value: "needs_owner",
    },
  ];

  return (
    <div
      data-testid="campaign-work-filter"
      className="mb-4 flex flex-wrap items-center gap-2"
    >
      {filters.map((filter) => {
        const active = activeFilter === filter.value;

        return (
          <button
            key={filter.value}
            type="button"
            data-testid={filter.testId}
            aria-pressed={active}
            onClick={() => onChange(filter.value)}
            className={`inline-flex h-8 items-center gap-1 rounded-lg border px-3 text-xs font-semibold transition-colors ${
              active
                ? "border-slate-300 bg-slate-100 text-slate-950 shadow-sm"
                : "border-border bg-white text-muted-foreground hover:border-slate-300 hover:bg-slate-50 hover:text-foreground"
            }`}
          >
            <span>{filter.label}</span>
            <span className={active ? "text-slate-600" : "text-muted-foreground"}>
              {filter.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function CampaignRow({
  campaign,
  t,
  locale,
}: {
  campaign: Campaign;
  t: (key: string, vars?: Record<string, string>) => string;
  locale: string;
}) {
  const reportHealth = campaign.reportHealth ?? {
    missed: 0,
    corrections: 0,
    toReview: 0,
  };
  const balanceDueCents = getCampaignServiceFeeBalanceDueCents(campaign);
  const balanceDueDisplay = formatCurrencyCents(
    balanceDueCents,
    locale,
    campaign.service_fee_currency ?? "usd",
  );
  const serviceFeeUnpaid = isCampaignServiceFeeUnpaid(campaign);
  const hasHealthSignals =
    serviceFeeUnpaid ||
    reportHealth.missed > 0 ||
    reportHealth.corrections > 0 ||
    reportHealth.toReview > 0;
  const nextAction = getCampaignNextAction(campaign, t, locale);
  const campaignHref = getBrandCampaignListHref({
    id: campaign.id,
    reportHealth,
  });
  const marketLabel = formatList(
    campaign.markets,
    (market) => getMarketLabel(market, locale),
    t("label.global"),
  );
  const visibleResponsibilities = campaign.responsibilities.filter(
    (responsibility) => responsibility.assigned,
  );
  const responsibilityChips = visibleResponsibilities.length > 0
    ? visibleResponsibilities
    : [
        {
          kind: "owner" as CampaignResponsibilityKind,
          labelKey: "responsibility.noneAssigned",
          assigneeName: null,
          brandTeamMemberId: null,
          assigned: false,
        },
      ];
  const emptyResponsibilityLabel = t("responsibility.noneAssigned");

  return (
    <Link
      data-testid="campaign-row"
      href={campaignHref}
      className="group grid gap-4 rounded-xl border border-border bg-white p-4 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50/60 lg:grid-cols-[minmax(0,1.5fr)_minmax(10rem,0.8fr)_minmax(8rem,0.6fr)_auto]"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate font-semibold text-foreground">{campaign.title}</h3>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${CAMPAIGN_STATUS_COLORS[campaign.status]}`}
          >
            {CAMPAIGN_STATUS_LABELS[campaign.status]}
          </span>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {campaign.platforms.map((p) => {
            const Icon = PlatformIcon[p];
            return (
              <span
                key={p}
                className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
              >
                <Icon className="size-3" />
                {PLATFORM_LABELS[p]}
              </span>
            );
          })}
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {marketLabel}
          </span>
        </div>

        {hasHealthSignals && (
          <div
            data-testid="campaign-health-signals"
            className="mt-2 flex flex-wrap gap-1.5"
          >
            {serviceFeeUnpaid && (
              <span
                data-testid="campaign-payment-required"
                className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-900"
              >
                <span data-testid="campaign-payment-balance-due">
                  {t("health.balanceDue", { amount: balanceDueDisplay })}
                </span>
              </span>
            )}
            {reportHealth.missed > 0 && (
              <span
                data-testid="campaign-health-missed"
                className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700"
              >
                {t("health.missed", {
                  count: String(reportHealth.missed),
                })}
              </span>
            )}
            {reportHealth.corrections > 0 && (
              <span
                data-testid="campaign-health-corrections"
                className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700"
              >
                {t("health.corrections", {
                  count: String(reportHealth.corrections),
                })}
              </span>
            )}
            {reportHealth.toReview > 0 && (
              <span
                data-testid="campaign-health-review"
                className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-900"
              >
                {t("health.toReview", {
                  count: String(reportHealth.toReview),
                })}
              </span>
            )}
          </div>
        )}

        <div
          data-testid="campaign-list-responsibilities"
          className="mt-2 flex flex-wrap items-center gap-1.5"
        >
          <span className="me-0.5 text-[11px] font-medium text-muted-foreground">
            {t("responsibility.title")}
          </span>
          {responsibilityChips.map((responsibility) => {
            const assignee =
              responsibility.assigneeName ?? t("responsibility.unassigned");
            const label = responsibility.assigned
              ? t(responsibility.labelKey)
              : emptyResponsibilityLabel;

            return (
              <span
                key={responsibility.kind}
                data-testid={`campaign-list-responsibility-${responsibility.kind}`}
                className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${
                  responsibility.assigned
                    ? "border-slate-200 bg-slate-50 text-slate-700"
                    : "border-dashed border-slate-200 bg-white text-muted-foreground"
                }`}
                title={responsibility.assigned ? `${label}: ${assignee}` : label}
              >
                <span className="font-medium text-foreground">
                  {label}
                </span>
                {responsibility.assigned && (
                  <span className="truncate">{assignee}</span>
                )}
              </span>
            );
          })}
        </div>
      </div>

      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{t("label.nextAction")}</p>
        <p className="mt-1 text-sm font-semibold text-foreground">{nextAction.label}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{nextAction.detail}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm lg:grid-cols-1">
        <div>
          <p className="text-xs font-medium text-muted-foreground">{t("label.creators")}</p>
          <p className="mt-1 font-semibold tabular-nums text-foreground">
            {campaign.max_creators}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted-foreground">{t("label.budget")}</p>
          <p className="mt-1 font-semibold tabular-nums text-foreground">
            {formatCurrency(campaign.budget_max, locale)}
          </p>
        </div>
      </div>

      <div className="flex items-end justify-between gap-4 lg:flex-col lg:items-end lg:justify-center">
        <p className="text-xs text-muted-foreground tabular-nums">
          {formatDate(campaign.created_at, locale)}
        </p>
        <span
          data-testid="campaign-row-action-label"
          className="inline-flex items-center rounded-lg border border-border bg-white px-3 py-1.5 text-sm font-semibold text-foreground shadow-sm transition-colors group-hover:border-slate-300"
        >
          {nextAction.label}
        </span>
      </div>
    </Link>
  );
}

function CampaignList({
  canCreateCampaigns,
  items,
  t,
  locale,
}: {
  canCreateCampaigns: boolean;
  items: Campaign[];
  t: (key: string, vars?: Record<string, string>) => string;
  locale: string;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-white px-5 py-12 text-center">
        <Megaphone className="mx-auto mb-3 size-8 text-muted-foreground/50" />
        <p className="text-sm font-medium text-foreground">{t("empty.noCampaigns")}</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          {t("empty.noCampaigns.detail")}
        </p>
        {canCreateCampaigns && (
          <LinkButton
            href="/b/campaigns/new"
            variant="outline"
            size="sm"
            data-testid="campaign-create-action"
            className="mt-4"
          >
            <Plus className="size-3.5" /> {t("action.create")}
          </LinkButton>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {items.map((c) => (
        <CampaignRow key={c.id} campaign={c} t={t} locale={locale} />
      ))}
    </div>
  );
}

function EnterpriseConciergeRequestsPanel({
  locale,
  requests,
  t,
}: {
  locale: string;
  requests: EnterpriseConciergeRequest[];
  t: (key: string, vars?: Record<string, string>) => string;
}) {
  if (requests.length === 0) return null;

  return (
    <section
      id="enterprise-concierge-requests"
      data-testid="enterprise-concierge-requests"
      className="mb-6 rounded-xl border border-border bg-white shadow-sm"
    >
      <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <BriefcaseBusiness className="size-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">
              {t("concierge.title")}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("concierge.detail")}
            </p>
          </div>
        </div>
      </div>

      <div className="divide-y divide-border">
        {requests.map((request) => {
          const quoteAmount = formatCurrencyCents(
            request.quoted_service_fee_cents,
            locale,
            request.quoted_service_fee_currency,
          );
          const showQuote = request.quoted_service_fee_cents !== null;

          return (
            <div
              key={request.id}
              className="grid gap-3 px-4 py-3 lg:grid-cols-[minmax(0,1fr)_auto]"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {request.campaign_title}
                  </p>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${conciergeStatusClass(request.status)}`}
                  >
                    {getConciergeStatusLabel(request.status, t)}
                  </span>
                  <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {getConciergeRequestTypeLabel(request, t)}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>
                    {t("concierge.scope", {
                      creators: request.requested_creator_count.toLocaleString(locale),
                      markets: request.market_count.toLocaleString(locale),
                    })}
                  </span>
                  <span>
                    {formatList(
                      request.platforms,
                      getPlatformLabel,
                      t("concierge.none"),
                    )}
                  </span>
                  <span>
                    {formatList(
                      request.markets,
                      (market) => getMarketLabel(market, locale),
                      t("concierge.global"),
                    )}
                  </span>
                </div>
              </div>

              <div className="flex items-end justify-between gap-4 lg:flex-col lg:items-end lg:justify-center">
                {showQuote ? (
                  <div className="text-start lg:text-end">
                    <p className="text-[11px] font-medium uppercase text-muted-foreground">
                      {t("concierge.quote")}
                    </p>
                    <p className="text-sm font-semibold tabular-nums text-foreground">
                      {quoteAmount}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {formatDate(request.created_at, locale)}
                  </p>
                )}
              </div>

              {request.quote_note && (
                <p className="text-xs text-muted-foreground lg:col-span-2">
                  {request.quote_note}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BrandCampaignsPage() {
  const { t } = useTranslation("brand.campaigns");
  const { locale } = useI18n();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [conciergeRequests, setConciergeRequests] = useState<
    EnterpriseConciergeRequest[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [canCreateCampaigns, setCanCreateCampaigns] = useState(false);
  const [workFilter, setWorkFilter] = useState<CampaignWorkFilter>("all");
  const [currentBrandTeamMemberId, setCurrentBrandTeamMemberId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await getBrowserUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const teamSettings = await getBrandTeamSettings();
      const teamMembersById = new Map(
        teamSettings.members.map((member) => [member.id, member]),
      );
      const currentTeamMember = teamSettings.members.find(
        (member) => member.userId === teamSettings.currentUserId,
      );
      setCurrentBrandTeamMemberId(currentTeamMember?.id ?? null);
      setCanCreateCampaigns(
        hasBrandWorkspacePermission(
          teamSettings.currentUserRole,
          "create_campaigns",
        ),
      );
      const { data } = await supabase
        .from("campaigns")
        .select("id, title, status, platforms, markets, max_creators, budget_max, service_fee_cents, service_fee_currency, service_fee_status, service_package_snapshot, created_at")
        .eq("brand_id", teamSettings.workspaceBrandId)
        .order("created_at", { ascending: false });

      const { data: conciergeData } = await supabase
        .from("enterprise_concierge_requests")
        .select(
          "id, campaign_title, campaign_mode, status, requested_creator_count, market_count, markets, platforms, quoted_service_fee_cents, quoted_service_fee_currency, quote_note, quoted_at, created_at, reviewed_at",
        )
        .eq("brand_id", teamSettings.workspaceBrandId)
        .neq("status", "closed")
        .order("created_at", { ascending: false });

      if (conciergeData) {
        setConciergeRequests(
          conciergeData.map((request) => ({
            ...request,
            status: normalizeConciergeStatus(request.status),
            markets: request.markets || [],
            platforms: request.platforms || [],
          })),
        );
      }

      if (data) {
        const campaignIds = data.map((campaign) => campaign.id);
        let healthByCampaignId = new Map<string, CampaignReportHealth>();
        let responsibilitiesByCampaignId = new Map<
          string,
          CampaignResponsibilitySummary[]
        >();

        if (campaignIds.length > 0) {
          const [
            { data: reportTasks },
            { data: evidenceRows },
            { data: responsibilityRows },
          ] = await Promise.all([
            supabase
              .from("campaign_report_tasks")
              .select("id, campaign_id, status")
              .in("campaign_id", campaignIds),
            supabase
              .from("content_performance_evidence")
              .select("id, campaign_id, campaign_member_id, report_task_id, submission_id, performance_id, verification_status, created_at")
              .in("campaign_id", campaignIds),
            supabase
              .from("campaign_responsibility_assignments")
              .select("id, campaign_id, brand_team_member_id, responsibility")
              .in("campaign_id", campaignIds),
          ]);
          const reportTaskRows = (reportTasks ?? []) as ReportTaskHealthRow[];
          const campaignIdByReportTaskId = new Map(
            reportTaskRows.map((task) => [task.id, task.campaign_id]),
          );
          const reportTaskIds = reportTaskRows.map((task) => task.id);
          let performanceRows: PerformanceHealthRow[] = [];

          if (reportTaskIds.length > 0) {
            const { data: performanceData } = await supabase
              .from("content_performance")
              .select("id, report_task_id, submission_id, screenshot_url, verification_status, reported_at, created_at")
              .in("report_task_id", reportTaskIds);

            performanceRows = ((performanceData ?? []) as Array<
              Omit<PerformanceHealthRow, "campaign_id">
            >).flatMap((row) => {
              const campaignId = row.report_task_id
                ? campaignIdByReportTaskId.get(row.report_task_id)
                : null;

              return campaignId ? [{ ...row, campaign_id: campaignId }] : [];
            });
          }

          healthByCampaignId = buildCampaignReportHealth({
            campaignIds,
            evidenceRows: (evidenceRows ?? []) as EvidenceHealthRow[],
            performanceRows,
            reportTasks: reportTaskRows,
          });
          responsibilitiesByCampaignId =
            buildCampaignResponsibilitySummariesByCampaign({
              campaignIds,
              responsibilityRows: (responsibilityRows ?? []) as CampaignResponsibilityAssignmentRow[],
              teamMembersById,
            });
        }

        setCampaigns(
          data.map((c) => ({
            ...c,
            platforms: c.platforms || [],
            markets: c.markets || [],
            reportHealth: healthByCampaignId.get(c.id) ?? {
              missed: 0,
              corrections: 0,
              toReview: 0,
            },
            responsibilities:
              responsibilitiesByCampaignId.get(c.id) ??
              buildCampaignResponsibilitySummaries({
                assignments: [],
                teamMembersById,
              }),
          }))
        );
      }
      setLoading(false);
    }
    load();
  }, []);

  const visibleCampaigns = useMemo(
    () =>
      filterCampaignsByWork({
        campaigns,
        currentBrandTeamMemberId,
        workFilter,
      }),
    [campaigns, currentBrandTeamMemberId, workFilter],
  );
  const sortedCampaigns = useMemo(
    () => sortCampaignsForOperations(visibleCampaigns),
    [visibleCampaigns],
  );
  const myWorkCampaigns = filterCampaignsByWork({
    campaigns,
    currentBrandTeamMemberId,
    workFilter: "mine",
  });
  const ownerlessCampaigns = filterCampaignsByWork({
    campaigns,
    currentBrandTeamMemberId,
    workFilter: "needs_owner",
  });
  const byStatus = (status: CampaignStatus) =>
    visibleCampaigns.filter((campaign) => campaign.status === status);
  const activeCampaigns = visibleCampaigns.filter((campaign) =>
    isActiveCampaign(campaign.status),
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("count", { count: String(campaigns.length) })}
          </p>
        </div>
        {canCreateCampaigns && (
          <LinkButton
            href="/b/campaigns/new"
            size="lg"
            data-testid="campaign-create-action"
            className="shrink-0"
          >
            <Plus className="size-4" />
            {t("action.create")}
          </LinkButton>
        )}
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid overflow-hidden rounded-xl border border-border bg-white sm:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3 border-b border-border px-4 py-4 last:border-b-0 sm:border-b-0 sm:border-e sm:last:border-e-0">
                <div className="size-9 animate-pulse rounded-lg bg-muted" />
                <div className="space-y-2">
                  <div className="h-3 w-20 animate-pulse rounded bg-muted/70" />
                  <div className="h-6 w-28 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="grid gap-4 rounded-xl border border-border/60 bg-card p-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(10rem,0.8fr)_minmax(8rem,0.6fr)_auto]"
              >
                <div className="space-y-2">
                  <div className="h-4 w-44 animate-pulse rounded bg-muted" />
                  <div className="h-5 w-60 animate-pulse rounded bg-muted/50" />
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-20 animate-pulse rounded bg-muted/50" />
                  <div className="h-4 w-28 animate-pulse rounded bg-muted" />
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-16 animate-pulse rounded bg-muted/50" />
                  <div className="h-4 w-20 animate-pulse rounded bg-muted" />
                </div>
                <div className="h-4 w-16 animate-pulse rounded bg-muted/50 lg:ms-auto" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          <EnterpriseConciergeRequestsPanel
            locale={locale}
            requests={conciergeRequests}
            t={t}
          />
          <CampaignOperationsSummary campaigns={campaigns} t={t} />
          <CampaignWorkFilterBar
            activeFilter={workFilter}
            allCount={campaigns.length}
            myWorkCount={myWorkCampaigns.length}
            ownerlessCount={ownerlessCampaigns.length}
            onChange={setWorkFilter}
            t={t}
          />
          <Tabs defaultValue="all">
          <TabsList variant="line" className="mb-6 overflow-x-auto">
            <TabsTrigger value="all">
              {t("tab.all")} ({visibleCampaigns.length})
            </TabsTrigger>
            <TabsTrigger value="draft">
              {t("tab.draft")} ({byStatus("draft").length})
            </TabsTrigger>
            <TabsTrigger value="recruiting">
              {t("tab.recruiting")} ({byStatus("recruiting").length})
            </TabsTrigger>
            <TabsTrigger value="active">
              {t("tab.active")} ({activeCampaigns.length})
            </TabsTrigger>
            <TabsTrigger value="completed">
              {t("tab.completed")} ({byStatus("completed").length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all">
            <CampaignList
              canCreateCampaigns={canCreateCampaigns}
              items={sortedCampaigns}
              t={t}
              locale={locale}
            />
          </TabsContent>
          <TabsContent value="draft">
            <CampaignList
              canCreateCampaigns={canCreateCampaigns}
              items={sortCampaignsForOperations(byStatus("draft"))}
              t={t}
              locale={locale}
            />
          </TabsContent>
          <TabsContent value="recruiting">
            <CampaignList
              canCreateCampaigns={canCreateCampaigns}
              items={sortCampaignsForOperations(byStatus("recruiting"))}
              t={t}
              locale={locale}
            />
          </TabsContent>
          <TabsContent value="active">
            <CampaignList
              canCreateCampaigns={canCreateCampaigns}
              items={sortCampaignsForOperations(activeCampaigns)}
              t={t}
              locale={locale}
            />
          </TabsContent>
          <TabsContent value="completed">
            <CampaignList
              canCreateCampaigns={canCreateCampaigns}
              items={sortCampaignsForOperations(byStatus("completed"))}
              t={t}
              locale={locale}
            />
          </TabsContent>
        </Tabs>
        </>
      )}
    </div>
  );
}
