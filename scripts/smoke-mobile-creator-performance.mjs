#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { execFile as execFileCallback, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { createClient } from "@supabase/supabase-js";

import {
  cleanupApplicationFlowSmokeData,
  createAdminClient,
  ensureSmokeDataDevUser,
  loadLocalEnv,
} from "./smoke-application-flow.mjs";

const execFile = promisify(execFileCallback);

export const DEFAULT_MOBILE_CREATOR_PERFORMANCE_CAMPAIGN_ID =
  "e0000000-0000-4000-8000-000000000201";

const DEFAULT_EXPO_URL = "exp://10.0.2.2:8082";
const DEFAULT_ADB_SERIAL = "emulator-5554";
const DEFAULT_SCREENSHOT_PATH =
  "output/android/mobile-creator-performance-smoke.png";
const PROOF_URL = "https://example.com/native-proof";
const MOBILE_REPORT_CORRECTION_NOTE =
  "Please upload the full analytics screen from native insights.";
const SMOKE_VIEWS = 4321;
const UI_AUTOMATOR_DUMP_PATH = "/data/local/tmp/popsdrops-window.xml";
const UI_AUTOMATOR_DUMP_COMMAND =
  "uiautomator dump /data/local/tmp/popsdrops-window.xml";
const CACHED_EXPO_GO_APK_PATH = ".expo/android-apk-cache/Expo-Go-54.0.8.apk";
export const EXPO_GO_PACKAGE = "host.exp.exponent";
export const EXPO_DEV_CLIENT_PACKAGE = "com.tengrivertex.popsdrops";
export const MOBILE_SMOKE_APP_PACKAGES = [
  EXPO_GO_PACKAGE,
  EXPO_DEV_CLIENT_PACKAGE,
];
export const MOBILE_SMOKE_CONFLICTING_APP_PACKAGES = [
  "com.getbabyapp.mobile",
];
export const MOBILE_SMOKE_NETWORK_HOST = "apgymcbtimoyywavqfja.supabase.co";
export const ANDROID_NOT_RESPONDING_TEXT = "isn't responding";
export const MOBILE_BOOT_TIMEOUT_MS = 180000;
export const MOBILE_NETWORK_READY_TIMEOUT_MS = 60000;
export const MOBILE_NETWORK_PROBE_INTERVAL_MS = 2000;
export const INPUT_FOCUS_SETTLE_MS = 1000;
export const INPUT_FOCUS_ATTEMPTS = 3;
export const SUBMIT_SCROLL_ATTEMPTS = 10;
export const EXPO_GO_CLEAR_ATTEMPTS = 2;

export function buildMobileCreatorPerformanceSmokeTargets({
  adbSerial = process.env.ADB_SERIAL || DEFAULT_ADB_SERIAL,
  campaignId =
    process.env.SMOKE_MOBILE_CREATOR_PERFORMANCE_CAMPAIGN_ID ||
    DEFAULT_MOBILE_CREATOR_PERFORMANCE_CAMPAIGN_ID,
  expoUrl = process.env.SMOKE_MOBILE_EXPO_URL || DEFAULT_EXPO_URL,
  screenshotPath =
    process.env.SMOKE_MOBILE_CREATOR_PERFORMANCE_SCREENSHOT_PATH ||
    DEFAULT_SCREENSHOT_PATH,
} = {}) {
  const normalizedExpoUrl = expoUrl.replace(/\/+$/, "");

  return {
    adbSerial,
    campaignId,
    expoUrl: normalizedExpoUrl,
    authCallbackUrl: `${normalizedExpoUrl}/--/auth/callback`,
    campaignRoomUrl: `${normalizedExpoUrl}/--/campaign-room/${campaignId}?tab=submit`,
    screenshotPath,
  };
}

export function buildDeviceShellQuotedStartCommand(url) {
  return [
    "am",
    "start",
    "-a",
    "android.intent.action.VIEW",
    "-n",
    "host.exp.exponent/.LauncherActivity",
    "-d",
    quoteForDeviceShell(url),
  ].join(" ");
}

export function shouldClearExpoGoForSmoke(env = process.env) {
  return env.SMOKE_MOBILE_CLEAR_EXPO_GO !== "0";
}

export function shouldDisableAndroidWifiForSmoke(env = process.env) {
  return env.SMOKE_MOBILE_DISABLE_ANDROID_WIFI === "1";
}

export function buildExpoGoForceStopCommand(packageName = EXPO_GO_PACKAGE) {
  return `am force-stop ${packageName}`;
}

export function buildExpoGoOverlayPermissionCommand(
  mode = "allow",
  packageName = EXPO_GO_PACKAGE,
) {
  return `appops set ${packageName} SYSTEM_ALERT_WINDOW ${mode}`;
}

export function buildMobileSmokeForceStopCommands(
  packages = MOBILE_SMOKE_APP_PACKAGES,
) {
  return packages.map((packageName) => buildExpoGoForceStopCommand(packageName));
}

export function buildMobileSmokeOverlayPermissionCommands(
  mode = "allow",
  packages = MOBILE_SMOKE_APP_PACKAGES,
) {
  return packages.map((packageName) =>
    buildExpoGoOverlayPermissionCommand(mode, packageName),
  );
}

export function buildMobileSmokeConflictingAppUninstallCommands(
  packages = MOBILE_SMOKE_CONFLICTING_APP_PACKAGES,
) {
  return packages.flatMap((packageName) => [
    `pm uninstall --user 0 ${packageName}`,
    `pm uninstall ${packageName}`,
  ]);
}

export function buildMobileSmokeNetworkProbeCommands(
  host = MOBILE_SMOKE_NETWORK_HOST,
) {
  return ["ip route", `ping -c 1 ${host}`];
}

