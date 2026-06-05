#!/usr/bin/env node
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { dispatchNotificationEmailByQueueId } from "../src/lib/email/notification-queue";

config({ path: resolve(process.cwd(), ".env.local"), quiet: true });

const SMOKE_EMAIL = "creator@dev.popsdrops.com";
const SMOKE_SOURCE = "smoke-admin-communications-retry";

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
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function requireArg(name: string) {
  const value = readArg(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
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

async function findContextCampaign(
  admin: SupabaseClient,
): Promise<SmokeCampaign | null> {
  return checkedQuery<SmokeCampaign | null>(
    "Find context campaign",
    admin
      .from("campaigns")
      .select("id, title")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  );
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

export async function setupRetryFixture() {
  const admin = createAdminClientFromEnv();
  const profile = await ensureSmokeProfile(admin);
  const previousPreferences = await readPreferenceRow(admin, profile.id);
  const campaign = await findContextCampaign(admin);
  const smokeId = `pd_admin_retry_${randomUUID()}`;
  const now = new Date().toISOString();

  await checkedQuery(
    "Suppress campaign update email for safe retry",
    admin.from("notification_email_preferences").upsert(
      {
        user_id: profile.id,
        email_messages: false,
        email_campaign_activity:
          previousPreferences?.email_campaign_activity ?? true,
        email_reports: previousPreferences?.email_reports ?? true,
        updated_at: now,
      },
      { onConflict: "user_id" },
    ),
  );

  const notification = await checkedQuery<{ id: string }>(
    "Create smoke notification",
    admin
      .from("notifications")
      .insert({
        user_id: profile.id,
        type: "campaign_update",
        title: "Admin communications retry smoke",
        body: `Smoke retry fixture. ${smokeId}`,
        data: {
          campaign_id: campaign?.id,
          campaign_title: campaign?.title,
          previousPreferences,
          smoke: true,
          smokeId,
          source: SMOKE_SOURCE,
        },
      })
      .select("id")
      .single(),
  );

  const queuedBefore = await waitForQueueRow(admin, notification.id);

  await checkedQuery(
    "Mark smoke queue row failed",
    admin
      .from("notification_queue")
      .update({
        attempt_count: 1,
        delivered_at: null,
        last_error: "Smoke retry fixture. Safe because campaign update email is disabled.",
        processed_at: null,
        processed_reason: "email_failed",
        status: "failed",
        updated_at: now,
      })
      .eq("id", queuedBefore.id),
  );

  const queue = await readRetryFixture(queuedBefore.id);

  return {
    campaign,
    notificationId: notification.id,
    profileId: profile.id,
    queue,
    queueId: queuedBefore.id,
    smokeId,
  };
}

export async function readRetryFixture(queueId: string) {
  const admin = createAdminClientFromEnv();

  return checkedQuery<SmokeQueueRow>(
    "Read smoke retry queue row",
    admin
      .from("notification_queue")
      .select(
        "id, notification_id, email, template, status, attempt_count, last_error, processed_reason, processed_at, delivered_at, updated_at",
      )
      .eq("id", queueId)
      .single(),
  );
}

export async function cleanupRetryFixture(notificationId: string) {
  const admin = createAdminClientFromEnv();
  const notification = await checkedQuery<SmokeNotification | null>(
    "Read smoke notification",
    admin
      .from("notifications")
      .select("id, user_id, data")
      .eq("id", notificationId)
      .maybeSingle(),
  );

  if (!notification) return { cleaned: false, reason: "notification_missing" };

  const data = asRecord(notification.data);
  const previousPreferences = asPreferenceRow(
    data?.previousPreferences,
    notification.user_id,
  );

  await checkedQuery(
    "Delete smoke queue rows",
    admin.from("notification_queue").delete().eq("notification_id", notification.id),
  );

  await checkedQuery(
    "Delete smoke notification",
    admin.from("notifications").delete().eq("id", notification.id),
  );

  await restorePreferences(admin, notification.user_id, previousPreferences);

  return { cleaned: true, notificationId: notification.id };
}

export async function runAdminCommunicationsRetrySmoke() {
  const admin = createAdminClientFromEnv();
  const result = await setupRetryFixture();

  try {
    const dispatchResult = await dispatchNotificationEmailByQueueId(
      result.queueId,
      admin,
    );
    const queue = await readRetryFixture(result.queueId);

    if (queue.status !== "skipped") {
      throw new Error(`Expected skipped after retry, got ${queue.status}`);
    }
    if (queue.processed_reason !== "email_preference_suppressed") {
      throw new Error(
        `Expected email_preference_suppressed, got ${queue.processed_reason}`,
      );
    }
    if (queue.delivered_at !== null) {
      throw new Error("Suppressed retry should not have delivered_at.");
    }

    return {
      ...result,
      dispatchResult,
      queue,
    };
  } finally {
    await cleanupRetryFixture(result.notificationId);
  }
}

async function main() {
  const hasModeArg = process.argv.some((arg) =>
    ["--setup", "--read", "--cleanup"].includes(arg),
  );

  if (!hasModeArg) {
    const result = await runAdminCommunicationsRetrySmoke();
    console.log(JSON.stringify({ ok: true, result }, null, 2));
    return;
  }

  if (process.argv.includes("--setup")) {
    const result = await setupRetryFixture();
    console.log(JSON.stringify({ ok: true, result }, null, 2));
    return;
  }

  if (process.argv.includes("--read")) {
    const result = await readRetryFixture(requireArg("--queue-id"));
    const assertSkipped = process.argv.includes("--assert-skipped");

    if (assertSkipped) {
      if (result.status !== "skipped") {
        throw new Error(`Expected skipped after retry, got ${result.status}`);
      }
      if (result.processed_reason !== "email_preference_suppressed") {
        throw new Error(
          `Expected email_preference_suppressed, got ${result.processed_reason}`,
        );
      }
      if (result.delivered_at !== null) {
        throw new Error("Suppressed retry should not have delivered_at.");
      }
    }

    console.log(JSON.stringify({ ok: true, result }, null, 2));
    return;
  }

  if (process.argv.includes("--cleanup")) {
    const result = await cleanupRetryFixture(requireArg("--notification-id"));
    console.log(JSON.stringify({ ok: true, result }, null, 2));
    return;
  }

  throw new Error("Use --setup, --read --queue-id=<id>, or --cleanup --notification-id=<id>.");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
