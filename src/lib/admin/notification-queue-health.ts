import { isEmailNotificationType } from "../email/notification-types";
import type { NotificationQueueStatus } from "../../types/database";

export const NOTIFICATION_QUEUE_STATUSES = [
  "pending",
  "failed",
  "skipped",
  "sent",
  "unsupported",
  "archived",
] as const satisfies readonly NotificationQueueStatus[];

export type NotificationQueueStatusCount = {
  status: NotificationQueueStatus;
  count: number;
};

export type NotificationQueueAttentionItem = {
  count: number;
  detail: string;
  href: string;
  key: string;
  label: string;
  tone: "danger" | "warning";
};

export type NotificationQueueCampaignContext = {
  detail: string | null;
  href: string;
  label: "Campaign";
};

type RawNotificationQueueStatusCount = {
  status: string | null;
  count: number | string | null;
};

type RetryableNotificationQueueItem = {
  notification_id: string | null;
  template: string;
  status: string;
  processed_at?: string | null;
};

type SendableNotificationQueueItem = {
  template: string;
  status: string;
  processed_at?: string | null;
};

export function normalizeNotificationQueueStatusCounts(
  rows: RawNotificationQueueStatusCount[],
): NotificationQueueStatusCount[] {
  const counts = new Map<string, number>();

  for (const row of rows) {
    if (!row.status) continue;
    const value =
      typeof row.count === "string" ? Number.parseInt(row.count, 10) : row.count;
    counts.set(row.status, Number.isFinite(value) ? Number(value) : 0);
  }

  return NOTIFICATION_QUEUE_STATUSES.map((status) => ({
    status,
    count: counts.get(status) ?? 0,
  }));
}

export function canRetryNotificationQueueItem(
  item: RetryableNotificationQueueItem,
) {
  return (
    item.status === "failed" &&
    item.processed_at == null &&
    isEmailNotificationType(item.template)
  );
}

export function canSendNotificationQueueItem(item: SendableNotificationQueueItem) {
  return (
    item.status === "pending" &&
    item.processed_at == null &&
    isEmailNotificationType(item.template)
  );
}

export function getNotificationQueueRecoveryLabel(
  item: RetryableNotificationQueueItem,
) {
  if (canSendNotificationQueueItem(item)) return "Send";
  if (canRetryNotificationQueueItem(item)) return "Retry";
  return null;
}

export function maskNotificationRecipient(email: string) {
  const [local, domain] = email.split("@");
  if (!local || !domain) return email;
  if (local.length <= 1) return `${local}@${domain}`;
  if (local.length === 2) return `${local[0]}*@${domain}`;

  return `${local[0]}${"*".repeat(local.length - 2)}${local.at(-1)}@${domain}`;
}

const deliveryReasonLabels: Record<string, string> = {
  email_sent: "Email sent",
  email_failed: "Delivery failed",
  email_preference_suppressed: "Email preference off",
  legacy_processed: "Legacy processed",
  legacy_supported_not_replayed: "Legacy email archived",
  legacy_unsupported_template_closed: "Legacy unsupported template",
  unsupported_template: "No email template",
};

function humanizeReason(reason: string) {
  const words = reason
    .split("_")
    .filter(Boolean)
    .map((word, index) =>
      index === 0
        ? `${word.charAt(0).toUpperCase()}${word.slice(1)}`
        : word,
    );

  return words.join(" ");
}

export function formatNotificationDeliveryReason(
  reason: string | null | undefined,
  status?: NotificationQueueStatus | string | null,
) {
  if (reason) return deliveryReasonLabels[reason] ?? humanizeReason(reason);

  switch (status) {
    case "pending":
      return "Waiting to send";
    case "failed":
      return "Delivery failed";
    case "sent":
      return "Email sent";
    case "skipped":
      return "Skipped";
    case "unsupported":
      return "No email template";
    case "archived":
      return "Archived";
    default:
      return "Not processed";
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readString(
  record: Record<string, unknown> | null,
  keys: readonly string[],
) {
  if (!record) return null;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
  }

  return null;
}

function unwrapNotificationQueueData(data: Record<string, unknown> | null) {
  const nested = asRecord(data?.data);
  return nested ?? data;
}

export function getNotificationQueueCampaignContext(
  data: Record<string, unknown> | null | undefined,
): NotificationQueueCampaignContext | null {
  const record = unwrapNotificationQueueData(asRecord(data));
  const campaignId = readString(record, ["campaign_id", "campaignId"]);

  if (!campaignId) return null;

  return {
    detail: readString(record, ["campaign_title", "campaignTitle"]),
    href: `/admin/campaigns/${campaignId}`,
    label: "Campaign",
  };
}

function getStatusCount(
  queueCounts: NotificationQueueStatusCount[],
  status: NotificationQueueStatus,
) {
  return queueCounts.find((item) => item.status === status)?.count ?? 0;
}

export function buildNotificationQueueAttentionItems({
  activeQueueCounts,
  queueCounts,
}: {
  activeQueueCounts?: NotificationQueueStatusCount[];
  queueCounts: NotificationQueueStatusCount[];
}): NotificationQueueAttentionItem[] {
  const items: NotificationQueueAttentionItem[] = [];
  const actionableCounts = activeQueueCounts ?? queueCounts;
  const failedCount = getStatusCount(actionableCounts, "failed");
  const pendingCount = getStatusCount(actionableCounts, "pending");
  const unsupportedCount = getStatusCount(actionableCounts, "unsupported");

  if (failedCount > 0) {
    items.push({
      count: failedCount,
      detail: "Retry or investigate",
      href: "#failed-deliveries",
      key: "failed",
      label: "Failed emails",
      tone: "danger",
    });
  }

  if (pendingCount > 0) {
    items.push({
      count: pendingCount,
      detail: "Waiting to send",
      href: "#delivery-log",
      key: "pending",
      label: "Pending emails",
      tone: "warning",
    });
  }

  if (unsupportedCount > 0) {
    items.push({
      count: unsupportedCount,
      detail: "Template coverage",
      href: "#delivery-log",
      key: "unsupported",
      label: "Unsupported templates",
      tone: "warning",
    });
  }

  return items;
}
