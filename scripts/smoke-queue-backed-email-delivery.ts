#!/usr/bin/env node
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { buildReportFollowUpNotification } from "../src/lib/reporting/report-notifications";

config({ path: resolve(process.cwd(), ".env.local"), quiet: true });

const DEFAULT_RECIPIENT_EMAIL = "queue-backed-email-smoke@example.invalid";
const SMOKE_EMAIL = "creator@dev.popsdrops.com";
const SMOKE_SOURCE = "smoke-queue-backed-email-delivery";
const REPORT_FOLLOW_UP_NOTIFICATION_TYPE = "report_follow_up_requested";
let serverOnlyHookInstalled = false;

type PreferenceRow = {
  user_id: string;
  email_messages: boolean;
  email_campaign_activity: boolean;
  email_reports: boolean;
};

type SmokeProfile = {
  id: string;
  email: string;
  full_name: string | null;
};

type SmokeCampaign = {
  id: string;
  title: string;
};

type SmokeNotification = {
  id: string;
  user_id: string;
  data: Record<string, unknown> | null;
};

type SmokeQueueRow = {
  id: string;
  notification_id: string | null;
  email: string;
  template: string;
  status: string;
  attempt_count: number;
  last_error: string | null;
  processed_reason: string | null;
  processed_at: string | null;
  delivered_at: string | null;
  updated_at: string;
};

type ModuleWithLoad = {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
};

function installServerOnlySmokeHook() {
  if (serverOnlyHookInstalled) return;

  const require = createRequire(import.meta.url);
  const moduleApi = require("node:module") as ModuleWithLoad;
  const originalLoad = moduleApi._load;

  moduleApi._load = function smokeServerOnlyHook(
    request: string,
    parent: unknown,
    isMain: boolean,
  ) {
    if (request === "server-only") return {};
    return originalLoad(request, parent, isMain);
  };

  serverOnlyHookInstalled = true;
}

