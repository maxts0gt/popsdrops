#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

import {
  buildSmokeHealthUrl,
  clickTab,
  createCdpPage,
  ensureDevServer,
  stopDevServer,
  evaluate,
  findFreePort,
  launchChrome,
  loginForSmoke,
  navigate,
  waitForExpression,
} from "./smoke-campaign-detail.mjs";

export const DEFAULT_APPLICATION_FLOW_CAMPAIGN_ID =
  "a0000000-0000-4000-8000-000000000101";

const DEFAULT_BASE_URL = "http://127.0.0.1:4000";
const DEFAULT_CREATOR_SCREENSHOT_PATH =
  "output/playwright/application-flow-creator-submit-smoke.png";
const DEFAULT_CREATOR_DISCOVER_SCREENSHOT_PATH =
  "output/playwright/application-flow-creator-discover-smoke.png";
const DEFAULT_CREATOR_INVALID_INVITE_SCREENSHOT_PATH =
  "output/playwright/application-flow-invalid-invite-smoke.png";
const DEFAULT_BRAND_SCREENSHOT_PATH =
  "output/playwright/application-flow-brand-applicant-smoke.png";
const DEFAULT_PUBLIC_INVITE_SCREENSHOT_PATH =
  "output/playwright/application-flow-public-invite-smoke.png";
export const SMOKE_CAMPAIGN_TITLE = "US Market Entry Proof Campaign";
export const SMOKE_PITCH = "Intentional smoke application pitch";
export const SMOKE_CAMPAIGN_ASSET_TITLE = "Maison Lumiere New York launch still";
export const SMOKE_CREATOR_INVITE_CONTACT = "@mina.park";
let smokeCreativeAssetBytesPromise;

export function getSmokeCampaignTitle() {
  return process.env.SMOKE_CAMPAIGN_TITLE?.trim() || SMOKE_CAMPAIGN_TITLE;
}

export function getSmokeBrandCompanyName() {
  return process.env.SMOKE_BRAND_COMPANY_NAME?.trim() || "Maison Lumiere";
}

export function getSmokeCreatorDisplayName() {
  return process.env.SMOKE_CREATOR_DISPLAY_NAME?.trim() || "Mina Park";
}

export function ensureSmokeIdentityEnvDefaults() {
  process.env.SMOKE_CAMPAIGN_TITLE =
    process.env.SMOKE_CAMPAIGN_TITLE?.trim() || SMOKE_CAMPAIGN_TITLE;
  process.env.SMOKE_BRAND_COMPANY_NAME =
    process.env.SMOKE_BRAND_COMPANY_NAME?.trim() || getSmokeBrandCompanyName();
  process.env.SMOKE_CREATOR_DISPLAY_NAME =
    process.env.SMOKE_CREATOR_DISPLAY_NAME?.trim() || getSmokeCreatorDisplayName();
}

function getSmokeRoleDisplayName(role) {
  if (role === "creator") return getSmokeCreatorDisplayName();
  return DEV_SMOKE_USERS[role]?.displayName;
}