export function isAndroidEmulatorSerial(adbSerial) {
  return String(adbSerial).startsWith("emulator-");
}

export function buildAndroidWifiDisableCommand() {
  return "svc wifi disable";
}

export function buildExpoStartArgs(port) {
  return [
    "--prefix",
    "mobile",
    "run",
    "start",
    "--",
      "--port",
      String(port),
      "--go",
  ];
}

export function validateMobileCreatorPerformanceDbState({
  performanceRows,
  metricRows,
  taskRows,
}) {
  if (performanceRows.length !== 1) {
    throw new Error(
      `Expected one performance row, found ${performanceRows.length}.`,
    );
  }

  const performance = performanceRows[0];
  if (performance.views !== SMOKE_VIEWS) {
    throw new Error(`Expected views ${SMOKE_VIEWS}, found ${performance.views}.`);
  }
  if (performance.verification_status !== "submitted") {
    throw new Error(
      `Expected submitted performance proof, found ${performance.verification_status}.`,
    );
  }
  if (!String(performance.screenshot_url ?? "").includes("native-proof")) {
    throw new Error("Expected the proof URL to be saved with the performance row.");
  }

  const normalizedViews = metricRows.find(
    (row) =>
      row.performance_id === performance.id &&
      row.metric_key === "views" &&
      row.metric_value === SMOKE_VIEWS &&
      row.source_type === "creator_manual" &&
      row.confirmed_by_creator === true,
  );
  if (!normalizedViews) {
    throw new Error(
      "Missing creator-confirmed normalized views metric value from mobile submit.",
    );
  }

  const submittedTask = taskRows.find((row) =>
    ["submitted", "submitted_late", "verified"].includes(row.status),
  );
  if (!submittedTask) {
    throw new Error("Expected the report task to be marked submitted.");
  }
  if (submittedTask.review_note) {
    throw new Error("Expected mobile resubmission to clear the stale correction note.");
  }

  return { ok: true };
}

export function validateMobileCreatorPerformanceResidue(residue) {
  for (const [key, value] of Object.entries(residue)) {
    if (value !== 0) {
      throw new Error(`Mobile smoke cleanup left ${key}=${value}.`);
    }
  }

  return { ok: true };
}

function quoteForDeviceShell(value) {
  return `'${String(value).replace(/'/g, "'\\''")}'`;
}

function dateDaysFromNow(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

async function checkedQuery(label, query) {
  const { data, error } = await query;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

export function createAnonClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY for mobile smoke auth.",
    );
  }

  return createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function setupMobileCreatorPerformanceSmokeData(admin, targets) {
  await cleanupApplicationFlowSmokeData(admin, targets.campaignId);

  const brandId = await ensureSmokeDataDevUser(admin, "brand");
  const creatorId = await ensureSmokeDataDevUser(admin, "creator");
  const deliverableId = randomUUID();
  const memberId = randomUUID();
  const submissionId = randomUUID();
  const reportTaskId = randomUUID();

  await checkedQuery(
    "Create mobile performance smoke campaign",
    admin.from("campaigns").insert({
      id: targets.campaignId,
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
        tierKey: "workspace",
        includedCreatorCount: 10,
        includedActiveDays: 45,
        includedReportingDays: 14,
      },
      title: "Mobile Creator Performance Smoke Campaign",
      brief_description:
        "Creator submits one published Instagram post and confirms the final views.",
      brief_requirements:
        "Publish the approved post, then submit performance proof from native insights.",
      brief_dos: "Use approved product visuals\nKeep the caption clear",
      brief_donts: "Do not use unsupported claims\nDo not submit estimated numbers",
      platforms: ["instagram"],
      markets: ["us"],
      niches: ["beauty"],
      budget_min: 300,
      budget_max: 300,
      budget_currency: "USD",
      max_creators: 1,
      status: "monitoring",
      application_deadline: dateDaysFromNow(-4),
      content_due_date: dateDaysFromNow(-2),
      performance_due_date: dateDaysFromNow(3),
      posting_window_start: dateDaysFromNow(-2),
      posting_window_end: dateDaysFromNow(-1),
      monitoring_end_date: dateDaysFromNow(3),
      usage_rights_duration: "organic_social",
      usage_rights_territory: "global",
      usage_rights_paid_ads: false,
      max_revisions: 1,
      compliance_notes: "Disclose sponsorship clearly.",
      total_spend: 0,
    }),
  );

  await checkedQuery(
    "Create mobile performance smoke deliverable",
    admin.from("campaign_deliverables").insert({
      id: deliverableId,
      campaign_id: targets.campaignId,
      platform: "instagram",
      content_type: "reel",
      quantity: 1,
      notes: "One published reel with platform insight proof.",
      deadline: dateDaysFromNow(-2),
    }),
  );

  await checkedQuery(
    "Create mobile performance smoke member",
    admin.from("campaign_members").insert({
      id: memberId,
      campaign_id: targets.campaignId,
      creator_id: creatorId,
      accepted_rate: 300,
      payment_status: "pending",
    }),
  );

  await checkedQuery(
    "Create mobile performance smoke published submission",
    admin.from("content_submissions").insert({
      id: submissionId,
      campaign_member_id: memberId,
      deliverable_id: deliverableId,
      platform: "instagram",
      content_url: "https://example.com/native-draft",
      published_url: "https://instagram.com/p/native-smoke",
      caption: "Published smoke content for mobile proof submission.",
      status: "published",
      version: 1,
      submitted_at: dateDaysFromNow(-2),
      published_at: dateDaysFromNow(-1),
    }),
  );

  await checkedQuery(
    "Create mobile performance smoke report task",
    admin.from("campaign_report_tasks").insert(
      buildMobilePerformanceSmokeReportTaskInsert({
        reportTaskId,
        campaignId: targets.campaignId,
        memberId,
      }),
    ),
  );

  return { brandId, creatorId, deliverableId, memberId, submissionId, reportTaskId };
}

