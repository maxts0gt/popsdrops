import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  Archive,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ArrowUpRight,
  CheckCircle2,
  CircleSlash2,
  Clock3,
  FileText,
  Inbox,
  Mail,
  RotateCw,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { sendOrRetryNotificationEmail } from "@/app/actions/admin";
import { getUser } from "@/app/actions/auth";
import {
  EMAIL_NOTIFICATION_TYPES,
  type EmailNotificationType,
} from "@/lib/email/notification-types";
import {
  buildNotificationQueueAttentionItems,
  formatNotificationDeliveryReason,
  getNotificationQueueRecoveryLabel,
  getNotificationQueueCampaignContext,
  maskNotificationRecipient,
  normalizeNotificationQueueStatusCounts,
  NOTIFICATION_QUEUE_STATUSES,
  type NotificationQueueStatusCount,
} from "@/lib/admin/notification-queue-health";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getSingleRelation } from "@/lib/supabase/relations";
import type {
  NotificationQueueItem,
  NotificationQueueStatus,
} from "@/types/database";

type SortDir = "asc" | "desc";
type QueueSortKey = "updated_at" | "template" | "email" | "attempt_count";
type DeliverySortKey =
  | "updated_at"
  | "status"
  | "template"
  | "email"
  | "attempt_count";
type TemplateSortKey = "name" | "type" | "trigger";

type SearchParams = Promise<
  Record<string, string | string[] | undefined> | undefined
>;

type RecentNotification = {
  id: string;
  type: string;
  title: string;
  created_at: string;
  user_name: string;
};

type NotificationUserRecord = {
  full_name: string | null;
};

type RecentNotificationRow = {
  id: string;
  type: string;
  title: string;
  created_at: string;
  user: NotificationUserRecord | NotificationUserRecord[] | null;
};

type FailedQueueRow = Pick<
  NotificationQueueItem,
  | "id"
  | "notification_id"
  | "email"
  | "template"
  | "status"
  | "attempt_count"
  | "last_error"
  | "processed_at"
  | "updated_at"
  | "created_at"
>;

type RecentDeliveryRow = Pick<
  NotificationQueueItem,
  | "id"
  | "notification_id"
  | "email"
  | "template"
  | "status"
  | "attempt_count"
  | "last_error"
  | "processed_reason"
  | "delivered_at"
  | "processed_at"
  | "updated_at"
  | "created_at"
  | "data"
>;

type QueueAuditLink = {
  id: string;
  target_id: string;
  created_at: string;
};

const queueSortColumns: Record<QueueSortKey, string> = {
  updated_at: "updated_at",
  template: "template",
  email: "email",
  attempt_count: "attempt_count",
};

const deliverySortColumns: Record<DeliverySortKey, string> = {
  updated_at: "updated_at",
  status: "status",
  template: "template",
  email: "email",
  attempt_count: "attempt_count",
};

const templateMeta = {
  account_approved: {
    name: "Account approved",
    trigger: "Admin approval",
  },
  account_rejected: {
    name: "Account rejected",
    trigger: "Admin rejection",
  },
  account_suspended: {
    name: "Account suspended",
    trigger: "Admin suspension",
  },
  account_restored: {
    name: "Account restored",
    trigger: "Admin restore",
  },
  account_review_reopened: {
    name: "Account review reopened",
    trigger: "Admin review request",
  },
  brand_team_invitation: {
    name: "Brand team invitation",
    trigger: "Brand invites teammate",
  },
  application_received: {
    name: "Application received",
    trigger: "Creator applies",
  },
  application_accepted: {
    name: "Application accepted",
    trigger: "Brand accepts creator",
  },
  application_rejected: {
    name: "Application rejected",
    trigger: "Brand rejects creator",
  },
  counter_offer: {
    name: "Counter offer",
    trigger: "Brand sends offer",
  },
  campaign_match: {
    name: "Counter offer accepted",
    trigger: "Creator accepts offer",
  },
  content_submitted: {
    name: "Content submitted",
    trigger: "Creator submits proof",
  },
  content_approved: {
    name: "Content approved",
    trigger: "Brand accepts proof",
  },
  revision_requested: {
    name: "Revision requested",
    trigger: "Brand requests changes",
  },
  campaign_completed: {
    name: "Campaign completed",
    trigger: "Brand closes campaign",
  },
  campaign_update: {
    name: "Campaign announcement",
    trigger: "Brand sends announcement",
  },
  payment_received: {
    name: "Payment received",
    trigger: "Brand marks payment paid",
  },
  report_ready_for_review: {
    name: "Report ready for review",
    trigger: "Creator submits performance",
  },
  report_correction_requested: {
    name: "Report correction requested",
    trigger: "Brand requests metric fix",
  },
  report_correction_resubmitted: {
    name: "Report correction resubmitted",
    trigger: "Creator resubmits metrics",
  },
  report_follow_up_requested: {
    name: "Report follow-up requested",
    trigger: "Brand asks for evidence",
  },
  data_deletion_scheduled: {
    name: "Data deletion scheduled",
    trigger: "User requests deletion",
  },
  data_deletion_completed: {
    name: "Data deletion completed",
    trigger: "Automatic deletion processor",
  },
  data_export_ready: {
    name: "Data export ready",
    trigger: "Privacy export processor",
  },
  privacy_request_denied: {
    name: "Privacy request denied",
    trigger: "Admin exception review",
  },
} satisfies Record<EmailNotificationType, { name: string; trigger: string }>;

