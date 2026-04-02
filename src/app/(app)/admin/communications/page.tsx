"use client";

import { useState, useEffect } from "react";
import {
  Bell,
  Mail,
  FileText,
  Plus,
  Users,
  Clock,
  Inbox,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import { getSingleRelation } from "@/lib/supabase/relations";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NotificationGroup {
  type: string;
  count: number;
  latest_at: string;
}

interface RecentNotification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  created_at: string;
  user_name: string;
}

interface NotificationUserRecord {
  full_name: string | null;
}

interface RecentNotificationRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  created_at: string;
  user: NotificationUserRecord | NotificationUserRecord[] | null;
}

// Static notification templates (config, not data)
const templates = [
  {
    id: "t1",
    name: "Welcome - Creator",
    type: "email",
    trigger: "On creator approval",
  },
  {
    id: "t2",
    name: "Welcome - Brand",
    type: "email",
    trigger: "On brand approval",
  },
  {
    id: "t3",
    name: "New Campaign Match",
    type: "email",
    trigger: "On campaign publish (matching creators)",
  },
  {
    id: "t4",
    name: "Application Accepted",
    type: "email",
    trigger: "On application acceptance",
  },
  {
    id: "t5",
    name: "Application Rejected",
    type: "email",
    trigger: "On application rejection",
  },
  {
    id: "t6",
    name: "Content Submitted",
    type: "email",
    trigger: "On content submission",
  },
  {
    id: "t7",
    name: "Content Approved",
    type: "email",
    trigger: "On content approval",
  },
  {
    id: "t8",
    name: "Revision Requested",
    type: "email",
    trigger: "On revision request",
  },
  {
    id: "t9",
    name: "Campaign Completed",
    type: "email",
    trigger: "On campaign status change to completed",
  },
  {
    id: "t10",
    name: "Deadline Reminder",
    type: "email",
    trigger: "48h before content deadline",
  },
];

// Friendly labels for notification types
const typeLabels: Record<string, string> = {
  account_approved: "Account Approved",
  account_rejected: "Account Rejected",
  campaign_match: "Campaign Match",
  application_received: "Application Received",
  application_accepted: "Application Accepted",
  application_rejected: "Application Rejected",
  counter_offer: "Counter Offer",
  content_submitted: "Content Submitted",
  content_approved: "Content Approved",
  revision_requested: "Revision Requested",
  new_message: "New Message",
  campaign_completed: "Campaign Completed",
  review_received: "Review Received",
  content_due_soon: "Content Due Soon",
  payment_sent: "Payment Sent",
  payment_received: "Payment Received",
  tier_upgrade: "Tier Upgrade",
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AdminCommunicationsPage() {
  const [groups, setGroups] = useState<NotificationGroup[]>([]);
  const [recent, setRecent] = useState<RecentNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();

      // Recent notifications (last 50)
      const { data: recentData } = await supabase
        .from("notifications")
        .select(
          `id, type, title, body, created_at,
           user:profiles!notifications_user_id_fkey(full_name)`
        )
        .order("created_at", { ascending: false })
        .limit(50);

      const recentRows: RecentNotification[] = (recentData ?? []).map((row) => {
        const notification = row as RecentNotificationRow;
        const user = getSingleRelation(notification.user);

        return {
          id: notification.id,
          type: notification.type,
          title: notification.title,
          body: notification.body,
          created_at: notification.created_at,
          user_name: user?.full_name ?? "Unknown",
        };
      });
      setRecent(recentRows);

      // Group by type for summary
      const groupMap: Record<string, { count: number; latest_at: string }> = {};
      for (const n of recentRows) {
        if (!groupMap[n.type]) {
          groupMap[n.type] = { count: 0, latest_at: n.created_at };
        }
        groupMap[n.type].count++;
        if (n.created_at > groupMap[n.type].latest_at) {
          groupMap[n.type].latest_at = n.created_at;
        }
      }
      const groupRows: NotificationGroup[] = Object.entries(groupMap)
        .map(([type, data]) => ({ type, ...data }))
        .sort((a, b) => b.count - a.count);
      setGroups(groupRows);

      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Communications</h1>
        <p className="text-sm text-muted-foreground">
          Recent notifications and notification templates
        </p>
      </div>

      {/* Announcements placeholder */}
      <Card className="mb-8">
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="size-5 text-muted-foreground" />
            <CardTitle>Announcements</CardTitle>
          </div>
          <Button size="sm" disabled>
            <Plus className="size-3.5" /> New Announcement
          </Button>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-dashed border-border py-8 text-center">
            <Bell className="mx-auto mb-3 size-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              Announcements coming soon
            </p>
            <p className="text-xs text-muted-foreground/70">
              Platform-wide announcements will be managed here
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Recent notifications by type */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="size-5 text-muted-foreground" />
            <CardTitle>Recent Notifications (Last 50)</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : groups.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-8 text-center">
              <Inbox className="mx-auto mb-3 size-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                No notifications sent yet
              </p>
              <p className="text-xs text-muted-foreground/70">
                Notifications will appear here as users interact with the
                platform
              </p>
            </div>
          ) : (
            <>
              {/* Summary by type */}
              <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {groups.map((g) => (
                  <div
                    key={g.type}
                    className="rounded-lg border border-border p-3"
                  >
                    <p className="text-lg font-bold text-foreground">
                      {g.count}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {typeLabels[g.type] ?? g.type}
                    </p>
                  </div>
                ))}
              </div>

              {/* Recent list */}
              <div className="space-y-2">
                {recent.map((n) => (
                  <div
                    key={n.id}
                    className="flex items-start gap-3 rounded-lg border border-border/50 px-4 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {n.title}
                        </span>
                        <Badge variant="secondary" className="shrink-0 text-xs">
                          {typeLabels[n.type] ?? n.type}
                        </Badge>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                        <Users className="size-3" />
                        {n.user_name}
                        <span className="text-muted-foreground/50">|</span>
                        <Clock className="size-3" />
                        {new Date(n.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Notification Templates (static config) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="size-5 text-muted-foreground" />
            <CardTitle>Notification Templates</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                  <th className="pb-3 pr-4">Template Name</th>
                  <th className="pb-3 pr-4">Type</th>
                  <th className="pb-3">Trigger</th>
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr
                    key={t.id}
                    className="border-b border-border/50 last:border-0"
                  >
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-2">
                        <FileText className="size-3.5 text-muted-foreground/70" />
                        <span className="font-medium text-foreground">
                          {t.name}
                        </span>
                      </div>
                    </td>
                    <td className="py-2.5 pr-4">
                      <Badge variant="secondary" className="text-xs">
                        {t.type}
                      </Badge>
                    </td>
                    <td className="py-2.5 text-muted-foreground">
                      {t.trigger}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
