#!/usr/bin/env node
import { render } from "@react-email/components";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";

import { buildNotificationEmail } from "../src/lib/email/notification-email-builder";
import {
  EMAIL_NOTIFICATION_TYPES,
  type EmailNotificationType,
} from "../src/lib/email/notification-types";

config({ path: resolve(process.cwd(), ".env.local"), quiet: true });

export const DEFAULT_NOTIFICATION_SMOKE_PROFILE_EMAIL =
  "creator@dev.popsdrops.com";
export const DEFAULT_NOTIFICATION_SMOKE_CAMPAIGN_ID =
  "00000000-0000-4000-8000-00000000e101";
export const DEFAULT_NOTIFICATION_SMOKE_CAMPAIGN_TITLE =
  "Notification Email Smoke Campaign";
export const DEFAULT_NOTIFICATION_SMOKE_OUTPUT_PATH =
  "output/email-smoke/popsdrops-notification-email-flow.html";
export const CRITICAL_PRODUCT_NOTIFICATION_TYPES = [
  "application_rejected",
  "report_correction_requested",
  "campaign_update",
  "campaign_completed",
] as const satisfies readonly EmailNotificationType[];

type SmokeProfile = {
  id: string;
  email: string;
  full_name: string;
};

type SmokeQueueItem = {
  id: string;
  notification_id: string;
  email: string;
  template: string;
  data: Record<string, unknown>;
  status: string;
  attempt_count: number;
  processed_at: string | null;
  processed_reason: string | null;
  delivered_at: string | null;
};

export type NotificationEmailSmokeArgs = {
  campaignId: string;
  campaignTitle: string;
  keep: boolean;
  outputPath: string;
  profileEmail: string;
  recipients: string[];
  send: boolean;
  smokeId: string;
  types: EmailNotificationType[];
};

type SmokeResult = {
  cleanedUp: boolean;
  deliveryStatus: string;
  mode: "dry-run" | "send";
  notificationId: string;
  outputPath: string;
  queueId: string;
  recipient: string;
  statusAfterDispatch: string;
  type: EmailNotificationType;
};

function parseList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseEmailNotificationType(value: string): EmailNotificationType {
  if ((EMAIL_NOTIFICATION_TYPES as readonly string[]).includes(value)) {
    return value as EmailNotificationType;
  }

  throw new Error(
    `Unsupported email notification type: ${value}. Use one of ${EMAIL_NOTIFICATION_TYPES.join(", ")}`,
  );
}

function parseEmailNotificationTypes(value: string): EmailNotificationType[] {
  const types = parseList(value).map(parseEmailNotificationType);

  if (types.length === 0) {
    throw new Error("At least one notification type is required.");
  }

  return types;
}

export function parseNotificationEmailSmokeArgs(
  args: string[],
): NotificationEmailSmokeArgs {
  const parsed: NotificationEmailSmokeArgs = {
    campaignId: DEFAULT_NOTIFICATION_SMOKE_CAMPAIGN_ID,
    campaignTitle: DEFAULT_NOTIFICATION_SMOKE_CAMPAIGN_TITLE,
    keep: false,
    outputPath: DEFAULT_NOTIFICATION_SMOKE_OUTPUT_PATH,
    profileEmail: DEFAULT_NOTIFICATION_SMOKE_PROFILE_EMAIL,
    recipients: [],
    send: false,
    smokeId: `pd_smoke_${randomUUID()}`,
    types: [...CRITICAL_PRODUCT_NOTIFICATION_TYPES],
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--send") {
      parsed.send = true;
      continue;
    }

    if (arg === "--dry-run") {
      parsed.send = false;
      continue;
    }

    if (arg === "--keep") {
      parsed.keep = true;
      continue;
    }

    if (arg === "--to") {
      parsed.recipients = parseList(args[index + 1] ?? "");
      index += 1;
      continue;
    }

    if (arg.startsWith("--to=")) {
      parsed.recipients = parseList(arg.slice("--to=".length));
      continue;
    }

    if (arg === "--profile-email") {
      parsed.profileEmail =
        args[index + 1] ?? DEFAULT_NOTIFICATION_SMOKE_PROFILE_EMAIL;
      index += 1;
      continue;
    }

    if (arg.startsWith("--profile-email=")) {
      parsed.profileEmail =
        arg.slice("--profile-email=".length) ||
        DEFAULT_NOTIFICATION_SMOKE_PROFILE_EMAIL;
      continue;
    }

    if (arg === "--type") {
      parsed.types = [parseEmailNotificationType(args[index + 1] ?? "")];
      index += 1;
      continue;
    }

    if (arg.startsWith("--type=")) {
      parsed.types = [parseEmailNotificationType(arg.slice("--type=".length))];
      continue;
    }

    if (arg === "--types") {
      parsed.types = parseEmailNotificationTypes(args[index + 1] ?? "");
      index += 1;
      continue;
    }

    if (arg.startsWith("--types=")) {
      parsed.types = parseEmailNotificationTypes(arg.slice("--types=".length));
      continue;
    }

    if (arg === "--campaign-title") {
      parsed.campaignTitle =
        args[index + 1] ?? DEFAULT_NOTIFICATION_SMOKE_CAMPAIGN_TITLE;
      index += 1;
      continue;
    }

    if (arg.startsWith("--campaign-title=")) {
      parsed.campaignTitle =
        arg.slice("--campaign-title=".length) ||
        DEFAULT_NOTIFICATION_SMOKE_CAMPAIGN_TITLE;
      continue;
    }

    if (arg === "--campaign-id") {
      parsed.campaignId =
        args[index + 1] ?? DEFAULT_NOTIFICATION_SMOKE_CAMPAIGN_ID;
      index += 1;
      continue;
    }

    if (arg.startsWith("--campaign-id=")) {
      parsed.campaignId =
        arg.slice("--campaign-id=".length) ||
        DEFAULT_NOTIFICATION_SMOKE_CAMPAIGN_ID;
      continue;
    }

    if (arg === "--output") {
      parsed.outputPath =
        args[index + 1] ?? DEFAULT_NOTIFICATION_SMOKE_OUTPUT_PATH;
      index += 1;
      continue;
    }

    if (arg.startsWith("--output=")) {
      parsed.outputPath =
        arg.slice("--output=".length) ||
        DEFAULT_NOTIFICATION_SMOKE_OUTPUT_PATH;
    }
  }

  return parsed;
}

