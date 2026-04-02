"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Bell,
  Users,
  FileCheck,
  MessageSquare,
  Star,
  CheckCircle,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useI18n, useTranslation } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type NotificationType =
  | "new_application"
  | "content_submitted"
  | "content_published"
  | "new_message"
  | "new_review"
  | "campaign_completed"
  | "performance_submitted"
  | "account_approved";

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  read: boolean;
  data: Record<string, unknown> | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const iconMap: Record<
  string,
  { icon: typeof Bell; color: string }
> = {
  new_application: { icon: Users, color: "bg-muted/50 text-muted-foreground" },
  content_submitted: { icon: FileCheck, color: "bg-muted/50 text-muted-foreground" },
  content_published: { icon: TrendingUp, color: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400" },
  new_message: { icon: MessageSquare, color: "bg-muted/50 text-muted-foreground" },
  new_review: { icon: Star, color: "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400" },
  campaign_completed: { icon: CheckCircle, color: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400" },
  performance_submitted: { icon: Zap, color: "bg-muted/50 text-muted-foreground" },
  account_approved: { icon: CheckCircle, color: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400" },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hrefForNotification(n: Notification): string {
  const data = n.data || {};
  switch (n.type) {
    case "new_application":
    case "content_submitted":
    case "content_published":
    case "new_message":
    case "performance_submitted":
      return data?.campaign_id ? `/b/campaigns/${data.campaign_id}` : "/b/campaigns";
    case "campaign_completed":
      return data?.campaign_id ? `/b/campaigns/${data.campaign_id}/report` : "/b/campaigns";
    case "new_review":
      return "/b/home";
    default:
      return "/b/home";
  }
}

function timeAgo(
  dateStr: string,
  tc: (key: string, vars?: Record<string, string>) => string,
  locale = "en"
): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return tc("time.justNow");
  if (minutes < 60) return tc("time.minutesAgo", { count: String(minutes) });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return tc("time.hoursAgo", { count: String(hours) });
  const days = Math.floor(hours / 24);
  if (days === 1) return tc("time.yesterday");
  if (days < 7) return tc("time.daysAgo", { count: String(days) });
  return new Date(dateStr).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BrandNotificationsPage() {
  const { t } = useTranslation("notifications");
  const { t: tc } = useTranslation("ui.common");
  const { locale } = useI18n();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("notifications")
        .select("id, type, title, body, read, data, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (data) setNotifications(data as Notification[]);
      setLoading(false);
    }
    load();
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  async function markAllRead() {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false);

    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <div className="h-7 w-32 animate-pulse rounded bg-muted" />
          <div className="h-4 w-20 animate-pulse rounded bg-muted/50" />
        </div>
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="flex items-start gap-3 rounded-xl border border-border/60 bg-card p-4"
          >
            <div className="size-9 animate-pulse rounded-full bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-52 animate-pulse rounded bg-muted" />
              <div className="h-3 w-36 animate-pulse rounded bg-muted/50" />
            </div>
            <div className="h-3 w-12 animate-pulse rounded bg-muted/50" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" onClick={markAllRead}>
            {t("markAllRead")}
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center">
          <Bell className="mx-auto mb-3 size-8 text-muted-foreground/50" />
          <p className="text-sm font-medium text-foreground">{t("empty")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => {
            const config = iconMap[n.type] || iconMap.new_application;
            const Icon = config.icon;
            return (
              <Link key={n.id} href={hrefForNotification(n)}>
                <Card
                  className={`transition-colors hover:bg-muted/50 ${
                    !n.read ? "border-s-2 border-s-foreground" : ""
                  }`}
                >
                  <CardContent className="flex gap-3">
                    <div
                      className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${config.color}`}
                    >
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3
                          className={`text-sm ${
                            !n.read
                              ? "font-semibold text-foreground"
                              : "font-medium text-foreground"
                          }`}
                        >
                          {n.title}
                        </h3>
                        <span className="shrink-0 text-xs text-muted-foreground/70">
                          {timeAgo(n.created_at, tc, locale)}
                        </span>
                      </div>
                      {n.body && (
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {n.body}
                        </p>
                      )}
                    </div>
                    {!n.read && (
                      <div className="mt-1 size-2 shrink-0 rounded-full bg-foreground" />
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
