import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  IOS_EXPO_GO_BUNDLE_ID,
  IOS_LOGIN_SCREEN_SETTLE_MS,
  IOS_STORE_SCREENSHOT_MANIFEST_PATH,
  MOBILE_STORE_SCREENSHOT_IOS_TIMEOUT_MS,
  buildIosSimulatorOpenUrlArgs,
  buildIosStoreScreenshotTargets,
  validateIosStoreScreenshotManifest,
} from "./smoke-mobile-store-screenshots-ios.mjs";

describe("iOS mobile store screenshot smoke contract", () => {
  it("keeps iOS store screenshots separate from Android evidence", () => {
    const targets = buildIosStoreScreenshotTargets({
      expoUrl: "exp://127.0.0.1:8085",
      simulatorId: "BOOTED-IOS-SIM",
    });

    expect(IOS_STORE_SCREENSHOT_MANIFEST_PATH).toBe(
      "mobile/store-screenshot-manifest.ios.json",
    );
    expect(targets.outputDirectory).toBe("output/ios/store-screenshots");
    expect(targets.screens.map((screen) => screen.id)).toEqual([
      "01-login",
      "02-home",
      "03-invites",
      "04-campaign-detail",
      "05-profile",
    ]);
    expect(targets.screens[0].captureUrl).toBe(
      "exp://127.0.0.1:8085/--/login",
    );
    expect(targets.simulatorId).toBe("BOOTED-IOS-SIM");
    expect(targets.authCallbackUrl).toBe(
      "exp://127.0.0.1:8085/--/auth/callback",
    );
  });

  it("uses the iOS simulator and Expo Go instead of Android adb", () => {
    expect(IOS_EXPO_GO_BUNDLE_ID).toBe("host.exp.Exponent");
    expect(IOS_LOGIN_SCREEN_SETTLE_MS).toBeGreaterThanOrEqual(25000);
    expect(buildIosSimulatorOpenUrlArgs("SIM-1", "exp://127.0.0.1:8085/--/login")).toEqual([
      "simctl",
      "openurl",
      "SIM-1",
      "exp://127.0.0.1:8085/--/login",
    ]);
    expect(MOBILE_STORE_SCREENSHOT_IOS_TIMEOUT_MS).toBeGreaterThanOrEqual(180000);

    const source = readFileSync(
      new URL("./smoke-mobile-store-screenshots-ios.mjs", import.meta.url),
      "utf8",
    );

    expect(source).toContain("xcrun");
    expect(source).toContain("simctl");
    expect(source).toContain("openurl");
    expect(source).toContain("io");
    expect(source).toContain("screenshot");
    expect(source).toContain("host.exp.Exponent");
    expect(source).toContain("resetIosSimulatorForeground");
    expect(source).toContain("com.apple.springboard");
    expect(source).toContain("status_bar");
    expect(source).toContain("resetIosSimulatorAuthState");
    expect(source).toContain("keychain");
    expect(source).toContain("reset");
    expect(source).not.toContain("adb");
  });

  it("validates the checked-in iOS manifest against real mobile routes", () => {
    const manifestPath = new URL(
      "../mobile/store-screenshot-manifest.ios.json",
      import.meta.url,
    );

    expect(existsSync(manifestPath)).toBe(true);

    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const profileScreen = manifest.screens.find(
      (screen) => screen.id === "05-profile",
    );

    expect(validateIosStoreScreenshotManifest(manifest)).toEqual([]);
    expect(profileScreen.requiredText).toEqual([
      "Dev Creator",
      "Profile Completeness",
    ]);
    expect(
      validateIosStoreScreenshotManifest({
        outputDirectory: "output/ios/store-screenshots",
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

  it("wires iOS store screenshots as an explicit release command", () => {
    const rootPackageJson = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    );
    const mobilePackageJson = JSON.parse(
      readFileSync(new URL("../mobile/package.json", import.meta.url), "utf8"),
    );

    expect(rootPackageJson.scripts["smoke:mobile-store-screenshots:ios"]).toBe(
      "node scripts/smoke-mobile-store-screenshots-ios.mjs",
    );
    expect(mobilePackageJson.scripts["release:screenshots:ios"]).toBe(
      "npm --prefix .. run smoke:mobile-store-screenshots:ios",
    );
  });
});
