"use client";

import { useState, useEffect, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Bell,
  CheckCircle2,
  Clock,
  BadgeCheck,
  DollarSign,
  FileCheck,
  Megaphone,
  Star,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { NotificationEmailPreferencesPanel } from "@/components/shared/notification-email-preferences-panel";
import { getCreatorNotificationHref } from "@/lib/campaigns/creator-campaign-links";
import {
  getCreatorNotificationPresentation,
  type CreatorNotificationIconKey,
  type CreatorNotificationTone,
} from "@/lib/campaigns/creator-notification-presentation";
import { useI18n, useTranslation } from "@/lib/i18n";
import { createClient, getBrowserUser } from "@/lib/supabase/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type NotificationType =
  | "campaign_match"
  | "application_accepted"
  | "application_rejected"
  | "revision_requested"
  | "report_correction_requested"
  | "report_follow_up_requested"
  | "content_approved"
  | "campaign_update"
  | "payment_sent"
  | "payment_received"
  | "payment"
  | "review_received"
  | "review"
  | "content_due_soon"
  | "deadline"
  | "tier_upgrade"
  | "account_approved"
  | "account_suspended"
  | "account_restored"
  | "account_review_reopened";

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

const notificationIcons: Record<CreatorNotificationIconKey, typeof Bell> = {
  announcement: Megaphone,
  approval: CheckCircle2,
  deadline: Clock,
  payment: DollarSign,
  profile: BadgeCheck,
  review: Star,
  task: FileCheck,
};

const notificationToneClasses: Record<
  CreatorNotificationTone,
  { color: string; bg: string }
> = {
  danger: {
    color: "text-red-600",
    bg: "bg-red-50 dark:bg-red-950",
  },
  neutral: {
    color: "text-muted-foreground",
    bg: "bg-muted/50",
  },
  success: {
    color: "text-emerald-600",
    bg: "bg-emerald-50 dark:bg-emerald-950",
  },
  warning: {
    color: "text-amber-600",
    bg: "bg-amber-50 dark:bg-amber-950",
  },
};

function hrefForNotification(n: Notification): string {
  return getCreatorNotificationHref(n.type, n.data);
}

function shouldUseNativeLinkNavigation(
  event: MouseEvent<HTMLAnchorElement>,
): boolean {
  return (
    event.defaultPrevented ||
    event.metaKey ||
    event.altKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.button !== 0
  );
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
  const router = useRouter();
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
      } = await getBrowserUser();
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
    const previousNotifications = notifications;
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);
    if (unreadIds.length === 0) return;

    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await getBrowserUser();
      if (!user) throw new Error("Missing user");

      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .in("id", unreadIds);

      if (error) throw error;
    } catch {
      setNotifications(previousNotifications);
      toast.error(t("readUpdateError"));
    }
  }

  async function markNotificationRead(notificationId: string) {
    const notification = notifications.find((n) => n.id === notificationId);
    if (!notification || notification.read) return;

    setNotifications((prev) =>
      prev.map((n) => (n.id === notificationId ? { ...n, read: true } : n)),
    );

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await getBrowserUser();
      if (!user) throw new Error("Missing user");

      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("user_id", user.id)
        .eq("id", notificationId);

      if (error) throw error;
    } catch {
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, read: false } : n,
        ),
      );
      toast.error(t("readUpdateError"));
    }
  }

  async function handleNotificationClick(
    event: MouseEvent<HTMLAnchorElement>,
    n: Notification,
  ) {
    if (shouldUseNativeLinkNavigation(event)) return;

    event.preventDefault();
    const href = hrefForNotification(n);
    await markNotificationRead(n.id);
    router.push(href);
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-4 lg:p-6">
        <div className="flex items-center justify-between">
          <div className="h-6 w-32 animate-pulse rounded bg-muted" />
          <div className="h-4 w-20 animate-pulse rounded bg-muted/50" />
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-xl border border-border/60 bg-card p-4"
            >
              <div className="size-8 animate-pulse rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-48 animate-pulse rounded bg-muted" />
                <div className="h-3 w-32 animate-pulse rounded bg-muted/50" />
              </div>
              <div className="h-3 w-10 animate-pulse rounded bg-muted/50" />
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
          <h1 className="text-xl font-semibold text-foreground">
            {t("title")}
          </h1>
          {unreadCount > 0 && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {t("unreadCount", { count: String(unreadCount) })}
            </p>
          )}
          {notifications.length > 0 && unreadCount === 0 && (
            <p className="mt-0.5 text-sm text-muted-foreground">
              {t("allCaughtUp")}
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={markAllRead}
          >
            {t("markAllRead")}
          </Button>
        )}
      </div>

      <NotificationEmailPreferencesPanel
        variant="compact"
        className="rounded-xl border border-border bg-card p-3 shadow-sm"
      />

      {notifications.length > 0 ? (
        <div className="space-y-2">
          {notifications.map((n) => {
            const presentation = getCreatorNotificationPresentation({
              type: n.type,
              data: n.data,
            });
            const Icon = notificationIcons[presentation.iconKey];
            const tone = notificationToneClasses[presentation.tone];
            return (
              <Link
                key={n.id}
                href={hrefForNotification(n)}
                className="block"
                onClick={(event) => handleNotificationClick(event, n)}
              >
                <Card
                  size="sm"
                  data-read-state={!n.read ? "unread" : "read"}
                  className={`transition-colors duration-150 hover:bg-slate-50/70 ${
                    !n.read
                      ? "bg-slate-50/70 ring-slate-900/10 shadow-[0_8px_24px_-22px_rgba(15,23,42,0.45)]"
                      : "bg-card ring-border/70"
                  }`}
                >
                  <CardContent className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 shrink-0 rounded-lg p-2 ${tone.bg} ${tone.color}`}
                    >
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={`text-sm ${
                            n.read
                              ? "text-muted-foreground"
                              : "font-medium text-foreground"
                          }`}
                        >
                          {n.title}
                        </p>
                        {!n.read && (
                          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-foreground" />
                        )}
                      </div>
                      {n.body && (
                        <p className="mt-0.5 text-xs text-muted-foreground/70 line-clamp-2">
                          {n.body}
                        </p>
                      )}
                      <p className="mt-1 text-[11px] text-muted-foreground/50">
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
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center">
          <Bell className="mb-3 size-8 text-muted-foreground/50" />
          <p className="text-sm font-medium text-muted-foreground">
            {t("empty")}
          </p>
          <p className="mt-1 text-xs text-muted-foreground/70">
            {t("emptyDetail")}
          </p>
        </div>
      )}
    </div>
  );
}