export function buildMobilePerformanceSmokeReportTaskInsert({
  reportTaskId,
  campaignId,
  memberId,
}) {
  return {
    id: reportTaskId,
    campaign_id: campaignId,
    campaign_member_id: memberId,
    task_key: "final",
    period_start: dateDaysFromNow(-1),
    period_end: dateDaysFromNow(3),
    due_at: dateDaysFromNow(3),
    status: "needs_revision",
    submitted_at: dateDaysFromNow(-1),
    review_note: MOBILE_REPORT_CORRECTION_NOTE,
  };
}

export async function createCreatorMobileCallbackUrl(admin, anon, authCallbackUrl) {
  const generated = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: "creator@dev.popsdrops.com",
    options: { redirectTo: authCallbackUrl },
  });

  if (generated.error) {
    throw new Error(`Generate mobile creator magic link: ${generated.error.message}`);
  }

  const tokenHash = generated.data.properties?.hashed_token;
  if (!tokenHash) {
    throw new Error("Generated mobile creator magic link token hash is missing.");
  }

  const verified = await anon.auth.verifyOtp({
    type: "magiclink",
    token_hash: tokenHash,
  });
  if (verified.error) {
    throw new Error(`Verify mobile creator OTP: ${verified.error.message}`);
  }

  const session = verified.data.session;
  if (!session?.access_token || !session.refresh_token) {
    throw new Error("Mobile creator OTP did not return a full session.");
  }

  const params = new URLSearchParams({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });

  return `${authCallbackUrl}?${params.toString()}`;
}

export function buildAdbExecOptions({
  timeoutMs = 30000,
  binary = false,
} = {}) {
  return {
    timeout: timeoutMs,
    maxBuffer: 1024 * 1024 * 4,
    encoding: binary ? "buffer" : "utf8",
  };
}

async function runAdb(args, { timeoutMs = 30000 } = {}) {
  try {
    const result = await execFile("adb", args, buildAdbExecOptions({ timeoutMs }));
    return result.stdout;
  } catch (error) {
    const detail = [error.stdout, error.stderr, error.message]
      .filter(Boolean)
      .join("\n");
    throw new Error(`adb ${args.join(" ")} failed:\n${detail}`);
  }
}

async function runAdbBuffer(args, { timeoutMs = 30000 } = {}) {
  try {
    const result = await execFile(
      "adb",
      args,
      buildAdbExecOptions({ timeoutMs, binary: true }),
    );
    return result.stdout;
  } catch (error) {
    const detail = [error.stdout, error.stderr, error.message]
      .filter(Boolean)
      .map((value) => value.toString())
      .join("\n");
    throw new Error(`adb ${args.join(" ")} failed:\n${detail}`);
  }
}

export async function runAdbShell(adbSerial, command, options) {
  return runAdb(["-s", adbSerial, "shell", command], options);
}

async function runOptionalMobileSmokePackageCommand(
  adbSerial,
  command,
  packageName,
  options,
) {
  try {
    await runAdbShell(adbSerial, command, options);
  } catch (error) {
    const optionalDevClientMissing =
      (packageName === EXPO_DEV_CLIENT_PACKAGE ||
        MOBILE_SMOKE_CONFLICTING_APP_PACKAGES.includes(packageName)) &&
      /Unknown package|Failed|not installed|Can't find service|Security exception/i.test(
        error.message,
      );

    if (!optionalDevClientMissing) {
      throw error;
    }
  }
}

export async function forceStopMobileSmokeApps(adbSerial) {
  for (const packageName of MOBILE_SMOKE_APP_PACKAGES) {
    await runOptionalMobileSmokePackageCommand(
      adbSerial,
      buildExpoGoForceStopCommand(packageName),
      packageName,
      { timeoutMs: 15000 },
    );
  }
}

export async function setMobileSmokeOverlayPermission(
  adbSerial,
  mode = "allow",
) {
  for (const packageName of MOBILE_SMOKE_APP_PACKAGES) {
    await runOptionalMobileSmokePackageCommand(
      adbSerial,
      buildExpoGoOverlayPermissionCommand(mode, packageName),
      packageName,
      { timeoutMs: 15000 },
    );
  }
}

export async function uninstallConflictingMobileSmokeApps(adbSerial) {
  for (const packageName of MOBILE_SMOKE_CONFLICTING_APP_PACKAGES) {
    for (const command of buildMobileSmokeConflictingAppUninstallCommands([
      packageName,
    ])) {
      await runOptionalMobileSmokePackageCommand(
        adbSerial,
        command,
        packageName,
        { timeoutMs: 30000 },
      );
    }
  }
}

async function ensureExpoGoInstalled(adbSerial) {
  try {
    await runAdbShell(adbSerial, "pm path host.exp.exponent", {
      timeoutMs: 10000,
    });
    return;
  } catch {
    const cachedExpoGoApkPath = path.join(
      process.env.HOME ?? "",
      CACHED_EXPO_GO_APK_PATH,
    );
    if (!existsSync(cachedExpoGoApkPath)) {
      throw new Error(
        `Expo Go is not installed and cached APK is missing at ${cachedExpoGoApkPath}.`,
      );
    }

    const installCommandDescription = `adb -s ${adbSerial} install -r ${cachedExpoGoApkPath}`;
    console.warn(
      `Expo Go is not installed on ${adbSerial}; running ${installCommandDescription}`,
    );
    await runAdb(["-s", adbSerial, "install", "-r", cachedExpoGoApkPath], {
      timeoutMs: 120000,
    });
    await runAdbShell(adbSerial, "pm path host.exp.exponent", {
      timeoutMs: 10000,
    });
  }
}

