import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const waitlistActionSource = readFileSync(
  fileURLToPath(new URL("./waitlist.ts", import.meta.url)),
  "utf8",
);

const requestInvitePageSource = readFileSync(
  fileURLToPath(
    new URL("../(site)/(marketing)/request-invite/page.tsx", import.meta.url),
  ),
  "utf8",
);

describe("public brand access request", () => {
  it("persists target markets from the public brand request", () => {
    const brandBranch = waitlistActionSource.slice(
      waitlistActionSource.indexOf('if (data.type === "brand")'),
      waitlistActionSource.indexOf("} else {"),
    );

    expect(brandBranch).toContain("row.markets = data.markets");
  });

  it("shows target market before a brand can submit access request", () => {
    expect(requestInvitePageSource).toContain("CAMPAIGN_MARKETS");
    expect(requestInvitePageSource).toContain("targetMarket");
    expect(requestInvitePageSource).toContain('id="targetMarket"');
    expect(requestInvitePageSource).toContain("brand.targetMarket");
    expect(requestInvitePageSource).toContain("brand.targetMarket.placeholder");
  });

  it("uses deterministic market labels to avoid public-form hydration drift", () => {
    expect(requestInvitePageSource).toContain("MARKET_ACCESS_LABELS");
    expect(requestInvitePageSource).not.toContain("getMarketLabel(");
  });

  it("records request-invite legal consent at the point of collection", () => {
    expect(waitlistActionSource).toContain("recordLegalConsent");
    expect(waitlistActionSource).toContain('source: "request_invite"');
    expect(waitlistActionSource).toContain("email: data.email");
    expect(requestInvitePageSource).toContain("legal.notice");
    expect(requestInvitePageSource).toContain('href="/terms"');
    expect(requestInvitePageSource).toContain('href="/privacy"');
  });
});
