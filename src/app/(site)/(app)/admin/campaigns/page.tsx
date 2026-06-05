"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Download,
  Pause,
  Play,
  XCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CAMPAIGN_STATUS_TEXT_COLORS,
  CAMPAIGN_STATUS_LABELS,
  formatCurrency,
  formatBudgetRange,
} from "@/lib/constants";
import type { CampaignStatus } from "@/lib/constants";
import { useI18n } from "@/lib/i18n/context";
import { createClient } from "@/lib/supabase/client";
import { getSingleRelation } from "@/lib/supabase/relations";
import { pauseCampaign, cancelCampaign, resumeCampaign } from "@/app/actions/admin";
import type { PaymentStatusType } from "@/types/database";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CampaignSortKey =
  | "title"
  | "brand_name"
  | "status"
  | "service_fee_status"
  | "service_fee_cents"
  | "member_count"
  | "created_at";
type SortDir = "asc" | "desc";
type AttentionFilter = "all" | "payment" | "launch" | "reporting";
type AttentionKind = Exclude<AttentionFilter, "all">;

interface CampaignRow {
  id: string;
  title: string;
  status: CampaignStatus;
  max_creators: number;
  markets: string[];
  created_at: string;
  service_fee_cents: number | null;
  service_fee_currency: string | null;
  service_fee_status: PaymentStatusType;
  brand_name: string;
  member_count: number;
  report_correction_count: number;
  report_missed_count: number;
}

type CampaignQueryRow = Omit<
  CampaignRow,
  "brand_name" | "member_count" | "report_correction_count" | "report_missed_count"
> & {
  brand?: { full_name: string | null } | { full_name: string | null }[] | null;
};

type ReportTaskExceptionRow = {
  campaign_id: string;
  status: string;
};

type CampaignAttentionItem = {
  actionLabel: string;
  campaignId: string;
  detail: string;
  href: string;
  id: string;
  kind: AttentionKind;
  label: string;
  title: string;
};

const attentionFilters: Array<{ key: AttentionFilter; label: string }> = [
  { key: "all", label: "All" },
  { key: "payment", label: "Payment" },
  { key: "launch", label: "Launch" },
  { key: "reporting", label: "Reporting" },
];

const paymentExceptionStatuses = new Set<PaymentStatusType>([
  "failed",
  "refunded",
  "disputed",
  "overdue",
]);

async function fetchCampaignRows(): Promise<CampaignRow[]> {
  const supabase = createClient();

  const { data } = await supabase
    .from("campaigns")
    .select(`
      id, title, status, max_creators, markets, created_at,
      service_fee_cents, service_fee_currency, service_fee_status,
      brand:profiles!campaigns_brand_id_fkey (full_name)
    `)
    .order("created_at", { ascending: false })
    .limit(100);

  if (!data) return [];

  const campaigns = data as CampaignQueryRow[];
  const campaignIds = campaigns.map((campaign) => campaign.id);

  const { data: memberRows } = campaignIds.length > 0
    ? await supabase
        .from("campaign_members")
        .select("campaign_id")
        .in("campaign_id", campaignIds)
    : { data: [] };
  const { data: reportTaskRows } = campaignIds.length > 0
    ? await supabase
        .from("campaign_report_tasks")
        .select("campaign_id,status")
        .in("campaign_id", campaignIds)
        .in("status", ["missed", "needs_revision"])
    : { data: [] };

  const memberCounts = new Map<string, number>();
  for (const row of memberRows ?? []) {
    memberCounts.set(row.campaign_id, (memberCounts.get(row.campaign_id) ?? 0) + 1);
  }
  const reportCounts = new Map<
    string,
    { correctionCount: number; missedCount: number }
  >();
  for (const row of (reportTaskRows ?? []) as ReportTaskExceptionRow[]) {
    const current = reportCounts.get(row.campaign_id) ?? {
      correctionCount: 0,
      missedCount: 0,
    };
    if (row.status === "missed") {
      current.missedCount += 1;
    }
    if (row.status === "needs_revision") {
      current.correctionCount += 1;
    }
    reportCounts.set(row.campaign_id, current);
  }

  return campaigns.map((campaign) => {
    const brand = getSingleRelation(campaign.brand);
    const reportCount = reportCounts.get(campaign.id);

    return {
      ...campaign,
      status: campaign.status as CampaignStatus,
      service_fee_status: campaign.service_fee_status as PaymentStatusType,
      brand_name: brand?.full_name ?? "Unknown",
      member_count: memberCounts.get(campaign.id) ?? 0,
      report_correction_count: reportCount?.correctionCount ?? 0,
      report_missed_count: reportCount?.missedCount ?? 0,
    };
  });
}