async function loadQueueDispatcher() {
  installServerOnlySmokeHook();
  const { dispatchNotificationEmailByNotificationId } = await import(
    "../src/lib/email/notification-queue"
  );
  return dispatchNotificationEmailByNotificationId;
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

function readArg(name: string) {
  const prefix = `${name}=`;
  const inlineValue = process.argv
    .find((arg) => arg.startsWith(prefix))
    ?.slice(prefix.length);
  if (inlineValue) return inlineValue;

  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function requireArg(name: string) {
  const value = readArg(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function readRecipientArg() {
  const recipient = readArg("--to") ?? DEFAULT_RECIPIENT_EMAIL;
  if (!recipient.includes("@")) {
    throw new Error(`Invalid --to recipient: ${recipient}`);
  }
  return recipient;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asPreferenceRow(
  value: unknown,
  userId: string,
): PreferenceRow | null {
  const record = asRecord(value);
  if (!record) return null;

  const emailMessages = record.email_messages;
  const campaignActivity = record.email_campaign_activity;
  const reports = record.email_reports;

  if (
    typeof emailMessages !== "boolean" ||
    typeof campaignActivity !== "boolean" ||
    typeof reports !== "boolean"
  ) {
    return null;
  }

  return {
    email_campaign_activity: campaignActivity,
    email_messages: emailMessages,
    email_reports: reports,
    user_id: userId,
  };
}

async function ensureSmokeProfile(admin: SupabaseClient): Promise<SmokeProfile> {
  const existing = await checkedQuery<SmokeProfile | null>(
    "Find smoke profile",
    admin
      .from("profiles")
      .select("id, email, full_name")
      .eq("email", SMOKE_EMAIL)
      .maybeSingle(),
  );

  if (existing) return existing;

  const created = await admin.auth.admin.createUser({
    email: SMOKE_EMAIL,
    email_confirm: true,
    user_metadata: { full_name: "Dev Creator" },
  });

  if (created.error) {
    throw new Error(`Create smoke auth user: ${created.error.message}`);
  }

  const userId = created.data.user.id;

  await checkedQuery(
    "Create smoke profile",
    admin.from("profiles").upsert(
      {
        id: userId,
        email: SMOKE_EMAIL,
        full_name: "Dev Creator",
        onboarding_completed: true,
        role: "creator",
        status: "active",
      },
      { onConflict: "id" },
    ),
  );

  return { id: userId, email: SMOKE_EMAIL, full_name: "Dev Creator" };
}

async function readPreferenceRow(
  admin: SupabaseClient,
  userId: string,
): Promise<PreferenceRow | null> {
  return checkedQuery<PreferenceRow | null>(
    "Read notification preference",
    admin
      .from("notification_email_preferences")
      .select("user_id, email_messages, email_campaign_activity, email_reports")
      .eq("user_id", userId)
      .maybeSingle(),
  );
}

async function restorePreferences(
  admin: SupabaseClient,
  profileId: string,
  previous: PreferenceRow | null,
) {
  if (!previous) {
    await checkedQuery(
      "Delete smoke preference",
      admin.from("notification_email_preferences").delete().eq("user_id", profileId),
    );
    return;
  }

  await checkedQuery(
    "Restore smoke preference",
    admin.from("notification_email_preferences").upsert(previous, {
      onConflict: "user_id",
    }),
  );
}

async function restoreSmokeProfile(
  admin: SupabaseClient,
  profileId: string,
  previousEmail: string,
) {
  await checkedQuery(
    "Restore smoke profile email",
    admin
      .from("profiles")
      .update({ email: previousEmail })
      .eq("id", profileId),
  );
}

async function routeSmokeProfileEmail(
  admin: SupabaseClient,
  profileId: string,
  recipientEmail: string,
) {
  await checkedQuery(
    "Route smoke profile email",
    admin
      .from("profiles")
      .update({ email: recipientEmail })
      .eq("id", profileId),
  );
}

async function findContextCampaign(admin: SupabaseClient): Promise<SmokeCampaign> {
  const campaign = await checkedQuery<SmokeCampaign | null>(
    "Find context campaign",
    admin
      .from("campaigns")
      .select("id, title")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  );

  if (!campaign) {
    throw new Error("No campaign exists for queue backed email smoke context.");
  }

  return campaign;
}

async function waitForQueueRow(
  admin: SupabaseClient,
  notificationId: string,
): Promise<SmokeQueueRow> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 8000) {
    const row = await checkedQuery<SmokeQueueRow | null>(
      "Find notification queue row",
      admin
        .from("notification_queue")
        .select(
          "id, notification_id, email, template, status, attempt_count, last_error, processed_reason, processed_at, delivered_at, updated_at",
        )
        .eq("notification_id", notificationId)
        .maybeSingle(),
    );

    if (row) return row;
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }

  throw new Error(`Timed out waiting for queue row ${notificationId}`);
}

export async function setupQueueBackedEmailFixture(recipientEmail = readRecipientArg()) {
  const admin = createAdminClientFromEnv();
  const profile = await ensureSmokeProfile(admin);
  const previousEmail = profile.email;
  const previousPreferences = await readPreferenceRow(admin, profile.id);
  const campaign = await findContextCampaign(admin);
  const smokeId = `pd_queue_email_${randomUUID()}`;
  const now = new Date().toISOString();
  let notificationId: string | null = null;

  try {
    await routeSmokeProfileEmail(admin, profile.id, recipientEmail);
    await checkedQuery(
      "Enable report email for queue backed smoke",
      admin.from("notification_email_preferences").upsert(
        {
          user_id: profile.id,
          email_messages: previousPreferences?.email_messages ?? true,
          email_campaign_activity:
            previousPreferences?.email_campaign_activity ?? true,
          email_reports: true,
          updated_at: now,
        },
        { onConflict: "user_id" },
      ),
    );

    const notificationPayload = buildReportFollowUpNotification({
      campaignId: campaign.id,
      campaignTitle: campaign.title,
      creatorId: profile.id,
      reportTaskId: randomUUID(),
    });

    if (notificationPayload.type !== REPORT_FOLLOW_UP_NOTIFICATION_TYPE) {
      throw new Error(
        `Expected ${REPORT_FOLLOW_UP_NOTIFICATION_TYPE}, got ${notificationPayload.type}`,
      );
    }

    const notification = await checkedQuery<{ id: string }>(
      "Create report follow-up notification",
      admin
        .from("notifications")
        .insert({
          ...notificationPayload,
          body: `Queue backed email smoke for ${campaign.title}. ${smokeId}`,
          data: {
            ...notificationPayload.data,
            previous_email: previousEmail,
            previous_preferences: previousPreferences,
            smoke: true,
            smoke_id: smokeId,
            source: SMOKE_SOURCE,
          },
        })
        .select("id")
        .single(),
    );
    notificationId = notification.id;

    const queuedBefore = await waitForQueueRow(admin, notification.id);
    const dispatchNotificationEmailByNotificationId = await loadQueueDispatcher();
    const dispatchResult = await dispatchNotificationEmailByNotificationId(
      notification.id,
      admin,
    );
    const queue = await readQueueBackedEmailFixture(queuedBefore.id);

    if (queue.status !== "sent") {
      throw new Error(`Expected sent queue status, got ${queue.status}`);
    }

    if (queue.processed_reason !== "email_sent") {
      throw new Error(`Expected email_sent, got ${queue.processed_reason}`);
    }

    if (!queue.delivered_at) {
      throw new Error("Sent queue backed email should have delivered_at.");
    }

    if (queue.email !== recipientEmail) {
      throw new Error(`Expected queue email ${recipientEmail}, got ${queue.email}`);
    }

    return {
      campaign,
      dispatchResult,
      notificationId: notification.id,
      profileId: profile.id,
      queue,
      queueId: queuedBefore.id,
      recipientEmail,
      smokeId,
    };
  } catch (error) {
    if (notificationId) {
      await cleanupQueueBackedEmailFixture(notificationId).catch(() => null);
    } else {
      await restoreSmokeProfile(admin, profile.id, previousEmail).catch(() => null);
      await restorePreferences(admin, profile.id, previousPreferences).catch(
        () => null,
      );
    }
    throw error;
  }
}

export async function readQueueBackedEmailFixture(queueId: string) {
  const admin = createAdminClientFromEnv();

  return checkedQuery<SmokeQueueRow>(
    "Read queue backed email row",
    admin
      .from("notification_queue")
      .select(
        "id, notification_id, email, template, status, attempt_count, last_error, processed_reason, processed_at, delivered_at, updated_at",
      )
      .eq("id", queueId)
      .single(),
  );
}

export async function cleanupQueueBackedEmailFixture(notificationId: string) {
  const admin = createAdminClientFromEnv();
  const notification = await checkedQuery<SmokeNotification | null>(
    "Read queue backed email notification",
    admin
      .from("notifications")
      .select("id, user_id, data")
      .eq("id", notificationId)
      .maybeSingle(),
  );

  if (!notification) return { cleaned: false, reason: "notification_missing" };

  const data = asRecord(notification.data);
  const previousEmail =
    typeof data?.previous_email === "string" && data.previous_email.trim()
      ? data.previous_email
      : SMOKE_EMAIL;
  const previousPreferences = asPreferenceRow(
    data?.previous_preferences,
    notification.user_id,
  );

  await checkedQuery(
    "Delete queue backed email rows",
    admin.from("notification_queue").delete().eq("notification_id", notification.id),
  );

  await checkedQuery(
    "Delete queue backed email notification",
    admin.from("notifications").delete().eq("id", notification.id),
  );

  await restoreSmokeProfile(admin, notification.user_id, previousEmail);
  await restorePreferences(admin, notification.user_id, previousPreferences);

  return { cleaned: true, notificationId: notification.id };
}

export async function runQueueBackedEmailSmoke(recipientEmail = readRecipientArg()) {
  const result = await setupQueueBackedEmailFixture(recipientEmail);

  try {
    return result;
  } finally {
    await cleanupQueueBackedEmailFixture(result.notificationId);
  }
}

async function main() {
  const hasModeArg = process.argv.some((arg) =>
    ["--setup", "--read", "--cleanup"].includes(arg),
  );

  if (!hasModeArg) {
    const result = await runQueueBackedEmailSmoke();
    console.log(JSON.stringify({ ok: true, result }, null, 2));
    return;
  }

  if (process.argv.includes("--setup")) {
    const result = await setupQueueBackedEmailFixture();
    console.log(JSON.stringify({ ok: true, result }, null, 2));
    return;
  }

  if (process.argv.includes("--read")) {
    const result = await readQueueBackedEmailFixture(requireArg("--queue-id"));
    const assertSent = process.argv.includes("--assert-sent");

    if (assertSent) {
      if (result.status !== "sent") {
        throw new Error(`Expected sent after dispatch, got ${result.status}`);
      }
      if (result.processed_reason !== "email_sent") {
        throw new Error(`Expected email_sent, got ${result.processed_reason}`);
      }
      if (!result.delivered_at) {
        throw new Error("Sent dispatch should have delivered_at.");
      }
    }

    console.log(JSON.stringify({ ok: true, result }, null, 2));
    return;
  }

  if (process.argv.includes("--cleanup")) {
    const result = await cleanupQueueBackedEmailFixture(
      requireArg("--notification-id"),
    );
    console.log(JSON.stringify({ ok: true, result }, null, 2));
    return;
  }

  throw new Error(
    "Use --setup [--to=<email>], --read --queue-id=<id>, or --cleanup --notification-id=<id>.",
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
