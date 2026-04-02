"use client";

import { useState, useEffect } from "react";
import { Search } from "lucide-react";
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
import { getMarketLabel } from "@/lib/constants";
import type { Market } from "@/lib/constants";
import { useI18n } from "@/lib/i18n/context";
import { createClient } from "@/lib/supabase/client";
import { suspendUser, unsuspendUser } from "@/app/actions/admin";
import { toast } from "sonner";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name: string): string {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

const statusColors: Record<string, string> = {
  approved: "bg-emerald-100 text-emerald-700",
  pending: "bg-amber-100 text-amber-700",
  suspended: "bg-red-100 text-red-700",
  rejected: "bg-slate-100 text-slate-600",
};

const roleColors: Record<string, string> = {
  creator: "bg-slate-100 text-slate-700",
  brand: "bg-slate-100 text-slate-700",
  admin: "bg-slate-900 text-white",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminUsersPage() {
  const { locale } = useI18n();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  async function loadUsers() {
    const supabase = createClient();

    // Fetch profiles with creator primary_market
    let query = supabase
      .from("profiles")
      .select(`
        id, full_name, email, role, status, avatar_url, created_at,
        creator_profiles!creator_profiles_profile_id_fkey (primary_market)
      `)
      .order("created_at", { ascending: false })
      .limit(200);

    const { data } = await query;

    if (data) {
      setUsers(
        data.map((u: any) => ({
          ...u,
          primary_market: u.creator_profiles?.[0]?.primary_market ?? u.creator_profiles?.primary_market ?? null,
        }))
      );
    }
    setLoading(false);
  }

  useEffect(() => {
    loadUsers();
  }, []);

  const filtered = users.filter((u) => {
    if (roleFilter !== "all" && u.role !== roleFilter) return false;
    if (statusFilter !== "all" && u.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!u.full_name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false;
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

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-6 lg:px-8">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-100" />
        <div className="h-16 animate-pulse rounded-xl bg-slate-100" />
        <div className="h-96 animate-pulse rounded-xl bg-slate-100" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">User Management</h1>
        <p className="text-sm text-slate-500">{users.length} total users</p>
      </div>

      {/* Search & Filter */}
      <Card className="mb-6">
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search by name or email..."
              className="ps-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Select value={roleFilter} onValueChange={(v) => v && setRoleFilter(v)}>
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
            <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
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
                        <AvatarFallback className="text-xs">{getInitials(user.full_name)}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{user.full_name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-500">{user.email}</TableCell>
                  <TableCell>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${roleColors[user.role]}`}>
                      {user.role}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusColors[user.status] ?? statusColors.pending}`}>
                      {user.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    {user.primary_market
                      ? getMarketLabel(user.primary_market as Market, locale)
                      : "—"}
                  </TableCell>
                  <TableCell className="text-slate-500">
                    {new Date(user.created_at).toLocaleDateString(locale, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </TableCell>
                  <TableCell className="text-end">
                    {user.status === "approved" && user.role !== "admin" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => handleSuspend(user.id, user.full_name)}
                      >
                        Suspend
                      </Button>
                    )}
                    {user.status === "suspended" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleUnsuspend(user.id, user.full_name)}
                      >
                        Unsuspend
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-sm text-slate-400">
                    No users found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
