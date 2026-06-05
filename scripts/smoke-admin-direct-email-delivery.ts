#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

config({ path: resolve(process.cwd(), ".env.local"), quiet: true });

const DEFAULT_RECIPIENT_EMAIL = "admin-direct-email-smoke@example.invalid";
const SMOKE_SOURCE = "smoke-admin-direct-email-delivery";
let serverOnlyHookInstalled = false;

type ModuleWithLoad = {
  _load: (request: string, parent: unknown, isMain: boolean) => unknown;
};

type DirectQueueRow = {
  id: string;
  notification_id: string | null;
  email: string;
  template: string;
  data: Record<string, unknown> | null;
  status: string;
  attempt_count: number;
  last_error: string | null;
  processed_reason: string | null;
  processed_at: string | null;
  delivered_at: string | null;
  updated_at: string;
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
  const { dispatchNotificationEmailByQueueId } = await import(
    "../src/lib/email/notification-queue"
  );
  return dispatchNotificationEmailByQueueId;
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

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function isSmokeQueueRow(row: DirectQueueRow) {
  const data = asRecord(row.data);
  const nested = asRecord(data.data);
  return data.source === SMOKE_SOURCE || nested.source === SMOKE_SOURCE;
}

export async function setupAdminDirectEmailFixture(
  recipientEmail = readRecipientArg(),
) {
  const admin = createAdminClientFromEnv();
  const smokeId = `pd_admin_direct_email_${randomUUID()}`;
  const reason = `Admin communications delivery smoke. ${smokeId}`;

  const row = await checkedQuery<{ id: string }>(
    "Create direct admin communications queue row",
    admin
      .from("notification_queue")
      .insert({
        email: recipientEmail,
        template: "account_rejected",
        priority: "immediate",
        data: {
          title: "Account Update",
          body: reason,
          recipientName: "Max",
          recipient_name: "Max",
          source: SMOKE_SOURCE,
          data: {
            reason,
            role: "brand",
            smoke: true,
            smoke_id: smokeId,
            source: SMOKE_SOURCE,
          },
        },
      })
      .select("id")
      .single(),
  );

  return {
    queue: await readAdminDirectEmailFixture(row.id),
    queueId: row.id,
    recipientEmail,
    smokeId,
  };
}

export async function readAdminDirectEmailFixture(queueId: string) {
  const admin = createAdminClientFromEnv();

  return checkedQuery<DirectQueueRow>(
    "Read direct admin communications queue row",
    admin
      .from("notification_queue")
      .select(
        "id, notification_id, email, template, data, status, attempt_count, last_error, processed_reason, processed_at, delivered_at, updated_at",
      )
      .eq("id", queueId)
      .single(),
  );
}

export async function dispatchAdminDirectEmailFixture(queueId: string) {
  const admin = createAdminClientFromEnv();
  const before = await readAdminDirectEmailFixture(queueId);

  if (!isSmokeQueueRow(before)) {
    throw new Error("Refusing to dispatch a non-smoke direct queue row.");
  }

  const dispatchNotificationEmailByQueueId = await loadQueueDispatcher();
  const dispatchResult = await dispatchNotificationEmailByQueueId(queueId, admin);
  const queue = await readAdminDirectEmailFixture(queueId);

  if (queue.status !== "sent") {
    throw new Error(`Expected sent queue status, got ${queue.status}`);
  }

  if (queue.processed_reason !== "email_sent") {
    throw new Error(`Expected email_sent, got ${queue.processed_reason}`);
  }

  if (!queue.delivered_at) {
    throw new Error("Sent direct email should have delivered_at.");
  }

  if (queue.attempt_count !== before.attempt_count + 1) {
    throw new Error(
      `Expected attempt_count ${before.attempt_count + 1}, got ${queue.attempt_count}`,
    );
  }

  return {
    dispatchResult,
    queue,
    queueId,
  };
}

export async function cleanupAdminDirectEmailFixture(queueId: string) {
  const admin = createAdminClientFromEnv();
  const row = await readAdminDirectEmailFixture(queueId).catch(() => null);

  if (!row) return { cleaned: false, reason: "queue_missing" };
  if (!isSmokeQueueRow(row)) {
    return { cleaned: false, reason: "source_mismatch", queueId };
  }

  await checkedQuery(
    "Delete direct admin communications queue row",
    admin.from("notification_queue").delete().eq("id", queueId),
  );

  return { cleaned: true, queueId };
}

export async function runAdminDirectEmailSmoke(
  recipientEmail = readRecipientArg(),
) {
  const result = await setupAdminDirectEmailFixture(recipientEmail);

  try {
    const dispatch = await dispatchAdminDirectEmailFixture(result.queueId);
    return {
      ...result,
      dispatch,
      queue: dispatch.queue,
    };
  } finally {
    if (!process.argv.includes("--keep")) {
      await cleanupAdminDirectEmailFixture(result.queueId);
    }
  }
}

async function main() {
  const hasModeArg = process.argv.some((arg) =>
    ["--setup", "--read", "--send", "--cleanup"].includes(arg),
  );

  if (!hasModeArg) {
    const result = await runAdminDirectEmailSmoke();
    console.log(JSON.stringify({ ok: true, result }, null, 2));
    return;
  }

  if (process.argv.includes("--setup")) {
    const result = await setupAdminDirectEmailFixture();
    console.log(JSON.stringify({ ok: true, result }, null, 2));
    return;
  }

  if (process.argv.includes("--send")) {
    const result = await dispatchAdminDirectEmailFixture(requireArg("--queue-id"));
    console.log(JSON.stringify({ ok: true, result }, null, 2));
    return;
  }

  if (process.argv.includes("--read")) {
    const result = await readAdminDirectEmailFixture(requireArg("--queue-id"));
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
    const result = await cleanupAdminDirectEmailFixture(requireArg("--queue-id"));
    console.log(JSON.stringify({ ok: true, result }, null, 2));
    return;
  }

  throw new Error(
    "Use --setup [--to=<email>], --send --queue-id=<id>, --read --queue-id=<id>, or --cleanup --queue-id=<id>.",
  );
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