export async function ensureAndroidDevice(adbSerial) {
  const devices = await runAdb(["devices"], { timeoutMs: 10000 });
  const line = devices
    .split(/\r?\n/)
    .find((row) => row.startsWith(`${adbSerial}\tdevice`));

  if (!line) {
    throw new Error(
      `Android emulator ${adbSerial} is not available. Start the emulator or set ADB_SERIAL.`,
    );
  }

  await ensureExpoGoInstalled(adbSerial);
}

export async function ensureAndroidNetwork(
  adbSerial,
  host = MOBILE_SMOKE_NETWORK_HOST,
) {
  const startedAt = Date.now();
  let lastRouteOutput = "";
  let lastErrorMessage = "network probe has not run yet";

  while (Date.now() - startedAt < MOBILE_NETWORK_READY_TIMEOUT_MS) {
    try {
      lastRouteOutput = await runAdbShell(adbSerial, "ip route", {
        timeoutMs: 10000,
      });

      if (lastRouteOutput.trim()) {
        await runAdbShell(adbSerial, `ping -c 1 ${host}`, {
          timeoutMs: 15000,
        });
        return;
      }

      lastErrorMessage = "route table is still empty";
    } catch (error) {
      lastErrorMessage =
        error instanceof Error ? error.message : String(error);
    }

    await new Promise((resolve) =>
      setTimeout(resolve, MOBILE_NETWORK_PROBE_INTERVAL_MS),
    );
  }

  throw new Error(
    [
      `Android emulator ${adbSerial} network did not become ready within ${MOBILE_NETWORK_READY_TIMEOUT_MS}ms before mobile smoke.`,
      "Auth and Supabase screens would fail with a misleading network error.",
      `Last route table: ${lastRouteOutput.trim() || "(empty)"}`,
      `Last network error: ${lastErrorMessage}`,
      "If this repeats, restart the emulator with network enabled, for example: emulator -avd PopsDrops_API_35_Smoke -no-snapshot -dns-server 8.8.8.8,1.1.1.1",
    ].join("\n"),
  );
}

export async function stabilizeAndroidEmulatorNetworkForSmoke(adbSerial) {
  if (!isAndroidEmulatorSerial(adbSerial)) return false;
  if (!shouldDisableAndroidWifiForSmoke()) return false;

  await runAdbShell(adbSerial, buildAndroidWifiDisableCommand(), {
    timeoutMs: 10000,
  }).catch(() => undefined);
  await new Promise((resolve) => setTimeout(resolve, 3000));
  return true;
}

