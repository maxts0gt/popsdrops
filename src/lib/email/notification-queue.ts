import "server-only";

import { sendNotificationEmail } from "./notify";
import { isEmailNotificationType } from "./notification-types";
import {
  DEFAULT_NOTIFICATION_EMAIL_PREFERENCES,
  isNotificationEmailSuppressed,
  normalizeNotificationEmailPreferences,
  type NotificationEmailPreferences,
} from "./notification-preferences";
import {
  buildFailedQueueUpdate,
  buildPreferenceSuppressedQueueUpdate,
  buildSentQueueUpdate,
  buildUnsupportedQueueUpdate,
} from "./notification-queue-state";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export type NotificationEmailQueueDispatchResult =
  | { status: "sent"; queueId: string }
  | { status: "skipped"; queueId: string; template: string }
  | { status: "unsupported"; queueId: string; template: string }
  | { status: "failed"; queueId: string; template: string }
  | { status: "not_queued"; notificationId: string }
  | { status: "not_queued"; queueId: string };

type NotificationEmailQueueItem = {
  id: string;
  notification_id: string | null;
  email: string;
  template: string;
  data: Record<string, unknown> | null;
  status: string;
  attempt_count: number | null;
  processed_at: string | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function readString(
  record: Record<string, unknown>,
  keys: readonly string[],
) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
  }

  return null;
}

function resolveQueueRecipientName(
  data: Record<string, unknown> | null,
  profileName?: string | null,
) {
  const record = asRecord(data);
  const nested = asRecord(record.data);
  const name =
    readString(record, [
      "recipientName",
      "recipient_name",
      "fullName",
      "full_name",
      "name",
    ]) ??
    readString(nested, [
      "recipientName",
      "recipient_name",
      "fullName",
      "full_name",
      "name",
    ]);

  return name ?? profileName ?? "PopsDrops member";
}

async function updateQueueItem(
  admin: AdminClient,
  queueId: string,
  values: Record<string, unknown>,
) {
  const { error } = await admin
    .from("notification_queue")
    .update(values)
    .eq("id", queueId);

  if (error) throw new Error(error.message);
}

async function dispatchNotificationEmailQueueItem(
  queueItem: NotificationEmailQueueItem,
  admin: AdminClient,
): Promise<NotificationEmailQueueDispatchResult> {
  if (!isEmailNotificationType(queueItem.template)) {
    await updateQueueItem(
      admin,
      queueItem.id,
      buildUnsupportedQueueUpdate({
        attemptCount: queueItem.attempt_count,
        now: new Date().toISOString(),
      }),
    );
    return {
      status: "unsupported",
      queueId: queueItem.id,
      template: queueItem.template,
    };
  }

  let preferences: NotificationEmailPreferences =
    DEFAULT_NOTIFICATION_EMAIL_PREFERENCES;
  let profileName: string | null = null;

  if (queueItem.notification_id) {
    const { data: notification, error: notificationError } = await admin
      .from("notifications")
      .select("user_id")
      .eq("id", queueItem.notification_id)
      .single();

    if (notificationError) throw new Error(notificationError.message);

    const { data: preferenceRow, error: preferenceError } = await admin
      .from("notification_email_preferences")
      .select("email_messages, email_campaign_activity, email_reports")
      .eq("user_id", notification.user_id)
      .maybeSingle();

    if (preferenceError) throw new Error(preferenceError.message);

    preferences = normalizeNotificationEmailPreferences(preferenceRow);

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", notification.user_id)
      .maybeSingle();

    if (profileError) throw new Error(profileError.message);
    profileName = profile?.full_name ?? null;
  }

  const now = new Date().toISOString();

  if (isNotificationEmailSuppressed(queueItem.template, preferences)) {
    await updateQueueItem(
      admin,
      queueItem.id,
      buildPreferenceSuppressedQueueUpdate({
        attemptCount: queueItem.attempt_count,
        now,
      }),
    );
    return {
      status: "skipped",
      queueId: queueItem.id,
      template: queueItem.template,
    };
  }

  const delivery = await sendNotificationEmail({
    type: queueItem.template,
    recipientEmail: queueItem.email,
    recipientName: resolveQueueRecipientName(queueItem.data, profileName),
    data: asRecord(queueItem.data),
  });

  if (delivery.status === "failed") {
    await updateQueueItem(
      admin,
      queueItem.id,
      buildFailedQueueUpdate({
        attemptCount: queueItem.attempt_count,
        errorMessage: delivery.errorMessage,
        now,
      }),
    );
    return {
      status: "failed",
      queueId: queueItem.id,
      template: queueItem.template,
    };
  }

  const update =
    delivery.status === "sent"
      ? buildSentQueueUpdate({ attemptCount: queueItem.attempt_count, now })
      : buildUnsupportedQueueUpdate({
          attemptCount: queueItem.attempt_count,
          now,
        });

  await updateQueueItem(admin, queueItem.id, update);
  return {
    status: delivery.status,
    queueId: queueItem.id,
    template: queueItem.template,
  };
}

export async function dispatchNotificationEmailByNotificationId(
  notificationId: string,
  admin: AdminClient = createAdminClient(),
): Promise<NotificationEmailQueueDispatchResult> {
  const { data: queueItem, error: queueError } = await admin
    .from("notification_queue")
    .select(
      "id, notification_id, email, template, data, status, attempt_count, processed_at",
    )
    .eq("notification_id", notificationId)
    .is("processed_at", null)
    .in("status", ["pending", "failed"])
    .maybeSingle();

  if (queueError) throw new Error(queueError.message);
  if (!queueItem) return { status: "not_queued", notificationId };

  return dispatchNotificationEmailQueueItem(queueItem, admin);
}

export async function dispatchNotificationEmailByQueueId(
  queueId: string,
  admin: AdminClient = createAdminClient(),
): Promise<NotificationEmailQueueDispatchResult> {
  const { data: queueItem, error: queueError } = await admin
    .from("notification_queue")
    .select(
      "id, notification_id, email, template, data, status, attempt_count, processed_at",
    )
    .eq("id", queueId)
    .is("processed_at", null)
    .in("status", ["pending", "failed"])
    .maybeSingle();

  if (queueError) throw new Error(queueError.message);
  if (!queueItem) return { status: "not_queued", queueId };

  return dispatchNotificationEmailQueueItem(queueItem, admin);
}
