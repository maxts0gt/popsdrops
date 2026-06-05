import { describe, expect, it } from "vitest";

import { buildStorePostSubmitReport } from "./store-post-submit-check.mjs";

describe("store post-submit check", () => {
  it("passes when store visibility and durable install evidence pass, even if devices are no longer attached", () => {
    const report = buildStorePostSubmitReport({
      visibilityReport: {
        ok: true,
        summaries: [
          "iOS: 1.0.0 (12) is VALID in App Store Connect.",
          "Android: version code 3 is completed on Play internal track.",
        ],
        issues: [],
        nextSteps: [],
      },
      evidenceReport: {
        ok: true,
        summaries: [
          "iOS: TestFlight install evidence matches build 12.",
          "Android: Play internal install evidence matches build 3.",
        ],
        issues: [],
        nextSteps: [],
      },
      deviceReport: {
        ok: false,
        summaries: [],
        issues: [
          "iOS: Max Tsogt's iPhone is unavailable to Xcode.",
          "Android: No attached ADB device is available for Play internal install smoke.",
        ],
        nextSteps: [],
      },
    });

    expect(report).toEqual({
      ok: true,
      summaries: [
        "iOS: 1.0.0 (12) is VALID in App Store Connect.",
        "Android: version code 3 is completed on Play internal track.",
        "iOS: TestFlight install evidence matches build 12.",
        "Android: Play internal install evidence matches build 3.",
      ],
      issues: [],
      nextSteps: [],
    });
  });

  it("includes device readiness only when install evidence is missing", () => {
    const report = buildStorePostSubmitReport({
      visibilityReport: {
        ok: true,
        summaries: ["iOS: 1.0.0 (12) is VALID in App Store Connect."],
        issues: [],
        nextSteps: [],
      },
      evidenceReport: {
        ok: false,
        summaries: [],
        issues: [
          "Store install evidence manifest is missing: mobile/store-install-evidence-manifest.local.json.",
        ],
        nextSteps: [
          "Install the iOS build from TestFlight on a real tester device, capture the creator app screen, and add it to mobile/store-install-evidence-manifest.local.json.",
        ],
      },
      deviceReport: {
        ok: false,
        summaries: [],
        issues: [
          "iOS: Max Tsogt's iPhone is unavailable to Xcode.",
          "Android: No attached ADB device is available for Play internal install smoke.",
        ],
        nextSteps: [
          "Unlock the iPhone, trust this Mac if prompted, keep it awake, then rerun npm --prefix mobile run release:store-install-devices:check.",
        ],
      },
    });

    expect(report).toEqual({
      ok: false,
      summaries: ["iOS: 1.0.0 (12) is VALID in App Store Connect."],
      issues: [
        "Store install evidence manifest is missing: mobile/store-install-evidence-manifest.local.json.",
        "iOS: Max Tsogt's iPhone is unavailable to Xcode.",
        "Android: No attached ADB device is available for Play internal install smoke.",
      ],
      nextSteps: [
        "Install the iOS build from TestFlight on a real tester device, capture the creator app screen, and add it to mobile/store-install-evidence-manifest.local.json.",
        "Unlock the iPhone, trust this Mac if prompted, keep it awake, then rerun npm --prefix mobile run release:store-install-devices:check.",
      ],
    });
  });

  it("stops at store visibility failures before checking device capture", () => {
    const report = buildStorePostSubmitReport({
      visibilityReport: {
        ok: false,
        summaries: [],
        issues: ["Android: version code 3 is not visible on Play internal track."],
        nextSteps: [
          "Check Google Play internal testing, then rerun npm --prefix mobile run release:store-visibility:check.",
        ],
      },
      evidenceReport: {
        ok: true,
        summaries: ["Android: Play internal install evidence matches build 3."],
        issues: [],
        nextSteps: [],
      },
      deviceReport: {
        ok: true,
        summaries: ["Android: emulator-5554 is attached through ADB."],
        issues: [],
        nextSteps: [],
      },
    });

    expect(report).toEqual({
      ok: false,
      summaries: [],
      issues: ["Android: version code 3 is not visible on Play internal track."],
      nextSteps: [
        "Check Google Play internal testing, then rerun npm --prefix mobile run release:store-visibility:check.",
      ],
    });
  });
});
