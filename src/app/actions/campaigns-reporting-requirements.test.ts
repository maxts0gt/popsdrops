import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const campaignsSource = readFileSync(
  new URL("./campaigns.ts", import.meta.url),
  "utf8",
);
const newCampaignSource = readFileSync(
  new URL("../(site)/(app)/b/campaigns/new/page.tsx", import.meta.url),
  "utf8",
);

describe("campaign reporting requirements creation", () => {
  it("builds defaults from deliverables when explicit requirements are absent", () => {
    expect(campaignsSource).toContain("buildDefaultCampaignReportingRequirements");
    expect(campaignsSource).toContain("reporting_requirements");
    expect(campaignsSource).toContain(".from(\"campaign_reporting_requirements\")");
  });

  it("creates a campaign reporting plan during campaign creation", () => {
    expect(campaignsSource).toContain(".from(\"campaign_reporting_plans\")");
    expect(campaignsSource).toContain("reporting_cadence");
  });

  it("passes reporting requirements from the campaign builder payload", () => {
    expect(newCampaignSource).toContain("reporting_requirements");
    expect(newCampaignSource).toContain("reporting_cadence");
  });
});
