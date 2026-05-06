import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

describe("public apply reporting requirements flow", () => {
  it("shows reporting requirements and eligibility before applying", () => {
    expect(source).toContain("reportingRequirements");
    expect(source).toContain("getCreatorReportingEligibility");
    expect(source).toContain("reporting_requirements");
  });
});
