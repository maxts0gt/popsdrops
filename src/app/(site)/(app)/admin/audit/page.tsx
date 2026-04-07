"use client";

import { useState, useEffect } from "react";
import { Download, Inbox, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/client";
import { getSingleRelation } from "@/lib/supabase/relations";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 50;

const ACTION_LABELS: Record<string, string> = {
  approve_profile: "Approved profile",
  reject_profile: "Rejected profile",
  suspend_user: "Suspended user",
  unsuspend_user: "Unsuspended user",
  pause_campaign: "Paused campaign",
  cancel_campaign: "Cancelled campaign",
  resume_campaign: "Resumed campaign",
  re_review_profile: "Sent to re-review",
};

const ACTION_FILTER_GROUPS: Record<string, string[]> = {
  approvals: ["approve_profile", "reject_profile", "re_review_profile"],
  suspensions: ["suspend_user", "unsuspend_user"],
  campaigns: ["pause_campaign", "cancel_campaign", "resume_campaign"],
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuditEntry {
  id: string;
  action: string;
  target_type: string;
  target_id: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  admin: { full_name: string; email: string } | null;
}

interface AuditAdminRecord {
  full_name: string | null;
  email: string | null;
}

type AuditLogRow = Omit<AuditEntry, "admin"> & {
  admin: AuditAdminRecord | AuditAdminRecord[] | null;
};

async function fetchAuditEntries(params: {
  page: number;
  actionFilter: string;
  dateRange: string;
}): Promise<{ entries: AuditEntry[]; totalCount: number }> {
  const supabase = createClient();
  const { page, actionFilter, dateRange } = params;

  let query = supabase
    .from("admin_audit_log")
    .select(
      `
      id, action, target_type, target_id, metadata, created_at,
      admin:profiles!admin_audit_log_admin_id_fkey (full_name, email)
    `,
      { count: "exact" },
    )
    .order("created_at", { ascending: false });

  if (actionFilter !== "all") {
    const actions = ACTION_FILTER_GROUPS[actionFilter];
    if (actions) {
      query = query.in("action", actions);
    }
  }

  const dateFrom = getDateRangeFilter(dateRange);
  if (dateFrom) {
    query = query.gte("created_at", dateFrom);
  }

  query = query.range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

  const { data, count } = await query;

  return {
    entries: (data ?? []).map((row) => {
      const entry = row as AuditLogRow;
      const admin = getSingleRelation(entry.admin);

      return {
        ...entry,
        admin: admin
          ? {
              full_name: admin.full_name ?? "Unknown",
              email: admin.email ?? "",
            }
          : null,
      };
    }),
    totalCount: count ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay === 1) return "yesterday";
  if (diffDay < 30) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getDateRangeFilter(range: string): string | null {
  const now = new Date();
  switch (range) {
    case "today": {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return start.toISOString();
    }
    case "7d": {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return start.toISOString();
    }
    case "30d": {
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return start.toISOString();
    }
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// CSV Export
// ---------------------------------------------------------------------------

function exportCSV(entries: AuditEntry[]) {
  const headers = ["Date", "Admin", "Action", "Target", "Details"];
  const rows = entries.map((e) => [
    new Date(e.created_at).toISOString(),
    e.admin?.full_name ?? "Unknown",
    ACTION_LABELS[e.action] ?? e.action,
    typeof e.metadata?.target_name === "string" ? e.metadata.target_name : e.target_id,
    typeof e.metadata?.reason === "string" ? e.metadata.reason : "",
  ]);
  const csv = [headers, ...rows]
    .map((r) =>
      r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `audit-log-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminAuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [actionFilter, setActionFilter] = useState("all");
  const [dateRange, setDateRange] = useState("all");

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  useEffect(() => {
    let cancelled = false;

    void fetchAuditEntries({ page, actionFilter, dateRange })
      .then((result) => {
        if (cancelled) return;
        setEntries(result.entries);
        setTotalCount(result.totalCount);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setEntries([]);
        setTotalCount(0);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [page, actionFilter, dateRange]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Audit Log</h1>
          <p className="text-sm text-muted-foreground">
            {totalCount} {totalCount === 1 ? "entry" : "entries"}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportCSV(entries)}
          disabled={entries.length === 0}
        >
          <Download className="me-1.5 size-4" />
          Export CSV
        </Button>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Select
            value={actionFilter}
            onValueChange={(value) => {
              if (!value) return;
              setLoading(true);
              setPage(0);
              setActionFilter(value);
            }}
          >
            <SelectTrigger className="h-9 w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Actions</SelectItem>
              <SelectItem value="approvals">Approvals</SelectItem>
              <SelectItem value="suspensions">Suspensions</SelectItem>
              <SelectItem value="campaigns">Campaign Actions</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={dateRange}
            onValueChange={(value) => {
              if (!value) return;
              setLoading(true);
              setPage(0);
              setDateRange(value);
            }}
          >
            <SelectTrigger className="h-9 w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Audit Table */}
      <Card>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 8 }, (_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-12 text-center">
              <Inbox className="mx-auto mb-3 size-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                {actionFilter !== "all" || dateRange !== "all"
                  ? "No entries match your filters"
                  : "No audit entries yet"}
              </p>
              {actionFilter === "all" && dateRange === "all" && (
                <p className="mt-1 text-xs text-muted-foreground/70">
                  Admin actions will appear here automatically
                </p>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Admin</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => {
                  const reason =
                    typeof entry.metadata?.reason === "string"
                      ? entry.metadata.reason
                      : null;
                  const targetName =
                    typeof entry.metadata?.target_name === "string"
                      ? entry.metadata.target_name
                      : entry.target_id;

                  return (
                    <TableRow key={entry.id}>
                      <TableCell
                        className="whitespace-nowrap text-xs text-muted-foreground"
                        title={new Date(entry.created_at).toLocaleString()}
                      >
                        {relativeTime(entry.created_at)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {entry.admin?.full_name ?? "Unknown"}
                      </TableCell>
                      <TableCell className="text-sm font-medium text-foreground">
                        {ACTION_LABELS[entry.action] ?? entry.action}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {targetName}
                      </TableCell>
                      <TableCell
                        className="max-w-[250px] truncate text-xs text-muted-foreground"
                        title={reason ?? ""}
                      >
                        {reason ?? "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
              <p className="text-xs text-muted-foreground">
                Page {page + 1} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 0}
                  onClick={() => {
                    setLoading(true);
                    setPage((currentPage) => currentPage - 1);
                  }}
                >
                  <ChevronLeft className="me-1 size-4" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages - 1}
                  onClick={() => {
                    setLoading(true);
                    setPage((currentPage) => currentPage + 1);
                  }}
                >
                  Next
                  <ChevronRight className="ms-1 size-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