const typeLabels: Record<string, string> = {
  account_approved: "Account approved",
  account_rejected: "Account rejected",
  account_suspended: "Account suspended",
  account_restored: "Account restored",
  account_review_reopened: "Account review reopened",
  brand_team_invitation: "Brand team invitation",
  campaign_match: "Campaign match",
  application_received: "Application received",
  application_accepted: "Application accepted",
  application_rejected: "Application rejected",
  counter_offer: "Counter offer",
  content_submitted: "Content submitted",
  content_approved: "Content approved",
  revision_requested: "Revision requested",
  campaign_update: "Campaign update",
  campaign_completed: "Campaign completed",
  payment_received: "Payment received",
  report_ready_for_review: "Report ready for review",
  data_export_ready: "Data export ready",
  report_correction_requested: "Report correction requested",
  report_correction_resubmitted: "Report correction resubmitted",
  report_follow_up_requested: "Report follow-up requested",
  data_deletion_scheduled: "Data deletion scheduled",
  data_deletion_completed: "Data deletion completed",
  privacy_request_denied: "Privacy request denied",
};

const statusMeta: Record<
  NotificationQueueStatus,
  {
    label: string;
    icon: typeof Clock3;
    className: string;
  }
> = {
  pending: {
    label: "Pending",
    icon: Clock3,
    className: "text-slate-600",
  },
  failed: {
    label: "Failed",
    icon: AlertTriangle,
    className: "text-red-700",
  },
  sent: {
    label: "Sent",
    icon: CheckCircle2,
    className: "text-slate-900",
  },
  unsupported: {
    label: "Unsupported",
    icon: CircleSlash2,
    className: "text-slate-500",
  },
  skipped: {
    label: "Skipped",
    icon: CircleSlash2,
    className: "text-slate-500",
  },
  archived: {
    label: "Archived",
    icon: Archive,
    className: "text-slate-500",
  },
};

const highlightedNotificationQueueRowClassName =
  "bg-slate-50 ring-1 ring-inset ring-slate-900";

function getSearchParam(
  params: Record<string, string | string[] | undefined> | undefined,
  key: string,
) {
  const value = params?.[key];
  return Array.isArray(value) ? value[0] : value;
}

function parseSortDir(value: string | undefined, fallback: SortDir): SortDir {
  return value === "asc" || value === "desc" ? value : fallback;
}

function parseQueueSortKey(value: string | undefined): QueueSortKey {
  return value && value in queueSortColumns
    ? (value as QueueSortKey)
    : "updated_at";
}

function parseDeliverySortKey(value: string | undefined): DeliverySortKey {
  return value && value in deliverySortColumns
    ? (value as DeliverySortKey)
    : "updated_at";
}

function parseTemplateSortKey(value: string | undefined): TemplateSortKey {
  return value === "type" || value === "trigger" ? value : "name";
}

function formatAdminDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function compareText(a: string, b: string) {
  return a.localeCompare(b, "en-US", { numeric: true, sensitivity: "base" });
}