export function buildSmokeNotificationPayload({
  campaignId,
  campaignTitle,
  now,
  smokeId,
  type,
  userId,
}: {
  campaignId: string;
  campaignTitle: string;
  now: Date;
  smokeId: string;
  type: EmailNotificationType;
  userId: string;
}) {
  const messageByType: Partial<Record<
    EmailNotificationType,
    { body: string; title: string }
  >> = {
    application_rejected: {
      title: "Application Update",
      body: `Update on your application to "${campaignTitle}". Smoke id: ${smokeId}.`,
    },
    campaign_completed: {
      title: "Campaign Completed",
      body: `The campaign "${campaignTitle}" has been completed. Smoke id: ${smokeId}.`,
    },
    content_approved: {
      title: "Content Approved",
      body: `Your content for "${campaignTitle}" has been approved. Smoke id: ${smokeId}.`,
    },
    campaign_update: {
      title: "Campaign announcement",
      body: `Notification smoke update for "${campaignTitle}" at ${now.toISOString()}.`,
    },
    report_correction_requested: {
      title: "Report Correction Requested",
      body: `Upload the full native analytics view for "${campaignTitle}". Smoke id: ${smokeId}.`,
    },
  };
  const message = messageByType[type] ?? {
    title: "Campaign update",
    body: `PopsDrops notification smoke for "${campaignTitle}". Smoke id: ${smokeId}.`,
  };

  const data: Record<string, unknown> = {
    accepted_rate: 475,
    campaign_id: campaignId,
    campaignId,
    campaignTitle,
    counter_rate: 520,
    creator_name: "Mina Park",
    message: "Please confirm the revised scope.",
    platform: "Instagram",
    proposed_rate: 425,
    smoke: true,
    smokeId,
    source: "smoke-notification-email-flow",
  };

  if (type === "report_correction_requested") {
    data.feedback = "Use the complete native analytics view.";
  }

  return {
    user_id: userId,
    type,
    title: message.title,
    body: message.body,
    data,
  };
}

function createAdminClientFromEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.",
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function checkedQuery<T>(
  label: string,
  query: PromiseLike<{ data: T; error: { message: string } | null }>,
): Promise<T> {
  const { data, error } = await query;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

async function findAuthUserByEmail(admin: SupabaseClient, email: string) {
  const normalizedEmail = email.toLowerCase();

  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) throw new Error(`Find smoke auth user: ${error.message}`);

    const users = data?.users ?? [];
    const user = users.find(
      (candidate) => candidate.email?.toLowerCase() === normalizedEmail,
    );

    if (user) return user;
    if (users.length < 1000) return null;
  }

  return null;
}

