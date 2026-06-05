import { describe, expect, it } from "vitest";

import { buildStoreInstallHandoff } from "./store-install-handoff.mjs";

describe("store install handoff", () => {
  it("prints the exact real-device install proof steps for the submitted builds", () => {
    const handoff = buildStoreInstallHandoff({
      artifactReport: {
        ok: true,
        artifacts: [
          {
            platform: "iOS",
            appBuildVersion: "12",
          },
          {
            platform: "Android",
            appBuildVersion: "3",
          },
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
          "Attach a real Android tester device with Play Store access and USB debugging enabled, then rerun npm --prefix mobile run release:store-install-devices:check.",
        ],
      },
      iosScreenshotPath: "/tmp/popsdrops-ios.png",
      androidScreenshotPath: "/tmp/popsdrops-android.png",
    });

    expect(handoff).toContain("Mobile store install smoke handoff");
    expect(handoff).toContain("iOS build: 12");
    expect(handoff).toContain("Android version code: 3");
    expect(handoff).toContain("Device readiness: blocked");
    expect(handoff).toContain("iOS: Max Tsogt's iPhone is unavailable to Xcode.");
    expect(handoff).toContain(
      "Android: No attached ADB device is available for Play internal install smoke.",
    );
    expect(handoff).toContain(
      "Screenshots must be real-device portrait PNGs, not simulator, browser, or store-console screenshots.",
    );
    expect(handoff).toContain("iOS minimum: 1170x2532. Android minimum: 1080x1920.");
    expect(handoff).toContain("Open a signed-in creator screen, such as Campaign Room or Home.");
    expect(handoff).toContain(
      "npm --prefix mobile run release:store-install-evidence:create -- --ios /tmp/popsdrops-ios.png --android /tmp/popsdrops-android.png --ios-build 12 --android-build 3 --ios-tester \"redacted Apple tester\" --android-tester \"redacted Google tester\"",
    );
    expect(handoff).toContain(
      "npm --prefix mobile run release:store-install-evidence:check",
    );
    expect(handoff).toContain(
      "npm --prefix mobile run release:post-submit:check",
    );
  });

  it("surfaces build-artifact blockers before giving screenshot commands", () => {
    const handoff = buildStoreInstallHandoff({
      artifactReport: {
        ok: false,
        issues: ["iOS: No finished production store build artifact found."],
        nextSteps: ["Run production iOS and Android builds."],
        artifacts: [],
      },
      deviceReport: {
        ok: true,
        summaries: ["iOS: Max iPhone is available to Xcode."],
        issues: [],
        nextSteps: [],
      },
    });

    expect(handoff).toContain("Build artifacts: blocked");
    expect(handoff).toContain("iOS: No finished production store build artifact found.");
    expect(handoff).not.toContain("release:store-install-evidence:create");
  });
});
