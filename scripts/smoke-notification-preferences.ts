#!/usr/bin/env node
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { dispatchNotificationEmailByNotificationId } from "../src/lib/email/notification-queue";

config({ path: resolve(process.cwd(), ".env.local"), quiet: true });

const SMOKE_EMAIL = "creator@dev.popsdrops.com";

type SmokeProfile = {
  id: string;
  email: string;
  full_name: string | null;
};

type PreferenceRow = {
  user_id: string;
  email_messages: boolean;
  email_campaign_activity: boolean;
  email_reports: boolean;
};

type QueueRow = {
  id: string;
  notification_id: string | null;
  status: string;
  processed_reason: string | null;
  processed_at: string | null;
  delivered_at: string | null;
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

async function waitForQueueRow(
  admin: SupabaseClient,
  notificationId: string,
): Promise<QueueRow> {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 8000) {
    const row = await checkedQuery<QueueRow | null>(
      "Find notification queue row",
      admin
        .from("notification_queue")
        .select(
          "id, notification_id, status, processed_reason, processed_at, delivered_at",
        )
        .eq("notification_id", notificationId)
        .maybeSingle(),
    );

    if (row) return row;
    await new Promise((resolveWait) => setTimeout(resolveWait, 250));
  }

  throw new Error(`Timed out waiting for queue row ${notificationId}`);
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

export async function runNotificationPreferencesSmoke() {
  const admin = createAdminClientFromEnv();
  const profile = await ensureSmokeProfile(admin);
  const previousPreferences = await readPreferenceRow(admin, profile.id);
  const smokeId = `pd_notification_preferences_${randomUUID()}`;
  let notificationId: string | null = null;
  let queueId: string | null = null;

  try {
    await checkedQuery(
      "Disable campaign update emails",
      admin.from("notification_email_preferences").upsert(
        {
          user_id: profile.id,
          email_messages: false,
          email_campaign_activity: true,
          email_reports: true,
          updated_at: new Date().toISOString(),
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
          title: "Notification preference smoke",
          body: `Campaign update email should be skipped. Smoke id: ${smokeId}.`,
          data: { smoke: true, smokeId, source: "smoke-notification-preferences" },
        })
        .select("id")
        .single(),
    );
    notificationId = notification.id;

    const queuedBefore = await waitForQueueRow(admin, notificationId);
    queueId = queuedBefore.id;

    const dispatchResult = await dispatchNotificationEmailByNotificationId(
      notificationId,
      admin,
    );
    const queuedAfter = await checkedQuery<QueueRow>(
      "Read dispatched queue row",
      admin
        .from("notification_queue")
        .select(
          "id, notification_id, status, processed_reason, processed_at, delivered_at",
        )
        .eq("id", queueId)
        .single(),
    );

    if (queuedAfter.status !== "skipped") {
      throw new Error(`Expected skipped queue status, got ${queuedAfter.status}`);
    }

    if (queuedAfter.processed_reason !== "email_preference_suppressed") {
      throw new Error(
        `Expected email_preference_suppressed, got ${queuedAfter.processed_reason}`,
      );
    }

    if (queuedAfter.delivered_at !== null) {
      throw new Error("Skipped email should not have a delivered_at timestamp");
    }

    return {
      dispatchResult,
      notificationId,
      queueId,
      smokeId,
      status: queuedAfter.status,
      processedReason: queuedAfter.processed_reason,
    };
  } finally {
    if (queueId) {
      await checkedQuery(
        "Clean smoke queue row",
        admin.from("notification_queue").delete().eq("id", queueId),
      ).catch(() => null);
    }
    if (notificationId) {
      await checkedQuery(
        "Clean smoke notification",
        admin.from("notifications").delete().eq("id", notificationId),
      ).catch(() => null);
    }
    await restorePreferences(admin, profile.id, previousPreferences);
  }
}

async function main() {
  const result = await runNotificationPreferencesSmoke();
  console.log(JSON.stringify({ ok: true, result }, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
