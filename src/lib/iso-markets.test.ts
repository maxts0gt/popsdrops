import { describe, expect, it } from "vitest";

import {
  CAMPAIGN_MARKETS,
  MARKET_SCOPES,
  MARKETS,
  campaignMarketsIncludeCreatorMarket,
  getMarketLabel,
  isMarketScope,
  normalizeEnglishRegionName,
  sanitizeCampaignMarkets,
} from "./constants";

describe("ISO market list", () => {
  it("uses ISO 3166-1 alpha-2 country codes for selectable markets", () => {
    expect(MARKETS.length).toBeGreaterThanOrEqual(240);
    expect(MARKETS).toContain("kr");
    expect(MARKETS).toContain("us");
    expect(MARKETS).toContain("gb");
    expect(MARKETS).not.toContain("south_korea");
    expect(MARKETS).not.toContain("uk");
  });

  it("keeps legacy market values displayable for existing records", () => {
    expect(getMarketLabel("south_korea", "en")).toBe("South Korea");
    expect(getMarketLabel("uae", "en")).toBe("United Arab Emirates");
  });

  it("normalizes browser-specific English region aliases before rendering market options", () => {
    expect(normalizeEnglishRegionName("FK", "Falkland Islands (Islas Malvinas)")).toBe(
      "Falkland Islands",
    );
    expect(normalizeEnglishRegionName("HK", "Hong Kong SAR China")).toBe(
      "Hong Kong",
    );
    expect(normalizeEnglishRegionName("PS", "Palestinian Territories")).toBe(
      "Palestine",
    );
  });

  it("supports campaign-level global and regional market scopes without polluting the ISO country list", () => {
    expect(MARKET_SCOPES).toEqual([
      "global",
      "region:apac",
      "region:emea",
      "region:americas",
      "region:latam",
    ]);
    expect(CAMPAIGN_MARKETS).toContain("global");
    expect(CAMPAIGN_MARKETS).toContain("region:apac");
    expect(MARKETS).not.toContain("global");
    expect(MARKETS).not.toContain("region:apac");
    expect(isMarketScope("global")).toBe(true);
    expect(isMarketScope("kr")).toBe(false);
    expect(getMarketLabel("global", "en")).toBe("Global");
    expect(getMarketLabel("region:apac", "en")).toBe("APAC");
    expect(getMarketLabel("region:emea", "en")).toBe("EMEA");
  });

  it("matches global and regional campaign scopes against creator country markets", () => {
    expect(campaignMarketsIncludeCreatorMarket(["global"], "kr")).toBe(true);
    expect(campaignMarketsIncludeCreatorMarket(["region:apac"], "jp")).toBe(true);
    expect(campaignMarketsIncludeCreatorMarket(["region:emea"], "fr")).toBe(true);
    expect(campaignMarketsIncludeCreatorMarket(["region:latam"], "br")).toBe(true);
    expect(campaignMarketsIncludeCreatorMarket(["region:americas"], "us")).toBe(true);
    expect(campaignMarketsIncludeCreatorMarket(["region:emea"], "jp")).toBe(false);
  });

  it("sanitizes legacy brand markets before settings render or save", () => {
    expect(
      sanitizeCampaignMarkets(["US", "uk", "japan", "france", "region:apac", "jp", "jp"]),
    ).toEqual(["us", "region:apac", "jp"]);
    expect(sanitizeCampaignMarkets(["kr", "global", "region:emea"])).toEqual([
      "global",
    ]);
  });
});