export async function clearExpoGoDataForSmoke(adbSerial) {
  let lastError = null;

  for (let attempt = 1; attempt <= EXPO_GO_CLEAR_ATTEMPTS; attempt += 1) {
    try {
      for (const packageName of MOBILE_SMOKE_APP_PACKAGES) {
        await runOptionalMobileSmokePackageCommand(
          adbSerial,
          `pm clear ${packageName}`,
          packageName,
          { timeoutMs: 15000 },
        );
      }
      return;
    } catch (error) {
      lastError = error;
      await forceStopMobileSmokeApps(adbSerial).catch(() => undefined);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  throw lastError;
}

async function fetchWithTimeout(url, timeoutMs = 2000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function isExpoReady(port) {
  try {
    const response = await fetchWithTimeout(`http://127.0.0.1:${port}/status`);
    const text = await response.text();
    return response.ok && text.includes("packager-status:running");
  } catch {
    return false;
  }
}

function getPortFromExpoUrl(expoUrl) {
  const parsed = new URL(expoUrl);
  return parsed.port ? Number(parsed.port) : 8082;
}

export function buildExpoAndroidBundleWarmupUrl(expoUrl) {
  return buildExpoBundleWarmupUrl(expoUrl, "android");
}

export function buildExpoBundleWarmupUrl(expoUrl, platform = "android") {
  const port = getPortFromExpoUrl(expoUrl);
  const params = new URLSearchParams({
    platform,
    dev: "true",
    hot: "false",
    lazy: "true",
    "transform.engine": "hermes",
    "transform.bytecode": "0",
    "transform.routerRoot": "app",
    unstable_transformProfile: "hermes-stable",
  });

  return `http://127.0.0.1:${port}/index.ts.bundle?${params.toString()}`;
}

async function warmExpoBundle(targets, options = {}) {
  const { platform = "android" } = options;
  const response = await fetchWithTimeout(
    buildExpoBundleWarmupUrl(targets.expoUrl, platform),
    120000,
  );

  if (!response.ok) {
    throw new Error(
      `Expo ${platform} bundle warm-up failed with HTTP ${response.status}.`,
    );
  }

  await response.arrayBuffer();
}

function tailLog(lines, limit = 80) {
  return lines.slice(Math.max(0, lines.length - limit)).join("\n");
}

export function getMetroCachePath(tempDirectory = tmpdir()) {
  return path.join(tempDirectory, "metro-cache");
}

export function getMobileSmokeTempDir(platform = "android") {
  return path.join("output", platform, "tmp");
}

async function prepareMobileSmokeTempDir(tempDirectory) {
  await rm(getMetroCachePath(tempDirectory), { recursive: true, force: true });
  await mkdir(tempDirectory, { recursive: true });
}

export async function ensureExpoServer(targets, options = {}) {
  const {
    platform = "android",
    packagerHostname = platform === "ios" ? "127.0.0.1" : "10.0.2.2",
  } = options;
  const port = getPortFromExpoUrl(targets.expoUrl);
  if (await isExpoReady(port)) {
    await warmExpoBundle(targets, options);
    return { started: false, stop: async () => undefined };
  }

  const tempDirectory = path.resolve(getMobileSmokeTempDir(platform));
  await prepareMobileSmokeTempDir(tempDirectory);

  const logLines = [];
  const child = spawn(
    "npm",
    buildExpoStartArgs(port),
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        EXPO_PUBLIC_SUPABASE_URL:
          process.env.EXPO_PUBLIC_SUPABASE_URL ||
          process.env.NEXT_PUBLIC_SUPABASE_URL ||
          "",
        EXPO_PUBLIC_SUPABASE_ANON_KEY:
          process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
          "",
        REACT_NATIVE_PACKAGER_HOSTNAME: packagerHostname,
        TMPDIR: tempDirectory,
        TMP: tempDirectory,
        TEMP: tempDirectory,
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  child.stdout.on("data", (chunk) => {
    logLines.push(chunk.toString());
  });
  child.stderr.on("data", (chunk) => {
    logLines.push(chunk.toString());
  });

  const startedAt = Date.now();
  while (Date.now() - startedAt < 90000) {
    if (await isExpoReady(port)) {
      await warmExpoBundle(targets, options);
      return {
        started: true,
        stop: () =>
          new Promise((resolve) => {
            child.once("exit", resolve);
            child.kill("SIGTERM");
            setTimeout(resolve, 5000).unref?.();
          }),
      };
    }

    if (child.exitCode != null) {
      throw new Error(
        `Expo server exited before becoming ready:\n${tailLog(logLines)}`,
      );
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  child.kill("SIGTERM");
  throw new Error(`Expo server did not become ready:\n${tailLog(logLines)}`);
}

export async function launchDeepLink(adbSerial, url) {
  await runAdbShell(adbSerial, buildDeviceShellQuotedStartCommand(url), {
    timeoutMs: 60000,
  });
}

function decodeXmlAttribute(value) {
  return value
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

export function parseBounds(bounds) {
  const match = bounds.match(/^\[(\d+),(\d+)]\[(\d+),(\d+)]$/);
  if (!match) return null;

  const [, x1, y1, x2, y2] = match.map(Number);
  if (x2 <= x1 || y2 <= y1) return null;

  return { x1, y1, x2, y2, x: Math.round((x1 + x2) / 2), y: Math.round((y1 + y2) / 2) };
}

function getAttr(nodeText, name) {
  const match = nodeText.match(new RegExp(`${name}="([^"]*)"`));
  return match ? decodeXmlAttribute(match[1]) : "";
}

function parseUiNodes(xml) {
  return Array.from(xml.matchAll(/<node\b[^>]*>/g), (match, index) => {
    const raw = match[0];
    const bounds = parseBounds(getAttr(raw, "bounds"));
    return {
      index,
      className: getAttr(raw, "class"),
      text: getAttr(raw, "text"),
      contentDescription: getAttr(raw, "content-desc"),
      bounds,
      raw,
    };
  }).filter((node) => node.bounds);
}

async function dumpUiFromDeviceFile(adbSerial) {
  await runAdbShell(
    adbSerial,
    UI_AUTOMATOR_DUMP_COMMAND,
    {
      timeoutMs: 30000,
    },
  );
  const xml = await runAdbShell(adbSerial, `cat ${UI_AUTOMATOR_DUMP_PATH}`, {
    timeoutMs: 30000,
  });

  await runAdbShell(adbSerial, `rm -f ${UI_AUTOMATOR_DUMP_PATH}`, {
    timeoutMs: 10000,
  }).catch(() => undefined);

  if (!isUiAutomatorHierarchyDump(xml)) {
    throw new Error("UiAutomator file dump did not return a hierarchy.");
  }

  return xml;
}

export function isUiAutomatorHierarchyDump(xml) {
  return String(xml).includes("<hierarchy");
}

async function dumpUiXml(adbSerial) {
  try {
    const xml = await runAdb(
      ["-s", adbSerial, "exec-out", "uiautomator", "dump", "/dev/tty"],
      {
        timeoutMs: 30000,
      },
    );
    if (!isUiAutomatorHierarchyDump(xml)) {
      console.warn(
        "UiAutomator /dev/tty dump returned no hierarchy; falling back to device-file dump.",
      );
      return dumpUiFromDeviceFile(adbSerial);
    }

    return xml;
  } catch (error) {
    console.warn(
      `UiAutomator /dev/tty dump failed; falling back to device-file dump. ${error.message}`,
    );
    return dumpUiFromDeviceFile(adbSerial);
  }
}

async function dumpUi(adbSerial) {
  const xml = await dumpUiXml(adbSerial);
  const nodes = parseUiNodes(xml);
  return { xml, nodes, text: nodes.map((node) => `${node.text} ${node.contentDescription}`).join(" ") };
}

export async function waitForUi(adbSerial, predicate, description, timeoutMs = 60000) {
  const startedAt = Date.now();
  let lastText = "";
  let lastDumpError = "";

  while (Date.now() - startedAt < timeoutMs) {
    let ui;
    try {
      ui = await dumpUi(adbSerial);
      lastDumpError = "";
    } catch (error) {
      lastDumpError = error.message;
      console.warn(
        `UiAutomator dump failed while waiting for ${description}; retrying. ${error.message}`,
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));
      continue;
    }

    lastText = ui.text.replace(/\s+/g, " ").slice(0, 1000);
    if (await dismissBlockingAndroidUiIfPresent(adbSerial, ui)) {
      continue;
    }

    const result = predicate(ui);
    if (result) return result;

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  const lastObservation = lastText
    ? `Last UI: ${lastText}`
    : `Last dump error: ${lastDumpError}`;

  throw new Error(`Timed out waiting for ${description}. ${lastObservation}`);
}

async function dismissAndroidNotRespondingDialogIfPresent(adbSerial, ui) {
  if (!ui.text.includes(ANDROID_NOT_RESPONDING_TEXT)) {
    return false;
  }

  const waitNode =
    findNodeByText(ui.nodes, "Wait") ?? findNodeContainingText(ui.nodes, "Wait");
  if (!waitNode) {
    return false;
  }

  await tapNode(adbSerial, waitNode);
  await new Promise((resolve) => setTimeout(resolve, 1000));
  return true;
}

async function dismissBlockingAndroidUiIfPresent(adbSerial, ui) {
  if (await dismissAndroidNotRespondingDialogIfPresent(adbSerial, ui)) {
    return true;
  }

  if (await dismissExpoDevMenuIfPresent(adbSerial, ui)) {
    return true;
  }

  return false;
}

function findNodeByText(nodes, text) {
  return nodes.find(
    (node) => node.text === text || node.contentDescription === text,
  );
}

function findNodeContainingText(nodes, text) {
  return nodes.find(
    (node) =>
      node.text.includes(text) || node.contentDescription.includes(text),
  );
}

function hasHorizontalOverlap(first, second) {
  return (
    Math.min(first.bounds.x2, second.bounds.x2) >
    Math.max(first.bounds.x1, second.bounds.x1)
  );
}

export function findInputBelowLabel(nodes, label) {
  const labelNode = findNodeByText(nodes, label) ?? findNodeContainingText(nodes, label);
  if (!labelNode) return null;

  return nodes
    .filter(
      (node) =>
        node.className.includes("EditText") &&
        node.bounds.y1 >= labelNode.bounds.y2 &&
        hasHorizontalOverlap(node, labelNode),
    )
    .toSorted((first, second) => {
      const firstDistance =
        Math.abs(first.bounds.y1 - labelNode.bounds.y2) +
        Math.abs(first.bounds.x - labelNode.bounds.x);
      const secondDistance =
        Math.abs(second.bounds.y1 - labelNode.bounds.y2) +
        Math.abs(second.bounds.x - labelNode.bounds.x);
      return firstDistance - secondDistance;
    })[0] ?? null;
}

async function tapNode(adbSerial, node) {
  await runAdbShell(adbSerial, `input tap ${node.bounds.x} ${node.bounds.y}`);
}

export function buildExpoDevMenuFallbackContinueTapCommand() {
  return "input tap 540 2210";
}

export function buildExpoDevMenuFallbackCloseTapCommand() {
  return "input tap 1015 800";
}

export async function dismissExpoDevMenuIfPresent(adbSerial, ui = null) {
  let currentUi;
  try {
    currentUi = ui ?? (await dumpUi(adbSerial));
  } catch (error) {
    console.warn(
      `Could not inspect Expo developer menu; tapping the known Expo Go continue area before screenshot. ${error.message}`,
    );
    await runAdbShell(adbSerial, buildExpoDevMenuFallbackContinueTapCommand());
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return true;
  }

  const hasExpoDevMenu = findNodeContainingText(currentUi.nodes, "SDK version");
  const continueNode =
    findNodeByText(currentUi.nodes, "Continue") ??
    findNodeContainingText(currentUi.nodes, "Continue");

  if (!hasExpoDevMenu) return false;

  if (!continueNode) {
    await runAdbShell(adbSerial, buildExpoDevMenuFallbackCloseTapCommand());
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return true;
  }

  await tapNode(adbSerial, continueNode);
  await new Promise((resolve) => setTimeout(resolve, 1000));
  return true;
}

async function scrollUntilText(adbSerial, text, maxScrolls = 5) {
  let lastText = "";
  for (let attempt = 0; attempt <= maxScrolls; attempt += 1) {
    const ui = await dumpUi(adbSerial);
    lastText = ui.text.replace(/\s+/g, " ").slice(0, 1000);
    if (await dismissBlockingAndroidUiIfPresent(adbSerial, ui)) {
      continue;
    }

    const node = findNodeContainingText(ui.nodes, text);
    if (node) return { ui, node };

    await runAdbShell(adbSerial, "input swipe 540 2100 540 850 500");
    await new Promise((resolve) => setTimeout(resolve, 700));
  }

  throw new Error(`Could not find "${text}" after scrolling. Last UI: ${lastText}`);
}

export function escapeAdbInputText(value) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/\s/g, "%s");
}

export function buildAndroidDigitKeyEvents(value) {
  const text = String(value);
  if (!/^\d+$/.test(text)) {
    throw new Error("Android metric key events require digits only.");
  }
  return [...text].map((digit) => `KEYCODE_${digit}`);
}

async function clearFocusedText(adbSerial) {
  await runAdbShell(adbSerial, "input keyevent KEYCODE_MOVE_END");
  for (let index = 0; index < 40; index += 1) {
    await runAdbShell(adbSerial, "input keyevent KEYCODE_DEL");
  }
}

async function focusAndClearNode(adbSerial, node) {
  for (let attempt = 1; attempt <= INPUT_FOCUS_ATTEMPTS; attempt += 1) {
    await tapNode(adbSerial, node);
    await new Promise((resolve) => setTimeout(resolve, INPUT_FOCUS_SETTLE_MS));

    const ui = await dumpUi(adbSerial);
    if (await dismissBlockingAndroidUiIfPresent(adbSerial, ui)) {
      continue;
    }

    const focusedInput = ui.nodes.find(
      (candidate) =>
        candidate.className.includes("EditText") &&
        candidate.raw.includes('focused="true"'),
    );
    if (focusedInput) break;

    if (attempt === INPUT_FOCUS_ATTEMPTS) {
      throw new Error("Mobile input did not receive focus after tapping.");
    }
  }

  await clearFocusedText(adbSerial);
}

async function waitForTypedValue(adbSerial, value) {
  await waitForUi(
    adbSerial,
    ({ nodes }) =>
      nodes.some(
        (candidate) =>
          candidate.className.includes("EditText") && candidate.text === value,
      ),
    `typed value ${value}`,
    10000,
  );
}

export function buildMissingTypedValueSuffix({ actual, expected }) {
  if (actual === expected) return "";
  if (!expected.startsWith(actual)) return null;
  return expected.slice(actual.length);
}

async function readFocusedEditTextValue(adbSerial) {
  const ui = await dumpUi(adbSerial);
  const focusedInput = ui.nodes.find(
    (candidate) =>
      candidate.className.includes("EditText") &&
      candidate.raw.includes('focused="true"'),
  );

  return focusedInput?.text ?? "";
}

async function typeIntoNode(adbSerial, node, value) {
  await focusAndClearNode(adbSerial, node);
  await runAdbShell(adbSerial, `input text ${quoteForDeviceShell(escapeAdbInputText(value))}`);
  await new Promise((resolve) => setTimeout(resolve, 500));

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = await readFocusedEditTextValue(adbSerial);
    const missingSuffix = buildMissingTypedValueSuffix({
      actual,
      expected: value,
    });

    if (missingSuffix === "") return;
    if (!missingSuffix) break;

    await runAdbShell(
      adbSerial,
      `input text ${quoteForDeviceShell(escapeAdbInputText(missingSuffix))}`,
    );
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  await waitForTypedValue(adbSerial, value);
}

async function typeDigitsIntoNode(adbSerial, node, value) {
  await focusAndClearNode(adbSerial, node);
  const keyEvents = buildAndroidDigitKeyEvents(value);
  await runAdbShell(adbSerial, `input keyevent ${keyEvents.join(" ")}`);
  await waitForTypedValue(adbSerial, value);
}

async function fillPerformanceProof(adbSerial) {
  await scrollUntilText(adbSerial, "Proof correction requested");
  await scrollUntilText(adbSerial, MOBILE_REPORT_CORRECTION_NOTE);
  await scrollUntilText(adbSerial, "Performance proof");
  const viewsUi = await scrollUntilText(adbSerial, "Views", 5);
  const viewsInput = findInputBelowLabel(viewsUi.ui.nodes, "Views");
  if (!viewsInput) {
    throw new Error("Missing mobile views input.");
  }
  await typeDigitsIntoNode(adbSerial, viewsInput, String(SMOKE_VIEWS));

  await runAdbShell(adbSerial, "input keyevent 4");
  await new Promise((resolve) => setTimeout(resolve, 500));

  const proofUi = await scrollUntilText(
    adbSerial,
    "Proof link",
    6,
  );
  const proofInput =
    findInputBelowLabel(proofUi.ui.nodes, "Proof link") ??
    findNodeByText(proofUi.ui.nodes, "Optional analytics or export link");
  if (!proofInput) {
    throw new Error("Missing mobile proof URL input.");
  }
  await typeIntoNode(adbSerial, proofInput, PROOF_URL);

  await runAdbShell(adbSerial, "input keyevent 4");
  await new Promise((resolve) => setTimeout(resolve, 1000));

  const submitTarget = await scrollUntilText(
    adbSerial,
    "Submit performance",
    SUBMIT_SCROLL_ATTEMPTS,
  );
  await tapNode(adbSerial, submitTarget.node);
}

export async function captureAndroidScreenshot(adbSerial, screenshotPath) {
  await mkdir(path.dirname(screenshotPath), { recursive: true });
  const screenshot = await runAdbBuffer(
    ["-s", adbSerial, "exec-out", "screencap", "-p"],
    {
      timeoutMs: 30000,
    },
  );
  await writeFile(screenshotPath, screenshot);
}

async function hideExpoGoDebugOverlaysForScreenshot(adbSerial) {
  await setMobileSmokeOverlayPermission(adbSerial, "ignore");
  await new Promise((resolve) => setTimeout(resolve, 1000));
}

async function collectPerformanceDbState(admin, ids) {
  const performanceRows = await checkedQuery(
    "Find mobile smoke performance rows",
    admin
      .from("content_performance")
      .select("id, views, verification_status, screenshot_url, report_task_id")
      .eq("submission_id", ids.submissionId),
  );
  const metricRows =
    performanceRows.length > 0
      ? await checkedQuery(
          "Find mobile smoke normalized metrics",
          admin
            .from("content_performance_metric_values")
            .select(
              "performance_id, report_task_id, metric_key, metric_value, source_type, confirmed_by_creator",
            )
            .in(
              "performance_id",
              performanceRows.map((row) => row.id),
            ),
        )
      : [];
  const taskRows = await checkedQuery(
    "Find mobile smoke report tasks",
    admin
      .from("campaign_report_tasks")
      .select("id, status, review_note")
      .eq("campaign_id", ids.campaignId),
  );

  return { performanceRows, metricRows, taskRows };
}

export async function waitForPerformanceDbState(admin, ids) {
  const startedAt = Date.now();
  let latest = null;

  while (Date.now() - startedAt < 45000) {
    latest = await collectPerformanceDbState(admin, ids);
    try {
      validateMobileCreatorPerformanceDbState(latest);
      return latest;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  validateMobileCreatorPerformanceDbState(
    latest ?? { performanceRows: [], metricRows: [], taskRows: [] },
  );
}

async function countRows(admin, label, query) {
  const { count, error } = await query;
  if (error) throw new Error(`${label}: ${error.message}`);
  return count ?? 0;
}

async function collectResidue(admin, ids) {
  const [campaignCount, memberCount, submissionCount, reportTaskCount] =
    await Promise.all([
      countRows(
        admin,
        "Count mobile smoke campaigns",
        admin
          .from("campaigns")
          .select("id", { count: "exact", head: true })
          .eq("id", ids.campaignId),
      ),
      countRows(
        admin,
        "Count mobile smoke members",
        admin
          .from("campaign_members")
          .select("id", { count: "exact", head: true })
          .eq("campaign_id", ids.campaignId),
      ),
      countRows(
        admin,
        "Count mobile smoke submissions",
        admin
          .from("content_submissions")
          .select("id", { count: "exact", head: true })
          .eq("campaign_member_id", ids.memberId),
      ),
      countRows(
        admin,
        "Count mobile smoke report tasks",
        admin
          .from("campaign_report_tasks")
          .select("id", { count: "exact", head: true })
          .eq("campaign_id", ids.campaignId),
      ),
    ]);

  const performanceRows = await checkedQuery(
    "Find mobile smoke performance residue",
    admin
      .from("content_performance")
      .select("id")
      .eq("submission_id", ids.submissionId),
  );
  const performanceIds = performanceRows.map((row) => row.id);
  const metricCount =
    performanceIds.length > 0
      ? await countRows(
          admin,
          "Count mobile smoke metric residue",
          admin
            .from("content_performance_metric_values")
            .select("id", { count: "exact", head: true })
            .in("performance_id", performanceIds),
        )
      : 0;

  return {
    campaignCount,
    memberCount,
    submissionCount,
    reportTaskCount,
    performanceCount: performanceRows.length,
    metricCount,
  };
}

async function runMobileCreatorPerformanceSmoke() {
  const targets = buildMobileCreatorPerformanceSmokeTargets();
  await loadLocalEnv();
  process.env.EXPO_PUBLIC_SUPABASE_URL ||=
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||=
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  const admin = createAdminClient();
  const anon = createAnonClient();
  const ids = await setupMobileCreatorPerformanceSmokeData(admin, targets);
  const expoServer = await ensureExpoServer(targets);

  try {
    await ensureAndroidDevice(targets.adbSerial);
    await stabilizeAndroidEmulatorNetworkForSmoke(targets.adbSerial);
    await ensureAndroidNetwork(targets.adbSerial);
    await uninstallConflictingMobileSmokeApps(targets.adbSerial);
    await forceStopMobileSmokeApps(targets.adbSerial);
    if (shouldClearExpoGoForSmoke()) {
      await clearExpoGoDataForSmoke(targets.adbSerial);
      await setMobileSmokeOverlayPermission(targets.adbSerial);
    }

    const callbackUrl = await createCreatorMobileCallbackUrl(
      admin,
      anon,
      targets.authCallbackUrl,
    );
    await launchDeepLink(targets.adbSerial, callbackUrl);
    await waitForUi(
      targets.adbSerial,
      ({ nodes }) =>
        findNodeContainingText(nodes, "Good") ||
        findNodeContainingText(nodes, "Campaigns") ||
        findNodeContainingText(nodes, "SDK version"),
      "mobile creator authenticated home",
      MOBILE_BOOT_TIMEOUT_MS,
    );
    await dismissExpoDevMenuIfPresent(targets.adbSerial);
    await waitForUi(
      targets.adbSerial,
      ({ nodes }) =>
        findNodeContainingText(nodes, "Good") ||
        findNodeContainingText(nodes, "Campaigns"),
      "mobile creator home after auth",
      60000,
    );

    await launchDeepLink(targets.adbSerial, targets.campaignRoomUrl);
    await waitForUi(
      targets.adbSerial,
      ({ nodes }) =>
        findNodeContainingText(
          nodes,
          "Mobile Creator Performance Smoke Campaign",
        ),
      "mobile creator smoke campaign room",
      90000,
    );
    await fillPerformanceProof(targets.adbSerial);
    await waitForPerformanceDbState(admin, {
      ...ids,
      campaignId: targets.campaignId,
    });
    await waitForUi(
      targets.adbSerial,
      ({ nodes }) =>
        findNodeContainingText(nodes, "Submitted") &&
        (findNodeContainingText(nodes, "4,321") ||
          findNodeContainingText(nodes, "4321")),
      "mobile submitted performance proof",
      60000,
    ).catch(async () => {
      await runAdbShell(targets.adbSerial, "input swipe 540 900 540 1500 350");
      return waitForUi(
        targets.adbSerial,
        ({ nodes }) =>
          findNodeContainingText(nodes, "Submitted") &&
          (findNodeContainingText(nodes, "4,321") ||
            findNodeContainingText(nodes, "4321")),
        "mobile submitted performance proof after scroll",
        30000,
      );
    });
    await hideExpoGoDebugOverlaysForScreenshot(targets.adbSerial);
    await captureAndroidScreenshot(targets.adbSerial, targets.screenshotPath);

    await cleanupApplicationFlowSmokeData(admin, targets.campaignId);
    const residue = await collectResidue(admin, {
      ...ids,
      campaignId: targets.campaignId,
    });
    validateMobileCreatorPerformanceResidue(residue);

    return {
      ok: true,
      campaignId: targets.campaignId,
      screenshotPath: path.resolve(targets.screenshotPath),
      expoServerStarted: expoServer.started,
    };
  } catch (error) {
    await cleanupApplicationFlowSmokeData(admin, targets.campaignId);
    throw error;
  } finally {
    await expoServer.stop();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMobileCreatorPerformanceSmoke()
    .then((result) => {
      console.log(
        `Mobile creator performance smoke passed for ${result.campaignId}. Screenshot: ${result.screenshotPath}`,
      );
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
