#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  cleanupApplicationFlowSmokeData,
  createAdminClient,
  ensureSmokeDataDevUser,
  loadLocalEnv,
} from "./smoke-application-flow.mjs";
import {
  captureAndroidScreenshot,
  clearExpoGoDataForSmoke,
  createAnonClient,
  createCreatorMobileCallbackUrl,
  buildExpoDevMenuFallbackCloseTapCommand,
  buildExpoDevMenuFallbackContinueTapCommand,
  dismissExpoDevMenuIfPresent,
  ensureAndroidDevice,
  ensureAndroidNetwork,
  ensureExpoServer,
  forceStopMobileSmokeApps,
  launchDeepLink,
  runAdbShell,
  setMobileSmokeOverlayPermission,
  shouldClearExpoGoForSmoke,
  uninstallConflictingMobileSmokeApps,
  waitForUi,
} from "./smoke-mobile-creator-performance.mjs";

export const MOBILE_STORE_SCREENSHOT_MANIFEST_PATH =
  "mobile/store-screenshot-manifest.json";
export const MOBILE_STORE_SCREENSHOT_TIMEOUT_MS = 180000;

const DEFAULT_EXPO_URL = "exp://10.0.2.2:8084";
const DEFAULT_ADB_SERIAL = "emulator-5554";
const ACTIVE_CAMPAIGN_ID = "f0000000-0000-4000-8000-000000000503";
const RECRUITING_CAMPAIGN_ID = "f0000000-0000-4000-8000-000000000504";
const RECRUITING_CAMPAIGN_TITLE = "Seoul Glow Retail Launch";
const RECRUITING_BRAND_NAME = "Dev Brand Co.";

function readManifest() {
  return JSON.parse(readFileSync(MOBILE_STORE_SCREENSHOT_MANIFEST_PATH, "utf8"));
}

