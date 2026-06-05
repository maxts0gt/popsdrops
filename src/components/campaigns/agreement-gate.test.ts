import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./agreement-gate.tsx", import.meta.url), "utf8");
const stringsSource = readFileSync(
  new URL("../../lib/i18n/strings.ts", import.meta.url),
  "utf8",
);

describe("AgreementGate", () => {
  it("renders creator agreement as a compact entry checkpoint", () => {
    expect(source).toContain("agreement.reviewTitle");
    expect(source).toContain("agreement.unlockSummary");
    expect(source).toContain("agreement.signatureTitle");
    expect(source).toContain("agreement.ruleCount");
    expect(source).toContain("ruleEntries.slice(0, 4)");
  });

  it("keeps all creator gate copy in i18n", () => {
    expect(stringsSource).toContain('"agreement.reviewTitle"');
    expect(stringsSource).toContain('"agreement.unlockSummary"');
    expect(stringsSource).toContain('"agreement.signatureTitle"');
    expect(stringsSource).toContain('"agreement.ruleCount"');
  });
});