function QueueSortableHead({
  label,
  sortKey,
  currentKey,
  currentDir,
}: {
  label: string;
  sortKey: QueueSortKey;
  currentKey: QueueSortKey;
  currentDir: SortDir;
}) {
  const isActive = currentKey === sortKey;
  const nextDir = isActive && currentDir === "asc" ? "desc" : "asc";

  return (
    <th
      className="px-3 py-2 text-start"
      aria-sort={
        isActive ? (currentDir === "asc" ? "ascending" : "descending") : "none"
      }
    >
      <Link
        href={`/admin/communications?queueSort=${sortKey}&queueDir=${nextDir}#failed-deliveries`}
        data-testid="notification-queue-sort-header"
        className="inline-flex items-center gap-1 transition-colors hover:text-slate-950"
      >
        {label}
        {isActive ? (
          currentDir === "asc" ? (
            <ArrowUp className="size-3" />
          ) : (
            <ArrowDown className="size-3" />
          )
        ) : (
          <ArrowUpDown className="size-3 opacity-35" />
        )}
      </Link>
    </th>
  );
}

function DeliverySortableHead({
  label,
  sortKey,
  currentKey,
  currentDir,
}: {
  label: string;
  sortKey: DeliverySortKey;
  currentKey: DeliverySortKey;
  currentDir: SortDir;
}) {
  const isActive = currentKey === sortKey;
  const nextDir = isActive && currentDir === "asc" ? "desc" : "asc";

  return (
    <th
      className="px-3 py-2 text-start"
      aria-sort={
        isActive ? (currentDir === "asc" ? "ascending" : "descending") : "none"
      }
    >
      <Link
        href={`/admin/communications?deliverySort=${sortKey}&deliveryDir=${nextDir}#delivery-log`}
        data-testid="admin-delivery-log-sort-header"
        className="inline-flex items-center gap-1 transition-colors hover:text-slate-950"
      >
        {label}
        {isActive ? (
          currentDir === "asc" ? (
            <ArrowUp className="size-3" />
          ) : (
            <ArrowDown className="size-3" />
          )
        ) : (
          <ArrowUpDown className="size-3 opacity-35" />
        )}
      </Link>
    </th>
  );
}

function TemplateSortableHead({
  label,
  sortKey,
  currentKey,
  currentDir,
}: {
  label: string;
  sortKey: TemplateSortKey;
  currentKey: TemplateSortKey;
  currentDir: SortDir;
}) {
  const isActive = currentKey === sortKey;
  const nextDir = isActive && currentDir === "asc" ? "desc" : "asc";

  return (
    <th
      className="px-3 py-2 text-start"
      aria-sort={
        isActive ? (currentDir === "asc" ? "ascending" : "descending") : "none"
      }
    >
      <Link
        href={`/admin/communications?templateSort=${sortKey}&templateDir=${nextDir}#email-templates`}
        data-testid="admin-template-sort-header"
        className="inline-flex items-center gap-1 transition-colors hover:text-slate-950"
      >
        {label}
        {isActive ? (
          currentDir === "asc" ? (
            <ArrowUp className="size-3" />
          ) : (
            <ArrowDown className="size-3" />
          )
        ) : (
          <ArrowUpDown className="size-3 opacity-35" />
        )}
      </Link>
    </th>
  );
}

function NotificationQueueRecoveryAction({
  row,
}: {
  row: Pick<
    NotificationQueueItem,
    "id" | "notification_id" | "template" | "status" | "processed_at"
  >;
}) {
  const recoveryLabel = getNotificationQueueRecoveryLabel(row);

  return (
    <form action={sendOrRetryNotificationEmail.bind(null, row.id)}>
      <Button
        type="submit"
        size="sm"
        variant="secondary"
        disabled={!recoveryLabel}
        data-testid="admin-delivery-recovery-action"
        className="h-8 gap-1.5 px-2.5 text-xs"
      >
        <RotateCw className="size-3.5" />
        {recoveryLabel ?? "Send"}
      </Button>
    </form>
  );
}

function QueueStatusStrip({
  counts,
}: {
  counts: NotificationQueueStatusCount[];
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
      {counts.map((item) => {
        const meta = statusMeta[item.status];
        const Icon = meta.icon;

        return (
          <div
            key={item.status}
            className="flex min-h-24 flex-col justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-900/[0.03]"
          >
            <div className="flex items-center justify-between gap-3 text-sm font-medium text-slate-500">
              <span>{meta.label}</span>
              <Icon className={`size-4 ${meta.className}`} />
            </div>
            <p className="text-3xl font-semibold tabular-nums text-slate-950">
              {item.count}
            </p>
          </div>
        );
      })}
    </div>
  );
}

