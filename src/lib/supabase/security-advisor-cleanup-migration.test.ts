import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationName = "supabase_security_advisor_cleanup.sql";
const migrationDir = new URL("../../../supabase/migrations/", import.meta.url);
const migrationFile = readdirSync(migrationDir).find((fileName) =>
  fileName.endsWith(migrationName),
);
const migrationSource = migrationFile
  ? readFileSync(new URL(migrationFile, migrationDir), "utf8")
  : "";

describe("Supabase security advisor cleanup migration", () => {
  it("moves notification queue trigger behavior behind app_private", () => {
    expect(migrationFile).toBeTruthy();
    expect(migrationSource).toContain(
      "create or replace function app_private.queue_notification_email()",
    );
    expect(migrationSource).toContain(
      "execute function app_private.queue_notification_email()",
    );
    expect(migrationSource).toContain("drop function if exists public.queue_notification_email()");
    expect(migrationSource).toContain("set search_path = public, pg_temp");
  });

  it("keeps creator report RPC names stable while moving privileged work private", () => {
    expect(migrationSource).toContain(
      "create or replace function app_private.submit_creator_report_task",
    );
    expect(migrationSource).toContain(
      "create or replace function public.submit_creator_report_task",
    );
    expect(migrationSource).toContain("security invoker");
    expect(migrationSource).toContain(
      "app_private.submit_creator_report_task(p_task_id, p_submitted_at)",
    );
    expect(migrationSource).toContain(
      "create or replace function app_private.link_creator_performance_evidence",
    );
    expect(migrationSource).toContain(
      "create or replace function public.link_creator_performance_evidence",
    );
    expect(migrationSource).toContain(
      "app_private.link_creator_performance_evidence(",
    );
  });

  it("moves campaign member capacity enforcement out of the exposed schema", () => {
    expect(migrationSource).toContain(
      "create or replace function app_private.enforce_campaign_member_creator_capacity()",
    );
    expect(migrationSource).toContain(
      "execute function app_private.enforce_campaign_member_creator_capacity()",
    );
    expect(migrationSource).toContain(
      "drop function if exists public.enforce_campaign_member_creator_capacity()",
    );
    expect(migrationSource).toContain(
      "revoke all on function app_private.enforce_campaign_member_creator_capacity()",
    );
  });
});
