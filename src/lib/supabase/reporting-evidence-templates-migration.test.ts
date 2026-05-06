import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../supabase/migrations/20260507010000_reporting_evidence_templates.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("reporting evidence templates migration", () => {
  it("adds sparse reporting evidence tables", () => {
    expect(migration).toContain(
      "create table if not exists public.reporting_metric_definitions",
    );
    expect(migration).toContain(
      "create table if not exists public.campaign_reporting_requirements",
    );
    expect(migration).toContain(
      "create table if not exists public.content_performance_metric_values",
    );
    expect(migration).toContain(
      "create table if not exists public.content_performance_ai_extractions",
    );
  });

  it("supports all reporting platforms including X and Generic", () => {
    for (const platform of [
      "instagram",
      "tiktok",
      "youtube",
      "facebook",
      "snapchat",
      "x",
      "generic",
    ]) {
      expect(migration).toContain(`'${platform}'`);
    }
  });

  it("extends reporting cadence with per_post", () => {
    expect(migration).toContain("campaign_reporting_plans_cadence_check");
    expect(migration).toContain("'per_post'");
  });

  it("enforces generic platform label and controlled source states", () => {
    expect(migration).toContain(
      "campaign_reporting_requirements_generic_label_check",
    );
    expect(migration).toContain("source_type in (");
    expect(migration).toContain("'creator_manual'");
    expect(migration).toContain("'ai_extracted'");
    expect(migration).toContain("'creator_confirmed'");
    expect(migration).toContain("'brand_verified'");
    expect(migration).toContain("'platform_api'");
  });

  it("enables RLS and policies on all new public tables", () => {
    for (const table of [
      "reporting_metric_definitions",
      "campaign_reporting_requirements",
      "content_performance_metric_values",
      "content_performance_ai_extractions",
    ]) {
      expect(migration).toContain(
        `alter table public.${table} enable row level security`,
      );
    }

    expect(migration).toContain("campaign_reporting_requirements_select_access");
    expect(migration).toContain(
      "content_performance_metric_values_select_access",
    );
    expect(migration).toContain(
      "content_performance_ai_extractions_select_access",
    );
  });

  it("explicitly exposes reporting tables through the Supabase Data API", () => {
    expect(migration).toContain(
      "grant select on table public.reporting_metric_definitions",
    );
    expect(migration).toContain(
      "grant select on table public.campaign_reporting_requirements",
    );
    expect(migration).toContain(
      "grant select, insert, update on table public.content_performance_metric_values",
    );
    expect(migration).toContain(
      "grant select, update on table public.content_performance_ai_extractions",
    );
  });
});