async function assertAdmin() {
  const user = await getUser();
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") notFound();
}

async function fetchQueueStatusCounts() {
  const admin = createAdminClient();
  const rows = await Promise.all(
    NOTIFICATION_QUEUE_STATUSES.map(async (status) => {
      const { count, error } = await admin
        .from("notification_queue")
        .select("id", { count: "exact", head: true })
        .eq("status", status);

      if (error) throw new Error(error.message);
      return { status, count: count ?? 0 };
    }),
  );

  return normalizeNotificationQueueStatusCounts(rows);
}

async function fetchActiveQueueStatusCounts() {
  const admin = createAdminClient();
  const rows = await Promise.all(
    NOTIFICATION_QUEUE_STATUSES.map(async (status) => {
      const { count, error } = await admin
        .from("notification_queue")
        .select("id", { count: "exact", head: true })
        .eq("status", status)
        .is("processed_at", null);

      if (error) throw new Error(error.message);
      return { status, count: count ?? 0 };
    }),
  );

  return normalizeNotificationQueueStatusCounts(rows);
}

async function fetchFailedQueueRows(sortKey: QueueSortKey, sortDir: SortDir) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("notification_queue")
    .select(
      "id, notification_id, email, template, status, attempt_count, last_error, processed_at, updated_at, created_at",
    )
    .eq("status", "failed")
    .is("processed_at", null)
    .order(queueSortColumns[sortKey], { ascending: sortDir === "asc" })
    .limit(25);

  if (error) throw new Error(error.message);
  return (data ?? []) as FailedQueueRow[];
}

async function fetchRecentDeliveryRows(
  sortKey: DeliverySortKey,
  sortDir: SortDir,
) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("notification_queue")
    .select(
      "id, notification_id, email, template, data, status, attempt_count, last_error, processed_reason, delivered_at, processed_at, updated_at, created_at",
    )
    .order(deliverySortColumns[sortKey], { ascending: sortDir === "asc" })
    .limit(25);

  if (error) throw new Error(error.message);
  return (data ?? []) as RecentDeliveryRow[];
}

async function fetchHighlightedQueueRow(queueId: string | undefined) {
  if (!queueId) return null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("notification_queue")
    .select(
      "id, notification_id, email, template, data, status, attempt_count, last_error, processed_reason, delivered_at, processed_at, updated_at, created_at",
    )
    .eq("id", queueId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? ((data as unknown) as RecentDeliveryRow) : null;
}

async function fetchQueueAuditLinks(queueIds: string[]) {
  if (queueIds.length === 0) return new Map<string, string>();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("admin_audit_log")
    .select("id, target_id, created_at")
    .eq("target_type", "notification_queue")
    .in("target_id", queueIds)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  const links = new Map<string, string>();
  for (const row of (data ?? []) as QueueAuditLink[]) {
    if (!links.has(row.target_id)) {
      links.set(row.target_id, row.id);
    }
  }

  return links;
}

async function fetchRecentNotifications() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("notifications")
    .select(
      `id, type, title, created_at,
       user:profiles!notifications_user_id_fkey(full_name)`,
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const notification = row as RecentNotificationRow;
    const user = getSingleRelation(notification.user);

    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      created_at: notification.created_at,
      user_name: user?.full_name ?? "Unknown",
    } satisfies RecentNotification;
  });
}

function groupNotifications(recent: RecentNotification[]) {
  const groups = new Map<string, number>();

  for (const notification of recent) {
    groups.set(notification.type, (groups.get(notification.type) ?? 0) + 1);
  }

  return [...groups.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count || compareText(a.type, b.type));
}

function getSortedTemplates(sortKey: TemplateSortKey, sortDir: SortDir) {
  const direction = sortDir === "asc" ? 1 : -1;

  return EMAIL_NOTIFICATION_TYPES.map((type) => ({
    id: type,
    type: "email",
    ...templateMeta[type],
  })).sort((a, b) => compareText(a[sortKey], b[sortKey]) * direction);
}

