import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const designSource = readFileSync(
  new URL("../../../../../../DESIGN.md", import.meta.url),
  "utf8",
);

describe("creator discover visual opportunity flow", () => {
  it("loads public Creative Kit assets for campaign discovery cards", () => {
    expect(source).toContain("campaign_assets");
    expect(source).toContain("createSignedUrls");
    expect(source).toContain("pickCreatorFacingHeroAsset");
    expect(source).toContain('data-testid="creator-discover-card"');
    expect(source).toContain('data-testid="creator-discover-card-image"');
  });

  it("keeps creator cards visual without hiding operational signals", () => {
    expect(source).toContain("heroAsset");
    expect(source).toContain("function CampaignCardVisual");
    expect(source).toContain('data-testid="creator-discover-card-fallback-visual"');
    expect(source).not.toContain("ImageIcon");
    expect(source).toContain("formatBudgetPerCreatorRange(");
    expect(source).toContain("deadlineLabel(");
    expect(source).toContain("getCampaignApplicationDeadlineDaysLeft");
    expect(source).not.toContain("new Date(dateStr).getTime() - Date.now()");
    expect(source).toContain("PLATFORM_LABELS");
    expect(designSource).toContain("Missing campaign images should never render");
  });

  it("treats Global and regional campaign scopes as valid matches for country filters", () => {
    expect(source).toContain("campaignMarketsIncludeCreatorMarket");
    expect(source).toContain("campaignMarketsIncludeCreatorMarket(c.markets, filters.market)");
    expect(source).not.toContain("!c.markets.includes(filters.market)");
  });

  it("hides unpaid service-fee campaigns from creator discovery", () => {
    expect(source).toContain(
      "service_fee_cents, service_fee_status,",
    );
    expect(source).toContain("isCampaignOpenForCreatorDiscovery");
    expect(source).toContain("isCampaignOpenForCreatorDiscovery(campaign)");
  });

  it("only shows campaigns intentionally opened for creator discovery", () => {
    expect(source).toContain("recruitment_visibility");
    expect(source).toContain("isCampaignOpenForCreatorDiscovery(campaign)");
  });
});