export async function ensureDefaultSmokeProfile(
  admin: SupabaseClient,
  email: string,
): Promise<SmokeProfile> {
  const existing = await checkedQuery<SmokeProfile | null>(
    "Find smoke profile",
    admin
      .from("profiles")
      .select("id, email, full_name")
      .eq("email", email)
      .maybeSingle(),
  );

  if (existing) return existing;

  if (email !== DEFAULT_NOTIFICATION_SMOKE_PROFILE_EMAIL) {
    throw new Error(
      `Profile ${email} does not exist. Use ${DEFAULT_NOTIFICATION_SMOKE_PROFILE_EMAIL} or create the profile first.`,
    );
  }

  const created = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: "Dev Creator" },
  });

  let userId = created.data.user?.id ?? null;

  if (created.error) {
    if (created.error.message.includes("already been registered")) {
      const existingUser = await findAuthUserByEmail(admin, email);
      userId = existingUser?.id ?? null;
    }

    if (!userId) {
      throw new Error(`Create smoke auth user: ${created.error.message}`);
    }
  }

  if (!userId) {
    throw new Error("Create smoke auth user: missing user id");
  }

  await checkedQuery(
    "Create smoke profile",
    admin.from("profiles").upsert(
      {
        id: userId,
        email,
        full_name: "Dev Creator",
        onboarding_completed: true,
        role: "creator",
        status: "active",
      },
      { onConflict: "id" },
    ),
  );

  await checkedQuery(
    "Create smoke creator profile",
    admin.from("creator_profiles").upsert(
      {
        bio: "Development creator used for notification email smoke tests.",
        content_formats: ["reel"],
        languages: ["en"],
        markets: ["us"],
        niches: ["beauty"],
        primary_market: "us",
        profile_completeness: 90,
        profile_id: userId,
        rate_card: { instagram: { reel: 300 } },
        rate_currency: "USD",
        slug: `notification-smoke-${userId.slice(0, 8)}`,
        tier: "rising",
      },
      { onConflict: "profile_id" },
    ),
  );

  return { id: userId, email, full_name: "Dev Creator" };
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForQueueItem(
  admin: SupabaseClient,
  notificationId: string,
): Promise<SmokeQueueItem> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 8000) {
    const row = await checkedQuery<SmokeQueueItem | null>(
      "Find notification queue item",
      admin
        .from("notification_queue")
        .select(
          "id, notification_id, email, template, data, status, attempt_count, processed_at, processed_reason, delivered_at",
        )
        .eq("notification_id", notificationId)
        .maybeSingle(),
    );

    if (row) return row;
    await sleep(300);
  }

  throw new Error(`Timed out waiting for queue row for ${notificationId}`);
}

async function updateQueueEmail(
  admin: SupabaseClient,
  queueId: string,
  recipient: string,
) {
  await checkedQuery(
    "Override smoke queue recipient",
    admin.from("notification_queue").update({ email: recipient }).eq("id", queueId),
  );
}

async function archiveDryRunQueueItem(admin: SupabaseClient, queueId: string) {
  const now = new Date().toISOString();

  await checkedQuery(
    "Archive dry-run smoke queue item",
    admin
      .from("notification_queue")
      .update({
        processed_at: now,
        processed_reason: "smoke_dry_run_not_sent",
        status: "archived",
        updated_at: now,
      })
      .eq("id", queueId),
  );
}

async function markQueueItemSent(admin: SupabaseClient, queueId: string, attemptCount: number) {
  const now = new Date().toISOString();

  await checkedQuery(
    "Mark smoke queue item sent",
    admin
      .from("notification_queue")
      .update({
        attempt_count: Math.max(0, attemptCount) + 1,
        delivered_at: now,
        last_error: null,
        processed_at: now,
        processed_reason: "email_sent",
        status: "sent",
        updated_at: now,
      })
      .eq("id", queueId),
  );
}

async function cleanupSmokeRows(
  admin: SupabaseClient,
  notificationId: string,
  queueId: string,
) {
  await checkedQuery(
    "Clean smoke queue item",
    admin.from("notification_queue").delete().eq("id", queueId),
  );
  await checkedQuery(
    "Clean smoke notification",
    admin.from("notifications").delete().eq("id", notificationId),
  );
}

async function sendRenderedSmokeEmail({
  html,
  recipient,
  subject,
  text,
}: {
  html: string;
  recipient: string;
  subject: string;
  text: string;
}) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.",
    );
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ to: recipient, subject, html, text }),
  });
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`send-email failed for ${recipient}: ${response.status} ${body}`);
  }
}

function outputPathForScenario(
  basePath: string,
  type: EmailNotificationType,
  recipient: string,
  index: number,
) {
  const safeType = type.replace(/_/g, "-");
  const safeRecipient = recipient
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const dotIndex = basePath.lastIndexOf(".");
  const recipientSuffix = index === 0 ? "" : `-${safeRecipient || `recipient-${index + 1}`}`;
  const suffix = `${safeType}${recipientSuffix}`;

  if (dotIndex === -1) {
    return resolve(process.cwd(), `${basePath}-${suffix}`);
  }

  return resolve(
    process.cwd(),
    `${basePath.slice(0, dotIndex)}-${suffix}${basePath.slice(dotIndex)}`,
  );
}

