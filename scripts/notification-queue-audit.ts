#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "node:path";
import { EMAIL_NOTIFICATION_TYPES } from "../src/lib/email/notification-types";

config({ path: resolve(process.cwd(), ".env.local"), quiet: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const closeUnsupported = process.argv.includes("--close-unsupported");
const archiveSupportedBefore = process.argv
  .find((arg) => arg.startsWith("--archive-supported-before="))
  ?.replace("--archive-supported-before=", "");
const dryRun = !closeUnsupported && !archiveSupportedBefore;

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type QueueRow = {
  id: string;
  template: string;
  status: string;
  processed_at: string | null;
  created_at: string;
};

function summarize(rows: QueueRow[]) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.template] = (acc[row.template] ?? 0) + 1;
    return acc;
  }, {});
}

async function main() {
  const { data: rows, error } = await supabase
    .from("notification_queue")
    .select("id, template, status, processed_at, created_at")
    .eq("status", "pending")
    .is("processed_at", null)
    .order("created_at", { ascending: true })
    .limit(10000);

  if (error) throw new Error(error.message);

  const pendingRows = (rows ?? []) as QueueRow[];
  const emailTypes = new Set<string>(EMAIL_NOTIFICATION_TYPES);
  const unsupportedTemplates = Array.from(
    new Set(
      pendingRows
        .map((row) => row.template)
        .filter((template) => !emailTypes.has(template)),
    ),
  ).sort();
  const unsupportedRows = pendingRows.filter((row) =>
    unsupportedTemplates.includes(row.template),
  );
  const supportedLegacyRows = pendingRows.filter(
    (row) =>
      emailTypes.has(row.template) &&
      (!archiveSupportedBefore || row.created_at < archiveSupportedBefore),
  );
  const supportedLegacyTemplates = Array.from(
    new Set(supportedLegacyRows.map((row) => row.template)),
  ).sort();

  console.log(
    JSON.stringify(
      {
        dryRun,
        pending: {
          total: pendingRows.length,
          byTemplate: summarize(pendingRows),
        },
        unsupported: {
          total: unsupportedRows.length,
          templates: unsupportedTemplates,
          byTemplate: summarize(unsupportedRows),
        },
        supportedLegacy: {
          archiveBefore: archiveSupportedBefore ?? null,
          total: supportedLegacyRows.length,
          templates: supportedLegacyTemplates,
          byTemplate: summarize(supportedLegacyRows),
        },
      },
      null,
      2,
    ),
  );

  if (dryRun) {
    console.log(
      "No rows were changed. Pass --close-unsupported or --archive-supported-before=<ISO timestamp> for controlled cleanup.",
    );
    return;
  }

  const now = new Date().toISOString();

  if (archiveSupportedBefore) {
    if (supportedLegacyTemplates.length === 0) {
      console.log("No supported legacy rows found before the cutoff.");
      return;
    }

    const { error: archiveError } = await supabase
      .from("notification_queue")
      .update({
        status: "archived",
        processed_at: now,
        processed_reason: "legacy_supported_not_replayed",
        updated_at: now,
      })
      .eq("status", "pending")
      .is("processed_at", null)
      .lt("created_at", archiveSupportedBefore)
      .in("template", supportedLegacyTemplates);

    if (archiveError) throw new Error(archiveError.message);

    console.log(
      `Archived ${supportedLegacyRows.length} supported legacy queue rows without replay.`,
    );
    return;
  }

  if (unsupportedTemplates.length === 0) {
    console.log("No unsupported pending rows found.");
    return;
  }

  const { error: updateError } = await supabase
    .from("notification_queue")
    .update({
      status: "unsupported",
      processed_at: now,
      processed_reason: "legacy_unsupported_template_closed",
      updated_at: now,
    })
    .eq("status", "pending")
    .is("processed_at", null)
    .in("template", unsupportedTemplates);

  if (updateError) throw new Error(updateError.message);

  console.log(
    `Closed ${unsupportedRows.length} unsupported legacy queue rows: ${unsupportedTemplates.join(", ")}`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
