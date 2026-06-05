"use client";

import { useState, useEffect, useMemo, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ArrowUpRight,
  Globe,
  Smartphone,
  BookOpen,
  Calendar,
  BarChart3,
  ToggleLeft,
  Save,
  Loader2,
  SlidersHorizontal,
  FileText,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { CampaignMarketPicker } from "@/components/campaigns/campaign-market-picker";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  MARKET_SCOPE_OPTIONS,
  MARKETS,
  PLATFORM_LABELS,
  getMarketLabel,
  sanitizeCampaignMarkets,
} from "@/lib/constants";
import type { CampaignMarket, Market, Platform } from "@/lib/constants";
import {
  getPlatformSettings,
  updateDataRightsRequestStatus,
  updatePlatformSetting,
} from "@/app/actions/admin";

// ---------------------------------------------------------------------------
// Static config (these are fine to keep hardcoded)
// ---------------------------------------------------------------------------

const enabledPlatforms: Platform[] = [
  "tiktok",
  "instagram",
  "snapchat",
  "youtube",
];
const disabledPlatforms: Platform[] = ["facebook"];

const featureFlags = [
  {
    name: "auto_translation",
    label: "Auto-Translation (Gemini)",
    description: "Automatically translate campaign briefs",
    enabled: true,
  },
  {
    name: "look_alike_discovery",
    label: "Look-Alike Discovery",
    description: "Suggest similar creators based on audience overlap",
    enabled: true,
  },
  {
    name: "timing_intelligence",
    label: "Timing Intelligence",
    description: "Show optimal posting times per market/platform",
    enabled: true,
  },
  {
    name: "campaign_reports",
    label: "Campaign Intelligence Reports",
    description: "AI-powered post-campaign analytics",
    enabled: true,
  },
  {
    name: "public_profiles",
    label: "Public Creator Profiles",
    description: "Allow creators to share their /c/slug profile",
    enabled: true,
  },
  {
    name: "rate_card_builder",
    label: "Rate Card Builder",
    description: "Creator toolkit for building rate cards",
    enabled: false,
  },
  {
    name: "video_preview",
    label: "Video Content Preview",
    description: "In-app video preview for submitted content",
    enabled: false,
  },
];

const dataRightsRequestSelectColumns =
  "id, email, request_type, status, details, retention_note, scheduled_for, verification_due_at, created_at, reviewed_at, processed_at, processing_error, completed_at";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PlaybookRow {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
}

interface CulturalEvent {
  id: string;
  event_name: string;
  start_date: string;
  end_date: string;
  market: string;
}

type DataRightsStatus =
  | "pending"
  | "scheduled"
  | "reviewing"
  | "processing"
  | "completed"
  | "failed"
  | "rejected"
  | "cancelled";

type ManualDataRightsStatus = "completed" | "rejected";

interface DataRightsRequestRow {
  id: string;
  email: string;
  request_type: "export" | "deletion" | "correction";
  status: DataRightsStatus;
  details: string | null;
  retention_note: string | null;
  scheduled_for: string | null;
  verification_due_at: string | null;
  created_at: string;
  reviewed_at: string | null;
  processed_at: string | null;
  processing_error: string | null;
  completed_at: string | null;
}

type CalendarSortKey = "event_name" | "start_date" | "market" | "status";
type SortDir = "asc" | "desc";

type DataRightsAuditLink = {
  id: string;
  target_id: string;
  created_at: string;
};

