#!/usr/bin/env node

import { execFile as execFileCallback } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import {
  createAdminClient,
  loadLocalEnv,
} from "./smoke-application-flow.mjs";
import {
  buildMobileStoreScreenshotCaptureUrl,
  cleanupStoreScreenshotData,
  setupStoreScreenshotData,
} from "./smoke-mobile-store-screenshots.mjs";
import {
  createAnonClient,
  createCreatorMobileCallbackUrl,
  ensureExpoServer,
} from "./smoke-mobile-creator-performance.mjs";

const execFile = promisify(execFileCallback);

export const IOS_STORE_SCREENSHOT_MANIFEST_PATH =
  "mobile/store-screenshot-manifest.ios.json";
export const MOBILE_STORE_SCREENSHOT_IOS_TIMEOUT_MS = 180000;
export const IOS_EXPO_GO_BUNDLE_ID = "host.exp.Exponent";
export const IOS_LOGIN_SCREEN_SETTLE_MS = 30000;

const DEFAULT_IOS_EXPO_URL = "exp://127.0.0.1:8085";
const RECRUITING_CAMPAIGN_ID = "f0000000-0000-4000-8000-000000000504";
const RECRUITING_CAMPAIGN_TITLE = "Seoul Glow Retail Launch";
const RECRUITING_BRAND_NAME = "Dev Brand Co.";
const ACTIVE_CAMPAIGN_ID = "f0000000-0000-4000-8000-000000000503";
const SCREEN_SETTLE_MS = 8000;
const AUTH_SETTLE_MS = 12000;
const SPRINGBOARD_BUNDLE_ID = "com.apple.springboard";

function readIosManifest() {
  return JSON.parse(readFileSync(IOS_STORE_SCREENSHOT_MANIFEST_PATH, "utf8"));
}

