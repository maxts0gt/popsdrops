import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_APPLICATION_ACCEPTANCE_CAMPAIGN_ID,
  buildPublicCampaignApiUrlFromApplyUrl,
  buildApplicationAcceptanceSmokeTargets,
  validateApplicationAcceptanceSmoke,
} from "./smoke-application-acceptance.mjs";

describe("brand accepts creator application smoke contract", () => {
  it("targets a disposable acceptance campaign and both role surfaces", () => {
    expect(buildApplicationAcceptanceSmokeTargets({})).toEqual({
      baseUrl: "http://127.0.0.1:4000",
      campaignId: DEFAULT_APPLICATION_ACCEPTANCE_CAMPAIGN_ID,
      creatorLoginUrl: "http://127.0.0.1:4000/auth/dev-login?role=creator",
      brandLoginUrl: "http://127.0.0.1:4000/auth/dev-login?role=brand",
      applyUrl: `http://127.0.0.1:4000/apply/${DEFAULT_APPLICATION_ACCEPTANCE_CAMPAIGN_ID}`,
      discoverUrl: `http://127.0.0.1:4000/i/discover/${DEFAULT_APPLICATION_ACCEPTANCE_CAMPAIGN_ID}`,
      brandCampaignUrl: `http://127.0.0.1:4000/b/campaigns/${DEFAULT_APPLICATION_ACCEPTANCE_CAMPAIGN_ID}`,
      creatorCampaignUrl: `http://127.0.0.1:4000/i/campaigns/${DEFAULT_APPLICATION_ACCEPTANCE_CAMPAIGN_ID}`,
    });
  });

  it("derives the public campaign API URL from the accepted apply URL", () => {
    expect(
      buildPublicCampaignApiUrlFromApplyUrl(
        "http://127.0.0.1:4000/apply/a0000000-0000-4000-8000-000000000102?invite=abc",
      ),
    ).toBe(
      "http://127.0.0.1:4000/api/public/campaigns/a0000000-0000-4000-8000-000000000102?invite=abc",
    );
  });

  it("rejects an acceptance flow that never unlocks the creator room", () => {
    expect(() =>
      validateApplicationAcceptanceSmoke({
        brandAcceptedText:
          "US Market Entry Proof Campaign Members Mina Park TikTok $275 No applications yet",
        creatorGateText:
          "US Market Entry Proof Campaign Review before you continue Sign and continue Full brief, private assets, content submission, and performance reporting.",
        publicApplyAfterAcceptText:
          "US Market Entry Proof Campaign Open campaign room",
        signedCreatorRoomText: "US Market Entry Proof Campaign Apply Now",
        agreementAcceptanceCount: 1,
        consoleErrors: [],
      }),
    ).toThrow(/creator room/i);
  });

  it("rejects an accepted creator room that unlocks without the agreement gate", () => {
    expect(() =>
      validateApplicationAcceptanceSmoke({
        brandAcceptedText:
          "US Market Entry Proof Campaign Applicants No applications yet Members Mina Park TikTok $275",
        creatorGateText: "US Market Entry Proof Campaign Brief Tasks Submit",
        publicApplyAfterAcceptText:
          "US Market Entry Proof Campaign Open campaign room",
        signedCreatorRoomText:
          "US Market Entry Proof Campaign Next action Brief Tasks Submit",
        agreementAcceptanceCount: 1,
        consoleErrors: [],
      }),
    ).toThrow(/agreement gate/i);
  });

  it("accepts the intended brand accept to creator room state", () => {
    expect(
      validateApplicationAcceptanceSmoke({
        brandAcceptedText:
          "US Market Entry Proof Campaign Applicants No applications yet Members Mina Park TikTok $275",
        creatorGateText:
          "US Market Entry Proof Campaign Review before you continue Sign and continue Full brief, private assets, content submission, and performance reporting.",
        publicApplyAfterAcceptText:
          "US Market Entry Proof Campaign Open campaign room",
        signedCreatorRoomText:
          "US Market Entry Proof Campaign Next action Brief Tasks Submit",
        agreementAcceptanceCount: 1,
        consoleErrors: [],
      }),
    ).toEqual({ ok: true });
  });

  it("seeds a published agreement and signs it before private materials unlock", () => {
    const source = readFileSync(
      new URL("./smoke-application-acceptance.mjs", import.meta.url),
      "utf8",
    );

    expect(source).toContain("createSmokeCampaignAgreement");
    expect(source).toContain("campaign_agreements");
    expect(source).toContain("campaign_agreement_acceptances");
    expect(source).toContain("creator-agreement-gate");
    expect(source).toContain("agreement-typed-name");
    expect(source).toContain("Sign and continue");
    expect(source).toContain("Full brief, private assets, content submission, and performance reporting.");
    expect(source).toContain("application-acceptance-creator-gate-smoke.png");
  });

  it("uses the configurable smoke campaign title in shared creator waits", () => {
    const source = readFileSync(
      new URL("./smoke-application-acceptance.mjs", import.meta.url),
      "utf8",
    );

    expect(source).toContain("getSmokeCampaignTitle");
    expect(source).toContain("getSmokeCampaignTitle()");
    expect(source).not.toContain("SMOKE_CAMPAIGN_TITLE");
  });

  it("sets board-ready identity before app launch and reasserts it after creator dev-login", () => {
    const source = readFileSync(
      new URL("./smoke-application-acceptance.mjs", import.meta.url),
      "utf8",
    );
    const runSource = source.slice(
      source.indexOf("async function runApplicationAcceptanceSmoke"),
      source.indexOf("const admin = createAdminClient()"),
    );

    expect(source).toContain("ensureSmokeIdentityEnvDefaults");
    expect(runSource.indexOf("ensureSmokeIdentityEnvDefaults()")).toBeLessThan(
      runSource.indexOf("ensureDevServer"),
    );
    expect(source).toContain(
      'await submitCreatorApplication(client, targets);\n    await ensureSmokeDataDevUser(admin, "creator");',
    );
  });
});
