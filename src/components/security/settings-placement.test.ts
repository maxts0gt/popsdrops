import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const brandSettings = readFileSync(
  new URL("../../app/(site)/(app)/b/settings/page.tsx", import.meta.url),
  "utf8",
);

const creatorProfile = readFileSync(
  new URL("../../app/(site)/(app)/i/profile/page.tsx", import.meta.url),
  "utf8",
);

describe("security and privacy settings placement", () => {
  it("adds MFA and data-rights controls to the brand account surface", () => {
    expect(brandSettings).toContain("MfaSettingsPanel");
    expect(brandSettings).toContain("PrivacyControlsPanel");
    expect(brandSettings).toContain("section.security");
    expect(brandSettings).toContain("section.privacy");
  });

  it("adds the same controls to the creator profile account surface", () => {
    expect(creatorProfile).toContain("MfaSettingsPanel");
    expect(creatorProfile).toContain("PrivacyControlsPanel");
    expect(creatorProfile).toContain("section.security");
    expect(creatorProfile).toContain("section.privacy");
  });
});