async function renderSmokeEmail({
  data,
  outputPath,
  profile,
  type,
}: {
  data: Record<string, unknown>;
  outputPath: string;
  profile: SmokeProfile;
  type: EmailNotificationType;
}) {
  const email = buildNotificationEmail({
    type,
    recipientName: profile.full_name,
    data,
  });

  if (!email) throw new Error(`No email builder found for ${type}`);

  const html = await render(email.template);
  const text = await render(email.template, { plainText: true });
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, html);

  return { html, subject: email.subject, text };
}

async function createQueuedSmokeNotification({
  admin,
  args,
  profile,
  recipient,
  type,
}: {
  admin: SupabaseClient;
  args: NotificationEmailSmokeArgs;
  profile: SmokeProfile;
  recipient: string | null;
  type: EmailNotificationType;
}) {
  const notification = buildSmokeNotificationPayload({
    campaignId: args.campaignId,
    campaignTitle: args.campaignTitle,
    now: new Date(),
    smokeId: args.smokeId,
    type,
    userId: profile.id,
  });

  const inserted = await checkedQuery<{ id: string }>(
    "Insert smoke notification",
    admin.from("notifications").insert(notification).select("id").single(),
  );
  const queueItem = await waitForQueueItem(admin, inserted.id);

  if (recipient && queueItem.email !== recipient) {
    await updateQueueEmail(admin, queueItem.id, recipient);
  }

  const refreshedQueueItem = await waitForQueueItem(admin, inserted.id);
  return { notification, notificationId: inserted.id, queueItem: refreshedQueueItem };
}

export async function runNotificationEmailSmoke(
  args: NotificationEmailSmokeArgs,
): Promise<SmokeResult[]> {
  const admin = createAdminClientFromEnv();
  const profile = await ensureDefaultSmokeProfile(admin, args.profileEmail);
  const recipients = args.recipients.length > 0 ? args.recipients : [profile.email];
  const results: SmokeResult[] = [];

  for (const type of args.types) {
    for (let index = 0; index < recipients.length; index += 1) {
      const recipient = recipients[index];
      const { notification, notificationId, queueItem } =
        await createQueuedSmokeNotification({
          admin,
          args,
          profile,
          recipient,
          type,
        });
      const outputPath = outputPathForScenario(
        args.outputPath,
        type,
        recipient,
        index,
      );

      try {
        const rendered = await renderSmokeEmail({
          data: {
            title: notification.title,
            body: notification.body,
            data: notification.data,
          },
          outputPath,
          profile,
          type,
        });

        let deliveryStatus = "dry-run";
        let statusAfterDispatch = "archived";

        if (args.send) {
          await sendRenderedSmokeEmail({
            html: rendered.html,
            recipient,
            subject: rendered.subject,
            text: rendered.text,
          });
          await markQueueItemSent(admin, queueItem.id, queueItem.attempt_count);
          deliveryStatus = "sent";
          const updatedQueueItem = await checkedQuery<SmokeQueueItem>(
            "Read dispatched queue item",
            admin
              .from("notification_queue")
              .select(
                "id, notification_id, email, template, data, status, attempt_count, processed_at, processed_reason, delivered_at",
              )
              .eq("id", queueItem.id)
              .single(),
          );
          statusAfterDispatch = updatedQueueItem.status;

          if (updatedQueueItem.status !== "sent") {
            throw new Error(
              `Notification email dispatch failed with queue=${updatedQueueItem.status}`,
            );
          }
        } else {
          await archiveDryRunQueueItem(admin, queueItem.id);
        }

        if (!args.keep) {
          await cleanupSmokeRows(admin, notificationId, queueItem.id);
        }

        results.push({
          cleanedUp: !args.keep,
          deliveryStatus,
          mode: args.send ? "send" : "dry-run",
          notificationId,
          outputPath,
          queueId: queueItem.id,
          recipient,
          statusAfterDispatch,
          type,
        });
      } catch (error) {
        if (!args.keep) {
          await cleanupSmokeRows(admin, notificationId, queueItem.id).catch(
            () => {},
          );
        }
        throw error;
      }
    }
  }

  return results;
}

async function main() {
  const args = parseNotificationEmailSmokeArgs(process.argv.slice(2));
  const results = await runNotificationEmailSmoke(args);

  console.log(
    JSON.stringify(
      {
        mode: args.send ? "send" : "dry-run",
        profileEmail: args.profileEmail,
        results,
        smokeId: args.smokeId,
        types: args.types,
      },
      null,
      2,
    ),
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