function dateDaysFromNow(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildSeed() {
  return {
    activeCampaignId: ACTIVE_CAMPAIGN_ID,
    recruitingCampaignId: RECRUITING_CAMPAIGN_ID,
    recruitingCampaignTitle: RECRUITING_CAMPAIGN_TITLE,
    recruitingBrandName: RECRUITING_BRAND_NAME,
    recruitingDeadline: dateDaysFromNow(8),
  };
}

export function validateIosStoreScreenshotManifest(
  manifest,
  { mobileRoot = path.resolve("mobile") } = {},
) {
  const issues = [];
  const expectedIds = [
    "01-login",
    "02-home",
    "03-invites",
    "04-campaign-detail",
    "05-profile",
  ];

  if (manifest?.outputDirectory !== "output/ios/store-screenshots") {
    issues.push("Screenshot output directory must be output/ios/store-screenshots.");
  }

  if (!Array.isArray(manifest?.screens) || manifest.screens.length !== 5) {
    issues.push("Screenshot manifest must include exactly five screens.");
  }

  const actualIds = manifest.screens.map((screen) => screen.id);
  if (actualIds.join(",") !== expectedIds.join(",")) {
    issues.push("Screenshot manifest screen order must match the store story.");
  }

  for (const screen of manifest.screens) {
    if (!screen.id) {
      issues.push("A screenshot screen is missing id.");
      continue;
    }

    if (!/^\d{2}-[a-z-]+\.png$/.test(screen.file ?? "")) {
      issues.push(`Screen ${screen.id} file must be a numbered png.`);
    }

    if (!String(screen.route ?? "").startsWith("/")) {
      issues.push(`Screen ${screen.id} route must start with /.`);
    }

    if (!existsSync(path.join(mobileRoot, screen.routeFile ?? ""))) {
      issues.push(`Screen ${screen.id} route file does not exist.`);
    }

    if (!Array.isArray(screen.requiredText) || screen.requiredText.length < 2) {
      issues.push(`Screen ${screen.id} needs at least two proof labels.`);
    }
  }

  return issues;
}

export function buildIosSimulatorOpenUrlArgs(simulatorId, url) {
  return ["simctl", "openurl", simulatorId, url];
}

export function buildIosStoreScreenshotTargets({
  expoUrl = process.env.SMOKE_MOBILE_IOS_EXPO_URL || DEFAULT_IOS_EXPO_URL,
  simulatorId =
    process.env.IOS_SIMULATOR_ID ||
    process.env.SIMULATOR_UDID ||
    process.env.UDID,
  manifest = readIosManifest(),
} = {}) {
  const normalizedExpoUrl = expoUrl.replace(/\/+$/, "");
  const manifestIssues = validateIosStoreScreenshotManifest(manifest);

  if (manifestIssues.length > 0) {
    throw new Error(
      `iOS mobile store screenshot manifest is invalid:\n${manifestIssues.join("\n")}`,
    );
  }

  const seed = buildSeed();

  return {
    expoUrl: normalizedExpoUrl,
    simulatorId,
    authCallbackUrl: `${normalizedExpoUrl}/--/auth/callback`,
    outputDirectory: manifest.outputDirectory,
    seed,
    screens: manifest.screens.map((screen) => ({
      ...screen,
      captureUrl: buildMobileStoreScreenshotCaptureUrl(
        normalizedExpoUrl,
        screen,
        seed,
      ),
      outputPath: path.join(manifest.outputDirectory, screen.file),
    })),
  };
}

async function runXcrun(args, options = {}) {
  try {
    const result = await execFile("xcrun", args, {
      timeout: options.timeoutMs ?? 30000,
      maxBuffer: 1024 * 1024 * 4,
      encoding: "utf8",
    });

    return result.stdout;
  } catch (error) {
    const detail = [error.stdout, error.stderr, error.message]
      .filter(Boolean)
      .join("\n");
    throw new Error(`xcrun ${args.join(" ")} failed:\n${detail}`);
  }
}

async function runOptionalXcrun(args, options) {
  try {
    return await runXcrun(args, options);
  } catch {
    return "";
  }
}

async function resolveBootedIosSimulatorId(simulatorId) {
  if (simulatorId) return simulatorId;

  const rawDevices = await runXcrun(["simctl", "list", "devices", "available", "--json"]);
  const parsed = JSON.parse(rawDevices);
  const booted = Object.entries(parsed.devices ?? {}).flatMap(
    ([runtime, devices]) =>
      runtime.includes("iOS")
        ? devices.filter((device) => device.state === "Booted")
        : [],
  );

  if (booted.length === 0) {
    throw new Error(
      "No booted iOS simulator is available. Boot an iPhone simulator or set IOS_SIMULATOR_ID.",
    );
  }

  return booted[0].udid;
}

async function ensureIosExpoGoInstalled(simulatorId) {
  await runXcrun(
    ["simctl", "get_app_container", simulatorId, IOS_EXPO_GO_BUNDLE_ID, "app"],
    { timeoutMs: 15000 },
  );
}

async function openIosUrl(simulatorId, url) {
  await runXcrun(buildIosSimulatorOpenUrlArgs(simulatorId, url), {
    timeoutMs: 60000,
  });
}

async function resetIosSimulatorForeground(simulatorId) {
  await runOptionalXcrun(["simctl", "terminate", simulatorId, "com.getbabyapp.mobile"], {
    timeoutMs: 15000,
  });
  await runOptionalXcrun(["simctl", "launch", simulatorId, SPRINGBOARD_BUNDLE_ID], {
    timeoutMs: 15000,
  });
  await wait(1000);
}

async function setIosStatusBarForScreenshots(simulatorId) {
  await runOptionalXcrun([
    "simctl",
    "status_bar",
    simulatorId,
    "override",
    "--time",
    "9:41",
    "--dataNetwork",
    "wifi",
    "--wifiMode",
    "active",
    "--wifiBars",
    "3",
    "--cellularMode",
    "notSupported",
    "--batteryState",
    "charged",
    "--batteryLevel",
    "100",
  ]);
}

async function resetIosSimulatorAuthState(simulatorId) {
  await runXcrun(["simctl", "keychain", simulatorId, "reset"], {
    timeoutMs: 30000,
  });
}

async function captureIosScreenshot(simulatorId, outputPath) {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await runXcrun(["simctl", "io", simulatorId, "screenshot", outputPath], {
    timeoutMs: 60000,
  });
}

async function captureScreen(simulatorId, screen) {
  console.log(`Capturing ${screen.id}: ${screen.title}`);
  await resetIosSimulatorForeground(simulatorId);
  await openIosUrl(simulatorId, screen.captureUrl);
  await wait(screen.id === "01-login" ? IOS_LOGIN_SCREEN_SETTLE_MS : SCREEN_SETTLE_MS);
  await captureIosScreenshot(simulatorId, screen.outputPath);
}

async function runIosMobileStoreScreenshotSmoke() {
  console.log("Preparing iOS mobile store screenshot smoke.");
  await loadLocalEnv();
  process.env.EXPO_PUBLIC_SUPABASE_URL ||=
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||=
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  const targets = buildIosStoreScreenshotTargets();
  const simulatorId = await resolveBootedIosSimulatorId(targets.simulatorId);
  const resolvedTargets = { ...targets, simulatorId };
  const admin = createAdminClient();
  const anon = createAnonClient();

  console.log("Ensuring Expo server is ready for iOS.");
  const expoServer = await ensureExpoServer(resolvedTargets, { platform: "ios" });

  try {
    console.log("Seeding creator screenshot data.");
    await setupStoreScreenshotData(admin, resolvedTargets.seed);
    console.log(`Checking iOS simulator ${simulatorId}.`);
    await ensureIosExpoGoInstalled(simulatorId);
    await setIosStatusBarForScreenshots(simulatorId);
    await resetIosSimulatorAuthState(simulatorId);
    await runOptionalXcrun(
      ["simctl", "terminate", simulatorId, IOS_EXPO_GO_BUNDLE_ID],
      { timeoutMs: 15000 },
    );

    const [loginScreen, ...creatorScreens] = resolvedTargets.screens;
    await captureScreen(simulatorId, loginScreen);

    console.log("Signing in screenshot creator.");
    const callbackUrl = await createCreatorMobileCallbackUrl(
      admin,
      anon,
      resolvedTargets.authCallbackUrl,
    );
    await openIosUrl(simulatorId, callbackUrl);
    await wait(AUTH_SETTLE_MS);

    for (const screen of creatorScreens) {
      await captureScreen(simulatorId, screen);
    }

    return {
      ok: true,
      screenshotPaths: resolvedTargets.screens.map((screen) =>
        path.resolve(screen.outputPath),
      ),
    };
  } catch (error) {
    await captureIosScreenshot(
      simulatorId,
      path.join(resolvedTargets.outputDirectory, "failure.png"),
    ).catch(() => undefined);
    throw error;
  } finally {
    await cleanupStoreScreenshotData(admin, resolvedTargets.seed);
    await runOptionalXcrun(["simctl", "status_bar", simulatorId, "clear"]);
    await expoServer.stop();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runIosMobileStoreScreenshotSmoke()
    .then((result) => {
      console.log("iOS mobile store screenshots captured:");
      for (const screenshotPath of result.screenshotPaths) {
        console.log(`- ${screenshotPath}`);
      }
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
