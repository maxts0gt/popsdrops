import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./smoke-campaign-service-fee-gate.mjs", import.meta.url),
  "utf8",
);

describe("campaign service fee gate smoke contract", () => {
  it("proves the direct creator application Data API path is fee gated", () => {
    expect(source).toContain("assertDirectCreatorApplicationServiceFeeGate");
    expect(source).toContain("createAuthenticatedSmokeCreatorClient");
    expect(source).toContain("Expected unpaid direct creator application insert to fail.");
    expect(source).toContain("Expected paid direct creator application insert to succeed.");
    expect(source).toContain('service_fee_status: "pending"');
    expect(source).toContain('service_fee_status: "paid"');
    expect(source).toContain('.from("campaign_applications")');
  });

  it("uses an open-application campaign before expecting a public apply link", () => {
    expect(source).toContain('recruitment_visibility: "open_applications"');
    expect(source.indexOf('recruitment_visibility: "open_applications"')).toBeLessThan(
      source.indexOf('"paid launched invite URL"'),
    );
  });

  it("waits for the shared premium smoke campaign title instead of stale fixture copy", () => {
    expect(source).toContain("getSmokeCampaignTitle");
    expect(source).toContain("getSmokeCampaignTitle()");
    expect(source).not.toContain('"Application Flow Smoke Campaign"');
  });
});
