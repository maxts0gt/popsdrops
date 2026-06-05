import { describe, expect, it } from "vitest";

import {
  buildEasSubmitArgs,
  buildProductionSubmitOutcome,
  parseSubmitPlatform,
} from "./submit-production-build.mjs";

describe("production store submit wrapper", () => {
  it("builds a non-interactive EAS submit command for one platform", () => {
    expect(buildEasSubmitArgs("ios")).toEqual([
      "--yes",
      "eas-cli@19.0.8",
      "submit",
      "--platform",
      "ios",
      "--profile",
      "production",
      "--latest",
      "--non-interactive",
      "--wait",
    ]);
  });

  it("treats store visibility as success when EAS exits ambiguously", () => {
    const outcome = buildProductionSubmitOutcome({
      platform: "ios",
      submitStatus: 1,
      visibilityReport: {
        ok: true,
        summaries: [
          "iOS: 1.0.0 (12) is VALID in App Store Connect.",
          "Android: version code 3 is completed on Play internal track.",
        ],
        issues: [],
        nextSteps: [],
      },
    });

    expect(outcome).toEqual({
      ok: true,
      message:
        "EAS submit exited nonzero, but store visibility passed for the production builds.",
      summaries: [
        "iOS: 1.0.0 (12) is VALID in App Store Connect.",
        "Android: version code 3 is completed on Play internal track.",
      ],
      issues: [],
      nextSteps: [],
    });
  });

  it("keeps a submit failure failed when store visibility is not proven", () => {
    const outcome = buildProductionSubmitOutcome({
      platform: "android",
      submitStatus: 1,
      visibilityReport: {
        ok: false,
        summaries: [],
        issues: [
          "Android: version code 3 is not visible on Play internal track.",
        ],
        nextSteps: [
          "Check Google Play internal testing, then rerun npm --prefix mobile run release:store-visibility:check.",
        ],
      },
    });

    expect(outcome).toEqual({
      ok: false,
      message: "EAS submit failed and store visibility is not proven.",
      summaries: [],
      issues: [
        "Android: version code 3 is not visible on Play internal track.",
      ],
      nextSteps: [
        "Check Google Play internal testing, then rerun npm --prefix mobile run release:store-visibility:check.",
      ],
    });
  });

  it("parses the explicit platform flag", () => {
    expect(parseSubmitPlatform(["--platform", "ios"])).toBe("ios");
    expect(parseSubmitPlatform(["--platform=android"])).toBe("android");
    expect(() => parseSubmitPlatform([])).toThrow(
      "Pass --platform ios or --platform android.",
    );
  });
});
