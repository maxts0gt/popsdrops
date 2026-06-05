import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(
  readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
);

const sourcePath = "scripts/smoke-release-candidate-story.mjs";

describe("release candidate story smoke", () => {
  it("exposes one command for the full money to report story", () => {
    expect(packageJson.scripts["smoke:release-candidate-story"]).toBe(
      `node ${sourcePath}`,
    );
    expect(packageJson.scripts["smoke:release"]).toContain(
      "smoke:release-candidate-story",
    );
  });

  it("keeps the story on one campaign from payment through report sharing", () => {
    const source = readFileSync(resolve(process.cwd(), sourcePath), "utf8");

    expect(source).toContain("DEFAULT_RELEASE_CANDIDATE_STORY_CAMPAIGN_ID");
    expect(source).toContain("RELEASE_CANDIDATE_STORY_CAMPAIGN_TITLE");
    expect(source).toContain("US Market Entry Proof Campaign");
    expect(source).toContain("RELEASE_CANDIDATE_STORY_CREATOR_NAME");
    expect(source).toContain("Mina Park");
    expect(source).toContain("RELEASE_CANDIDATE_STORY_BRAND_NAME");
    expect(source).toContain("Maison Lumiere");
    expect(source).toContain("process.env.SMOKE_CAMPAIGN_TITLE");
    expect(source).toContain("process.env.SMOKE_CREATOR_DISPLAY_NAME");
    expect(source).toContain("process.env.SMOKE_BRAND_COMPANY_NAME");
    expect(source).toContain("getSmokeCampaignTitle()");
    expect(source).toContain("setupApplicationFlowSmokeData");
    expect(source).toContain("fillStripeCheckoutTestPayment");
    expect(source).toContain("submitCreatorApplication");
    expect(source).toContain("acceptCreatorApplication");
    expect(source).toContain("campaign-start-work-action");
    expect(source).toContain("submitCreatorDraft");
    expect(source).toContain("submitCreatorPerformanceProof");
    expect(source).toContain("verifyBrandReportEvidence");
    expect(source).toContain("report-share-button");
    expect(source).toContain("report-export-menu");
    expect(source).toContain("Data source");
    expect(source).toContain("Brand-reviewed proof");
    expect(source).toContain("Creator evidence reviewed by brand");
    expect(source).not.toContain('"How metrics entered PopsDrops"');
    expect(source).toContain("admin-campaigns-service-fee-status");
    expect(source).toContain("checkout.session.completed");
    expect(source).toContain("cleanupApplicationFlowSmokeData");
    expect(source).not.toContain('"Application Flow Smoke Campaign"');
  });
});
