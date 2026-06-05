import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  MOBILE_STORE_SCREENSHOT_TIMEOUT_MS,
  MOBILE_STORE_SCREENSHOT_MANIFEST_PATH,
  buildMobileStoreScreenshotCaptureUrl,
  buildMobileStoreScreenshotTargets,
  validateMobileStoreScreenshotManifest,
} from "./smoke-mobile-store-screenshots.mjs";

describe("mobile store screenshot smoke contract", () => {
  it("loads the checked-in screenshot manifest and routes through Expo Go", () => {
    const targets = buildMobileStoreScreenshotTargets({
      expoUrl: "exp://10.0.2.2:8084",
    });

    expect(MOBILE_STORE_SCREENSHOT_MANIFEST_PATH).toBe(
      "mobile/store-screenshot-manifest.json",
    );
    expect(targets.outputDirectory).toBe("output/android/store-screenshots");
    expect(targets.screens.map((screen) => screen.id)).toEqual([
      "01-login",
      "02-home",
      "03-invites",
      "04-campaign-detail",
      "05-profile",
    ]);
    expect(targets.screens[0].captureUrl).toBe("exp://10.0.2.2:8084/--/login");
  });

  it("allows cold Expo Go launches enough time to render store screenshots", () => {
    expect(MOBILE_STORE_SCREENSHOT_TIMEOUT_MS).toBeGreaterThanOrEqual(180000);
  });

  it("suppresses Expo Go debug overlays before the first store screenshot", () => {
    const source = readFileSync(
      new URL("./smoke-mobile-store-screenshots.mjs", import.meta.url),
      "utf8",
    );
    const captureScreenSource = source.slice(
      source.indexOf("async function captureScreen"),
      source.indexOf("await waitForUi", source.indexOf("async function captureScreen")),
    );
    const captureScreenPostWaitSource = source.slice(
      source.indexOf("await waitForUi", source.indexOf("async function captureScreen")),
      source.indexOf(
        "await captureAndroidScreenshot",
        source.indexOf("async function captureScreen"),
      ),
    );

    expect(captureScreenSource).toContain(
      "await dismissExpoDevMenuIfPresent(adbSerial)",
    );
    expect(captureScreenSource).toContain('screen.id === "01-login"');
    expect(captureScreenSource).toContain(
      "buildExpoDevMenuFallbackContinueTapCommand()",
    );
    expect(captureScreenSource).toContain(
      "buildExpoDevMenuFallbackCloseTapCommand()",
    );
    expect(captureScreenSource).toMatch(
      /buildExpoDevMenuFallbackContinueTapCommand\(\)\)[\s\S]+setTimeout\(resolve, 1000\)[\s\S]+buildExpoDevMenuFallbackCloseTapCommand\(\)/,
    );
    expect(captureScreenPostWaitSource).toMatch(
      /screen\.id === "01-login"[\s\S]+buildExpoDevMenuFallbackCloseTapCommand\(\)/,
    );
    expect(source).toMatch(
      /setMobileSmokeOverlayPermission\(targets\.adbSerial, "ignore"\)[\s\S]+const \[loginScreen/,
    );
  });

  it("builds a concrete campaign detail URL from the seeded campaign", () => {
    const captureUrl = buildMobileStoreScreenshotCaptureUrl(
      "exp://10.0.2.2:8084",
      {
        id: "04-campaign-detail",
        route: "/campaign/[id]",
        title: "Campaign detail",
        file: "04-campaign-detail.png",
        auth: "creator",
        routeFile: "app/campaign/[id].tsx",
        requiredText: ["Campaign", "Apply to Campaign"],
        seed: "recruitingCampaign",
      },
      {
        recruitingCampaignId: "f0000000-0000-4000-8000-000000000504",
        recruitingCampaignTitle: "Seoul Glow Retail Launch",
        recruitingBrandName: "Dev Brand Co.",
        recruitingDeadline: "2026-06-01T00:00:00.000Z",
      },
    );

    expect(captureUrl).toContain(
      "exp://10.0.2.2:8084/--/campaign/f0000000-0000-4000-8000-000000000504?",
    );
    expect(captureUrl).toContain("title=Seoul+Glow+Retail+Launch");
    expect(captureUrl).toContain("brandName=Dev+Brand+Co.");
    expect(captureUrl).toContain("platforms=instagram%2Ctiktok");
    expect(captureUrl).toContain("matchScore=95");
  });

  it("validates route files and required visual proof labels", () => {
    const manifest = JSON.parse(
      readFileSync(
        new URL("../mobile/store-screenshot-manifest.json", import.meta.url),
        "utf8",
      ),
    );
    const profileScreen = manifest.screens.find(
      (screen) => screen.id === "05-profile",
    );

    expect(validateMobileStoreScreenshotManifest(manifest)).toEqual([]);
    expect(profileScreen.requiredText).toEqual([
      "Dev Creator",
      "Profile Completeness",
    ]);
    expect(
      validateMobileStoreScreenshotManifest({
        outputDirectory: "output/android/store-screenshots",
        screens: [
          {
            id: "01-login",
            file: "01-login.png",
            route: "/login",
            routeFile: "app/(auth)/missing.tsx",
            requiredText: ["PopsDrops"],
          },
        ],
      }),
    ).toContain("Screen 01-login route file does not exist.");
  });
});
