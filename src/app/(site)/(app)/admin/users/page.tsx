"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Search, Download, ArrowUpDown, ArrowUp, ArrowDown, MoreHorizontal } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getMarketLabel, PROFILE_STATUS_COLORS, ROLE_COLORS } from "@/lib/constants";
import type { Market } from "@/lib/constants";
import { getAdminAuditActionLabel } from "@/lib/admin/audit-action-labels";
import { useI18n } from "@/lib/i18n/context";
import { createClient } from "@/lib/supabase/client";
import { getSingleRelation } from "@/lib/supabase/relations";
import {
  fetchAdminUserDetail,
  suspendUser,
  unsuspendUser,
  reReviewProfile,
} from "@/app/actions/admin";
import type { AdminUserDetail } from "@/app/actions/admin";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const PAGE_SIZE = 50;

type SortKey = "full_name" | "email" | "role" | "status" | "primary_market" | "created_at";
type SortDir = "asc" | "desc";

interface UserRow {
  id: string;
  full_name: string;
  email: string;
  role: "creator" | "brand" | "admin";
  status: string;
  avatar_url: string | null;
  created_at: string;
  primary_market: string | null;
}

type UserActionTarget = Pick<UserRow, "id" | "full_name" | "email" | "role" | "status">;

type UserRowRecord = Omit<UserRow, "primary_market"> & {
  creator_profiles?:
    | { primary_market: string | null }
    | { primary_market: string | null }[]
    | null;
};

