import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  attachInviteToApplicationFlowSmokeTargets,
  DEFAULT_APPLICATION_FLOW_CAMPAIGN_ID,
  SMOKE_CREATOR_INVITE_CONTACT,
  buildApplicationFlowSmokeTargets,
  getSmokeBrandCompanyName,
  getSmokeCampaignTitle,
  getSmokeCreatorDisplayName,
  validateApplicationFlowSmoke,
} from "./smoke-application-flow.mjs";

describe("creator application to brand applicant smoke contract", () => {
  it("targets a disposable campaign and both roles", () => {
    expect(buildApplicationFlowSmokeTargets({})).toEqual({
      baseUrl: "http://127.0.0.1:4000",
      campaignId: DEFAULT_APPLICATION_FLOW_CAMPAIGN_ID,
      creatorLoginUrl: "http://127.0.0.1:4000/auth/dev-login?role=creator",
      brandLoginUrl: "http://127.0.0.1:4000/auth/dev-login?role=brand",
      applyUrl: `http://127.0.0.1:4000/apply/${DEFAULT_APPLICATION_FLOW_CAMPAIGN_ID}`,
      discoverUrl: `http://127.0.0.1:4000/i/discover/${DEFAULT_APPLICATION_FLOW_CAMPAIGN_ID}`,
      brandCampaignUrl: `http://127.0.0.1:4000/b/campaigns/${DEFAULT_APPLICATION_FLOW_CAMPAIGN_ID}`,
    });
  });

  it("threads the generated private invite through public apply and creator discover targets", () => {
    const inviteId = "11111111-2222-4333-8444-555555555555";
    const targets = buildApplicationFlowSmokeTargets({});

    const returnedTargets = attachInviteToApplicationFlowSmokeTargets(
      targets,
      inviteId,
    );

    expect(returnedTargets).toBe(targets);
    expect(targets.inviteId).toBe(inviteId);
    expect(targets.applyUrl).toBe(
      `http://127.0.0.1:4000/apply/${DEFAULT_APPLICATION_FLOW_CAMPAIGN_ID}?invite=${inviteId}`,
    );
    expect(targets.discoverUrl).toBe(
      `http://127.0.0.1:4000/i/discover/${DEFAULT_APPLICATION_FLOW_CAMPAIGN_ID}?invite=${inviteId}`,
    );
  });

  it("preserves existing query params when adding a private invite to smoke targets", () => {
    const inviteId = "22222222-3333-4444-8555-666666666666";
    const targets = buildApplicationFlowSmokeTargets({});
    targets.applyUrl = `${targets.applyUrl}?preview=1`;
    targets.discoverUrl = `${targets.discoverUrl}?tab=brief`;

    attachInviteToApplicationFlowSmokeTargets(targets, inviteId);

    expect(targets.applyUrl).toBe(
      `http://127.0.0.1:4000/apply/${DEFAULT_APPLICATION_FLOW_CAMPAIGN_ID}?preview=1&invite=${inviteId}`,
    );
    expect(targets.discoverUrl).toBe(
      `http://127.0.0.1:4000/i/discover/${DEFAULT_APPLICATION_FLOW_CAMPAIGN_ID}?tab=brief&invite=${inviteId}`,
    );
  });

  it("allows smoke setup targets that do not navigate public apply or creator discover", () => {
    const inviteId = "33333333-4444-4555-8666-777777777777";
    const targets = {
      baseUrl: "http://127.0.0.1:4000",
      campaignId: DEFAULT_APPLICATION_FLOW_CAMPAIGN_ID,
      brandLoginUrl: "http://127.0.0.1:4000/auth/dev-login?role=brand",
    };

    const returnedTargets = attachInviteToApplicationFlowSmokeTargets(
      targets,
      inviteId,
    );

    expect(returnedTargets).toBe(targets);
    expect(targets.inviteId).toBe(inviteId);
    expect(targets.applyUrl).toBeUndefined();
    expect(targets.discoverUrl).toBeUndefined();
  });

  it("rejects an application flow that never reaches the brand applicant queue", () => {
    expect(() =>
      validateApplicationFlowSmoke({
        creatorApplyText: "US Market Entry Proof Campaign Private invite Apply Now",
        creatorSubmittedText: "Application submitted",
        brandApplicantText: "No applicants yet",
        consoleErrors: [],
      }),
    ).toThrow(/brand applicant/i);
  });

  it("accepts the intended creator apply to brand applicant state", () => {
    expect(
      validateApplicationFlowSmoke({
        creatorApplyText: "US Market Entry Proof Campaign Private invite Apply Now",
        creatorSubmittedText: "Application submitted",
        brandApplicantText:
          "US Market Entry Proof Campaign Applicants Mina Park Intentional smoke application pitch Accept",
        consoleErrors: [],
      }),
    ).toEqual({ ok: true });
  });

  it("keeps a board-ready creator identity unless a smoke slice overrides it", () => {
    const previousDisplayName = process.env.SMOKE_CREATOR_DISPLAY_NAME;

    try {
      delete process.env.SMOKE_CREATOR_DISPLAY_NAME;
      expect(getSmokeCreatorDisplayName()).toBe("Mina Park");

      process.env.SMOKE_CREATOR_DISPLAY_NAME = "Rose Kim";
      expect(getSmokeCreatorDisplayName()).toBe("Rose Kim");
    } finally {
      if (previousDisplayName === undefined) {
        delete process.env.SMOKE_CREATOR_DISPLAY_NAME;
      } else {
        process.env.SMOKE_CREATOR_DISPLAY_NAME = previousDisplayName;
      }
    }
  });

  it("defaults every evidence slice to board-ready campaign and brand copy", () => {
    const previousCampaignTitle = process.env.SMOKE_CAMPAIGN_TITLE;
    const previousBrandCompanyName = process.env.SMOKE_BRAND_COMPANY_NAME;

    try {
      delete process.env.SMOKE_CAMPAIGN_TITLE;
      delete process.env.SMOKE_BRAND_COMPANY_NAME;
      expect(getSmokeCampaignTitle()).toBe("US Market Entry Proof Campaign");
      expect(getSmokeBrandCompanyName()).toBe("Maison Lumiere");

      process.env.SMOKE_CAMPAIGN_TITLE = "Global Fragrance Proof Campaign";
      process.env.SMOKE_BRAND_COMPANY_NAME = "Maison Atlas";
      expect(getSmokeCampaignTitle()).toBe("Global Fragrance Proof Campaign");
      expect(getSmokeBrandCompanyName()).toBe("Maison Atlas");
    } finally {
      if (previousCampaignTitle === undefined) {
        delete process.env.SMOKE_CAMPAIGN_TITLE;
      } else {
        process.env.SMOKE_CAMPAIGN_TITLE = previousCampaignTitle;
      }

      if (previousBrandCompanyName === undefined) {
        delete process.env.SMOKE_BRAND_COMPANY_NAME;
      } else {
        process.env.SMOKE_BRAND_COMPANY_NAME = previousBrandCompanyName;
      }
    }
  });

  it("seeds a creator-facing campaign image for realistic launch readiness", () => {
    const source = readFileSync(
      new URL("./smoke-application-flow.mjs", import.meta.url),
      "utf8",
    );

    expect(source).toContain('import sharp from "sharp"');
    expect(source).toContain(
      'SMOKE_CAMPAIGN_ASSET_TITLE = "Maison Lumiere New York launch still"',
    );
    expect(source).not.toContain("Market launch hero visual");
    expect(source).not.toContain("Global proof campaign visual");
    expect(source).toContain("linearGradient");
    expect(source).toContain("Product still");
    expect(source).toContain("Launch proof");
    expect(source).toContain('.from("campaign_assets").insert');
    expect(source).toContain('asset_type: "product_image"');
    expect(source).toContain('mime_type: "image/png"');
    expect(source).toContain('visibility: "public"');
    expect(source).toContain('status: "ready"');
  });

  it("seeds a paid campaign so public invite smokes pass the service fee gate", () => {
    const source = readFileSync(
      new URL("./smoke-application-flow.mjs", import.meta.url),
      "utf8",
    );

    expect(source).toContain('service_fee_status: "paid"');
  });

  it("seeds a service-fee snapshot that matches the checkout scope guard", () => {
    const source = readFileSync(
      new URL("./smoke-application-flow.mjs", import.meta.url),
      "utf8",
    );

    expect(source).toContain("max_creators: 3");
    expect(source).toContain("estimatedMaxCreators: 3");
    expect(source).toContain("estimatedActiveDays: 4");
    expect(source).toContain("estimatedReportingDays: 1");
  });

  it("cleans uploaded campaign evidence files before deleting smoke evidence rows", () => {
    const source = readFileSync(
      new URL("./smoke-application-flow.mjs", import.meta.url),
      "utf8",
    );
    const cleanupSource = source.slice(
      source.indexOf("export async function cleanupApplicationFlowSmokeData"),
      source.indexOf("function dateDaysFromNow"),
    );

    expect(cleanupSource).toContain("Find smoke performance evidence files");
    expect(cleanupSource).toContain('.from("campaign-evidence")');
    expect(cleanupSource).toContain(".remove(smokeEvidencePaths)");
    expect(cleanupSource.indexOf(".remove(smokeEvidencePaths)")).toBeLessThan(
      cleanupSource.indexOf("Clean smoke performance evidence"),
    );
  });

  it("cleans content submissions before deleting the campaign so deliverable references cannot strand smoke data", () => {
    const source = readFileSync(
      new URL("./smoke-application-flow.mjs", import.meta.url),
      "utf8",
    );
    const cleanupSource = source.slice(
      source.indexOf("export async function cleanupApplicationFlowSmokeData"),
      source.indexOf("function dateDaysFromNow"),
    );

    expect(cleanupSource).toContain("Clean smoke content submissions");
    expect(cleanupSource.indexOf("Clean smoke content submissions")).toBeLessThan(
      cleanupSource.indexOf('admin.from("campaigns").delete().eq("id", campaignId)'),
    );
  });

  it("cleans campaign creator invites before deleting queued invite emails", () => {
    const source = readFileSync(
      new URL("./smoke-application-flow.mjs", import.meta.url),
      "utf8",
    );
    const cleanupSource = source.slice(
      source.indexOf("export async function cleanupApplicationFlowSmokeData"),
      source.indexOf("function dateDaysFromNow"),
    );

    expect(cleanupSource).toContain("Clean smoke campaign creator invites");
    expect(cleanupSource.indexOf("Clean smoke campaign creator invites")).toBeLessThan(
      cleanupSource.indexOf('deleteRowsByJsonCampaign(admin, "notification_queue"'),
    );
  });

  it("proves private invite context survives public apply and creator submit", () => {
    const source = readFileSync(
      new URL("./smoke-application-flow.mjs", import.meta.url),
      "utf8",
    );

    expect(source).toContain("Create smoke creator invite row");
    expect(source).toContain("publicInviteUrl");
    expect(source).toContain("publicInviteScreenshotPath");
    expect(source).toContain("invite=");
    expect(source).toContain("public-apply-private-invite");
    expect(source).toContain("creator-private-invite-context");
    expect(source).toContain("Find tracked smoke creator invite row");
    expect(source).toContain('status !== "sent"');
    expect(source).toContain("source_invite_id");
    expect(source).toContain("appliedInviteRowState");
    expect(source).toContain("Applied source invite row still exposes send control.");
    expect(source).toContain("Expected source invite row to show Applied status.");
  });

  it("proves invalid signed-in invite links cannot show verified private context", () => {
    const source = readFileSync(
      new URL("./smoke-application-flow.mjs", import.meta.url),
      "utf8",
    );

    expect(source).toContain("invalidCreatorInviteUrl");
    expect(source).toContain("invalidCreatorInviteScreenshotPath");
    expect(source).toContain("creator-private-invite-unavailable");
    expect(source).toContain("creator-private-invite-context");
    expect(source).toContain("Invalid invite link still shows private context.");
  });

  it("captures and checks the creator discover apply rail before submitting", () => {
    const source = readFileSync(
      new URL("./smoke-application-flow.mjs", import.meta.url),
      "utf8",
    );

    expect(source).toContain("DEFAULT_CREATOR_DISCOVER_SCREENSHOT_PATH");
    expect(source).toContain("creatorDiscoverScreenshotPath");
    expect(source).toContain("creator-campaign-apply-jump");
    expect(source).toContain("creator-campaign-handoff-sequence");
    expect(source).toContain("waitForCreatorCampaignHeroImage");
    expect(source).toContain("naturalWidth > 0");
    expect(source).toContain("getBoundingClientRect");
    expect(source).toContain("window.scrollTo");
    expect(source).toContain("creator discover handoff screenshot position");
    expect(source).toContain("gridScrollWidth");
    expect(source).toContain("Creator discover handoff rail overflows");
    expect(source).toContain("Creator discover apply helper overlaps");
    expect(source).toContain("Creator discover apply helper is too visually dominant");
  });

  it("checks the public invite apply helper before the campaign flow rail", () => {
    const source = readFileSync(
      new URL("./smoke-application-flow.mjs", import.meta.url),
      "utf8",
    );

    expect(source).toContain("publicApplyLayout");
    expect(source).toContain("public-apply-jump");
    expect(source).toContain("public-apply-handoff-sequence");
    expect(source).toContain("Public apply handoff rail overflows");
    expect(source).toContain("Public apply helper overlaps the handoff rail");
    expect(source).toContain("Public apply helper is too visually dominant");
  });

  it("seeds smoke users through Supabase admin without burning magic-link OTPs", () => {
    const source = readFileSync(
      new URL("./smoke-application-flow.mjs", import.meta.url),
      "utf8",
    );

    const setupSource = source.slice(
      source.indexOf("export async function setupApplicationFlowSmokeData"),
      source.indexOf("await checkedQuery", source.indexOf("export async function setupApplicationFlowSmokeData")),
    );

    expect(setupSource).toContain('ensureSmokeDataDevUser(admin, "brand")');
    expect(setupSource).toContain('ensureSmokeDataDevUser(admin, "creator")');
    expect(setupSource).not.toContain("/auth/dev-login");
    expect(setupSource).not.toContain("verifyOtp");
  });

  it("protects board-ready smoke identity from dev-login provisioning defaults", () => {
    const source = readFileSync(
      new URL("./smoke-application-flow.mjs", import.meta.url),
      "utf8",
    );

    expect(source).toContain("SMOKE_CREATOR_DISPLAY_NAME");
    expect(source).toContain("SMOKE_BRAND_COMPANY_NAME");
    expect(source).toContain(
      'description: "creator dev login redirect",\n    });\n    await ensureSmokeDataDevUser(admin, "creator");',
    );
    expect(source).toContain(
      'description: "brand dev login redirect",\n    });\n    await ensureSmokeDataDevUser(admin, "brand");',
    );
  });

  it("applies board-ready smoke identity before shared fixture setup starts a dev-login flow", () => {
    const source = readFileSync(
      new URL("./smoke-application-flow.mjs", import.meta.url),
      "utf8",
    );
    const setupSource = source.slice(
      source.indexOf("export async function setupApplicationFlowSmokeData"),
      source.indexOf("const brandId = await ensureSmokeDataDevUser", source.indexOf("export async function setupApplicationFlowSmokeData")),
    );

    expect(source).toContain("function ensureSmokeIdentityEnvDefaults");
    expect(setupSource).toContain("ensureSmokeIdentityEnvDefaults()");
  });

  it("keeps brand-facing invite outreach copy out of dev-auth identity", () => {
    expect(SMOKE_CREATOR_INVITE_CONTACT).toBe("@mina.park");

    const source = readFileSync(
      new URL("./smoke-application-flow.mjs", import.meta.url),
      "utf8",
    );

    expect(source).toContain('contact_type: "handle"');
    expect(source).toContain("tiktok: SMOKE_CREATOR_INVITE_CONTACT");
    expect(source).toContain("instagram: SMOKE_CREATOR_INVITE_CONTACT");
    expect(source).toContain("contact_value: SMOKE_CREATOR_INVITE_CONTACT");
    expect(source).toContain("normalized_contact: SMOKE_CREATOR_INVITE_CONTACT");
    expect(source).not.toContain("contact_value: DEV_SMOKE_USERS.creator.email");
  });

  it("waits for the public invite hero image before capturing screenshot evidence", () => {
    const source = readFileSync(
      new URL("./smoke-application-flow.mjs", import.meta.url),
      "utf8",
    );

    expect(source).toContain("waitForPublicApplyCampaignHeroImage");
    expect(source).toContain("public invite campaign hero image");
    expect(source.indexOf("public invite campaign hero image")).toBeLessThan(
      source.indexOf("captureScreenshot(client, publicInviteScreenshotPath"),
    );
  });
});