function AttentionStrip({
  items,
}: {
  items: ReturnType<typeof buildNotificationQueueAttentionItems>;
}) {
  return (
    <section
      data-testid="admin-communications-attention"
      className="mb-8 space-y-3"
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className="size-4 text-slate-500" />
        <h2 className="text-base font-semibold text-slate-950">
          Needs attention
        </h2>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm shadow-sm ring-1 ring-slate-900/[0.03]">
          <span className="font-medium text-slate-950">Clear</span>
          <span className="ms-2 text-slate-500">
            Email delivery and report notifications have no active blockers.
          </span>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {items.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-900/[0.03] transition-colors hover:border-slate-300"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-500">
                    {item.label}
                  </p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-950">
                    {item.count}
                  </p>
                </div>
                <ArrowUpRight
                  className={`size-4 ${
                    item.tone === "danger" ? "text-red-700" : "text-slate-500"
                  }`}
                />
              </div>
              <p className="mt-2 text-xs text-slate-500">{item.detail}</p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

export default async function AdminCommunicationsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  await assertAdmin();

  const params = await searchParams;
  const queueSortKey = parseQueueSortKey(getSearchParam(params, "queueSort"));
  const queueSortDir = parseSortDir(getSearchParam(params, "queueDir"), "desc");
  const highlightedQueueId = getSearchParam(params, "queue");
  const deliverySortKey = parseDeliverySortKey(
    getSearchParam(params, "deliverySort"),
  );
  const deliverySortDir = parseSortDir(
    getSearchParam(params, "deliveryDir"),
    "desc",
  );
  const templateSortKey = parseTemplateSortKey(
    getSearchParam(params, "templateSort"),
  );
  const templateSortDir = parseSortDir(
    getSearchParam(params, "templateDir"),
    "asc",
  );

  const [
    queueCounts,
    activeQueueCounts,
    failedRows,
    deliveryRows,
    highlightedQueueRow,
    recent,
  ] =
    await Promise.all([
      fetchQueueStatusCounts(),
      fetchActiveQueueStatusCounts(),
      fetchFailedQueueRows(queueSortKey, queueSortDir),
      fetchRecentDeliveryRows(deliverySortKey, deliverySortDir),
      fetchHighlightedQueueRow(highlightedQueueId),
      fetchRecentNotifications(),
    ]);
  const visibleDeliveryRows =
    highlightedQueueRow && !deliveryRows.some((row) => row.id === highlightedQueueRow.id)
      ? [highlightedQueueRow, ...deliveryRows]
      : deliveryRows;
  const visibleFailedRows =
    highlightedQueueRow &&
    highlightedQueueRow.status === "failed" &&
    highlightedQueueRow.processed_at === null &&
    !failedRows.some((row) => row.id === highlightedQueueRow.id)
      ? [
          {
            id: highlightedQueueRow.id,
            notification_id: highlightedQueueRow.notification_id,
            email: highlightedQueueRow.email,
            template: highlightedQueueRow.template,
            status: highlightedQueueRow.status,
            attempt_count: highlightedQueueRow.attempt_count,
            last_error: highlightedQueueRow.last_error,
            processed_at: highlightedQueueRow.processed_at,
            updated_at: highlightedQueueRow.updated_at,
            created_at: highlightedQueueRow.created_at,
          } satisfies FailedQueueRow,
          ...failedRows,
        ]
      : failedRows;
  const queueAuditLinks = await fetchQueueAuditLinks(
    [...new Set([...visibleDeliveryRows, ...visibleFailedRows].map((row) => row.id))],
  );
  const notificationGroups = groupNotifications(recent);
  const attentionItems = buildNotificationQueueAttentionItems({
    activeQueueCounts,
    queueCounts,
  });
  const sortedTemplates = getSortedTemplates(templateSortKey, templateSortDir);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-950">
          Communications
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Email delivery, notification volume, and active templates.
        </p>
      </div>

      <AttentionStrip items={attentionItems} />

      <section className="mb-8 space-y-3">
        <div className="flex items-center gap-2">
          <Mail className="size-4 text-slate-500" />
          <h2 className="text-base font-semibold text-slate-950">
            Queue health
          </h2>
        </div>
        <QueueStatusStrip counts={queueCounts} />
      </section>

      <Card id="failed-deliveries" className="mb-8">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-red-700" />
            <CardTitle className="text-base">Failed deliveries</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {visibleFailedRows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center">
              <CheckCircle2 className="mx-auto mb-2 size-7 text-slate-400" />
              <p className="text-sm font-medium text-slate-950">
                No failed emails.
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Manual recovery appears here only when a delivery fails.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                    <QueueSortableHead
                      label="Template"
                      sortKey="template"
                      currentKey={queueSortKey}
                      currentDir={queueSortDir}
                    />
                    <QueueSortableHead
                      label="Recipient"
                      sortKey="email"
                      currentKey={queueSortKey}
                      currentDir={queueSortDir}
                    />
                    <QueueSortableHead
                      label="Attempts"
                      sortKey="attempt_count"
                      currentKey={queueSortKey}
                      currentDir={queueSortDir}
                    />
                    <QueueSortableHead
                      label="Updated"
                      sortKey="updated_at"
                      currentKey={queueSortKey}
                      currentDir={queueSortDir}
                    />
                    <th className="px-3 py-2 text-start">Last error</th>
                    <th className="px-3 py-2 text-start">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleFailedRows.map((row) => {
                    const isHighlighted = row.id === highlightedQueueId;

                    return (
                      <tr
                        key={row.id}
                        data-queue-id={row.id}
                        aria-current={isHighlighted ? "true" : undefined}
                        className={`border-b border-slate-100 last:border-0 ${
                          isHighlighted ? highlightedNotificationQueueRowClassName : ""
                        }`}
                      >
                        <td className="px-3 py-3 font-medium text-slate-950">
                          {typeLabels[row.template] ?? row.template}
                        </td>
                        <td className="px-3 py-3 text-slate-600">
                          {maskNotificationRecipient(row.email)}
                        </td>
                        <td className="px-3 py-3 tabular-nums text-slate-950">
                          {row.attempt_count}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-slate-600">
                          {formatAdminDate(row.updated_at)}
                        </td>
                        <td className="max-w-xs px-3 py-3 text-slate-600">
                          <span className="line-clamp-2">
                            {row.last_error ?? "No error message"}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          <NotificationQueueRecoveryAction row={row} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card id="delivery-log" className="mb-8">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Mail className="size-4 text-slate-500" />
            <CardTitle className="text-base">Delivery log</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {visibleDeliveryRows.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center">
              <Inbox className="mx-auto mb-2 size-7 text-slate-400" />
              <p className="text-sm font-medium text-slate-950">
                No delivery events yet.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                    <DeliverySortableHead
                      label="Status"
                      sortKey="status"
                      currentKey={deliverySortKey}
                      currentDir={deliverySortDir}
                    />
                    <DeliverySortableHead
                      label="Template"
                      sortKey="template"
                      currentKey={deliverySortKey}
                      currentDir={deliverySortDir}
                    />
                    <DeliverySortableHead
                      label="Recipient"
                      sortKey="email"
                      currentKey={deliverySortKey}
                      currentDir={deliverySortDir}
                    />
                    <DeliverySortableHead
                      label="Attempts"
                      sortKey="attempt_count"
                      currentKey={deliverySortKey}
                      currentDir={deliverySortDir}
                    />
                    <DeliverySortableHead
                      label="Updated"
                      sortKey="updated_at"
                      currentKey={deliverySortKey}
                      currentDir={deliverySortDir}
                    />
                    <th className="px-3 py-2 text-start">Reason</th>
                    <th className="px-3 py-2 text-start">Context</th>
                    <th className="px-3 py-2 text-start">Recovery</th>
                    <th className="px-3 py-2 text-start">Audit</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleDeliveryRows.map((row) => {
                    const isHighlighted = row.id === highlightedQueueId;
                    const meta = statusMeta[row.status];
                    const context = getNotificationQueueCampaignContext(row.data);
                    const reason =
                      row.status === "failed" && row.last_error
                        ? row.last_error
                        : formatNotificationDeliveryReason(
                            row.processed_reason,
                            row.status,
                          );
                    const recoveryLabel = getNotificationQueueRecoveryLabel(row);
                    const pendingSend = row.status === "pending";
                    const auditId = queueAuditLinks.get(row.id);

                    return (
                      <tr
                        key={row.id}
                        id={`notification-queue-${row.id}`}
                        data-testid="admin-delivery-log-row"
                        data-queue-id={row.id}
                        aria-current={isHighlighted ? "true" : undefined}
                        data-pending-send={pendingSend ? "true" : undefined}
                        className={`border-b border-slate-100 last:border-0 ${
                          isHighlighted ? highlightedNotificationQueueRowClassName : ""
                        }`}
                      >
                        <td className="px-3 py-3">
                          <Badge variant="secondary" className="text-xs">
                            {meta.label}
                          </Badge>
                        </td>
                        <td className="px-3 py-3 font-medium text-slate-950">
                          {typeLabels[row.template] ?? row.template}
                        </td>
                        <td className="px-3 py-3 text-slate-600">
                          {maskNotificationRecipient(row.email)}
                        </td>
                        <td className="px-3 py-3 tabular-nums text-slate-950">
                          {row.attempt_count}
                        </td>
                        <td className="px-3 py-3 whitespace-nowrap text-slate-600">
                          {formatAdminDate(row.updated_at)}
                        </td>
                        <td className="max-w-xs px-3 py-3 text-slate-600">
                          <span className="line-clamp-2">{reason}</span>
                        </td>
                        <td className="px-3 py-3">
                          {context ? (
                            <Link
                              href={context.href}
                              title={context.detail ?? undefined}
                              className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-slate-700 transition-colors hover:text-slate-950"
                            >
                              {context.label}
                              <ArrowUpRight className="size-3" />
                            </Link>
                          ) : (
                            <span className="whitespace-nowrap text-xs text-slate-500">
                              None
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {recoveryLabel ? (
                            <NotificationQueueRecoveryAction row={row} />
                          ) : (
                            <span className="whitespace-nowrap text-xs text-slate-500">
                              None
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {auditId ? (
                            <Link
                              href={`/admin/audit?entry=${auditId}#audit-entry-${auditId}`}
                              data-testid="admin-delivery-audit-link"
                              className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-slate-700 transition-colors hover:text-slate-950"
                            >
                              Open audit
                              <ArrowUpRight className="size-3" />
                            </Link>
                          ) : (
                            <span className="whitespace-nowrap text-xs text-slate-500">
                              None
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.55fr)]">
        <Card id="recent-notifications">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Inbox className="size-4 text-slate-500" />
              <CardTitle className="text-base">Recent notifications</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center">
                <Inbox className="mx-auto mb-2 size-7 text-slate-400" />
                <p className="text-sm font-medium text-slate-950">
                  No notifications yet.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {notificationGroups.length > 0 ? (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                    {notificationGroups.slice(0, 8).map((group) => (
                      <div
                        key={group.type}
                        className="rounded-lg border border-slate-200 p-3"
                      >
                        <p className="text-xl font-semibold tabular-nums text-slate-950">
                          {group.count}
                        </p>
                        <p className="mt-1 truncate text-xs text-slate-500">
                          {typeLabels[group.type] ?? group.type}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : null}

                <div className="divide-y divide-slate-100">
                  {recent.slice(0, 12).map((notification) => (
                    <div
                      key={notification.id}
                      className="flex items-start gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="mt-0.5 rounded-lg bg-slate-50 p-2 text-slate-500">
                        <Users className="size-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-medium text-slate-950">
                            {notification.title}
                          </p>
                          <Badge variant="secondary" className="text-xs">
                            {typeLabels[notification.type] ?? notification.type}
                          </Badge>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {notification.user_name} |{" "}
                          {formatAdminDate(notification.created_at)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card id="email-templates">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-slate-500" />
              <CardTitle className="text-base">Email templates</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                    <TemplateSortableHead
                      label="Template"
                      sortKey="name"
                      currentKey={templateSortKey}
                      currentDir={templateSortDir}
                    />
                    <TemplateSortableHead
                      label="Type"
                      sortKey="type"
                      currentKey={templateSortKey}
                      currentDir={templateSortDir}
                    />
                    <TemplateSortableHead
                      label="Trigger"
                      sortKey="trigger"
                      currentKey={templateSortKey}
                      currentDir={templateSortDir}
                    />
                  </tr>
                </thead>
                <tbody>
                  {sortedTemplates.map((t) => (
                    <tr
                      key={t.id}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <td className="px-3 py-3 font-medium text-slate-950">
                        {t.name}
                      </td>
                      <td className="px-3 py-3">
                        <Badge variant="secondary" className="text-xs">
                          {t.type}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-slate-600">{t.trigger}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
