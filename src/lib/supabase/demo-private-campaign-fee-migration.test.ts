import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../../supabase/migrations/20260509151434_normalize_demo_private_campaign_fee.sql", import.meta.url),
  "utf8",
);

describe("demo private campaign fee migration", () => {
  it("normalizes the smoke campaign away from the retired sourced fee", () => {
    expect(migration).toContain("4707edb5-dcab-4b2d-b5eb-7e79f0e1f010");
    expect(migration).toContain("campaign_mode = 'private'");
    expect(migration).toContain("creator_sourcing_required = false");
    expect(migration).toContain("service_fee_cents = 14900");
    expect(migration).toContain("\"requiresCustomPricing\": false");
    expect(migration).toContain("campaign_mode = 'sourced'");
    expect(migration).toContain("service_fee_cents = 49900");
  });
});
