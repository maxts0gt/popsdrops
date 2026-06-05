"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Bell, MailCheck, Megaphone, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { updateNotificationEmailPreferences } from "@/app/actions/profile";
import {
  DEFAULT_NOTIFICATION_EMAIL_PREFERENCES,
  normalizeNotificationEmailPreferences,
  type NotificationEmailPreferences,
} from "@/lib/email/notification-preferences";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { createClient, getBrowserUser } from "@/lib/supabase/client";

type PreferenceKey = keyof NotificationEmailPreferences;

const PREFERENCE_ITEMS: Array<{
  key: PreferenceKey;
  column: "email_campaign_activity" | "email_messages" | "email_reports";
  icon: typeof Bell;
  titleKey: string;
  detailKey: string;
}> = [
  {
    key: "campaignActivity",
    column: "email_campaign_activity",
    icon: Bell,
    titleKey: "notifications.campaignActivity",
    detailKey: "notifications.campaignActivityDetail",
  },
  {
    key: "campaignUpdates",
    column: "email_messages",
    icon: Megaphone,
    titleKey: "notifications.campaignUpdates",
    detailKey: "notifications.campaignUpdatesDetail",
  },
  {
    key: "reports",
    column: "email_reports",
    icon: MailCheck,
    titleKey: "notifications.reports",
    detailKey: "notifications.reportsDetail",
  },
];

function toActionPayload(preferences: NotificationEmailPreferences) {
  return {
    email_campaign_activity: preferences.campaignActivity,
    email_messages: preferences.campaignUpdates,
    email_reports: preferences.reports,
  };
}

type NotificationEmailPreferencesPanelProps = {
  className?: string;
  variant?: "default" | "compact";
};

export function NotificationEmailPreferencesPanel({
  className,
  variant = "default",
}: NotificationEmailPreferencesPanelProps) {
  const { t } = useTranslation("settings");
  const isCompact = variant === "compact";
  const [preferences, setPreferences] = useState<NotificationEmailPreferences>(
    DEFAULT_NOTIFICATION_EMAIL_PREFERENCES,
  );
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<PreferenceKey | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let mounted = true;

    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await getBrowserUser();

      if (!user) {
        if (mounted) setLoading(false);
        return;
      }

      const { data } = await supabase
        .from("notification_email_preferences")
        .select("email_messages, email_campaign_activity, email_reports")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!mounted) return;
      setPreferences(normalizeNotificationEmailPreferences(data));
      setLoading(false);
    }

    load();

    return () => {
      mounted = false;
    };
  }, []);

  const preferenceRows = useMemo(
    () =>
      PREFERENCE_ITEMS.map((item) => ({
        ...item,
        enabled: preferences[item.key],
      })),
    [preferences],
  );

  function togglePreference(key: PreferenceKey) {
    const next = { ...preferences, [key]: !preferences[key] };
    setPreferences(next);
    setSavingKey(key);

    startTransition(() => {
      void (async () => {
        try {
          await updateNotificationEmailPreferences(toActionPayload(next));
          toast.success(t("saved"));
        } catch {
          setPreferences(preferences);
          toast.error(t("notifications.saveError"));
        } finally {
          setSavingKey(null);
        }
      })();
    });
  }

  return (
    <section className={cn("space-y-3", className)}>
      <div>
        <h2 className="text-sm font-semibold text-foreground">
          {t("notifications.emailTitle")}
        </h2>
        <p
          className={cn(
            "mt-1 text-muted-foreground",
            isCompact ? "text-xs leading-5" : "text-sm",
          )}
        >
          {t("notifications.emailDetail")}
        </p>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {preferenceRows.map((item) => {
          const Icon = item.icon;
          const disabled = loading || isPending;
          const statusLabel =
            savingKey === item.key
              ? t("notifications.saving")
              : item.enabled
                ? t("notifications.on")
                : t("notifications.off");

          return (
            <button
              key={item.key}
              type="button"
              role="switch"
              aria-checked={item.enabled}
              disabled={disabled}
              onClick={() => togglePreference(item.key)}
              className={cn(
                "rounded-xl border text-start transition-all active:translate-y-px disabled:pointer-events-none disabled:opacity-60",
                isCompact
                  ? "flex min-h-14 items-center gap-3 px-3 py-2"
                  : "flex min-h-28 flex-col justify-between px-3 py-3",
                item.enabled
                  ? "border-slate-900 bg-white text-slate-950 shadow-sm"
                  : "border-border bg-muted/30 text-muted-foreground",
              )}
              data-column={item.column}
            >
              {isCompact ? (
                <>
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-semibold leading-tight">
                    {t(item.titleKey)}
                  </span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-medium",
                      item.enabled
                        ? "bg-slate-900 text-white"
                        : "bg-white text-muted-foreground ring-1 ring-border",
                    )}
                  >
                    {statusLabel}
                  </span>
                </>
              ) : (
                <>
                  <span className="flex items-center justify-between gap-3">
                    <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                      <Icon className="size-4" />
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[11px] font-medium",
                        item.enabled
                          ? "bg-slate-900 text-white"
                          : "bg-white text-muted-foreground ring-1 ring-border",
                      )}
                    >
                      {statusLabel}
                    </span>
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">
                      {t(item.titleKey)}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                      {t(item.detailKey)}
                    </span>
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>

      {!isCompact && (
        <div className="flex items-start gap-3 rounded-xl bg-muted/40 px-3 py-3 ring-1 ring-border/60">
          <ShieldCheck className="mt-0.5 size-4 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium text-foreground">
              {t("notifications.required.title")}
            </p>
            <p className="text-xs leading-5 text-muted-foreground">
              {t("notifications.required.detail")}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
