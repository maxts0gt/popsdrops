import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./page.tsx", import.meta.url)),
  "utf8",
);
const marketPickerSource = readFileSync(
  fileURLToPath(
    new URL("../../../../../components/campaigns/campaign-market-picker.tsx", import.meta.url),
  ),
  "utf8",
);

describe("admin settings market governance", () => {
  it("uses the shared market picker instead of a dense checkbox wall", () => {
    expect(source).toContain("CampaignMarketPicker");
    expect(source).toContain("MARKETS");
    expect(source).toContain("MARKET_SCOPE_OPTIONS");
    expect(source).toContain("getMarketLabel");
    expect(source).toContain('testId="admin-settings-market-picker"');
    expect(source).toContain('selectedChipTone="subtle"');
    expect(source).toContain("Enabled markets saved");
    expect(source).toContain("Search countries");
    expect(source).toContain("Market scope");
    expect(source).not.toContain("const ALL_MARKETS");
    expect(source).not.toContain("ALL_MARKETS.map");
    expect(source).not.toContain("grid grid-cols-3 gap-x-6 gap-y-2 sm:grid-cols-5");
    expect(source).not.toContain("checked={enabledMarkets.includes");
    expect(marketPickerSource).toContain('data-testid="selected-markets-list"');
    expect(marketPickerSource).toContain('data-testid="market-country-list"');
  });
});
