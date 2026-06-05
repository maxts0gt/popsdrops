import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const stringsSource = readFileSync(
  new URL("../../../lib/i18n/strings.ts", import.meta.url),
  "utf8",
);

describe("landing page product promise", () => {
  it("keeps the refined global campaign promise without deprecated sourcing language", () => {
    expect(stringsSource).toContain('Run private creator campaigns.\\nIn markets you cannot reach alone.');
    expect(stringsSource).toContain("Invite the creators you trust");
    expect(stringsSource).toContain("reports built for leadership");
    expect(stringsSource).toContain("Private brand access");
    expect(stringsSource).toContain("Evidence-backed reports");
    expect(stringsSource).toContain("Share a private invite when the campaign is ready.");
    expect(stringsSource).not.toContain("let PopsDrops source vetted local talent");
    expect(stringsSource).not.toContain("request a custom Concierge sourcing scope");
  });

  it("preserves the luxury landing hero instead of replacing it with dashboard chrome", () => {
    expect(pageSource).toContain("SocialGrid");
    expect(pageSource).toContain("bg-black");
    expect(pageSource).toContain("text-center");
    expect(pageSource).toContain("max-w-6xl");
    expect(pageSource).toContain('data-testid="landing-trust-rail"');
    expect(pageSource).toContain('t("trust.private")');
    expect(pageSource).toContain('t("trust.languages")');
    expect(pageSource).toContain('t("trust.reports")');
    expect(pageSource).not.toContain("lg:text-7xl");
    expect(pageSource).not.toContain("HeroCommandCenterPreview");
    expect(pageSource).not.toContain('data-testid="landing-command-center-preview"');
    expect(pageSource).not.toContain("hero.preview.payToLaunch");
    expect(pageSource).not.toContain("hero.preview.proofQueue");
  });
});
