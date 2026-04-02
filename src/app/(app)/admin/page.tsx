"use client";

import { useState, useEffect } from "react";
import {
  AlertTriangle,
  Users,
  ShieldCheck,
  Megaphone,
  TrendingUp,
  Clock,
  ArrowRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LinkButton } from "@/components/ui/link-button";
import { createClient } from "@/lib/supabase/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AdminStats {
  totalUsers: number;
  pendingApprovals: number;
  overdueApprovals: number;
  activeCampaigns: number;
  completedCampaigns: number;
  totalCampaigns: number;
  creatorsCount: number;
  brandsCount: number;
  newUsersThisWeek: number;
}

interface QueueItem {
  priority: "high" | "medium" | "low";
  label: string;
  action: string;
  href: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      // Parallel queries for dashboard stats
      const [
        { count: totalUsers },
        { count: pendingApprovals },
        { count: creatorsCount },
        { count: brandsCount },
        { count: activeCampaigns },
        { count: completedCampaigns },
        { count: totalCampaigns },
      ] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "creator"),
        supabase.from("profiles").select("id", { count: "exact", head: true }).eq("role", "brand"),
        supabase.from("campaigns").select("id", { count: "exact", head: true }).not("status", "in", '("draft","completed","cancelled","paused")'),
        supabase.from("campaigns").select("id", { count: "exact", head: true }).eq("status", "completed"),
        supabase.from("campaigns").select("id", { count: "exact", head: true }),
      ]);

      // Overdue approvals (pending > 24h)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count: overdueApprovals } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
        .lt("created_at", oneDayAgo);

      // New users this week
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { count: newUsersThisWeek } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .gt("created_at", oneWeekAgo);

      setStats({
        totalUsers: totalUsers ?? 0,
        pendingApprovals: pendingApprovals ?? 0,
        overdueApprovals: overdueApprovals ?? 0,
        activeCampaigns: activeCampaigns ?? 0,
        completedCampaigns: completedCampaigns ?? 0,
        totalCampaigns: totalCampaigns ?? 0,
        creatorsCount: creatorsCount ?? 0,
        brandsCount: brandsCount ?? 0,
        newUsersThisWeek: newUsersThisWeek ?? 0,
      });
      setLoading(false);
    }
    load();
  }, []);

  const completionRate = stats && stats.totalCampaigns > 0
    ? Math.round((stats.completedCampaigns / stats.totalCampaigns) * 100)
    : 0;

  const kpis = stats
    ? [
        { label: "Total Users", value: String(stats.totalUsers), detail: `${stats.creatorsCount} creators · ${stats.brandsCount} brands`, icon: Users },
        { label: "Pending Approvals", value: String(stats.pendingApprovals), detail: stats.overdueApprovals > 0 ? `${stats.overdueApprovals} overdue` : "All on time", icon: ShieldCheck },
        { label: "Active Campaigns", value: String(stats.activeCampaigns), detail: `${stats.totalCampaigns} total`, icon: Megaphone },
        { label: "Completion Rate", value: `${completionRate}%`, detail: `${stats.completedCampaigns} completed`, icon: TrendingUp },
        { label: "New This Week", value: String(stats.newUsersThisWeek), detail: "Signups last 7 days", icon: Clock },
      ]
    : [];

  const queue: QueueItem[] = [];
  if (stats) {
    if (stats.overdueApprovals > 0) {
      queue.push({
        priority: "high",
        label: `${stats.overdueApprovals} approval${stats.overdueApprovals > 1 ? "s" : ""} pending > 24 hours`,
        action: "Review",
        href: "/admin/approvals",
      });
    }
    if (stats.pendingApprovals > 0) {
      queue.push({
        priority: "medium",
        label: `${stats.pendingApprovals} total pending approval${stats.pendingApprovals > 1 ? "s" : ""}`,
        action: "Review",
        href: "/admin/approvals",
      });
    }
    if (stats.activeCampaigns > 0) {
      queue.push({
        priority: "low",
        label: `${stats.activeCampaigns} active campaign${stats.activeCampaigns > 1 ? "s" : ""} in progress`,
        action: "View",
        href: "/admin/campaigns",
      });
    }
  }

  const priorityColors: Record<string, string> = {
    high: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400 border-red-200",
    medium: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400 border-amber-200",
    low: "bg-muted/50 text-muted-foreground border-border",
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Alert Banner */}
      {stats && stats.overdueApprovals > 0 && (
        <div className="mb-6 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/50 px-4 py-3">
          <AlertTriangle className="size-5 shrink-0 text-amber-600" />
          <div className="flex-1">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              {stats.overdueApprovals} approval{stats.overdueApprovals > 1 ? "s" : ""} pending for more than 24 hours
            </p>
            <p className="text-xs text-amber-600">SLA target: approve within 24h of application</p>
          </div>
          <LinkButton href="/admin/approvals" size="sm" variant="outline" className="shrink-0 border-amber-300 text-amber-700 hover:bg-amber-100">
            Review Now
          </LinkButton>
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Platform overview and action items</p>
      </div>

      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
          <div className="h-64 animate-pulse rounded-xl bg-muted" />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
            {kpis.map((kpi) => (
              <Card key={kpi.label}>
                <CardContent className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <kpi.icon className="size-5" />
                  </div>
                  <div>
                    <p className="text-xl font-bold text-foreground">{kpi.value}</p>
                    <p className="text-xs text-muted-foreground">{kpi.label}</p>
                    <p className="text-xs text-muted-foreground/70">{kpi.detail}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Queue */}
          {queue.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Action Items</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {queue.map((item, i) => (
                    <div
                      key={i}
                      className={`flex items-center justify-between rounded-lg border px-4 py-3 ${priorityColors[item.priority]}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className={`size-2 rounded-full ${item.priority === "high" ? "bg-red-500" : item.priority === "medium" ? "bg-amber-500" : "bg-muted-foreground/50"}`} />
                        <span className="text-sm">{item.label}</span>
                      </div>
                      <LinkButton href={item.href} variant="ghost" size="sm">
                        {item.action} <ArrowRight className="size-3.5 rtl:rotate-180" />
                      </LinkButton>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Links */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="text-center">
                <ShieldCheck className="mx-auto mb-2 size-8 text-muted-foreground/50" />
                <p className="text-sm font-medium text-foreground">Approvals</p>
                <p className="mb-3 text-xs text-muted-foreground/70">{stats?.pendingApprovals ?? 0} pending</p>
                <LinkButton href="/admin/approvals" variant="outline" size="sm">
                  Review Queue
                </LinkButton>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="text-center">
                <Users className="mx-auto mb-2 size-8 text-muted-foreground/50" />
                <p className="text-sm font-medium text-foreground">Users</p>
                <p className="mb-3 text-xs text-muted-foreground/70">{stats?.totalUsers ?? 0} total</p>
                <LinkButton href="/admin/users" variant="outline" size="sm">
                  Manage Users
                </LinkButton>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="text-center">
                <Megaphone className="mx-auto mb-2 size-8 text-muted-foreground/50" />
                <p className="text-sm font-medium text-foreground">Campaigns</p>
                <p className="mb-3 text-xs text-muted-foreground/70">{stats?.activeCampaigns ?? 0} active</p>
                <LinkButton href="/admin/campaigns" variant="outline" size="sm">
                  View All
                </LinkButton>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
