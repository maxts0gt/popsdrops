"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Download,
  Inbox,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
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
import {
  fetchAdminAuditEntries,
  type AdminAuditEntry,
} from "@/app/actions/admin";
import { getAdminAuditActionLabel } from "@/lib/admin/audit-action-labels";
import {
  getAdminAuditDetailsLabel,
  getAdminAuditTargetLabel,
} from "@/lib/admin/audit-entry-display";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE = 50;
// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AuditSortKey = "created_at" | "admin" | "action" | "target" | "details";
type AuditActionFilter = "all" | "approvals" | "suspensions" | "campaigns" | "team";
type AuditDateRange = "all" | "today" | "7d" | "30d";
type SortDir = "asc" | "desc";

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

function compareText(a: string, b: string) {
  return a.localeCompare(b, "en-US", { numeric: true, sensitivity: "base" });
}

function AuditSortableHead({
  label,
  sortKey,
  currentKey,
  currentDir,
  onSort,
}: {
  label: string;
  sortKey: AuditSortKey;
  currentKey: AuditSortKey;
  currentDir: SortDir;
  onSort: (key: AuditSortKey) => void;
}) {
  const isActive = currentKey === sortKey;
  const ariaSort = isActive ? (currentDir === "asc" ? "ascending" : "descending") : "none";

  return (
    <TableHead aria-sort={ariaSort}>
      <button
        type="button"
        data-testid="admin-audit-sort-header"
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
    </TableHead>
  );
}

// ---------------------------------------------------------------------------
// CSV Export
// ---------------------------------------------------------------------------

function exportCSV(entries: AdminAuditEntry[]) {
  const headers = ["Date", "Admin", "Action", "Target", "Details"];
  const rows = entries.map((e) => [
    new Date(e.created_at).toISOString(),
    e.admin?.full_name ?? "Unknown",
    getAdminAuditActionLabel(e.action),
    getAdminAuditTargetLabel(e),
    getAdminAuditDetailsLabel(e),
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
  const searchParams = useSearchParams();
  const highlightedAuditEntryId = searchParams.get("entry");
  const [entries, setEntries] = useState<AdminAuditEntry[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [actionFilter, setActionFilter] = useState<AuditActionFilter>("all");
  const [dateRange, setDateRange] = useState<AuditDateRange>("all");
  const [sortKey, setSortKey] = useState<AuditSortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  function handleSort(key: AuditSortKey) {
    if (sortKey === key) {
      setSortDir((current) => (current === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  useEffect(() => {
    let cancelled = false;

    void fetchAdminAuditEntries({
      page,
      actionFilter,
      dateRange,
      highlightedAuditEntryId,
    })
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
  }, [page, actionFilter, dateRange, highlightedAuditEntryId]);

  const sortedEntries = useMemo(() => {
    const direction = sortDir === "asc" ? 1 : -1;

    return [...entries].sort((a, b) => {
      const getTarget = (entry: AdminAuditEntry) =>
        getAdminAuditTargetLabel(entry);
      const getDetails = (entry: AdminAuditEntry) =>
        getAdminAuditDetailsLabel(entry);

      let result = 0;
      switch (sortKey) {
        case "created_at":
          result = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case "admin":
          result = compareText(a.admin?.full_name ?? "Unknown", b.admin?.full_name ?? "Unknown");
          break;
        case "action":
          result = compareText(
            getAdminAuditActionLabel(a.action),
            getAdminAuditActionLabel(b.action),
          );
          break;
        case "target":
          result = compareText(getTarget(a), getTarget(b));
          break;
        case "details":
          result = compareText(getDetails(a), getDetails(b));
          break;
      }

      return result * direction;
    });
  }, [entries, sortDir, sortKey]);

  useEffect(() => {
    if (loading || !highlightedAuditEntryId) return;

    document
      .getElementById(`audit-entry-${highlightedAuditEntryId}`)
      ?.scrollIntoView({ block: "center" });
  }, [loading, highlightedAuditEntryId, sortedEntries.length]);

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
              <SelectItem value="team">Team Access</SelectItem>
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
                  <AuditSortableHead label="When" sortKey="created_at" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <AuditSortableHead label="Admin" sortKey="admin" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <AuditSortableHead label="Action" sortKey="action" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <AuditSortableHead label="Target" sortKey="target" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                  <AuditSortableHead label="Details" sortKey="details" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedEntries.map((entry) => {
                  const isHighlighted = entry.id === highlightedAuditEntryId;
                  const targetName = getAdminAuditTargetLabel(entry);
                  const details = getAdminAuditDetailsLabel(entry);

                  return (
                    <TableRow
                      key={entry.id}
                      id={`audit-entry-${entry.id}`}
                      data-testid={`admin-audit-row-${entry.id}`}
                      aria-current={isHighlighted ? "true" : undefined}
                      className={
                        isHighlighted
                          ? "bg-slate-50 ring-1 ring-inset ring-slate-900"
                          : undefined
                      }
                    >
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
                        {getAdminAuditActionLabel(entry.action)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {targetName}
                      </TableCell>
                      <TableCell
                        className="max-w-[250px] truncate text-xs text-muted-foreground"
                        title={details}
                      >
                        {details || "-"}
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
