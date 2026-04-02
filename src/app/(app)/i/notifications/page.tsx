"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Bell,
  CheckCircle2,
  Clock,
  DollarSign,
  FileCheck,
  MessageSquare,
  Star,
  UserCheck,
  XCircle,
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
  | "campaign_match"
  | "application_accepted"
  | "application_rejected"
  | "revision_requested"
  | "content_approved"
  | "message"
  | "payment"
  | "review"
  | "deadline"
  | "tier_upgrade"
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

const notificationConfig: Record<
  NotificationType,
  { icon: typeof Bell; color: string; bg: string }
> = {
  campaign_match: { icon: Zap, color: "text-slate-600", bg: "bg-slate-50" },
  application_accepted: {
    icon: CheckCircle2,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
  application_rejected: {
    icon: XCircle,
    color: "text-slate-500",
    bg: "bg-slate-50",
  },
  revision_requested: {
    icon: FileCheck,
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
  content_approved: {
    icon: CheckCircle2,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
  message: {
    icon: MessageSquare,
    color: "text-slate-600",
    bg: "bg-slate-50",
  },
  payment: {
    icon: DollarSign,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
  review: { icon: Star, color: "text-amber-500", bg: "bg-amber-50" },
  deadline: { icon: Clock, color: "text-red-600", bg: "bg-red-50" },
  tier_upgrade: { icon: Zap, color: "text-slate-900", bg: "bg-slate-100" },
  account_approved: {
    icon: UserCheck,
    color: "text-emerald-600",
    bg: "bg-emerald-50",
  },
};

function hrefForNotification(n: Notification): string {
  const data = n.data as Record<string, string> | null;
  switch (n.type) {
    case "campaign_match":
      return data?.campaign_id ? `/i/discover/${data.campaign_id}` : "/i/discover";
    case "application_accepted":
    case "revision_requested":
    case "content_approved":
    case "deadline":
      return data?.campaign_id ? `/i/campaigns/${data.campaign_id}` : "/i/campaigns";
    case "application_rejected":
      return "/i/campaigns";
    case "payment":
      return "/i/earnings";
    case "review":
      return "/i/profile";
    default:
      return "/i/home";
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

export default function NotificationsPage() {
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
      <div className="mx-auto max-w-2xl space-y-4 p-4 lg:p-6">
        <div className="flex items-center justify-between">
          <div className="h-6 w-32 animate-pulse rounded bg-slate-100" />
          <div className="h-4 w-20 animate-pulse rounded bg-slate-50" />
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-xl border border-slate-200/60 bg-white p-4"
            >
              <div className="size-8 animate-pulse rounded-full bg-slate-100" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-48 animate-pulse rounded bg-slate-100" />
                <div className="h-3 w-32 animate-pulse rounded bg-slate-50" />
              </div>
              <div className="h-3 w-10 animate-pulse rounded bg-slate-50" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 lg:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">
            {t("title")}
          </h1>
          {unreadCount > 0 && (
            <p className="mt-0.5 text-sm text-slate-500">
              {unreadCount} unread
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="text-slate-600"
            onClick={markAllRead}
          >
            {t("markAllRead")}
          </Button>
        )}
      </div>

      {notifications.length > 0 ? (
        <div className="space-y-2">
          {notifications.map((n) => {
            const config =
              notificationConfig[n.type] || notificationConfig.campaign_match;
            const Icon = config.icon;
            return (
              <Link
                key={n.id}
                href={hrefForNotification(n)}
                className="block"
              >
                <Card
                  className={`transition-shadow hover:shadow-md ${
                    !n.read ? "border-s-2 border-s-slate-900" : ""
                  }`}
                >
                  <CardContent className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 shrink-0 rounded-lg p-2 ${config.bg} ${config.color}`}
                    >
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={`text-sm ${
                            n.read
                              ? "text-slate-600"
                              : "font-medium text-slate-900"
                          }`}
                        >
                          {n.title}
                        </p>
                        {!n.read && (
                          <span className="mt-1.5 size-2 shrink-0 rounded-full bg-slate-900" />
                        )}
                      </div>
                      {n.body && (
                        <p className="mt-0.5 text-xs text-slate-400 line-clamp-2">
                          {n.body}
                        </p>
                      )}
                      <p className="mt-1 text-[11px] text-slate-300">
                        {timeAgo(n.created_at, tc, locale)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 py-16 text-center">
          <Bell className="mb-3 size-8 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">
            {t("empty")}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Notifications will appear here as you use the platform.
          </p>
        </div>
      )}
    </div>
  );
}