function formatDataRightsDate(value: string | null) {
  if (!value) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function canAdminActOnPrivacyRequest(request: DataRightsRequestRow) {
  return request.status === "failed" || request.status === "reviewing";
}

function getPrivacyRequestStatusLabel(request: DataRightsRequestRow) {
  if (canAdminActOnPrivacyRequest(request)) return "Review exception";
  if (request.status === "pending") return "Self-serve queue";
  if (request.status === "scheduled") return "Automatic deletion";
  if (request.status === "processing") return "Processing";
  if (request.status === "completed") return "Completed";
  if (request.status === "cancelled") return "Cancelled";
  if (request.status === "rejected") return "Denied";
  return request.status;
}

function getPrivacyRequestBadgeVariant(request: DataRightsRequestRow) {
  if (canAdminActOnPrivacyRequest(request)) return "destructive";
  if (request.status === "completed") return "secondary";
  if (["cancelled", "rejected"].includes(request.status)) return "outline";
  return "default";
}

function CalendarSortableHead({
  label,
  sortKey,
  currentKey,
  currentDir,
  onSort,
}: {
  label: string;
  sortKey: CalendarSortKey;
  currentKey: CalendarSortKey;
  currentDir: SortDir;
  onSort: (key: CalendarSortKey) => void;
}) {
  const isActive = currentKey === sortKey;
  const ariaSort = isActive ? (currentDir === "asc" ? "ascending" : "descending") : "none";

  return (
    <th className="pb-3 pr-4 text-left" aria-sort={ariaSort}>
      <button
        type="button"
        data-testid="admin-calendar-sort-header"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
      >
        {label}
        {isActive ? (
          currentDir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />
        ) : (
          <ArrowUpDown className="size-3 opacity-30" />
        )}
      </button>
    </th>
  );
}

async function fetchDataRightsAuditLinks(
  supabase: ReturnType<typeof createClient>,
  requestIds: string[],
) {
  if (requestIds.length === 0) return {};

  const { data, error } = await supabase
    .from("admin_audit_log")
    .select("id, target_id, created_at")
    .eq("target_type", "data_rights_request")
    .in("target_id", requestIds)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return ((data ?? []) as DataRightsAuditLink[]).reduce<Record<string, string>>(
    (links, row) => {
      if (!links[row.target_id]) {
        links[row.target_id] = row.id;
      }
      return links;
    },
    {},
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminSettingsPage() {
  const searchParams = useSearchParams();
  const highlightedDataRightsRequestId = searchParams.get("data_rights");

  // DB-backed settings state
  const [enabledMarkets, setEnabledMarkets] = useState<CampaignMarket[]>([]);
  const [minFollowers, setMinFollowers] = useState<number>(500);
  const [maxRevisions, setMaxRevisions] = useState<number>(3);
  const [slaHours, setSlaHours] = useState<number>(24);
  const [autoApproveCreators, setAutoApproveCreators] = useState(false);

  // Read-only display data
  const [playbooks, setPlaybooks] = useState<PlaybookRow[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CulturalEvent[]>([]);
  const [benchmarkCount, setBenchmarkCount] = useState<number>(0);
  const [dataRightsRequests, setDataRightsRequests] = useState<DataRightsRequestRow[]>([]);
  const [dataRightsAuditLinks, setDataRightsAuditLinks] = useState<Record<string, string>>({});
  const [updatingDataRightsId, setUpdatingDataRightsId] = useState<string | null>(null);
  const [denyingDataRightsId, setDenyingDataRightsId] = useState<string | null>(null);
  const [dataRightsDenialReason, setDataRightsDenialReason] = useState("");

  const [loading, setLoading] = useState(true);
  const [savingMarkets, startSavingMarkets] = useTransition();
  const [savingRules, startSavingRules] = useTransition();
  const [calendarSortKey, setCalendarSortKey] = useState<CalendarSortKey>("start_date");
  const [calendarSortDir, setCalendarSortDir] = useState<SortDir>("asc");

  function handleCalendarSort(key: CalendarSortKey) {
    if (calendarSortKey === key) {
      setCalendarSortDir((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setCalendarSortKey(key);
      setCalendarSortDir("asc");
    }
  }

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      const [
        settingsResult,
        playbookResult,
        calendarResult,
        benchmarkResult,
        dataRightsResult,
      ] =
        await Promise.all([
          getPlatformSettings(),
          supabase
            .from("playbooks")
            .select("id, name, description, sort_order")
            .order("sort_order", { ascending: true }),
          supabase
            .from("cultural_calendar")
            .select("id, event_name, start_date, end_date, market")
            .order("start_date", { ascending: true })
            .limit(50),
          supabase
            .from("market_benchmarks")
            .select("id", { count: "exact", head: true }),
          supabase
            .from("data_rights_requests")
            .select(dataRightsRequestSelectColumns)
            .order("created_at", { ascending: false })
            .limit(20),
        ]);

      // Hydrate settings
      const s = settingsResult;
      if (Array.isArray(s.enabled_markets)) {
        setEnabledMarkets(sanitizeCampaignMarkets(s.enabled_markets as string[]));
      }
      if (typeof s.creator_min_followers === "number") {
        setMinFollowers(s.creator_min_followers);
      }
      if (typeof s.max_revisions_per_submission === "number") {
        setMaxRevisions(s.max_revisions_per_submission);
      }
      if (typeof s.sla_approval_hours === "number") {
        setSlaHours(s.sla_approval_hours);
      }
      if (typeof s.auto_approve_creators === "boolean") {
        setAutoApproveCreators(s.auto_approve_creators);
      }

      setPlaybooks(playbookResult.data ?? []);
      setCalendarEvents(calendarResult.data ?? []);
      setBenchmarkCount(benchmarkResult.count ?? 0);
      const dataRightsRows = (dataRightsResult.data ?? []) as DataRightsRequestRow[];
      if (
        highlightedDataRightsRequestId &&
        !dataRightsRows.some((request) => request.id === highlightedDataRightsRequestId)
      ) {
        const { data: highlightedDataRightsRequest } = await supabase
          .from("data_rights_requests")
          .select(dataRightsRequestSelectColumns)
          .eq("id", highlightedDataRightsRequestId)
          .maybeSingle();

        if (highlightedDataRightsRequest) {
          dataRightsRows.unshift(highlightedDataRightsRequest as DataRightsRequestRow);
        }
      }

      setDataRightsRequests(dataRightsRows);
      setDataRightsAuditLinks(
        await fetchDataRightsAuditLinks(
          supabase,
          dataRightsRows.map((request) => request.id),
        ),
      );

      setLoading(false);
    }
    load();
  }, [highlightedDataRightsRequestId]);

  useEffect(() => {
    if (loading || !highlightedDataRightsRequestId) return;

    document
      .getElementById(`data-rights-request-${highlightedDataRightsRequestId}`)
      ?.scrollIntoView({ block: "center" });
  }, [dataRightsRequests.length, highlightedDataRightsRequestId, loading]);

  const sortedCalendarEvents = useMemo(() => {
    const direction = calendarSortDir === "asc" ? 1 : -1;

    return [...calendarEvents].sort((a, b) => {
      const getStatus = (event: CulturalEvent) =>
        new Date(event.end_date) < new Date() ? "past" : "upcoming";
      const aVal = calendarSortKey === "status" ? getStatus(a) : a[calendarSortKey];
      const bVal = calendarSortKey === "status" ? getStatus(b) : b[calendarSortKey];

      if (calendarSortKey === "start_date") {
        return (
          new Date(a.start_date).getTime() - new Date(b.start_date).getTime()
        ) * direction;
      }

      return String(aVal).localeCompare(String(bVal), "en-US", {
        numeric: true,
        sensitivity: "base",
      }) * direction;
    });
  }, [calendarEvents, calendarSortDir, calendarSortKey]);
  const marketOptions = useMemo(
    () =>
      MARKETS.map((market) => ({
        value: market as Market,
        label: getMarketLabel(market, "en"),
      })),
    [],
  );
  const marketScopeOptions = MARKET_SCOPE_OPTIONS.map((scope) => ({
    value: scope.value,
    label: getMarketLabel(scope.value, "en"),
  }));

  function handleSaveMarkets() {
    startSavingMarkets(async () => {
      try {
        await updatePlatformSetting("enabled_markets", enabledMarkets);
        toast.success("Enabled markets saved");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to save markets"
        );
      }
    });
  }

  function handleSaveRules() {
    startSavingRules(async () => {
      try {
        await Promise.all([
          updatePlatformSetting("creator_min_followers", minFollowers),
          updatePlatformSetting(
            "max_revisions_per_submission",
            maxRevisions
          ),
          updatePlatformSetting("sla_approval_hours", slaHours),
          updatePlatformSetting("auto_approve_creators", autoApproveCreators),
        ]);
        toast.success("Platform rules saved");
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to save rules"
        );
      }
    });
  }

  async function handleDataRightsStatus(
    requestId: string,
    status: ManualDataRightsStatus,
    reason?: string,
  ) {
    const trimmedReason = reason?.trim() ?? "";
    if (status === "rejected" && trimmedReason.length < 3) {
      toast.error("Add a clear denial reason before notifying the user.");
      return;
    }

    setUpdatingDataRightsId(requestId);
    try {
      await updateDataRightsRequestStatus(requestId, status, trimmedReason);
      const now = new Date().toISOString();
      setDataRightsRequests((requests) =>
        requests.map((request) =>
          request.id === requestId
            ? {
                ...request,
                status,
                reviewed_at: now,
                completed_at: status === "completed" ? now : null,
                retention_note:
                  status === "rejected"
                    ? [
                        request.retention_note,
                        `Admin denial reason: ${trimmedReason}`,
                      ]
                        .filter(Boolean)
                        .join("\n\n")
                    : request.retention_note,
              }
            : request,
        ),
      );
      if (status === "rejected") {
        setDenyingDataRightsId(null);
        setDataRightsDenialReason("");
      }
      const auditLinks = await fetchDataRightsAuditLinks(createClient(), [requestId]);
      setDataRightsAuditLinks((links) => ({
        ...links,
        ...auditLinks,
      }));
      toast.success("Privacy exception updated");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to update privacy request",
      );
    } finally {
      setUpdatingDataRightsId(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">
          Platform Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Configure platform-wide settings and feature flags
        </p>
      </div>

      <div className="space-y-6">
        {/* Privacy requests */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="size-5 text-muted-foreground" />
              <div>
                <CardTitle>Privacy Requests</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Export and deletion requests stay automatic when possible.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : dataRightsRequests.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border py-8 text-center">
                <p className="text-sm font-medium text-foreground">
                  No open privacy requests
                </p>
                <p className="text-xs text-muted-foreground">
                  Export and deletion requests will appear here for review.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {dataRightsRequests.map((request) => {
                  const isHighlighted = request.id === highlightedDataRightsRequestId;
                  const isUpdating = updatingDataRightsId === request.id;
                  const isDenying = denyingDataRightsId === request.id;
                  const isTerminal = ["completed", "rejected", "cancelled"].includes(
                    request.status,
                  );
                  const isScheduledDeletion =
                    request.request_type === "deletion" && request.status === "scheduled";
                  const canAdminAct = canAdminActOnPrivacyRequest(request);
                  const statusLabel = getPrivacyRequestStatusLabel(request);
                  const scheduledFor = formatDataRightsDate(request.scheduled_for);
                  const verificationDue = formatDataRightsDate(request.verification_due_at);
                  const processedAt = formatDataRightsDate(request.processed_at);
                  const auditId = dataRightsAuditLinks[request.id];

                  return (
                    <div
                      key={request.id}
                      id={`data-rights-request-${request.id}`}
                      data-testid={`admin-data-rights-row-${request.id}`}
                      aria-current={isHighlighted ? "true" : undefined}
                      className={`grid gap-3 rounded-lg border px-4 py-3 sm:grid-cols-[1fr_auto] ${
                        isHighlighted
                          ? "border-slate-900 bg-slate-50 ring-1 ring-slate-900"
                          : "border-border"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium text-foreground">
                            {request.email}
                          </p>
                          <Badge variant="secondary" className="capitalize">
                            {request.request_type}
                          </Badge>
                          <Badge variant={getPrivacyRequestBadgeVariant(request)}>
                            {statusLabel}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {new Date(request.created_at).toLocaleDateString()} request
                          {request.retention_note ? ` - ${request.retention_note}` : ""}
                        </p>
                        {isScheduledDeletion ? (
                          <p className="mt-1 text-xs font-medium text-foreground">
                            Automatic deletion{scheduledFor ? ` on ${scheduledFor}` : ""}
                            {verificationDue ? `, response due ${verificationDue}` : ""}
                          </p>
                        ) : null}
                        {request.status === "pending" ? (
                          <p className="mt-1 text-xs font-medium text-muted-foreground">
                            Self-serve queue
                          </p>
                        ) : null}
                        {request.status === "processing" ? (
                          <p className="mt-1 text-xs font-medium text-muted-foreground">
                            Processing
                          </p>
                        ) : null}
                        {canAdminAct ? (
                          <p className="mt-1 text-xs font-medium text-destructive">
                            Review exception
                          </p>
                        ) : null}
                        {request.status === "failed" && request.processing_error ? (
                          <p className="mt-1 line-clamp-2 text-xs text-destructive">
                            {request.processing_error}
                          </p>
                        ) : null}
                        {processedAt && request.status === "completed" ? (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Processed {processedAt}
                          </p>
                        ) : null}
                        {request.details ? (
                          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {request.details}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        {auditId ? (
                          <Link
                            href={`/admin/audit?entry=${auditId}#audit-entry-${auditId}`}
                            data-testid="admin-data-rights-audit-link"
                            className="inline-flex h-8 items-center gap-1 rounded-lg border border-border px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                          >
                            Open audit
                            <ArrowUpRight className="size-3" />
                          </Link>
                        ) : null}
                        {canAdminAct ? (
                          <>
                            {!isDenying ? (
                              <>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={isUpdating}
                                  onClick={() => {
                                    setDenyingDataRightsId(request.id);
                                    setDataRightsDenialReason("");
                                  }}
                                >
                                  Deny with reason
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={isUpdating}
                                  onClick={() =>
                                    handleDataRightsStatus(request.id, "completed")
                                  }
                                >
                                  {isUpdating ? (
                                    <Loader2 className="size-4 animate-spin" />
                                  ) : (
                                    "Mark resolved"
                                  )}
                                </Button>
                              </>
                            ) : null}
                          </>
                        ) : isTerminal ? (
                          <span className="text-xs font-medium text-muted-foreground">
                            Reviewed
                          </span>
                        ) : isScheduledDeletion ? (
                          <span className="text-xs font-medium text-muted-foreground">
                            Automatic deletion
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-muted-foreground">
                            {statusLabel}
                          </span>
                        )}
                      </div>
                      {canAdminAct && isDenying ? (
                        <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3 sm:col-span-2">
                          <div className="space-y-1">
                            <Label
                              htmlFor={`data-rights-deny-reason-${request.id}`}
                              className="text-xs font-medium text-foreground"
                            >
                              Denial reason
                            </Label>
                            <Textarea
                              id={`data-rights-deny-reason-${request.id}`}
                              data-testid="admin-data-rights-deny-reason"
                              value={dataRightsDenialReason}
                              onChange={(event) =>
                                setDataRightsDenialReason(event.target.value)
                              }
                              placeholder="Explain why this request cannot be completed."
                              className="min-h-20 text-sm"
                              maxLength={500}
                            />
                          </div>
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={isUpdating}
                              onClick={() => {
                                setDenyingDataRightsId(null);
                                setDataRightsDenialReason("");
                              }}
                            >
                              Keep request open
                            </Button>
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              disabled={
                                isUpdating || dataRightsDenialReason.trim().length < 3
                              }
                              onClick={() =>
                                handleDataRightsStatus(
                                  request.id,
                                  "rejected",
                                  dataRightsDenialReason,
                                )
                              }
                            >
                              {isUpdating ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                "Confirm denial"
                              )}
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Markets (DB-backed, toggleable) */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="size-5 text-muted-foreground" />
              <CardTitle>Enabled Markets</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              <Skeleton className="h-24 w-full" />
            ) : (
              <>
                <CampaignMarketPicker
                  testId="admin-settings-market-picker"
                  options={marketOptions}
                  scopeOptions={marketScopeOptions}
                  selected={enabledMarkets}
                  selectedChipTone="subtle"
                  onChange={setEnabledMarkets}
                  copy={{
                    placeholder: "Select enabled markets",
                    selectedCount: `${enabledMarkets.length} selected`,
                    scopeLabel: "Market scope",
                    searchPlaceholder: "Search countries",
                    empty: "No countries found",
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleSaveMarkets}
                  disabled={savingMarkets}
                  className="h-9 px-3 text-sm"
                >
                  {savingMarkets ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}{" "}
                  Save enabled markets
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Platform Rules (DB-backed) */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="size-5 text-muted-foreground" />
              <CardTitle>Platform Rules</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <Label htmlFor="minFollowers">
                      Min Followers for Visibility
                    </Label>
                    <Input
                      id="minFollowers"
                      type="number"
                      min={0}
                      value={minFollowers}
                      onChange={(e) =>
                        setMinFollowers(parseInt(e.target.value, 10) || 0)
                      }
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="maxRevisions">
                      Max Revisions per Submission
                    </Label>
                    <Input
                      id="maxRevisions"
                      type="number"
                      min={1}
                      max={10}
                      value={maxRevisions}
                      onChange={(e) =>
                        setMaxRevisions(parseInt(e.target.value, 10) || 1)
                      }
                      className="mt-1.5"
                    />
                  </div>
                  <div>
                    <Label htmlFor="slaHours">SLA Approval Hours</Label>
                    <Input
                      id="slaHours"
                      type="number"
                      min={1}
                      value={slaHours}
                      onChange={(e) =>
                        setSlaHours(parseInt(e.target.value, 10) || 1)
                      }
                      className="mt-1.5"
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={autoApproveCreators}
                    onChange={(e) =>
                      setAutoApproveCreators(e.target.checked)
                    }
                    className="size-4 rounded border-border accent-primary"
                  />
                  Auto-approve new creator accounts
                </label>
                <Button onClick={handleSaveRules} disabled={savingRules}>
                  {savingRules ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}{" "}
                  Save Rules
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Platforms (static config) */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Smartphone className="size-5 text-muted-foreground" />
              <CardTitle>Platforms</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {enabledPlatforms.map((p) => (
                <span
                  key={p}
                  className="rounded-lg border border-primary/10 bg-primary px-3 py-1.5 text-sm font-medium text-white"
                >
                  {PLATFORM_LABELS[p]}
                </span>
              ))}
              {disabledPlatforms.map((p) => (
                <span
                  key={p}
                  className="rounded-lg border border-border bg-muted/50 px-3 py-1.5 text-sm text-muted-foreground/70 line-through"
                >
                  {PLATFORM_LABELS[p]}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Playbooks (real data) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <BookOpen className="size-5 text-muted-foreground" />
              <CardTitle>Playbooks</CardTitle>
            </div>
            <Button variant="outline" size="sm" disabled>
              Add Playbook
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : playbooks.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border py-8 text-center">
                <BookOpen className="mx-auto mb-3 size-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  No playbooks configured
                </p>
                <p className="text-xs text-muted-foreground/70">
                  Playbooks define reusable campaign templates
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {playbooks.map((pb) => (
                  <div
                    key={pb.id}
                    className="flex items-center justify-between rounded-lg border border-border px-4 py-2.5"
                  >
                    <div>
                      <span className="text-sm font-medium text-foreground">
                        {pb.name}
                      </span>
                      {pb.description && (
                        <span className="ml-2 text-xs text-muted-foreground/70">
                          {pb.description}
                        </span>
                      )}
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      Active
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Cultural Calendar (real data) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="size-5 text-muted-foreground" />
              <CardTitle>Cultural Calendar</CardTitle>
            </div>
            <Button variant="outline" size="sm" disabled>
              Add Event
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-32 w-full" />
            ) : calendarEvents.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border py-8 text-center">
                <Calendar className="mx-auto mb-3 size-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  No cultural events configured
                </p>
                <p className="text-xs text-muted-foreground/70">
                  Add market-specific events to help with campaign timing
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                      <CalendarSortableHead label="Event" sortKey="event_name" currentKey={calendarSortKey} currentDir={calendarSortDir} onSort={handleCalendarSort} />
                      <CalendarSortableHead label="Dates" sortKey="start_date" currentKey={calendarSortKey} currentDir={calendarSortDir} onSort={handleCalendarSort} />
                      <CalendarSortableHead label="Market" sortKey="market" currentKey={calendarSortKey} currentDir={calendarSortDir} onSort={handleCalendarSort} />
                      <CalendarSortableHead label="Status" sortKey="status" currentKey={calendarSortKey} currentDir={calendarSortDir} onSort={handleCalendarSort} />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedCalendarEvents.map((event) => {
                      const isPast =
                        new Date(event.end_date) < new Date();
                      return (
                        <tr
                          key={event.id}
                          className="border-b border-border/50 last:border-0"
                        >
                          <td className="py-2.5 pr-4 font-medium text-foreground">
                            {event.event_name}
                          </td>
                          <td className="py-2.5 pr-4 text-muted-foreground">
                            {new Date(event.start_date).toLocaleDateString()} -{" "}
                            {new Date(event.end_date).toLocaleDateString()}
                          </td>
                          <td className="py-2.5 pr-4 capitalize text-muted-foreground">
                            {event.market.replace(/_/g, " ")}
                          </td>
                          <td className="py-2.5">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                isPast
                                  ? "bg-muted text-muted-foreground"
                                  : "bg-blue-100 text-blue-700"
                              }`}
                            >
                              {isPast ? "Past" : "Upcoming"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Benchmarks (real data) */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BarChart3 className="size-5 text-muted-foreground" />
              <CardTitle>Benchmarks</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-16 w-full" />
            ) : benchmarkCount === 0 ? (
              <div className="rounded-lg border border-dashed border-border py-8 text-center">
                <BarChart3 className="mx-auto mb-3 size-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">
                  No benchmark data yet
                </p>
                <p className="text-xs text-muted-foreground/70">
                  Benchmarks are calculated from aggregated campaign performance
                  data
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-muted/50 px-4 py-2">
                  <p className="text-xs text-muted-foreground">Data points</p>
                  <p className="text-sm font-medium text-foreground">
                    {benchmarkCount.toLocaleString()}
                  </p>
                </div>
                <Button variant="outline" size="sm" disabled>
                  Recalculate Now
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Feature Flags (static config) */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ToggleLeft className="size-5 text-muted-foreground" />
              <CardTitle>Feature Flags</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {featureFlags.map((flag) => (
                <div
                  key={flag.name}
                  className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {flag.label}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {flag.description}
                    </p>
                  </div>
                  <div
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      flag.enabled
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {flag.enabled ? "Enabled" : "Disabled"}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
