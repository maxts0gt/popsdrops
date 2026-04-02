"use client";

import { useState, useEffect } from "react";
import { Search, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { getMarketLabel } from "@/lib/constants";
import type { Market } from "@/lib/constants";
import { useI18n } from "@/lib/i18n/context";
import { createClient } from "@/lib/supabase/client";
import { getSingleRelation } from "@/lib/supabase/relations";
import { suspendUser, unsuspendUser, reReviewProfile } from "@/app/actions/admin";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const PAGE_SIZE = 50;

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

const statusColors: Record<string, string> = {
  approved: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  suspended: "bg-red-100 text-red-700",
  rejected: "bg-muted text-muted-foreground",
};

const roleColors: Record<string, string> = {
  creator: "bg-muted text-foreground",
  brand: "bg-muted text-foreground",
  admin: "bg-primary text-primary-foreground",
};

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

  // Re-review dialog state
  const [reReviewTarget, setReReviewTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [reReviewReason, setReReviewReason] = useState("");
  const [reReviewSubmitting, setReReviewSubmitting] = useState(false);

  async function loadUsers() {
    setLoading(true);
    const result = await fetchUsers(page);
    setUsers(result.users);
    setTotalCount(result.totalCount);
    setLoading(false);
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

  async function handleSuspend(userId: string, name: string) {
    try {
      await suspendUser(userId, "Suspended by admin");
      toast.success(`${name} suspended`);
      loadUsers();
    } catch {
      toast.error("Failed to suspend user");
    }
  }

  async function handleUnsuspend(userId: string, name: string) {
    try {
      await unsuspendUser(userId);
      toast.success(`${name} unsuspended`);
      loadUsers();
    } catch {
      toast.error("Failed to unsuspend user");
    }
  }

  async function handleReReview() {
    if (!reReviewTarget || !reReviewReason.trim()) return;
    setReReviewSubmitting(true);
    try {
      await reReviewProfile(reReviewTarget.id, reReviewReason.trim());
      toast.success(`${reReviewTarget.name} sent for re-review`);
      setReReviewTarget(null);
      setReReviewReason("");
      loadUsers();
    } catch {
      toast.error("Failed to re-review user");
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
          <h1 className="text-2xl font-bold text-foreground">User Management</h1>
          <p className="text-sm text-muted-foreground">
            {totalCount} total users
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
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Market</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-end">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar size="sm">
                        <AvatarFallback className="text-xs">
                          {getInitials(user.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{user.full_name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {user.email}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${roleColors[user.role]}`}
                    >
                      {user.role}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusColors[user.status] ?? statusColors.pending}`}
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
                      : "\u2014"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(user.created_at).toLocaleDateString(locale, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </TableCell>
                  <TableCell className="text-end">
                    <div className="flex items-center justify-end gap-1">
                      {(user.status === "approved" ||
                        user.status === "rejected") &&
                        user.role !== "admin" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setReReviewTarget({
                                id: user.id,
                                name: user.full_name,
                              })
                            }
                          >
                            Re-review
                          </Button>
                        )}
                      {user.status === "approved" && user.role !== "admin" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() =>
                            handleSuspend(user.id, user.full_name)
                          }
                        >
                          Suspend
                        </Button>
                      )}
                      {user.status === "suspended" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleUnsuspend(user.id, user.full_name)
                          }
                        >
                          Unsuspend
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
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
              Showing {page * PAGE_SIZE + 1}&ndash;
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