function getSmokeCreativeAssetBytes() {
  smokeCreativeAssetBytesPromise ??= sharp(
    Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900">
      <defs>
        <linearGradient id="smoke-paper" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#f8fafc"/>
          <stop offset="52%" stop-color="#e2e8f0"/>
          <stop offset="100%" stop-color="#cbd5e1"/>
        </linearGradient>
        <linearGradient id="smoke-night" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stop-color="#020617"/>
          <stop offset="100%" stop-color="#1e293b"/>
        </linearGradient>
        <linearGradient id="smoke-glass" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stop-color="#f8fafc" stop-opacity="0.94"/>
          <stop offset="58%" stop-color="#94a3b8" stop-opacity="0.42"/>
          <stop offset="100%" stop-color="#334155" stop-opacity="0.22"/>
        </linearGradient>
        <filter id="soft-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="22" stdDeviation="26" flood-color="#0f172a" flood-opacity="0.18"/>
        </filter>
      </defs>
      <rect width="1200" height="900" fill="url(#smoke-paper)"/>
      <rect x="62" y="62" width="1076" height="776" rx="44" fill="#ffffff" fill-opacity="0.72" stroke="#ffffff" stroke-opacity="0.86" stroke-width="2"/>
      <rect x="692" y="62" width="446" height="776" rx="44" fill="url(#smoke-night)"/>
      <path d="M0 706 C180 628 316 670 472 596 C598 536 694 386 846 366 C1016 344 1118 474 1200 416 L1200 900 L0 900 Z" fill="#0f172a" fill-opacity="0.06"/>
      <g filter="url(#soft-shadow)">
        <ellipse cx="430" cy="660" rx="252" ry="42" fill="#0f172a" fill-opacity="0.18"/>
        <rect x="318" y="240" width="208" height="438" rx="76" fill="url(#smoke-glass)" stroke="#f8fafc" stroke-width="5"/>
        <rect x="368" y="188" width="108" height="86" rx="26" fill="#e2e8f0" stroke="#ffffff" stroke-width="5"/>
        <rect x="352" y="384" width="144" height="122" rx="28" fill="#ffffff" fill-opacity="0.76" stroke="#cbd5e1"/>
        <path d="M388 424 H460" stroke="#0f172a" stroke-width="7" stroke-linecap="round"/>
        <path d="M394 456 H454" stroke="#64748b" stroke-width="5" stroke-linecap="round"/>
      </g>
      <g opacity="0.94">
        <rect x="768" y="164" width="260" height="98" rx="22" fill="#ffffff" fill-opacity="0.08" stroke="#ffffff" stroke-opacity="0.14"/>
        <text x="792" y="204" fill="#e2e8f0" font-family="Inter, Arial, sans-serif" font-size="20" font-weight="700">Launch proof</text>
        <text x="792" y="238" fill="#94a3b8" font-family="Inter, Arial, sans-serif" font-size="16">New York creator read</text>
        <rect x="768" y="304" width="260" height="1" fill="#ffffff" fill-opacity="0.18"/>
        <text x="768" y="362" fill="#f8fafc" font-family="Inter, Arial, sans-serif" font-size="58" font-weight="700">12.0K</text>
        <text x="770" y="404" fill="#94a3b8" font-family="Inter, Arial, sans-serif" font-size="18">verified views</text>
        <rect x="768" y="472" width="214" height="12" rx="6" fill="#ffffff" fill-opacity="0.72"/>
        <rect x="768" y="512" width="176" height="12" rx="6" fill="#ffffff" fill-opacity="0.32"/>
        <rect x="768" y="552" width="238" height="12" rx="6" fill="#ffffff" fill-opacity="0.18"/>
      </g>
      <text x="112" y="142" fill="#475569" font-family="Inter, Arial, sans-serif" font-size="18" font-weight="700" letter-spacing="2">MAISON LUMIERE</text>
      <text x="112" y="194" fill="#0f172a" font-family="Inter, Arial, sans-serif" font-size="46" font-weight="700">Product still</text>
      <text x="112" y="242" fill="#64748b" font-family="Inter, Arial, sans-serif" font-size="24">New York launch, creator proof workspace</text>
    </svg>`),
  )
    .png()
    .toBuffer();

  return smokeCreativeAssetBytesPromise;
}

export function buildApplicationFlowSmokeTargets({
  baseUrl = process.env.SMOKE_BASE_URL || DEFAULT_BASE_URL,
  campaignId =
    process.env.SMOKE_APPLICATION_FLOW_CAMPAIGN_ID ||
    DEFAULT_APPLICATION_FLOW_CAMPAIGN_ID,
} = {}) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

  return {
    baseUrl: normalizedBaseUrl,
    campaignId,
    creatorLoginUrl: `${normalizedBaseUrl}/auth/dev-login?role=creator`,
    brandLoginUrl: `${normalizedBaseUrl}/auth/dev-login?role=brand`,
    applyUrl: `${normalizedBaseUrl}/apply/${campaignId}`,
    discoverUrl: `${normalizedBaseUrl}/i/discover/${campaignId}`,
    brandCampaignUrl: `${normalizedBaseUrl}/b/campaigns/${campaignId}`,
  };
}

function setInviteQueryParam(url, inviteId) {
  const parsedUrl = new URL(url);
  parsedUrl.searchParams.set("invite", inviteId);
  return parsedUrl.toString();
}

export function attachInviteToApplicationFlowSmokeTargets(targets, inviteId) {
  if (targets.applyUrl) {
    targets.applyUrl = setInviteQueryParam(targets.applyUrl, inviteId);
  }
  if (targets.discoverUrl) {
    targets.discoverUrl = setInviteQueryParam(targets.discoverUrl, inviteId);
  }
  targets.inviteId = inviteId;
  return targets;
}

export function validateApplicationFlowSmoke({
  creatorApplyText,
  creatorSubmittedText,
  brandApplicantText,
  consoleErrors,
}) {
  const normalizedApplyText = creatorApplyText.toLowerCase();
  const normalizedSubmittedText = creatorSubmittedText.toLowerCase();
  const normalizedBrandText = brandApplicantText.toLowerCase();

  const requiredApplyText = [
    ["campaign title", getSmokeCampaignTitle()],
    ["private invite context", "Private invite"],
    ["public invite action", "Apply Now"],
  ];
  const requiredSubmittedText = [
    ["submitted state", "Application Submitted"],
  ];
  const requiredBrandApplicantText = [
    ["campaign title", getSmokeCampaignTitle()],
    ["brand applicant tab", "Applicants"],
    ["creator name", getSmokeCreatorDisplayName()],
    ["creator pitch", SMOKE_PITCH],
    ["accept action", "Accept"],
  ];

  for (const [label, text] of requiredApplyText) {
    if (!normalizedApplyText.includes(text.toLowerCase())) {
      throw new Error(`Missing public invite proof: ${label}`);
    }
  }

  for (const [label, text] of requiredSubmittedText) {
    if (!normalizedSubmittedText.includes(text.toLowerCase())) {
      throw new Error(`Missing creator application proof: ${label}`);
    }
  }

  for (const [label, text] of requiredBrandApplicantText) {
    if (!normalizedBrandText.includes(text.toLowerCase())) {
      throw new Error(`Missing brand applicant proof: ${label}`);
    }
  }

  if (consoleErrors.length > 0) {
    throw new Error(`Console errors found: ${consoleErrors.join(" | ")}`);
  }

  return { ok: true };
}

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const separatorIndex = trimmed.indexOf("=");
  if (separatorIndex === -1) return null;

  const key = trimmed.slice(0, separatorIndex).trim();
  let value = trimmed.slice(separatorIndex + 1).trim();
  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return key ? [key, value] : null;
}

export async function loadLocalEnv() {
  try {
    const envText = await readFile(path.resolve(".env.local"), "utf8");
    for (const line of envText.split(/\r?\n/)) {
      const parsed = parseEnvLine(line);
      if (!parsed) continue;
      const [key, value] = parsed;
      process.env[key] ||= value;
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

async function fetchWithTimeout(url, timeoutMs = 3000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export async function isExistingDevServerReady(baseUrl, timeoutMs = 15000) {
  const healthUrl = buildSmokeHealthUrl(baseUrl);
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetchWithTimeout(healthUrl, 5000);
      if (response.status >= 200 && response.status < 400) return true;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  return false;
}

export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for smoke data setup.",
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const DEV_SMOKE_USERS = {
  brand: {
    email: "brand@dev.popsdrops.com",
    displayName: "Maison Lumiere",
  },
  creator: {
    email: "creator@dev.popsdrops.com",
    displayName: "Mina Park",
  },
};

function getDevCreatorSlug(userId) {
  return `dev-creator-${userId.slice(0, 8)}`;
}

async function upsertSmokeRoleProfile(admin, role, userId) {
  if (role === "creator") {
    await checkedQuery(
      "Ensure smoke creator profile",
      admin.from("creator_profiles").upsert(
        {
          profile_id: userId,
          slug: getDevCreatorSlug(userId),
          bio: "Dev test creator for local testing.",
          primary_market: "us",
          platforms: ["tiktok", "instagram"],
          tiktok: SMOKE_CREATOR_INVITE_CONTACT,
          instagram: SMOKE_CREATOR_INVITE_CONTACT,
          niches: ["lifestyle", "tech"],
          markets: ["us", "uk"],
          languages: ["en"],
          content_formats: ["short_video", "reel"],
          rate_card: { tiktok: { short_video: 200 }, instagram: { reel: 150 } },
          rate_currency: "USD",
          tier: "rising",
          profile_completeness: 90,
        },
        { onConflict: "profile_id" },
      ),
    );
    return;
  }

  await checkedQuery(
    "Ensure smoke brand profile",
    admin.from("brand_profiles").upsert(
      {
        profile_id: userId,
        company_name: getSmokeBrandCompanyName(),
        industry: "fashion",
        target_markets: ["us", "uk", "japan", "france"],
        website: "https://devbrand.example.com",
      },
      { onConflict: "profile_id" },
    ),
  );
}

export async function ensureSmokeDataDevUser(admin, role) {
  const devUser = DEV_SMOKE_USERS[role];
  if (!devUser) throw new Error(`Unsupported smoke dev user role: ${role}`);
  const displayName = getSmokeRoleDisplayName(role);

  const existingProfile = await checkedQuery(
    `Find ${role} smoke profile`,
    admin
      .from("profiles")
      .select("id")
      .eq("email", devUser.email)
      .maybeSingle(),
  );

  let userId = existingProfile?.id;

  if (!userId) {
    const { data: createData, error: createError } = await admin.auth.admin.createUser({
      email: devUser.email,
      email_confirm: true,
      user_metadata: { full_name: displayName },
    });

    userId = createData?.user?.id;

    if (!userId && createError) {
      const { data: linkData, error: linkError } =
        await admin.auth.admin.generateLink({
          type: "magiclink",
          email: devUser.email,
        });
      if (linkError || !linkData?.user?.id) {
        throw new Error(
          `Unable to resolve ${role} smoke user: ${createError.message}; ${linkError?.message ?? "no generated user id"}`,
        );
      }
      userId = linkData.user.id;
    }
  }

  await checkedQuery(
    `Ensure ${role} smoke profile`,
    admin.from("profiles").upsert(
      {
        id: userId,
        email: devUser.email,
        full_name: displayName,
        role,
        status: "approved",
        onboarding_completed: true,
      },
      { onConflict: "id" },
    ),
  );
  await upsertSmokeRoleProfile(admin, role, userId);

  return userId;
}

export async function checkedQuery(label, query) {
  const { data, error } = await query;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

async function deleteRowsByJsonCampaign(admin, tableName, campaignId) {
  for (const key of ["campaign_id", "campaignId"]) {
    const { error } = await admin
      .from(tableName)
      .delete()
      .contains("data", { [key]: campaignId });
    if (error && !error.message.includes("does not exist")) {
      throw new Error(`Clean ${tableName}: ${error.message}`);
    }
  }
}

async function deleteByIds(admin, label, tableName, columnName, ids) {
  const uniqueIds = Array.from(new Set(ids.filter(Boolean)));
  if (uniqueIds.length === 0) return;

  await checkedQuery(
    label,
    admin.from(tableName).delete().in(columnName, uniqueIds),
  );
}

export async function cleanupApplicationFlowSmokeData(admin, campaignId) {
  const notificationIds = new Set();

  const reportExportJobs = await checkedQuery(
    "Find smoke report export jobs",
    admin
      .from("report_export_jobs")
      .select("id, storage_path")
      .eq("campaign_id", campaignId),
  );
  const reportExportPaths = (reportExportJobs ?? [])
    .map((job) => job.storage_path)
    .filter(Boolean);
  if (reportExportPaths.length > 0) {
    const { error } = await admin.storage
      .from("report-exports")
      .remove(reportExportPaths);
    if (error) throw new Error(`Clean smoke report exports: ${error.message}`);
  }
  if ((reportExportJobs ?? []).length > 0) {
    await checkedQuery(
      "Clean smoke report export jobs",
      admin
        .from("report_export_jobs")
        .delete()
        .in("id", reportExportJobs.map((job) => job.id)),
    );
  }

  for (const key of ["campaign_id", "campaignId"]) {
    const { data, error } = await admin
      .from("notifications")
      .select("id")
      .contains("data", { [key]: campaignId });
    if (error) throw new Error(`Find smoke notifications: ${error.message}`);
    for (const row of data ?? []) notificationIds.add(row.id);
  }

  await checkedQuery(
    "Clean smoke campaign creator invites",
    admin.from("campaign_creator_invites").delete().eq("campaign_id", campaignId),
  );
  await deleteRowsByJsonCampaign(admin, "notification_queue", campaignId);

  if (notificationIds.size > 0) {
    await checkedQuery(
      "Clean smoke notification queue",
      admin
      .from("notification_queue")
      .delete()
      .in("notification_id", Array.from(notificationIds)),
    );
    await checkedQuery(
      "Clean smoke notifications",
      admin.from("notifications").delete().in("id", Array.from(notificationIds)),
    );
  }

  const smokeMembers = await checkedQuery(
    "Find smoke campaign members",
    admin.from("campaign_members").select("id").eq("campaign_id", campaignId),
  );
  const smokeMemberIds = (smokeMembers ?? []).map((member) => member.id);

  const smokeSubmissions =
    smokeMemberIds.length > 0
      ? await checkedQuery(
          "Find smoke content submissions",
          admin
            .from("content_submissions")
            .select("id")
            .in("campaign_member_id", smokeMemberIds),
        )
      : [];
  const smokeSubmissionIds = (smokeSubmissions ?? []).map(
    (submission) => submission.id,
  );

  const smokeReportTasks = await checkedQuery(
    "Find smoke report tasks",
    admin.from("campaign_report_tasks").select("id").eq("campaign_id", campaignId),
  );
  const smokeReportTaskIds = (smokeReportTasks ?? []).map((task) => task.id);

  const performanceIds = new Set();
  if (smokeSubmissionIds.length > 0) {
    const rows = await checkedQuery(
      "Find smoke content performance by submission",
      admin
        .from("content_performance")
        .select("id")
        .in("submission_id", smokeSubmissionIds),
    );
    for (const row of rows ?? []) performanceIds.add(row.id);
  }
  if (smokeReportTaskIds.length > 0) {
    const rows = await checkedQuery(
      "Find smoke content performance by report task",
      admin
        .from("content_performance")
        .select("id")
        .in("report_task_id", smokeReportTaskIds),
    );
    for (const row of rows ?? []) performanceIds.add(row.id);
  }

  await deleteByIds(
    admin,
    "Clean smoke AI extraction rows",
    "content_performance_ai_extractions",
    "report_task_id",
    smokeReportTaskIds,
  );

  const smokeEvidenceRows = await checkedQuery(
    "Find smoke performance evidence files",
    admin
      .from("content_performance_evidence")
      .select("storage_path")
      .eq("campaign_id", campaignId),
  );
  const smokeEvidencePaths = (smokeEvidenceRows ?? [])
    .map((evidence) => evidence.storage_path)
    .filter(Boolean);
  if (smokeEvidencePaths.length > 0) {
    const { error } = await admin.storage
      .from("campaign-evidence")
      .remove(smokeEvidencePaths);
    if (error) throw new Error(`Clean smoke evidence files: ${error.message}`);
  }
  await checkedQuery(
    "Clean smoke performance evidence",
    admin.from("content_performance_evidence").delete().eq("campaign_id", campaignId),
  );
  await deleteByIds(
    admin,
    "Clean smoke metric values by performance",
    "content_performance_metric_values",
    "performance_id",
    Array.from(performanceIds),
  );
  await deleteByIds(
    admin,
    "Clean smoke metric values by report task",
    "content_performance_metric_values",
    "report_task_id",
    smokeReportTaskIds,
  );
  await deleteByIds(
    admin,
    "Clean smoke content performance",
    "content_performance",
    "id",
    Array.from(performanceIds),
  );
  await deleteByIds(
    admin,
    "Clean smoke report tasks",
    "campaign_report_tasks",
    "id",
    smokeReportTaskIds,
  );
  await deleteByIds(
    admin,
    "Clean smoke content submissions",
    "content_submissions",
    "id",
    smokeSubmissionIds,
  );

  const smokeAssets = await checkedQuery(
    "Find smoke campaign assets",
    admin.from("campaign_assets").select("storage_path").eq("campaign_id", campaignId),
  );
  const smokeAssetPaths = (smokeAssets ?? [])
    .map((asset) => asset.storage_path)
    .filter(Boolean);
  if (smokeAssetPaths.length > 0) {
    const { error } = await admin.storage
      .from("campaign-assets")
      .remove(smokeAssetPaths);
    if (error) throw new Error(`Clean smoke campaign assets: ${error.message}`);
  }

  await checkedQuery(
    "Clean smoke campaign",
    admin.from("campaigns").delete().eq("id", campaignId),
  );
}

function dateDaysFromNow(days) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

export async function setupApplicationFlowSmokeData(admin, targets) {
  ensureSmokeIdentityEnvDefaults();
  await cleanupApplicationFlowSmokeData(admin, targets.campaignId);

  const brandId = await ensureSmokeDataDevUser(admin, "brand");
  const creatorId = await ensureSmokeDataDevUser(admin, "creator");

  await checkedQuery(
    "Create smoke campaign",
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
        requiresCustomPricing: false,
        tierKey: "workspace",
        includedCreatorCount: 10,
        includedActiveDays: 45,
        includedReportingDays: 14,
        estimatedMaxCreators: 3,
        estimatedMarketCount: 1,
        estimatedActiveDays: 4,
        estimatedReportingDays: 1,
        creatorOverageBlocks: 0,
        activeDayOverageBlocks: 0,
        reportingDayOverageBlocks: 0,
        overageFeeCents: 0,
      },
      title: getSmokeCampaignTitle(),
      brief_description:
        "Create one concise short-form post for the smoke invite flow.",
      brief_requirements:
        "Show the product, state the campaign message, and submit proof after publishing.",
      brief_dos: "Keep the message clear\nUse natural light",
      brief_donts: "Do not make medical claims\nDo not use unapproved discounts",
      platforms: ["tiktok"],
      markets: ["us"],
      niches: ["beauty"],
      budget_min: 300,
      budget_max: 300,
      budget_currency: "USD",
      max_creators: 3,
      status: "recruiting",
      application_deadline: dateDaysFromNow(5),
      content_due_date: dateDaysFromNow(8),
      performance_due_date: dateDaysFromNow(11),
      posting_window_start: dateDaysFromNow(7),
      posting_window_end: dateDaysFromNow(10),
      monitoring_end_date: dateDaysFromNow(11),
      usage_rights_duration: "organic_social",
      usage_rights_territory: "global",
      usage_rights_paid_ads: false,
      max_revisions: 2,
      compliance_notes: "Disclose sponsorship clearly.",
      total_spend: 0,
    }),
  );

  await checkedQuery(
    "Create smoke deliverable",
    admin.from("campaign_deliverables").insert({
      campaign_id: targets.campaignId,
      platform: "tiktok",
      content_type: "short_video",
      quantity: 1,
      notes: "One smoke-test short video.",
      deadline: dateDaysFromNow(8),
    }),
  );

  await checkedQuery(
    "Create smoke reporting requirement",
    admin.from("campaign_reporting_requirements").insert({
      campaign_id: targets.campaignId,
      platform: "tiktok",
      content_format: "short_video",
      account_requirement: "public_post_ok",
      evidence_types: ["public_url", "manual_metrics", "screenshot"],
      required_metric_keys: ["views", "likes", "comments"],
      ai_extraction_allowed: true,
      creator_confirmation_required: true,
      sort_order: 1,
    }),
  );

  const assetId = randomUUID();
  const assetFileName = "smoke-product.png";
  const assetStoragePath = `${targets.campaignId}/${assetId}/${assetFileName}`;
  const smokeCreativeAssetBytes = await getSmokeCreativeAssetBytes();
  const { error: assetUploadError } = await admin.storage
    .from("campaign-assets")
    .upload(assetStoragePath, smokeCreativeAssetBytes, {
      contentType: "image/png",
      upsert: true,
    });
  if (assetUploadError) {
    throw new Error(`Create smoke campaign image: ${assetUploadError.message}`);
  }

  await checkedQuery(
    "Create smoke campaign image",
    admin.from("campaign_assets").insert({
      id: assetId,
      campaign_id: targets.campaignId,
      uploaded_by: brandId,
      title: SMOKE_CAMPAIGN_ASSET_TITLE,
      description: "Executive proof-room visual for launch readiness.",
      asset_type: "product_image",
      bucket_id: "campaign-assets",
      storage_path: assetStoragePath,
      file_name: assetFileName,
      mime_type: "image/png",
      size_bytes: smokeCreativeAssetBytes.byteLength,
      visibility: "public",
      status: "ready",
    }),
  );

  const smokeInvite = await checkedQuery(
    "Create smoke creator invite row",
    admin
      .from("campaign_creator_invites")
      .insert({
        campaign_id: targets.campaignId,
        contact_type: "handle",
        contact_value: SMOKE_CREATOR_INVITE_CONTACT,
        normalized_contact: SMOKE_CREATOR_INVITE_CONTACT,
        status: "queued",
        invited_by: brandId,
        invited_at: new Date().toISOString(),
      })
      .select("id")
      .single(),
  );

  attachInviteToApplicationFlowSmokeTargets(targets, smokeInvite.id);

  return { brandId, creatorId, inviteId: smokeInvite.id };
}

export async function captureScreenshot(
  client,
  screenshotPath,
  { captureBeyondViewport = false } = {},
) {
  await mkdir(path.dirname(screenshotPath), { recursive: true });
  const screenshot = await client.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport,
  });
  await writeFile(screenshotPath, Buffer.from(screenshot.data, "base64"));
}

export async function fillApplicationForm(client) {
  await evaluate(
    client,
    `(() => {
      const rate = document.querySelector("#rate");
      const pitch = document.querySelector("#pitch");
      if (!rate || !pitch) throw new Error("Missing application fields");

      const setInputValue = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      ).set;
      const setTextareaValue = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value",
      ).set;

      setInputValue.call(rate, "275");
      rate.dispatchEvent(new Event("input", { bubbles: true }));
      setTextareaValue.call(pitch, ${JSON.stringify(SMOKE_PITCH)});
      pitch.dispatchEvent(new Event("input", { bubbles: true }));
      return true;
    })()`,
  );
}

export async function clickTextButton(client, text) {
  await evaluate(
    client,
    `(() => {
      const button = [...document.querySelectorAll("button")]
        .find((node) => node.textContent.includes(${JSON.stringify(text)}));
      if (!button) throw new Error("Missing button: ${text}");
      button.click();
      return true;
    })()`,
  );
}

export async function waitForCreatorCampaignHeroImage(client, description) {
  await waitForExpression(
    client,
    `(() => {
      const hero = document.querySelector('[data-testid="creator-campaign-hero-asset"]');
      const image = hero?.querySelector('img[alt="${SMOKE_CAMPAIGN_ASSET_TITLE}"]');
      return Boolean(image?.complete && image.naturalWidth > 0);
    })()`,
    description,
  );
}

export async function waitForPublicApplyCampaignHeroImage(client, description) {
  await waitForExpression(
    client,
    `(() => {
      const hero = document.querySelector('[data-testid="public-apply-campaign-image"]');
      const image = hero?.querySelector('img[alt="${SMOKE_CAMPAIGN_ASSET_TITLE}"]');
      const fallback = hero?.querySelector('[data-testid="public-apply-campaign-fallback"]');
      return Boolean(
        (image?.complete && image.naturalWidth > 0) ||
          fallback?.textContent?.trim(),
      );
    })()`,
    description,
  );
}

async function runApplicationFlowSmoke() {
  await loadLocalEnv();

  const previousSmokeIdentityEnv = {
    campaignTitle: process.env.SMOKE_CAMPAIGN_TITLE,
    brandCompanyName: process.env.SMOKE_BRAND_COMPANY_NAME,
    creatorDisplayName: process.env.SMOKE_CREATOR_DISPLAY_NAME,
  };
  ensureSmokeIdentityEnvDefaults();

  const targets = buildApplicationFlowSmokeTargets();
  const creatorScreenshotPath = path.resolve(
    process.env.SMOKE_CREATOR_SCREENSHOT_PATH ||
      DEFAULT_CREATOR_SCREENSHOT_PATH,
  );
  const brandScreenshotPath = path.resolve(
    process.env.SMOKE_BRAND_SCREENSHOT_PATH || DEFAULT_BRAND_SCREENSHOT_PATH,
  );
  const creatorDiscoverScreenshotPath = path.resolve(
    process.env.SMOKE_CREATOR_DISCOVER_SCREENSHOT_PATH ||
      DEFAULT_CREATOR_DISCOVER_SCREENSHOT_PATH,
  );
  const invalidCreatorInviteScreenshotPath = path.resolve(
    process.env.SMOKE_CREATOR_INVALID_INVITE_SCREENSHOT_PATH ||
      DEFAULT_CREATOR_INVALID_INVITE_SCREENSHOT_PATH,
  );
  const publicInviteScreenshotPath = path.resolve(
    process.env.SMOKE_PUBLIC_INVITE_SCREENSHOT_PATH ||
      DEFAULT_PUBLIC_INVITE_SCREENSHOT_PATH,
  );
  const devServer = (await isExistingDevServerReady(targets.baseUrl))
    ? null
    : await ensureDevServer(targets.baseUrl);
  const admin = createAdminClient();
  const debugPort = await findFreePort();
  const userDataDir = await mkdtemp(
    path.join(tmpdir(), "popsdrops-application-flow-smoke-"),
  );
  let chrome;
  let client;
  const consoleErrors = [];
  const smokeEvidence = {
    creatorApplyText: "",
    creatorSubmittedText: "",
    brandApplicantText: "",
  };

  try {
    const { inviteId } = await setupApplicationFlowSmokeData(admin, targets);
    const publicInviteUrl = targets.applyUrl;

    chrome = await launchChrome({ debugPort, userDataDir });
    client = await createCdpPage(debugPort);
    client.on("Runtime.consoleAPICalled", (event) => {
      if (event.type === "error") {
        consoleErrors.push(
          event.args?.map((arg) => arg.value || arg.description || "").join(" ") ||
            "Console error",
        );
      }
    });
    client.on("Runtime.exceptionThrown", (event) => {
      consoleErrors.push(event.exceptionDetails?.text || "Runtime exception");
    });

    await client.send("Page.enable");
    await client.send("Runtime.enable");

    await loginForSmoke(client, {
      loginUrl: targets.creatorLoginUrl,
      expectedUrlPrefix: `${targets.baseUrl}/i/home`,
      description: "creator dev login redirect",
    });
    await ensureSmokeDataDevUser(admin, "creator");

    await navigate(client, publicInviteUrl);
    await waitForExpression(
      client,
      `document.body.innerText.includes(${JSON.stringify(getSmokeCampaignTitle())}) &&
        document.body.innerText.includes("Private invite") &&
        document.body.innerText.includes("Apply Now") &&
        document.querySelector('[data-testid="public-apply-private-invite"]') != null`,
      "creator public invite application action",
    );
    await waitForPublicApplyCampaignHeroImage(
      client,
      "public invite campaign hero image",
    );
    smokeEvidence.creatorApplyText = await evaluate(client, "document.body.innerText");
    const publicApplyLayout = await evaluate(
      client,
      `(() => {
        const button = document.querySelector('[data-testid="public-apply-jump"]');
        const handoff = document.querySelector('[data-testid="public-apply-handoff-sequence"]');
        const grid = handoff?.querySelector(".grid");
        if (!button || !handoff || !grid) {
          throw new Error("Missing public apply helper or handoff layout");
        }
        const buttonRect = button.getBoundingClientRect();
        const handoffRect = handoff.getBoundingClientRect();
        return {
          buttonBottom: buttonRect.bottom,
          buttonWidth: buttonRect.width,
          handoffTop: handoffRect.top,
          handoffWidth: handoffRect.width,
          handoffClientWidth: handoff.clientWidth,
          handoffScrollWidth: handoff.scrollWidth,
          gridClientWidth: grid.clientWidth,
          gridScrollWidth: grid.scrollWidth,
        };
      })()`,
    );
    if (
      publicApplyLayout.handoffScrollWidth >
        publicApplyLayout.handoffClientWidth + 1 ||
      publicApplyLayout.gridScrollWidth > publicApplyLayout.gridClientWidth + 1
    ) {
      throw new Error("Public apply handoff rail overflows.");
    }
    if (publicApplyLayout.buttonBottom >= publicApplyLayout.handoffTop) {
      throw new Error("Public apply helper overlaps the handoff rail.");
    }
    if (publicApplyLayout.buttonWidth > publicApplyLayout.handoffWidth * 0.45) {
      throw new Error("Public apply helper is too visually dominant.");
    }
    await evaluate(
      client,
      `(() => {
        document
          .querySelector('[data-testid="public-apply-private-invite"]')
          ?.scrollIntoView({ block: "center" });
        return true;
      })()`,
    );
    await captureScreenshot(client, publicInviteScreenshotPath, {
      captureBeyondViewport: true,
    });

    await evaluate(
      client,
      `(() => {
        const link = [...document.querySelectorAll("a")]
          .find((node) => node.getAttribute("href") === ${JSON.stringify(`/i/discover/${targets.campaignId}?invite=${inviteId}`)});
        if (!link) throw new Error("Missing creator discover apply link");
        link.click();
        return true;
      })()`,
    );
    await waitForExpression(
      client,
      `location.href.startsWith(${JSON.stringify(targets.discoverUrl)}) && location.search.includes("invite=")`,
      "creator discover navigation",
    );
    await waitForExpression(
      client,
      'document.querySelector("#rate") != null && document.querySelector("#pitch") != null && document.querySelector(\'[data-testid="creator-private-invite-context"]\') != null',
      "creator application form",
    );
    await waitForCreatorCampaignHeroImage(
      client,
      "creator campaign hero image",
    );
    await waitForExpression(
      client,
      'document.querySelector(\'[data-testid="creator-campaign-apply-jump"]\') != null && document.querySelector(\'[data-testid="creator-campaign-handoff-sequence"]\') != null',
      "creator discover helper apply and handoff rail",
    );
    const creatorDiscoverLayout = await evaluate(
      client,
      `(() => {
        const button = document.querySelector('[data-testid="creator-campaign-apply-jump"]');
        const handoff = document.querySelector('[data-testid="creator-campaign-handoff-sequence"]');
        const grid = handoff?.querySelector(".grid");
        if (!button || !handoff || !grid) throw new Error("Missing creator discover handoff layout");
        const buttonRect = button.getBoundingClientRect();
        const handoffRect = handoff.getBoundingClientRect();
        return {
          buttonBottom: buttonRect.bottom,
          buttonWidth: buttonRect.width,
          handoffTop: handoffRect.top,
          handoffWidth: handoffRect.width,
          handoffClientWidth: handoff.clientWidth,
          handoffScrollWidth: handoff.scrollWidth,
          gridClientWidth: grid.clientWidth,
          gridScrollWidth: grid.scrollWidth,
        };
      })()`,
    );
    if (
      creatorDiscoverLayout.handoffScrollWidth >
        creatorDiscoverLayout.handoffClientWidth + 1 ||
      creatorDiscoverLayout.gridScrollWidth >
        creatorDiscoverLayout.gridClientWidth + 1
    ) {
      throw new Error("Creator discover handoff rail overflows.");
    }
    if (creatorDiscoverLayout.buttonBottom >= creatorDiscoverLayout.handoffTop) {
      throw new Error("Creator discover apply helper overlaps the handoff rail.");
    }
    if (
      creatorDiscoverLayout.buttonWidth >
      creatorDiscoverLayout.handoffWidth * 0.45
    ) {
      throw new Error("Creator discover apply helper is too visually dominant.");
    }
    await evaluate(
      client,
      `(() => {
        const handoff = document.querySelector('[data-testid="creator-campaign-handoff-sequence"]');
        if (!handoff) throw new Error("Missing creator campaign handoff screenshot target");
        const top = handoff.getBoundingClientRect().top + window.scrollY - 120;
        window.scrollTo({ top: Math.max(0, top), behavior: "instant" });
        return true;
      })()`,
    );
    await waitForExpression(
      client,
      `(() => {
        const handoff = document.querySelector('[data-testid="creator-campaign-handoff-sequence"]');
        if (!handoff) return false;
        const rect = handoff.getBoundingClientRect();
        return rect.top >= 80 && rect.top <= 160;
      })()`,
      "creator discover handoff screenshot position",
    );
    await captureScreenshot(client, creatorDiscoverScreenshotPath);

    const invalidCreatorInviteUrl = setInviteQueryParam(
      targets.discoverUrl,
      randomUUID(),
    );
    await navigate(client, invalidCreatorInviteUrl);
    await waitForExpression(
      client,
      `document.querySelector('[data-testid="creator-private-invite-unavailable"]') != null &&
        document.querySelector('[data-testid="creator-private-invite-context"]') == null`,
      "invalid creator invite unavailable state",
    );
    await waitForCreatorCampaignHeroImage(
      client,
      "invalid invite hero image",
    );
    const invalidPrivateContextVisible = await evaluate(
      client,
      `document.querySelector('[data-testid="creator-private-invite-context"]') != null`,
    );
    if (invalidPrivateContextVisible) {
      throw new Error("Invalid invite link still shows private context.");
    }
    await captureScreenshot(client, invalidCreatorInviteScreenshotPath, {
      captureBeyondViewport: true,
    });

    await navigate(client, targets.discoverUrl);
    await waitForExpression(
      client,
      'document.querySelector("#rate") != null && document.querySelector("#pitch") != null && document.querySelector(\'[data-testid="creator-private-invite-context"]\') != null',
      "creator application form after invalid invite recovery",
    );

    await fillApplicationForm(client);
    await waitForExpression(
      client,
      '[...document.querySelectorAll("button")].some((button) => button.textContent.includes("Submit Application") && !button.disabled)',
      "enabled submit application button",
    );
    await clickTextButton(client, "Submit Application");
    await waitForExpression(
      client,
      'document.body.innerText.includes("Application Submitted") && document.body.innerText.includes("brand will review")',
      "creator submitted state",
    );
    const trackedInvite = await checkedQuery(
      "Find tracked smoke creator invite row",
      admin
        .from("campaign_creator_invites")
        .select("status")
        .eq("id", inviteId)
        .single(),
    );
    if (trackedInvite.status !== "sent") {
      throw new Error("Expected creator application to mark the source invite sent.");
    }
    const sourceInviteNotifications = await checkedQuery(
      "Find smoke source invite application notification",
      admin
        .from("notifications")
        .select("id, data")
        .contains("data", { source_invite_id: inviteId }),
    );
    if (sourceInviteNotifications.length !== 1) {
      throw new Error("Expected application notification to keep source_invite_id.");
    }
    smokeEvidence.creatorSubmittedText = await evaluate(
      client,
      "document.body.innerText",
    );
    await evaluate(
      client,
      `(() => {
        const submittedNode = [...document.querySelectorAll("h1, h2, h3, p, div")]
          .find((node) => node.textContent?.includes("Application Submitted"));
        submittedNode?.scrollIntoView({ block: "center" });
        return true;
      })()`,
    );
    await captureScreenshot(client, creatorScreenshotPath, {
      captureBeyondViewport: true,
    });

    await loginForSmoke(client, {
      loginUrl: targets.brandLoginUrl,
      expectedUrlPrefix: `${targets.baseUrl}/b/campaigns`,
      description: "brand dev login redirect",
    });
    await ensureSmokeDataDevUser(admin, "brand");
    await navigate(client, targets.brandCampaignUrl);
    await waitForExpression(
      client,
      `document.body.innerText.includes(${JSON.stringify(getSmokeCampaignTitle())})`,
      "brand campaign detail",
    );
    await clickTab(client, "Creators");
    await waitForExpression(
      client,
      `document.body.innerText.includes(${JSON.stringify(getSmokeCreatorDisplayName())}) && document.body.innerText.includes(${JSON.stringify(SMOKE_PITCH)}) && document.body.innerText.includes("Accept")`,
      "brand applicant queue",
    );
    await waitForExpression(
      client,
      `document.querySelector('[data-testid="campaign-invite-row"][data-status="sent"]') != null`,
      "brand applied source invite row",
    );
    const appliedInviteRowState = await evaluate(
      client,
      `(() => {
        const row = document.querySelector('[data-testid="campaign-invite-row"][data-status="sent"]');
        return {
          hasSendControl: Boolean(row?.querySelector('[data-testid="campaign-invite-send"]')),
          text: row?.innerText ?? "",
        };
      })()`,
    );
    if (appliedInviteRowState.hasSendControl) {
      throw new Error("Applied source invite row still exposes send control.");
    }
    if (!appliedInviteRowState.text.includes("Applied")) {
      throw new Error("Expected source invite row to show Applied status.");
    }
    smokeEvidence.brandApplicantText = await evaluate(
      client,
      "document.body.innerText",
    );
    await evaluate(
      client,
      `(() => {
        const applicantNode = [...document.querySelectorAll("h1, h2, h3, p, div, td")]
          .find((node) => node.textContent?.includes(${JSON.stringify(getSmokeCreatorDisplayName())}));
        applicantNode?.scrollIntoView({ block: "center" });
        return true;
      })()`,
    );
    await captureScreenshot(client, brandScreenshotPath, {
      captureBeyondViewport: true,
    });

    validateApplicationFlowSmoke({
      ...smokeEvidence,
      consoleErrors,
    });

    return {
      ok: true,
      baseUrl: targets.baseUrl,
      applyUrl: targets.applyUrl,
      discoverUrl: targets.discoverUrl,
      brandCampaignUrl: targets.brandCampaignUrl,
      publicInviteScreenshotPath,
      creatorDiscoverScreenshotPath,
      invalidCreatorInviteScreenshotPath,
      creatorScreenshotPath,
      brandScreenshotPath,
      keptSmokeData: process.env.SMOKE_KEEP_DATA === "1",
      devServerStarted: Boolean(devServer),
    };
  } finally {
    client?.close();
    chrome?.kill();

    if (process.env.SMOKE_KEEP_DATA !== "1") {
      await cleanupApplicationFlowSmokeData(admin, targets.campaignId);
    }

    await stopDevServer(devServer);
    await rm(userDataDir, {
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 100,
    });

    if (previousSmokeIdentityEnv.campaignTitle === undefined) {
      delete process.env.SMOKE_CAMPAIGN_TITLE;
    } else {
      process.env.SMOKE_CAMPAIGN_TITLE = previousSmokeIdentityEnv.campaignTitle;
    }
    if (previousSmokeIdentityEnv.brandCompanyName === undefined) {
      delete process.env.SMOKE_BRAND_COMPANY_NAME;
    } else {
      process.env.SMOKE_BRAND_COMPANY_NAME =
        previousSmokeIdentityEnv.brandCompanyName;
    }
    if (previousSmokeIdentityEnv.creatorDisplayName === undefined) {
      delete process.env.SMOKE_CREATOR_DISPLAY_NAME;
    } else {
      process.env.SMOKE_CREATOR_DISPLAY_NAME =
        previousSmokeIdentityEnv.creatorDisplayName;
    }
  }
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] === currentFile) {
  runApplicationFlowSmoke()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
