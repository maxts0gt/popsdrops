import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_PUBLIC_APPLY_CAMPAIGN_ID,
  buildPublicApplySmokeTargets,
  validatePublicApplySmoke,
} from "./smoke-public-apply.mjs";

describe("public apply smoke script contract", () => {
  it("targets the real creator invite bridge", () => {
    expect(buildPublicApplySmokeTargets({})).toEqual({
      baseUrl: "http://127.0.0.1:4000",
      campaignId: DEFAULT_PUBLIC_APPLY_CAMPAIGN_ID,
      loginUrl: "http://127.0.0.1:4000/auth/dev-login?role=creator",
      applyUrl: `http://127.0.0.1:4000/apply/${DEFAULT_PUBLIC_APPLY_CAMPAIGN_ID}`,
      roomUrl: `http://127.0.0.1:4000/i/campaigns/${DEFAULT_PUBLIC_APPLY_CAMPAIGN_ID}`,
    });
  });

  it("prepares the public campaign as a paid recruiting invite before loading it", () => {
    const source = readFileSync(new URL("./smoke-public-apply.mjs", import.meta.url), "utf8");

    expect(source).toContain("preparePublicApplyCampaign");
    expect(source).toContain('service_fee_status: "paid"');
    expect(source).toContain('status: "recruiting"');
    expect(source).toContain("restorePublicApplyCampaign");
  });

  it("rejects an invite page that traps accepted creators behind submitted copy", () => {
    expect(() =>
      validatePublicApplySmoke({
        applyText:
          "K-Beauty Retail Launch Before you apply Application submitted",
        roomText: "",
        finalUrl: `http://127.0.0.1:4000/apply/${DEFAULT_PUBLIC_APPLY_CAMPAIGN_ID}`,
        consoleErrors: [],
      }),
    ).toThrow(/campaign room action/i);
  });

  it("accepts the intended invite to room state", () => {
    expect(
      validatePublicApplySmoke({
        applyText:
          "K-Beauty Retail Launch Before you apply Open campaign room",
        roomText: "K-Beauty Retail Launch Status Brief Tasks Submit",
        finalUrl: `http://127.0.0.1:4000/i/campaigns/${DEFAULT_PUBLIC_APPLY_CAMPAIGN_ID}`,
        consoleErrors: [],
      }),
    ).toEqual({ ok: true });
  });
});