function serviceFeeTone(status: PaymentStatusType) {
  if (status === "paid") return "border-slate-200 bg-slate-50 text-slate-700";
  if (
    status === "failed" ||
    status === "refunded" ||
    status === "disputed" ||
    status === "overdue"
  ) {
    return "border-red-200 bg-red-50 text-red-700";
  }
  if (status === "invoiced") return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-slate-200 bg-white text-muted-foreground";
}

function serviceFeeLabel(status: PaymentStatusType) {
  return status[0].toUpperCase() + status.slice(1);
}

function attentionTone(kind: AttentionKind) {
  if (kind === "payment") return "border-red-200 bg-red-50 text-red-700";
  if (kind === "reporting") return "border-amber-200 bg-amber-50 text-amber-900";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function getCampaignAttentionItems(campaign: CampaignRow): CampaignAttentionItem[] {
  const items: CampaignAttentionItem[] = [];

  if (paymentExceptionStatuses.has(campaign.service_fee_status)) {
    items.push({
      actionLabel: "Open finance",
      campaignId: campaign.id,
      detail: `${serviceFeeLabel(campaign.service_fee_status)} service fee needs finance review.`,
      href: `/admin/campaigns/${campaign.id}?focus=finance#admin-finance-exception`,
      id: `${campaign.id}:payment`,
      kind: "payment",
      label: "Payment exception",
      title: campaign.title,
    });
  }

  const reportExceptionCount =
    campaign.report_correction_count + campaign.report_missed_count;
  if (reportExceptionCount > 0) {
    const parts = [
      campaign.report_missed_count > 0
        ? `${campaign.report_missed_count} missed`
        : null,
      campaign.report_correction_count > 0
        ? `${campaign.report_correction_count} correction`
        : null,
    ].filter(Boolean);
    items.push({
      actionLabel: "Open campaign",
      campaignId: campaign.id,
      detail: `${parts.join(", ")} report task${reportExceptionCount === 1 ? " needs" : "s need"} review.`,
      href: `/admin/campaigns/${campaign.id}?focus=reporting#admin-reporting-exceptions`,
      id: `${campaign.id}:reporting`,
      kind: "reporting",
      label: "Reporting exception",
      title: campaign.title,
    });
  }

  return items;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function CampaignSortableHead({
  label,
  sortKey: key,
  currentKey,
  currentDir,
  onSort,
}: {
  label: string;
  sortKey: CampaignSortKey;
  currentKey: CampaignSortKey;
  currentDir: SortDir;
  onSort: (key: CampaignSortKey) => void;
}) {
  const isActive = currentKey === key;
  const ariaSort = isActive
    ? currentDir === "asc"
      ? "ascending"
      : "descending"
    : "none";
  return (
    <TableHead aria-sort={ariaSort}>
      <button
        type="button"
        data-testid="admin-campaigns-sort-header"
        onClick={() => onSort(key)}
        className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
      >
        {label}
        {isActive ? (
          currentDir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />
        ) : (
          <ArrowUpDown className="size-3 opacity-30" />
        )}
      </button>
    </TableHead>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminCampaignsPage() {
  const { locale } = useI18n();
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<CampaignSortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [attentionFilter, setAttentionFilter] = useState<AttentionFilter>("all");

  const [dialogState, setDialogState] = useState<{
    type: "pause" | "cancel" | "resume" | null;
    campaign: CampaignRow | null;
  }>({ type: null, campaign: null });
  const [reason, setReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  function handleSort(key: CampaignSortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  async function loadCampaigns() {
    setLoading(true);
    setCampaigns(await fetchCampaignRows());
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;

    void fetchCampaignRows().then((nextCampaigns) => {
      if (cancelled) return;
      setCampaigns(nextCampaigns);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  function openDialog(type: "pause" | "cancel" | "resume", campaign: CampaignRow) {
    setDialogState({ type, campaign });
    setReason("");
  }

  function closeDialog() {
    setDialogState({ type: null, campaign: null });
    setReason("");
  }

  async function handleAction() {
    if (!dialogState.campaign || !dialogState.type) return;

    if ((dialogState.type === "pause" || dialogState.type === "cancel") && !reason.trim()) {
      toast.error("Please provide a reason");
      return;
    }

    setActionLoading(true);
    try {
      if (dialogState.type === "pause") {
        await pauseCampaign(dialogState.campaign.id, reason.trim());
        toast.success("Campaign paused");
      } else if (dialogState.type === "cancel") {
        await cancelCampaign(dialogState.campaign.id, reason.trim());
        toast.success("Campaign cancelled");
      } else if (dialogState.type === "resume") {
        await resumeCampaign(dialogState.campaign.id);
        toast.success("Campaign resumed");
      }
      closeDialog();
      loadCampaigns();
    } catch {
      toast.error("Action failed");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleExportCampaigns() {
    const supabase = createClient();
    const { data } = await supabase
      .from("campaigns")
      .select("title, status, created_at, budget_min, budget_max, budget_currency, service_fee_cents, service_fee_currency, service_fee_status, platforms, markets")
      .order("created_at", { ascending: false });

    if (!data || data.length === 0) {
      toast.error("No data to export");
      return;
    }

    const headers = [
      "Title",
      "Status",
      "Service fee",
      "Fee status",
      "Created",
      "Budget",
      "Platforms",
      "Markets",
    ];
    const rows = data.map((c) => [
      c.title,
      c.status,
      formatCurrency(
        (c.service_fee_cents ?? 0) / 100,
        locale,
        (c.service_fee_currency ?? "usd").toUpperCase(),
      ),
      c.service_fee_status,
      new Date(c.created_at).toLocaleDateString(),
      formatBudgetRange(c.budget_min, c.budget_max, locale, c.budget_currency),
      Array.isArray(c.platforms) ? c.platforms.join("; ") : "",
      Array.isArray(c.markets) ? c.markets.join("; ") : "",
    ]);

    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `campaigns-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // Build funnel from real data
  const statusCounts: Record<string, number> = {};
  for (const c of campaigns) {
    statusCounts[c.status] = (statusCounts[c.status] ?? 0) + 1;
  }

  const funnelStages: { status: CampaignStatus; label: string }[] = [
    { status: "draft", label: "Draft" },
    { status: "recruiting", label: "Recruiting" },
    { status: "in_progress", label: "In Progress" },
    { status: "publishing", label: "Publishing" },
    { status: "monitoring", label: "Monitoring" },
    { status: "completed", label: "Completed" },
  ];

  const maxCount = Math.max(1, ...funnelStages.map((s) => statusCounts[s.status] ?? 0));
  const attentionItems = campaigns.flatMap(getCampaignAttentionItems);
  const attentionCounts = attentionFilters.reduce(
    (counts, filter) => {
      counts[filter.key] =
        filter.key === "all"
          ? attentionItems.length
          : attentionItems.filter((item) => item.kind === filter.key).length;
      return counts;
    },
    {} as Record<AttentionFilter, number>,
  );
  const filteredAttentionItems =
    attentionFilter === "all"
      ? attentionItems
      : attentionItems.filter((item) => item.kind === attentionFilter);

  // Sort campaigns
  const sorted = [...campaigns].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    const aVal = a[sortKey] ?? "";
    const bVal = b[sortKey] ?? "";
    if (typeof aVal === "number" && typeof bVal === "number") {
      return (aVal - bVal) * dir;
    }
    if (typeof aVal === "string" && typeof bVal === "string") {
      return aVal.localeCompare(bVal) * dir;
    }
    return 0;
  });

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-6 lg:px-8">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
        <div className="h-32 animate-pulse rounded-xl bg-muted" />
        <div className="h-96 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  const dialogOpen = dialogState.type !== null;
  const dialogCampaign = dialogState.campaign;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Campaign Oversight</h1>
          <p className="text-sm text-muted-foreground">{campaigns.length} campaigns across all brands</p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExportCampaigns}>
          <Download className="size-4" /> Export CSV
        </Button>
      </div>

      <Card data-testid="admin-campaign-attention-panel" className="mb-6">
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Needs attention</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Payment, launch, and reporting exceptions across live campaigns
              </p>
            </div>
            <span className="text-sm font-semibold tabular-nums text-foreground">
              {attentionCounts.all} open
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {attentionFilters.map((filter) => {
              const active = attentionFilter === filter.key;
              return (
                <button
                  key={filter.key}
                  type="button"
                  data-testid="admin-campaign-attention-filter"
                  onClick={() => setAttentionFilter(filter.key)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-border bg-white text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {filter.label} {attentionCounts[filter.key]}
                </button>
              );
            })}
          </div>

          {filteredAttentionItems.length > 0 ? (
            <div className="divide-y divide-border/70 rounded-lg border border-border/70">
              {filteredAttentionItems.map((item) => (
                <div
                  key={item.id}
                  data-testid="admin-campaign-attention-row"
                  className="grid min-w-0 gap-3 px-3 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${attentionTone(item.kind)}`}
                      >
                        {item.label}
                      </span>
                      <Link
                        href={`/admin/campaigns/${item.campaignId}`}
                        className="min-w-0 truncate text-sm font-semibold text-foreground transition-colors hover:text-foreground/80"
                      >
                        {item.title}
                      </Link>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {item.detail}
                    </p>
                  </div>
                  <Link
                    href={item.href}
                    className="inline-flex h-8 w-fit max-w-full items-center justify-center justify-self-start whitespace-nowrap rounded-md border border-input bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted sm:justify-self-end"
                  >
                    {item.actionLabel}
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-border px-4 py-6 text-center">
              <p className="text-sm font-semibold text-foreground">
                No open exceptions
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                The selected queue has no payment, launch, or reporting blockers.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Funnel Visualization */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Campaign Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3">
            {funnelStages.map((stage) => {
              const count = statusCounts[stage.status] ?? 0;
              const heightPct = maxCount > 0 ? Math.max(10, (count / maxCount) * 100) : 10;
              return (
                <div key={stage.status} className="flex flex-1 flex-col items-center gap-2">
                  <span className="text-lg font-bold text-foreground">{count}</span>
                  <div className="flex h-24 w-full items-end justify-center">
                    <div
                      className="w-full max-w-16 rounded-t-md bg-muted transition-all"
                      style={{ height: `${heightPct}%` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">{stage.label}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Campaign Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Campaigns</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <CampaignSortableHead label="Campaign" sortKey="title" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <CampaignSortableHead label="Service fee" sortKey="service_fee_status" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <CampaignSortableHead label="Brand" sortKey="brand_name" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <CampaignSortableHead label="Status" sortKey="status" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <CampaignSortableHead label="Creators" sortKey="member_count" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <CampaignSortableHead label="Created" sortKey="created_at" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <TableHead className="text-end">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((c) => {
                  const showPauseCancel = ["recruiting", "in_progress", "publishing", "monitoring"].includes(c.status);
                  const showResume = c.status === "paused";
                  return (
                    <TableRow key={c.id}>
                      <TableCell className="w-64 max-w-64 font-medium">
                        <Link
                          href={`/admin/campaigns/${c.id}`}
                          className="block truncate text-foreground transition-colors hover:text-foreground/80"
                        >
                          {c.title}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start gap-1">
                          <span className="text-sm font-semibold tabular-nums text-foreground">
                            {formatCurrency(
                              (c.service_fee_cents ?? 0) / 100,
                              locale,
                              (c.service_fee_currency ?? "usd").toUpperCase(),
                            )}
                          </span>
                          <span
                            data-testid="admin-campaigns-service-fee-status"
                            className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${serviceFeeTone(c.service_fee_status)}`}
                          >
                            {serviceFeeLabel(c.service_fee_status)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{c.brand_name}</TableCell>
                      <TableCell>
                        <span className={`text-xs font-medium ${CAMPAIGN_STATUS_TEXT_COLORS[c.status]}`}>
                          {CAMPAIGN_STATUS_LABELS[c.status]}
                        </span>
                      </TableCell>
                      <TableCell>{c.member_count}/{c.max_creators ?? "-"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(c.created_at).toLocaleDateString(locale, {
                          month: "short",
                          day: "numeric",
                        })}
                      </TableCell>
                      <TableCell className="text-end">
                        {showPauseCancel && (
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-amber-600 hover:text-amber-700"
                              onClick={() => openDialog("pause", c)}
                            >
                              <Pause className="size-3.5" /> Pause
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => openDialog("cancel", c)}
                            >
                              <XCircle className="size-3.5" /> Cancel
                            </Button>
                          </div>
                        )}
                        {showResume && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-foreground hover:text-foreground/80"
                            onClick={() => openDialog("resume", c)}
                          >
                            <Play className="size-3.5" /> Resume
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {sorted.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground/70">
                      No campaigns yet
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent>
          {dialogState.type === "pause" && dialogCampaign && (
            <>
              <DialogHeader>
                <DialogTitle>Pause Campaign</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">{dialogCampaign.title}</p>
                  <p>{dialogCampaign.member_count} active participant{dialogCampaign.member_count !== 1 ? "s" : ""}</p>
                  <p className="mt-2 text-amber-600">All participants will be notified.</p>
                </div>
                <Textarea
                  placeholder="Reason for pausing (required)"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeDialog} disabled={actionLoading}>
                  Cancel
                </Button>
                <Button
                  className="bg-amber-600 text-white hover:bg-amber-700"
                  onClick={handleAction}
                  disabled={actionLoading || !reason.trim()}
                >
                  {actionLoading ? "Pausing..." : "Pause Campaign"}
                </Button>
              </DialogFooter>
            </>
          )}

          {dialogState.type === "cancel" && dialogCampaign && (
            <>
              <DialogHeader>
                <DialogTitle>Cancel Campaign</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">{dialogCampaign.title}</p>
                  <p>{dialogCampaign.member_count} active participant{dialogCampaign.member_count !== 1 ? "s" : ""}</p>
                  <p className="mt-2 font-semibold text-red-600">
                    This action cannot be undone. All participants will be notified.
                  </p>
                </div>
                <Textarea
                  placeholder="Reason for cancellation (required)"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeDialog} disabled={actionLoading}>
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleAction}
                  disabled={actionLoading || !reason.trim()}
                >
                  {actionLoading ? "Cancelling..." : "Cancel Campaign"}
                </Button>
              </DialogFooter>
            </>
          )}

          {dialogState.type === "resume" && dialogCampaign && (
            <>
              <DialogHeader>
                <DialogTitle>Resume Campaign</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">{dialogCampaign.title}</p>
                  <p className="mt-2">
                    This will set the campaign back to active and notify all participants.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={closeDialog} disabled={actionLoading}>
                  Cancel
                </Button>
                <Button onClick={handleAction} disabled={actionLoading}>
                  {actionLoading ? "Resuming..." : "Resume Campaign"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
