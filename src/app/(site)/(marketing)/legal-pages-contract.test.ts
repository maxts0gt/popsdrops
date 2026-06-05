import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const privacySource = readFileSync(
  fileURLToPath(new URL("./privacy/page.tsx", import.meta.url)),
  "utf8",
);

const termsSource = readFileSync(
  fileURLToPath(new URL("./terms/page.tsx", import.meta.url)),
  "utf8",
);

const supportSource = readFileSync(
  fileURLToPath(new URL("./support/page.tsx", import.meta.url)),
  "utf8",
);

const mobileStoreMetadata = readFileSync(
  fileURLToPath(new URL("../../../../mobile/store-metadata.md", import.meta.url)),
  "utf8",
);

describe("legal pages product contract", () => {
  it("describes live processors and evidence-first AI workflows", () => {
    expect(privacySource).toContain("Stripe");
    expect(privacySource).toContain("Axiom");
    expect(privacySource).toContain("Slack");
    expect(privacySource).toContain("performance evidence");
    expect(privacySource).toContain("Google Gemini API");
    expect(privacySource).toContain("campaign service fee");
  });

  it("publishes category-specific retention targets and data-rights handling", () => {
    expect(privacySource).toContain("Access requests");
    expect(privacySource).toContain("Campaign records");
    expect(privacySource).toContain("Evidence files");
    expect(privacySource).toContain("Consent records");
    expect(privacySource).toContain("data export");
    expect(privacySource).toContain("account deletion");
  });

  it("matches the current paid self-serve campaign model", () => {
    expect(termsSource).toContain("campaign service fee");
    expect(termsSource).toContain("Stripe Checkout");
    expect(termsSource).toContain("Creators are not charged");
    expect(termsSource).not.toContain("currently free for all users during our launch period");
  });

  it("publishes a real support page for app-store review and user help", () => {
    expect(supportSource).toContain("Support");
    expect(supportSource).toContain("support@popsdrops.com");
    expect(supportSource).toContain("legal@popsdrops.com");
    expect(supportSource).toContain("Creators");
    expect(supportSource).toContain("Brands");
    expect(mobileStoreMetadata).toContain("https://popsdrops.com/support");
    expect(mobileStoreMetadata).not.toContain("https://popsdrops.com/contact");
  });
});
