import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(new URL("./for-brands/page.tsx", import.meta.url), "utf8");
const stringsSource = readFileSync(
  new URL("../../../lib/i18n/strings.ts", import.meta.url),
  "utf8",
);

describe("for brands product promise", () => {
  it("centers the Global Proof Room wedge instead of generic marketplace sourcing", () => {
    expect(stringsSource).toContain("Local execution loses brand control.");
    expect(stringsSource).toContain("Private campaigns.\\nProof across markets.");
    expect(stringsSource).toContain("rules, usage rights, locked materials, approvals, proof, and report history");
    expect(stringsSource).toContain("Leadership needs proof, not a screenshot chase.");
    expect(stringsSource).toContain("what is verified, missed, or corrected");
    expect(stringsSource).toContain('"feature.match": "Proof gates"');
    expect(stringsSource).not.toContain("Private campaigns.\\nConcierge when needed.");
    expect(stringsSource).not.toContain("You do not have trusted creator access in new markets.");
    expect(stringsSource).not.toContain("request a curated shortlist from our network.");
  });

  it("keeps the brand page as a focused private campaign work surface", () => {
    expect(pageSource).toContain('useTranslation("marketing.forBrands")');
    expect(pageSource).toContain('"feature.vetted"');
    expect(pageSource).toContain('"feature.match"');
    expect(pageSource).toContain('"pain.1.problem"');
    expect(pageSource).toContain('"pain.3.problem"');
  });
});
