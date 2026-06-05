import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const migrationPath = path.join(
  projectRoot,
  "supabase/migrations/20260509110530_enterprise_concierge_requests.sql",
);
const policyOptimizationPath = path.join(
  projectRoot,
  "supabase/migrations/20260509113304_optimize_enterprise_concierge_requests_policies.sql",
);
const quoteDetailsPath = path.join(
  projectRoot,
  "supabase/migrations/20260509124807_enterprise_concierge_quote_details.sql",
);
const capacityRelaxationPath = path.join(
  projectRoot,
  "supabase/migrations/20260527092000_relax_enterprise_concierge_creator_count.sql",
);
const privateCapacityPath = path.join(
  projectRoot,
  "supabase/migrations/20260530103000_enterprise_concierge_private_capacity_scope.sql",
);
const databaseTypesPath = path.join(projectRoot, "src/types/database.ts");

describe("enterprise concierge requests migration", () => {
  it("stores large sourcing requests with brand-owned RLS and admin review access", () => {
    expect(existsSync(migrationPath)).toBe(true);
    expect(existsSync(policyOptimizationPath)).toBe(true);
    expect(existsSync(quoteDetailsPath)).toBe(true);
    expect(existsSync(capacityRelaxationPath)).toBe(true);
    expect(existsSync(privateCapacityPath)).toBe(true);

    const migration = readFileSync(migrationPath, "utf8");
    const policyOptimization = readFileSync(policyOptimizationPath, "utf8");
    const quoteDetails = readFileSync(quoteDetailsPath, "utf8");
    const capacityRelaxation = readFileSync(capacityRelaxationPath, "utf8");
    const privateCapacity = readFileSync(privateCapacityPath, "utf8");
    const databaseTypes = readFileSync(databaseTypesPath, "utf8");

    expect(migration).toContain("create table if not exists public.enterprise_concierge_requests");
    expect(migration).toContain("brand_id uuid not null references public.profiles(id)");
    expect(migration).toContain("requested_creator_count integer not null check");
    expect(migration).toContain("requested_creator_count > 50");
    expect(migration).toContain("service_estimate jsonb not null");
    expect(migration).toContain("alter table public.enterprise_concierge_requests enable row level security");
    expect(migration).toContain("enterprise_concierge_requests_insert_brand");
    expect(migration).toContain("enterprise_concierge_requests_select_brand");
    expect(migration).toContain("enterprise_concierge_requests_select_admin");
    expect(migration).toContain("enterprise_concierge_requests_update_admin");
    expect(migration).toContain("app_private.current_user_is_admin()");
    expect(policyOptimization).toContain("enterprise_concierge_requests_select_access");
    expect(policyOptimization).toContain("drop policy if exists enterprise_concierge_requests_select_brand");
    expect(policyOptimization).toContain("drop policy if exists enterprise_concierge_requests_select_admin");
    expect(policyOptimization).toContain("brand_id = (select auth.uid())");
    expect(policyOptimization).toContain("(select app_private.current_user_is_admin())");
    expect(quoteDetails).toContain("quoted_service_fee_cents");
    expect(quoteDetails).toContain("quote_note");
    expect(quoteDetails).toContain("quoted_at");
    expect(capacityRelaxation).toContain(
      "enterprise_concierge_requests_requested_creator_count_check",
    );
    expect(capacityRelaxation).toContain("requested_creator_count > 0");
    expect(capacityRelaxation).toContain("requested_creator_count <= 5000");
    expect(privateCapacity).toContain("enterprise_concierge_requests_campaign_mode_check");
    expect(privateCapacity).toContain("campaign_mode in ('private', 'sourced')");
    expect(privateCapacity).toContain("private capacity");
    expect(databaseTypes).toContain("enterprise_concierge_requests");
    expect(databaseTypes).toContain("campaign_mode: CampaignModeType");
    expect(databaseTypes).toContain("requested_creator_count: number");
    expect(databaseTypes).toContain("service_estimate: Record<string, unknown>");
    expect(databaseTypes).toContain("quoted_service_fee_cents");
    expect(databaseTypes).toContain("quote_note");
  });
});