async function fetchUsers(
  page: number
): Promise<{ users: UserRow[]; totalCount: number }> {
  const supabase = createClient();

  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const query = supabase
    .from("profiles")
    .select(
      `
      id, full_name, email, role, status, avatar_url, created_at,
      creator_profiles!creator_profiles_profile_id_fkey (primary_market)
    `,
      { count: "exact" }
    )
    .order("created_at", { ascending: false })
    .range(from, to);

  const { data, count } = await query;

  const users = (data ?? []).map((row) => {
    const user = row as UserRowRecord;
    const creatorProfile = getSingleRelation(user.creator_profiles);

    return {
      ...user,
      primary_market: creatorProfile?.primary_market ?? null,
    };
  });

  return { users, totalCount: count ?? 0 };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatAdminDate(value: string | null, locale: string): string {
  if (!value) return "Not set";

  return new Date(value).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatAdminDateTime(value: string | null, locale: string): string {
  if (!value) return "Not set";

  return new Date(value).toLocaleString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function titleize(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function metadataReason(metadata: Record<string, unknown> | null): string | null {
  const reason = metadata?.reason;
  return typeof reason === "string" && reason.trim() ? reason : null;
}

function SortableHead({
  label,
  sortKey: key,
  currentKey,
  currentDir,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  currentDir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  const isActive = currentKey === key;
  const ariaSort = isActive ? (currentDir === "asc" ? "ascending" : "descending") : "none";
  return (
    <TableHead aria-sort={ariaSort}>
      <button
        type="button"
        data-testid="admin-users-sort-header"
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

export default function AdminUsersPage() {
  const { locale } = useI18n();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Re-review dialog state
  const [reReviewTarget, setReReviewTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [reReviewReason, setReReviewReason] = useState("");
  const [reReviewSubmitting, setReReviewSubmitting] = useState(false);

  const [suspendTarget, setSuspendTarget] = useState<UserActionTarget | null>(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [suspendSubmitting, setSuspendSubmitting] = useState(false);
  const [detailTarget, setDetailTarget] = useState<UserActionTarget | null>(null);
  const [selectedUserDetail, setSelectedUserDetail] =
    useState<AdminUserDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  async function loadUsers() {
    setLoading(true);
    const result = await fetchUsers(page);
    setUsers(result.users);
    setTotalCount(result.totalCount);
    setLoading(false);
  }

  async function loadUserDetail(userId: string) {
    setDetailLoading(true);
    try {
      const detail = await fetchAdminUserDetail(userId);
      setSelectedUserDetail(detail);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to load user detail",
      );
      setSelectedUserDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }

  async function openUserDetail(user: UserActionTarget) {
    setDetailTarget(user);
    setSelectedUserDetail(null);
    await loadUserDetail(user.id);
  }

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    void fetchUsers(page).then((result) => {
      if (cancelled) return;
      setUsers(result.users);
      setTotalCount(result.totalCount);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [page]);

  const filtered = users.filter((u) => {
    if (roleFilter !== "all" && u.role !== roleFilter) return false;
    if (statusFilter !== "all" && u.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !u.full_name.toLowerCase().includes(q) &&
        !u.email.toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    const aVal = a[sortKey] ?? "";
    const bVal = b[sortKey] ?? "";
    if (typeof aVal === "string" && typeof bVal === "string") {
      return aVal.localeCompare(bVal) * dir;
    }
    return 0;
  });

  async function handleSuspend() {
    if (!suspendTarget || !suspendReason.trim()) return;
    const target = suspendTarget;
    setSuspendSubmitting(true);
    try {
      await suspendUser(target.id, suspendReason.trim());
      toast.success(`${target.full_name} suspended`);
      setSuspendTarget(null);
      setSuspendReason("");
      loadUsers();
      if (detailTarget?.id === target.id) {
        setDetailTarget((current) =>
          current?.id === target.id ? { ...current, status: "suspended" } : current,
        );
        await loadUserDetail(target.id);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to suspend user");
    } finally {
      setSuspendSubmitting(false);
    }
  }

  async function handleUnsuspend(userId: string, name: string) {
    try {
      await unsuspendUser(userId);
      toast.success(`${name} restored`);
      loadUsers();
      if (detailTarget?.id === userId) {
        setDetailTarget((current) =>
          current?.id === userId ? { ...current, status: "approved" } : current,
        );
        await loadUserDetail(userId);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to restore access");
    }
  }

  async function handleReReview() {
    if (!reReviewTarget || !reReviewReason.trim()) return;
    const target = reReviewTarget;
    setReReviewSubmitting(true);
    try {
      await reReviewProfile(target.id, reReviewReason.trim());
      toast.success(`${target.name} sent for re-review`);
      setReReviewTarget(null);
      setReReviewReason("");
      loadUsers();
      if (detailTarget?.id === target.id) {
        setDetailTarget((current) =>
          current?.id === target.id ? { ...current, status: "pending" } : current,
        );
        await loadUserDetail(target.id);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to re-review user");
    } finally {
      setReReviewSubmitting(false);
    }
  }

  async function handleExportUsers() {
    const supabase = createClient();
    const { data } = await supabase
      .from("profiles")
      .select("full_name, email, role, status, created_at")
      .order("created_at", { ascending: false });

    if (!data || data.length === 0) {
      toast.error("No data to export");
      return;
    }

    const headers = ["Name", "Email", "Role", "Status", "Joined"];
    const rows = data.map((u) => [
      u.full_name ?? "",
      u.email,
      u.role,
      u.status,
      new Date(u.created_at).toLocaleDateString(),
    ]);

    const csv = [headers, ...rows]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `users-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const activeDetailStatus =
    selectedUserDetail?.profile.status ?? detailTarget?.status ?? null;

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-6 lg:px-8">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
        <div className="h-16 animate-pulse rounded-xl bg-muted" />
        <div className="h-96 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Users</h1>
          <p className="text-sm text-muted-foreground">
            Access status, role, and safety actions for {totalCount} profiles.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={handleExportUsers}>
          <Download className="size-4" /> Export CSV
        </Button>
      </div>

      {/* Search & Filter */}
      <Card className="mb-6">
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/70" />
            <Input
              placeholder="Search by name or email..."
              className="ps-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Select
              value={roleFilter}
              onValueChange={(v) => v && setRoleFilter(v)}
            >
              <SelectTrigger className="h-9 w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="creator">Creator</SelectItem>
                <SelectItem value="brand">Brand</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={statusFilter}
              onValueChange={(v) => v && setStatusFilter(v)}
            >
              <SelectTrigger className="h-9 w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* User Table */}
      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead label="User" sortKey="full_name" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortableHead label="Email" sortKey="email" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortableHead label="Role" sortKey="role" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortableHead label="Status" sortKey="status" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortableHead label="Market" sortKey="primary_market" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortableHead label="Joined" sortKey="created_at" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                <TableHead className="text-end">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar size="sm">
                        <AvatarFallback className="text-xs">
                          {getInitials(user.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <button
                        type="button"
                        className="text-start font-medium transition-colors hover:text-slate-600"
                        onClick={() => openUserDetail(user)}
                      >
                        {user.full_name}
                      </button>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.email}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`text-xs font-medium capitalize ${ROLE_COLORS[user.role] ?? ""}`}
                    >
                      {user.role}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`text-xs font-medium capitalize ${PROFILE_STATUS_COLORS[user.status] ?? PROFILE_STATUS_COLORS.pending}`}
                    >
                      {user.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    {user.primary_market
                      ? getMarketLabel(
                          user.primary_market as Market,
                          locale
                        )
                      : "-"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(user.created_at).toLocaleDateString(locale, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </TableCell>
                  <TableCell className="text-end">
                    {user.role !== "admin" ? (
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          render={
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-8"
                              aria-label={`Open actions for ${user.full_name}`}
                            />
                          }
                        >
                          <MoreHorizontal className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openUserDetail(user)}>
                            View user
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {(user.status === "approved" || user.status === "rejected") && (
                            <DropdownMenuItem
                              onClick={() =>
                                setReReviewTarget({ id: user.id, name: user.full_name })
                              }
                            >
                              Send to review
                            </DropdownMenuItem>
                          )}
                          {user.status === "approved" && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-600 dark:text-red-400"
                                onClick={() => setSuspendTarget(user)}
                              >
                                Suspend access
                              </DropdownMenuItem>
                            </>
                          )}
                          {user.status === "suspended" && (
                            <DropdownMenuItem
                              onClick={() => handleUnsuspend(user.id, user.full_name)}
                            >
                              Restore access
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    ) : (
                      <span className="text-xs text-muted-foreground">Protected</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {sorted.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="py-8 text-center text-sm text-muted-foreground/70"
                  >
                    No users found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          <div className="flex items-center justify-between border-t border-border pt-4">
            <p className="text-sm text-muted-foreground">
              Showing {page * PAGE_SIZE + 1}-
              {Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 0}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => p + 1)}
                disabled={(page + 1) * PAGE_SIZE >= totalCount}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Sheet
        open={detailTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDetailTarget(null);
            setSelectedUserDetail(null);
          }
        }}
      >
        <SheetContent
          side="right"
          className="w-full overflow-y-auto p-0 sm:max-w-xl"
        >
          <SheetHeader className="border-b border-border p-5 pe-12">
            <SheetTitle>{detailTarget?.full_name ?? "User detail"}</SheetTitle>
            <SheetDescription>{detailTarget?.email}</SheetDescription>
          </SheetHeader>

          <div
            data-testid="admin-user-detail-panel"
            className="flex flex-1 flex-col gap-4 px-5 pb-6"
          >
            {detailLoading ? (
              <div className="space-y-3 pt-1">
                <div className="h-24 animate-pulse rounded-xl bg-muted" />
                <div className="h-40 animate-pulse rounded-xl bg-muted" />
                <div className="h-40 animate-pulse rounded-xl bg-muted" />
              </div>
            ) : selectedUserDetail ? (
              <>
                <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-border">
                  <div className="border-e border-border p-3">
                    <div className="text-xs text-muted-foreground">Role</div>
                    <div className="mt-1 text-sm font-medium capitalize">
                      {selectedUserDetail.profile.role}
                    </div>
                  </div>
                  <div className="border-e border-border p-3">
                    <div className="text-xs text-muted-foreground">Status</div>
                    <div className="mt-1 text-sm font-medium capitalize">
                      {activeDetailStatus}
                    </div>
                  </div>
                  <div className="p-3">
                    <div className="text-xs text-muted-foreground">Joined</div>
                    <div className="mt-1 text-sm font-medium">
                      {formatAdminDate(
                        selectedUserDetail.profile.created_at,
                        locale,
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {selectedUserDetail.profile.role === "admin" ? (
                    <span className="rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground">
                      Protected admin account
                    </span>
                  ) : (
                    <>
                      {(activeDetailStatus === "approved" ||
                        activeDetailStatus === "rejected") && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setReReviewTarget({
                              id: selectedUserDetail.profile.id,
                              name: selectedUserDetail.profile.full_name,
                            })
                          }
                        >
                          Send to review
                        </Button>
                      )}
                      {activeDetailStatus === "approved" && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() =>
                            setSuspendTarget(selectedUserDetail.profile)
                          }
                        >
                          Suspend access
                        </Button>
                      )}
                      {activeDetailStatus === "suspended" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleUnsuspend(
                              selectedUserDetail.profile.id,
                              selectedUserDetail.profile.full_name,
                            )
                          }
                        >
                          Restore access
                        </Button>
                      )}
                    </>
                  )}
                </div>

                <section className="rounded-xl border border-border p-4">
                  <div className="mb-3">
                    <h2 className="text-sm font-semibold text-foreground">
                      Related campaigns
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Campaigns this profile owns, joined, or applied to.
                    </p>
                  </div>
                  <div className="space-y-3">
                    {selectedUserDetail.relatedCampaigns.length > 0 ? (
                      selectedUserDetail.relatedCampaigns.map((campaign) => (
                        <Link
                          key={campaign.id}
                          href={`/admin/campaigns/${campaign.id}`}
                          className="block rounded-lg border border-border/80 px-3 py-2 transition-colors hover:border-slate-300 hover:bg-muted/30"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-medium">
                                {campaign.title}
                              </div>
                              <div className="text-xs text-muted-foreground capitalize">
                                {titleize(campaign.relationship)}
                                {campaign.application_status
                                  ? ` / ${titleize(campaign.application_status)}`
                                  : ""}
                              </div>
                            </div>
                            <div className="shrink-0 text-xs text-muted-foreground">
                              {titleize(campaign.status)}
                            </div>
                          </div>
                          <div className="mt-2 text-xs font-medium text-slate-500">
                            Open campaign
                          </div>
                        </Link>
                      ))
                    ) : (
                      <div className="rounded-lg border border-dashed border-border px-3 py-5 text-sm text-muted-foreground">
                        No related campaigns
                      </div>
                    )}
                  </div>
                </section>

                <section className="rounded-xl border border-border p-4">
                  <div className="mb-3">
                    <h2 className="text-sm font-semibold text-foreground">
                      Access history
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Admin actions recorded for this profile.
                    </p>
                  </div>
                  <div className="space-y-3">
                    {selectedUserDetail.auditEntries.length > 0 ? (
                      selectedUserDetail.auditEntries.map((entry) => (
                        <Link
                          key={entry.id}
                          href={`/admin/audit?entry=${entry.id}#audit-entry-${entry.id}`}
                          className="block rounded-lg border border-border/80 px-3 py-2 transition-colors hover:border-slate-300 hover:bg-muted/30"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-medium">
                                {getAdminAuditActionLabel(entry.action)}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {entry.admin_name ??
                                  entry.admin_email ??
                                  "System"}
                              </div>
                            </div>
                            <div className="shrink-0 text-xs text-muted-foreground">
                              {formatAdminDateTime(entry.created_at, locale)}
                            </div>
                          </div>
                          {metadataReason(entry.metadata) && (
                            <div className="mt-2 text-xs text-muted-foreground">
                              {metadataReason(entry.metadata)}
                            </div>
                          )}
                          <div className="mt-2 text-xs font-medium text-slate-500">
                            Open audit
                          </div>
                        </Link>
                      ))
                    ) : (
                      <div className="rounded-lg border border-dashed border-border px-3 py-5 text-sm text-muted-foreground">
                        No access events yet
                      </div>
                    )}
                  </div>
                </section>

                <section className="rounded-xl border border-border p-4">
                  <div className="mb-3">
                    <h2 className="text-sm font-semibold text-foreground">
                      Emails
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Queued and delivered account notifications.
                    </p>
                  </div>
                  <div className="space-y-3">
                    {selectedUserDetail.notificationQueue.length > 0 ? (
                      selectedUserDetail.notificationQueue.map((item) => (
                        <Link
                          key={item.id}
                          href={`/admin/communications?queue=${item.id}#notification-queue-${item.id}`}
                          className="block rounded-lg border border-border/80 px-3 py-2 transition-colors hover:border-slate-300 hover:bg-muted/30"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-medium">
                                {titleize(item.template)}
                              </div>
                              <div className="text-xs text-muted-foreground capitalize">
                                {item.status}
                              </div>
                            </div>
                            <div className="shrink-0 text-xs text-muted-foreground">
                              {formatAdminDateTime(item.created_at, locale)}
                            </div>
                          </div>
                          <div className="mt-2 text-xs font-medium text-slate-500">
                            Open email
                          </div>
                        </Link>
                      ))
                    ) : selectedUserDetail.notifications.length > 0 ? (
                      selectedUserDetail.notifications.map((notification) => (
                        <Link
                          key={notification.id}
                          href={`/admin/communications?notification=${notification.id}`}
                          className="block rounded-lg border border-border/80 px-3 py-2 transition-colors hover:border-slate-300 hover:bg-muted/30"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-medium">
                                {notification.title}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {titleize(notification.type)}
                              </div>
                            </div>
                            <div className="shrink-0 text-xs text-muted-foreground">
                              {formatAdminDateTime(
                                notification.created_at,
                                locale,
                              )}
                            </div>
                          </div>
                          <div className="mt-2 text-xs font-medium text-slate-500">
                            Open email
                          </div>
                        </Link>
                      ))
                    ) : (
                      <div className="rounded-lg border border-dashed border-border px-3 py-5 text-sm text-muted-foreground">
                        No account emails yet
                      </div>
                    )}
                  </div>
                </section>

                <section className="rounded-xl border border-border p-4">
                  <div className="mb-3">
                    <h2 className="text-sm font-semibold text-foreground">
                      Privacy requests
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Privacy requests tied to this account.
                    </p>
                  </div>
                  <div className="space-y-3">
                    {selectedUserDetail.dataRightsRequests.length > 0 ? (
                      selectedUserDetail.dataRightsRequests.map((request) => (
                        <Link
                          key={request.id}
                          href={`/admin/settings?data_rights=${request.id}#data-rights-request-${request.id}`}
                          className="block rounded-lg border border-border/80 px-3 py-2 transition-colors hover:border-slate-300 hover:bg-muted/30"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-sm font-medium">
                                {titleize(request.request_type)}
                              </div>
                              <div className="text-xs text-muted-foreground capitalize">
                                {request.status}
                              </div>
                            </div>
                            <div className="shrink-0 text-xs text-muted-foreground">
                              {formatAdminDateTime(request.created_at, locale)}
                            </div>
                          </div>
                          {request.scheduled_for && (
                            <div className="mt-2 text-xs text-muted-foreground">
                              Scheduled {formatAdminDate(request.scheduled_for, locale)}
                            </div>
                          )}
                          <div className="mt-2 text-xs font-medium text-slate-500">
                            Open request
                          </div>
                        </Link>
                      ))
                    ) : (
                      <div className="rounded-lg border border-dashed border-border px-3 py-5 text-sm text-muted-foreground">
                        No privacy requests
                      </div>
                    )}
                  </div>
                </section>
              </>
            ) : (
              <div className="rounded-lg border border-dashed border-border px-3 py-5 text-sm text-muted-foreground">
                Select a user to see operational history.
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog
        open={suspendTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSuspendTarget(null);
            setSuspendReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend access</DialogTitle>
            <DialogDescription>
              {suspendTarget?.full_name} will lose access immediately. The
              reason is saved to audit and sent to the account email.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
            <div className="font-medium text-foreground">
              {suspendTarget?.email}
            </div>
            <div className="text-muted-foreground capitalize">
              {suspendTarget?.role} / {suspendTarget?.status}
            </div>
          </div>
          <Textarea
            data-testid="admin-users-suspend-reason"
            placeholder="Reason for suspension"
            rows={4}
            value={suspendReason}
            onChange={(e) => setSuspendReason(e.target.value)}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSuspendTarget(null);
                setSuspendReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleSuspend}
              disabled={!suspendReason.trim() || suspendSubmitting}
            >
              {suspendSubmitting ? "Suspending..." : "Suspend access"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Re-review Dialog */}
      <Dialog
        open={reReviewTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setReReviewTarget(null);
            setReReviewReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Re-review {reReviewTarget?.name}</DialogTitle>
            <DialogDescription>
              This will reset their status to pending and send them a
              notification. Provide a reason for the re-review.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="Reason for re-review..."
            value={reReviewReason}
            onChange={(e) => setReReviewReason(e.target.value)}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setReReviewTarget(null);
                setReReviewReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReReview}
              disabled={!reReviewReason.trim() || reReviewSubmitting}
            >
              {reReviewSubmitting ? "Submitting..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