function dateDaysFromNow(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

async function checkedQuery(label, query) {
  const { data, error } = await query;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

export function validateMobileStoreScreenshotManifest(
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

  if (manifest?.outputDirectory !== "output/android/store-screenshots") {
    issues.push("Screenshot output directory must be output/android/store-screenshots.");
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

export function buildMobileStoreScreenshotCaptureUrl(
  expoUrl,
  screen,
  seed = {},
) {
  const normalizedExpoUrl = expoUrl.replace(/\/+$/, "");

  if (screen.route === "/campaign/[id]") {
    const campaignId = seed.recruitingCampaignId ?? RECRUITING_CAMPAIGN_ID;
    const params = new URLSearchParams({
      title: seed.recruitingCampaignTitle ?? RECRUITING_CAMPAIGN_TITLE,
      brandName: seed.recruitingBrandName ?? RECRUITING_BRAND_NAME,
      platforms: "instagram,tiktok",
      budgetMin: "600",
      budgetMax: "900",
      budgetCurrency: "USD",
      applicationDeadline: seed.recruitingDeadline ?? dateDaysFromNow(8),
      matchScore: "95",
      niches: "beauty,lifestyle",
      markets: "us,kr",
    });

    return `${normalizedExpoUrl}/--/campaign/${campaignId}?${params.toString()}`;
  }

  return `${normalizedExpoUrl}/--${screen.route}`;
}

export function buildMobileStoreScreenshotTargets({
  adbSerial = process.env.ADB_SERIAL || DEFAULT_ADB_SERIAL,
  expoUrl = process.env.SMOKE_MOBILE_EXPO_URL || DEFAULT_EXPO_URL,
  manifest = readManifest(),
} = {}) {
  const normalizedExpoUrl = expoUrl.replace(/\/+$/, "");
  const manifestIssues = validateMobileStoreScreenshotManifest(manifest);

  if (manifestIssues.length > 0) {
    throw new Error(
      `Mobile store screenshot manifest is invalid:\n${manifestIssues.join("\n")}`,
    );
  }

  const seed = {
    activeCampaignId: ACTIVE_CAMPAIGN_ID,
    recruitingCampaignId: RECRUITING_CAMPAIGN_ID,
    recruitingCampaignTitle: RECRUITING_CAMPAIGN_TITLE,
    recruitingBrandName: RECRUITING_BRAND_NAME,
    recruitingDeadline: dateDaysFromNow(8),
  };

  return {
    adbSerial,
    expoUrl: normalizedExpoUrl,
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

export async function setupStoreScreenshotData(admin, seed) {
  await cleanupApplicationFlowSmokeData(admin, seed.activeCampaignId);
  await cleanupApplicationFlowSmokeData(admin, seed.recruitingCampaignId);

  const brandId = await ensureSmokeDataDevUser(admin, "brand");
  const creatorId = await ensureSmokeDataDevUser(admin, "creator");
  const activeDeliverableId = randomUUID();
  const activeMemberId = randomUUID();

  await checkedQuery(
    "Create store screenshot active campaign",
    admin.from("campaigns").insert({
      id: seed.activeCampaignId,
      brand_id: brandId,
      campaign_mode: "private",
      creator_sourcing_required: false,
      service_fee_cents: 14900,
      service_fee_currency: "usd",
      service_fee_status: "paid",
      service_package_snapshot: {
        mode: "private",
        feeCents: 14900,
        currency: "usd",
        creatorSourcingRequired: false,
      },
      title: "Private Beauty Launch",
      brief_description: "Create one polished product story for a private retail launch.",
      brief_requirements: "Use the approved visual direction and submit proof after publishing.",
      platforms: ["instagram"],
      markets: ["us"],
      niches: ["beauty", "lifestyle"],
      budget_min: 600,
      budget_max: 900,
      budget_currency: "USD",
      max_creators: 1,
      status: "in_progress",
      application_deadline: dateDaysFromNow(-2),
      content_due_date: dateDaysFromNow(4),
      performance_due_date: dateDaysFromNow(10),
      posting_window_start: dateDaysFromNow(4),
      posting_window_end: dateDaysFromNow(7),
      monitoring_end_date: dateDaysFromNow(14),
      usage_rights_duration: "organic_social",
      usage_rights_territory: "global",
      usage_rights_paid_ads: false,
      max_revisions: 1,
      total_spend: 0,
    }),
  );

  await checkedQuery(
    "Create store screenshot active deliverable",
    admin.from("campaign_deliverables").insert({
      id: activeDeliverableId,
      campaign_id: seed.activeCampaignId,
      platform: "instagram",
      content_type: "reel",
      quantity: 1,
      notes: "One polished reel for the launch window.",
      deadline: dateDaysFromNow(4),
    }),
  );

  await checkedQuery(
    "Create store screenshot active member",
    admin.from("campaign_members").insert({
      id: activeMemberId,
      campaign_id: seed.activeCampaignId,
      creator_id: creatorId,
      accepted_rate: 600,
      payment_status: "pending",
    }),
  );

  await checkedQuery(
    "Create store screenshot recruiting campaign",
    admin.from("campaigns").insert({
      id: seed.recruitingCampaignId,
      brand_id: brandId,
      campaign_mode: "private",
      creator_sourcing_required: false,
      service_fee_cents: 14900,
      service_fee_currency: "usd",
      service_fee_status: "paid",
      service_package_snapshot: {
        mode: "private",
        feeCents: 14900,
        currency: "usd",
        creatorSourcingRequired: false,
      },
      title: seed.recruitingCampaignTitle,
      brief_description: "Invite-only skincare retail story for creators in aligned markets.",
      brief_requirements: "Show product texture, usage moment, and clear disclosure.",
      platforms: ["instagram", "tiktok"],
      markets: ["us", "kr"],
      niches: ["beauty", "lifestyle"],
      budget_min: 600,
      budget_max: 900,
      budget_currency: "USD",
      max_creators: 4,
      status: "recruiting",
      application_deadline: seed.recruitingDeadline,
      content_due_date: dateDaysFromNow(12),
      performance_due_date: dateDaysFromNow(20),
      posting_window_start: dateDaysFromNow(12),
      posting_window_end: dateDaysFromNow(16),
      monitoring_end_date: dateDaysFromNow(22),
      usage_rights_duration: "organic_social",
      usage_rights_territory: "global",
      usage_rights_paid_ads: false,
      max_revisions: 1,
      total_spend: 0,
    }),
  );

  return { brandId, creatorId, activeDeliverableId, activeMemberId };
}

export async function cleanupStoreScreenshotData(admin, seed) {
  await cleanupApplicationFlowSmokeData(admin, seed.activeCampaignId);
  await cleanupApplicationFlowSmokeData(admin, seed.recruitingCampaignId);
}

function uiContainsAll(ui, requiredText) {
  return requiredText.every((text) =>
    ui.text.toLowerCase().includes(String(text).toLowerCase()),
  );
}

async function captureScreen(adbSerial, screen) {
  console.log(`Capturing ${screen.id}: ${screen.title}`);
  await launchDeepLink(adbSerial, screen.captureUrl);
  await dismissExpoDevMenuIfPresent(adbSerial);
  if (screen.id === "01-login") {
    await runAdbShell(adbSerial, buildExpoDevMenuFallbackContinueTapCommand());
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await runAdbShell(adbSerial, buildExpoDevMenuFallbackCloseTapCommand());
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  await waitForUi(
    adbSerial,
    (ui) => (uiContainsAll(ui, screen.requiredText) ? ui : null),
    `store screenshot ${screen.id}`,
    MOBILE_STORE_SCREENSHOT_TIMEOUT_MS,
  );
  await dismissExpoDevMenuIfPresent(adbSerial);
  if (screen.id === "01-login") {
    await runAdbShell(adbSerial, buildExpoDevMenuFallbackCloseTapCommand());
  }
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await captureAndroidScreenshot(adbSerial, screen.outputPath);
}

async function runMobileStoreScreenshotSmoke() {
  console.log("Preparing mobile store screenshot smoke.");
  await loadLocalEnv();
  process.env.EXPO_PUBLIC_SUPABASE_URL ||=
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||=
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  const targets = buildMobileStoreScreenshotTargets();
  const admin = createAdminClient();
  const anon = createAnonClient();
  console.log("Ensuring Expo server is ready.");
  const expoServer = await ensureExpoServer(targets);

  try {
    console.log("Seeding creator screenshot data.");
    await setupStoreScreenshotData(admin, targets.seed);
    console.log("Checking Android device.");
    await ensureAndroidDevice(targets.adbSerial);
    await ensureAndroidNetwork(targets.adbSerial);
    await uninstallConflictingMobileSmokeApps(targets.adbSerial);
    await forceStopMobileSmokeApps(targets.adbSerial);
    if (shouldClearExpoGoForSmoke()) {
      console.log("Clearing Expo Go state.");
      await clearExpoGoDataForSmoke(targets.adbSerial);
      await setMobileSmokeOverlayPermission(targets.adbSerial, "ignore");
    }

    const [loginScreen, ...creatorScreens] = targets.screens;
    await captureScreen(targets.adbSerial, loginScreen);

    console.log("Signing in screenshot creator.");
    const callbackUrl = await createCreatorMobileCallbackUrl(
      admin,
      anon,
      targets.authCallbackUrl,
    );
    await launchDeepLink(targets.adbSerial, callbackUrl);
    await waitForUi(
      targets.adbSerial,
      (ui) => (ui.text.includes("Good") || ui.text.includes("SDK version") ? ui : null),
      "mobile creator home for store screenshots",
      120000,
    );
    await dismissExpoDevMenuIfPresent(targets.adbSerial);
    await setMobileSmokeOverlayPermission(targets.adbSerial, "ignore");

    for (const screen of creatorScreens) {
      await captureScreen(targets.adbSerial, screen);
    }

    return {
      ok: true,
      screenshotPaths: targets.screens.map((screen) =>
        path.resolve(screen.outputPath),
      ),
    };
  } catch (error) {
    await captureAndroidScreenshot(
      targets.adbSerial,
      path.join(targets.outputDirectory, "failure.png"),
    ).catch(() => undefined);
    throw error;
  } finally {
    await cleanupStoreScreenshotData(admin, targets.seed);
    await expoServer.stop();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMobileStoreScreenshotSmoke()
    .then((result) => {
      console.log("Mobile store screenshots captured:");
      for (const screenshotPath of result.screenshotPaths) {
        console.log(`- ${screenshotPath}`);
      }
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
