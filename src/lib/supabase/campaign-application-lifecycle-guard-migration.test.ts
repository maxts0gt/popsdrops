import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(
  fileURLToPath(new URL("../../../", import.meta.url)),
);
const migrationsDir = path.join(projectRoot, "supabase/migrations");
const decisionAfterDeadlineMigrationPath = path.join(
  migrationsDir,
  "20260604162000_campaign_application_decisions_after_deadline.sql",
);

function readApplicationLifecycleMigrations() {
  return readdirSync(migrationsDir)
    .filter((file) => file.includes("campaign_application_lifecycle"))
    .sort()
    .map((file) => readFileSync(path.join(migrationsDir, file), "utf8"))
    .join("\n");
}

describe("campaign application lifecycle guard migration", () => {
  it("keeps creator-owned application updates inside open recruiting lifecycle", () => {
    const migration = readApplicationLifecycleMigrations();

    expect(migration).toContain("campaign_applications_update_own");
    expect(migration).toContain(
      "create or replace function app_private.campaign_accepts_application_decisions",
    );
    expect(migration).toContain(
      "drop policy if exists rls_campaign_applications_update_authenticated_335b3251",
    );
    expect(migration).toContain(
      "create policy rls_campaign_applications_update_authenticated_335b3251",
    );
    expect(migration).toContain("status in ('pending', 'counter_offer')");
    expect(migration).toContain("status = 'withdrawn'");
    expect(migration).toContain(
      "app_private.can_apply_to_campaign(campaign_applications.campaign_id)",
    );
    expect(migration).toContain(
      "app_private.campaign_accepts_application_decisions(",
    );
  });

  it("keeps creator intake deadline-gated while brand selection remains open during recruiting", () => {
    const migration = readFileSync(decisionAfterDeadlineMigrationPath, "utf8");
    const decisionFunction = migration.slice(
      migration.indexOf(
        "create or replace function app_private.campaign_accepts_application_decisions",
      ),
      migration.indexOf("comment on function app_private.campaign_accepts_application_decisions"),
    );

    expect(migration).toContain(
      "create or replace function app_private.campaign_accepts_application_decisions",
    );
    expect(decisionFunction).toContain("campaigns.status = 'recruiting'");
    expect(decisionFunction).not.toContain("campaign_application_deadline_is_open");
    expect(migration).toContain(
      "Creator intake stays deadline-gated; brand selection and creator withdrawal remain open while recruiting.",
    );
    expect(migration).not.toContain(
      "app_private.can_apply_to_campaign(campaign_applications.campaign_id)",
    );
    expect(migration).toContain(
      "and app_private.campaign_accepts_application_decisions(",
    );
  });

  it("keeps direct creator application inserts behind the service fee gate", () => {
    const migration = readApplicationLifecycleMigrations();

    expect(migration).toContain(
      "create or replace function app_private.can_apply_to_campaign",
    );
    expect(migration).toContain("campaign.service_fee_cents");
    expect(migration).toContain("campaign.application_deadline is null");
    expect(migration).toContain("campaign.application_deadline >= current_date");
    expect(migration).not.toContain("campaign.application_deadline >= now()");
    expect(migration).toContain("coalesce(campaign.service_fee_cents, 0) <= 0");
    expect(migration).toContain("campaign.service_fee_status = 'paid'");
    expect(migration.indexOf("campaign.status = 'recruiting'")).toBeLessThan(
      migration.indexOf("coalesce(campaign.service_fee_cents, 0) <= 0"),
    );
    expect(migration.indexOf("campaign.service_fee_status = 'paid'")).toBeLessThan(
      migration.indexOf("campaign.brand_id <> auth.uid()"),
    );
  });

  it("keeps invite-only direct creator application inserts behind a matched invite", () => {
    const migration = readApplicationLifecycleMigrations();

    expect(migration).toContain(
      "create or replace function app_private.creator_matches_campaign_application_invite",
    );
    expect(migration).toContain("campaign.recruitment_visibility = 'open_applications'");
    expect(migration).toContain(
      "campaign.recruitment_visibility in ('private_invite', 'shortlist_invite')",
    );
    expect(migration).toContain("public.campaign_creator_invites invite");
    expect(migration).toContain("invite.status in ('manual', 'queued', 'sent')");
    expect(migration).toContain("invite.contact_type = 'email'");
    expect(migration).toContain("profiles.email");
    expect(migration).toContain("invite.contact_type = 'handle'");
    expect(migration).toContain("public.creator_profiles creator_profile");
    expect(migration).toContain("creator_profile.tiktok");
    expect(migration).toContain("creator_profile.instagram");
    expect(migration).toContain("creator_profile.snapchat");
    expect(migration).toContain("creator_profile.youtube");
    expect(migration).toContain("creator_profile.facebook");
    expect(migration).toContain("trim(both '\"' from lower(coalesce(account::text, '')))");
    expect(migration).toContain(
      "app_private.creator_matches_campaign_application_invite(campaign.id, auth.uid())",
    );
  });

  it("guards the mobile counter-offer accept RPC before accepting or creating membership", () => {
    const migration = readFileSync(decisionAfterDeadlineMigrationPath, "utf8");

    expect(migration).toContain("create or replace function app_private.accept_counter_offer");
    expect(migration).toContain(
      "if not app_private.campaign_accepts_application_decisions(v_app.campaign_id) then",
    );
    expect(
      migration.indexOf(
        "if not app_private.campaign_accepts_application_decisions",
      ),
    ).toBeLessThan(migration.indexOf("update public.campaign_applications"));
    expect(
      migration.indexOf(
        "if not app_private.campaign_accepts_application_decisions",
      ),
    ).toBeLessThan(migration.indexOf("insert into public.campaign_members"));
    expect(migration).toContain(
      "Creator intake stays deadline-gated; counter-offer responses stay open while recruiting.",
    );
  });
});
