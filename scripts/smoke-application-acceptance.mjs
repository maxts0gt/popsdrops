#!/usr/bin/env node

import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
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
import {
  buildApplicationFlowSmokeTargets,
  captureScreenshot,
  cleanupApplicationFlowSmokeData,
  clickTextButton,
  createAdminClient,
  ensureSmokeDataDevUser,
  ensureSmokeIdentityEnvDefaults,
  fillApplicationForm,
  getSmokeCampaignTitle,
  getSmokeCreatorDisplayName,
  isExistingDevServerReady,
  loadLocalEnv,
  setupApplicationFlowSmokeData,
} from "./smoke-application-flow.mjs";

export const DEFAULT_APPLICATION_ACCEPTANCE_CAMPAIGN_ID =
  "a0000000-0000-4000-8000-000000000102";

const DEFAULT_BRAND_ACCEPTED_SCREENSHOT_PATH =
  "output/playwright/application-acceptance-brand-smoke.png";
const DEFAULT_CREATOR_GATE_SCREENSHOT_PATH =
  "output/playwright/application-acceptance-creator-gate-smoke.png";
const DEFAULT_CREATOR_ROOM_SCREENSHOT_PATH =
  "output/playwright/application-acceptance-creator-room-smoke.png";
const SMOKE_AGREEMENT_TITLE = "Smoke campaign rules";
const SMOKE_AGREEMENT_RULES = {
  disclosure: {
    title: "Clear sponsorship disclosure",
    body: "Use clear sponsored disclosure on every TikTok post.",
  },
  claims: {
    title: "Approved claims only",
    body: "Do not add unapproved skin-care efficacy claims.",
  },
  reporting: {
    title: "Proof required",
    body: "Submit screenshot proof and confirm metrics before the report uses them.",
  },
};

export function buildApplicationAcceptanceSmokeTargets({
  baseUrl,
  campaignId =
    process.env.SMOKE_APPLICATION_ACCEPTANCE_CAMPAIGN_ID ||
    DEFAULT_APPLICATION_ACCEPTANCE_CAMPAIGN_ID,
} = {}) {
  const targets = buildApplicationFlowSmokeTargets({ baseUrl, campaignId });

  return {
    ...targets,
    creatorCampaignUrl: `${targets.baseUrl}/i/campaigns/${campaignId}`,
  };
}

export function buildPublicCampaignApiUrlFromApplyUrl(applyUrl) {
  const url = new URL(applyUrl);
  const [, campaignId] = url.pathname.match(/^\/apply\/([^/]+)$/) ?? [];
  if (!campaignId) {
    throw new Error(`Invalid public apply URL: ${applyUrl}`);
  }

  url.pathname = `/api/public/campaigns/${campaignId}`;
  return url.toString();
}

async function prewarmPublicCampaignApi(applyUrl) {
  const response = await fetch(buildPublicCampaignApiUrlFromApplyUrl(applyUrl));
  if (!response.ok) {
    throw new Error(`Public campaign API prewarm failed: ${response.status}`);
  }
}

export function validateApplicationAcceptanceSmoke({
  brandAcceptedText,
  creatorGateText,
  publicApplyAfterAcceptText,
  signedCreatorRoomText,
  agreementAcceptanceCount,
  consoleErrors,
}) {
  const normalizedBrandText = brandAcceptedText.toLowerCase();
  const normalizedGateText = creatorGateText.toLowerCase();
  const normalizedApplyText = publicApplyAfterAcceptText.toLowerCase();
  const normalizedRoomText = signedCreatorRoomText.toLowerCase();

  const requiredBrandText = [
    ["campaign title", getSmokeCampaignTitle()],
    ["empty applicants", "No applications yet"],
    ["members section", "Members"],
    ["creator name", getSmokeCreatorDisplayName()],
    ["accepted platform", "TikTok"],
    ["accepted rate", "$275"],
  ];
  const requiredPublicApplyText = [
    ["campaign title", getSmokeCampaignTitle()],
    ["room action", "Open campaign room"],
  ];
  const requiredCreatorGateText = [
    ["agreement gate", "Review before you continue"],
    ["unlock summary", "Full brief, private assets, content submission, and performance reporting."],
    ["sign action", "Sign and continue"],
  ];
  const requiredCreatorRoomText = [
    ["creator room title", getSmokeCampaignTitle()],
    ["next action", "Next action"],
    ["brief tab", "Brief"],
    ["tasks tab", "Tasks"],
    ["submit tab", "Submit"],
  ];

  for (const [label, text] of requiredBrandText) {
    if (!normalizedBrandText.includes(text.toLowerCase())) {
      throw new Error(`Missing brand acceptance proof: ${label}`);
    }
  }

  for (const [label, text] of requiredPublicApplyText) {
    if (!normalizedApplyText.includes(text.toLowerCase())) {
      throw new Error(`Missing public apply after accept proof: ${label}`);
    }
  }

  for (const [label, text] of requiredCreatorGateText) {
    if (!normalizedGateText.includes(text.toLowerCase())) {
      throw new Error(`Missing agreement gate proof: ${label}`);
    }
  }

  for (const [label, text] of requiredCreatorRoomText) {
    if (!normalizedRoomText.includes(text.toLowerCase())) {
      throw new Error(`Missing creator room proof: ${label}`);
    }
  }

  if (normalizedRoomText.includes("sign and continue")) {
    throw new Error("Expected signed creator room to hide the agreement gate.");
  }

  if (agreementAcceptanceCount < 1) {
    throw new Error("Expected agreement acceptance record after signing.");
  }

  if (consoleErrors.length > 0) {
    throw new Error(`Console errors found: ${consoleErrors.join(" | ")}`);
  }

  return { ok: true };
}

export async function submitCreatorApplication(client, targets) {
  await loginForSmoke(client, {
    loginUrl: targets.creatorLoginUrl,
    expectedUrlPrefix: `${targets.baseUrl}/i/home`,
    description: "creator dev login redirect",
  });

  await navigate(client, targets.applyUrl);
  await waitForExpression(
    client,
    `document.body.innerText.includes(${JSON.stringify(getSmokeCampaignTitle())}) && document.body.innerText.includes("Apply Now")`,
    "creator public invite application action",
  );
  await evaluate(
    client,
    `(() => {
      const link = [...document.querySelectorAll("a")]
        .find((node) => (node.getAttribute("href") || "").startsWith(${JSON.stringify(`/i/discover/${targets.campaignId}`)}));
      if (!link) throw new Error("Missing creator discover apply link");
      link.click();
      return true;
    })()`,
  );
  await waitForExpression(
    client,
    `location.href.startsWith(${JSON.stringify(targets.discoverUrl)})`,
    "creator discover navigation",
  );
  await waitForExpression(
    client,
    'document.querySelector("#rate") != null && document.querySelector("#pitch") != null',
    "creator application form",
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
    'document.body.innerText.includes("Application Submitted")',
    "creator submitted state",
  );
}

async function acceptCreatorApplication(client, targets) {
  await loginForSmoke(client, {
    loginUrl: targets.brandLoginUrl,
    expectedUrlPrefix: `${targets.baseUrl}/b/campaigns`,
    description: "brand dev login redirect",
  });
  await navigate(client, targets.brandCampaignUrl);
  await waitForExpression(
    client,
    `document.body.innerText.includes(${JSON.stringify(getSmokeCampaignTitle())})`,
    "brand campaign detail",
  );
  await clickTab(client, "Creators");
  await waitForExpression(
    client,
    `document.querySelector("[data-testid=\\"campaign-creators-section-applicants\\"]")?.innerText.includes(${JSON.stringify(getSmokeCreatorDisplayName())})`,
    "brand pending applicant",
  );
  await evaluate(
    client,
    `(() => {
      const section = document.querySelector('[data-testid="campaign-creators-section-applicants"]');
      const button = [...(section?.querySelectorAll("button") ?? [])]
        .find((node) => node.textContent.trim() === "Accept");
      if (!button) throw new Error("Missing applicant accept button");
      button.click();
      return true;
    })()`,
  );
  await waitForExpression(
    client,
    `(() => {
      const applicants = document.querySelector('[data-testid="campaign-creators-section-applicants"]')?.innerText ?? "";
      const members = document.querySelector('[data-testid="campaign-creators-section-members"]')?.innerText ?? "";
      return applicants.includes("No applications yet") &&
        members.includes(${JSON.stringify(getSmokeCreatorDisplayName())}) &&
        members.includes("TikTok") &&
        members.includes("$275");
    })()`,
    "accepted member row",
  );

  return evaluate(client, "document.body.innerText");
}

function normalizeSmokeAgreementRules(rules) {
  return Object.fromEntries(
    Object.entries(rules)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, section]) => [
        key,
        {
          title: section.title.trim(),
          body: section.body.trim().replace(/\s+/g, " "),
        },
      ]),
  );
}

function hashSmokeAgreementContent({
  agreementBody,
  campaignId,
  gateMode,
  rules,
  title,
  version,
}) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        campaignId,
        version,
        gateMode,
        title: title.trim(),
        rules: normalizeSmokeAgreementRules(rules),
        agreementBody: agreementBody.trim(),
        fileSha256: null,
      }),
    )
    .digest("hex");
}

export async function createSmokeCampaignAgreement(admin, targets, brandId) {
  const agreementId = randomUUID();
  const version = 1;
  const gateMode = "rules_and_brand_agreement";
  const agreementBody =
    "Signing confirms the creator read the campaign rules before private materials unlock.";
  const contentHash = hashSmokeAgreementContent({
    agreementBody,
    campaignId: targets.campaignId,
    gateMode,
    rules: SMOKE_AGREEMENT_RULES,
    title: SMOKE_AGREEMENT_TITLE,
    version,
  });

  const { error: acceptanceCleanupError } = await admin
    .from("campaign_agreement_acceptances")
    .delete()
    .eq("campaign_id", targets.campaignId);
  if (acceptanceCleanupError) {
    throw new Error(
      `Clean smoke agreement acceptances: ${acceptanceCleanupError.message}`,
    );
  }

  const { error: agreementCleanupError } = await admin
    .from("campaign_agreements")
    .delete()
    .eq("campaign_id", targets.campaignId);
  if (agreementCleanupError) {
    throw new Error(`Clean smoke campaign agreements: ${agreementCleanupError.message}`);
  }

  const { error } = await admin.from("campaign_agreements").insert({
    id: agreementId,
    campaign_id: targets.campaignId,
    created_by: brandId,
    version,
    status: "published",
    gate_mode: gateMode,
    title: SMOKE_AGREEMENT_TITLE,
    rules: SMOKE_AGREEMENT_RULES,
    agreement_body: agreementBody,
    preview_enabled: true,
    preview_summary: {
      disclosure: "Clear sponsorship disclosure required.",
      reporting: "Screenshot proof and confirmed metrics required.",
      assets: "Private materials unlock after acceptance and signature.",
    },
    content_hash: contentHash,
    requires_typed_name: true,
    published_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (error) throw new Error(`Create smoke campaign agreement: ${error.message}`);
  return agreementId;
}

async function countSmokeAgreementAcceptances(admin, campaignId) {
  const { count, error } = await admin
    .from("campaign_agreement_acceptances")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", campaignId);

  if (error) throw new Error(`Count agreement acceptances: ${error.message}`);
  return count ?? 0;
}

async function signCreatorAgreementGate(client) {
  await evaluate(
    client,
    `(() => {
      const checkbox = document.querySelector('[data-testid="creator-agreement-gate"] input[type="checkbox"]');
      const typedName = document.querySelector("#agreement-typed-name");
      if (!checkbox || !typedName) throw new Error("Missing creator agreement signature controls");

      checkbox.click();
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set;
      setter.call(typedName, ${JSON.stringify(getSmokeCreatorDisplayName())});
      typedName.dispatchEvent(new Event("input", { bubbles: true }));
      typedName.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    })()`,
  );
  await waitForExpression(
    client,
    `[...document.querySelectorAll("button")].some((button) => button.textContent.includes("Sign and continue") && !button.disabled)`,
    "enabled creator agreement sign action",
  );
  await clickTextButton(client, "Sign and continue");
}

export async function openAcceptedCreatorRoom(
  client,
  targets,
  { creatorGateScreenshotPath } = {},
) {
  await loginForSmoke(client, {
    loginUrl: targets.creatorLoginUrl,
    expectedUrlPrefix: `${targets.baseUrl}/i/home`,
    description: "creator dev login redirect after accept",
  });
  await prewarmPublicCampaignApi(targets.applyUrl);
  await navigate(client, targets.applyUrl);
  await waitForExpression(
    client,
    `document.body.innerText.includes(${JSON.stringify(getSmokeCampaignTitle())}) && document.body.innerText.includes("Open campaign room")`,
    "public invite room action after accept",
  );
  const publicApplyAfterAcceptText = await evaluate(client, "document.body.innerText");
  await evaluate(
    client,
    `(() => {
      const link = document.querySelector('[data-testid="public-apply-open-room"]');
      if (!link) throw new Error("Missing open campaign room link");
      link.click();
      return true;
    })()`,
  );
  await waitForExpression(
    client,
    `location.href.startsWith(${JSON.stringify(targets.creatorCampaignUrl)})`,
    "creator campaign room navigation after accept",
  );
  await waitForExpression(
    client,
    `document.querySelector('[data-testid="creator-agreement-gate"]')?.innerText.includes("Review before you continue") &&
      document.body.innerText.includes("Sign and continue")`,
    "creator agreement gate after accept",
  );
  const creatorGateText = await evaluate(client, "document.body.innerText");
  if (creatorGateScreenshotPath) {
    await captureScreenshot(client, creatorGateScreenshotPath);
  }

  await signCreatorAgreementGate(client);
  await waitForExpression(
    client,
    `document.querySelector('[data-testid="creator-room-flow-tabs"]')?.innerText.includes("Submit") &&
      !document.body.innerText.includes("Sign and continue")`,
    "creator campaign room after agreement signature",
  );

  return {
    creatorGateText,
    publicApplyAfterAcceptText,
    signedCreatorRoomText: await evaluate(client, "document.body.innerText"),
  };
}

async function runApplicationAcceptanceSmoke() {
  await loadLocalEnv();
  ensureSmokeIdentityEnvDefaults();

  const targets = buildApplicationAcceptanceSmokeTargets();
  const brandScreenshotPath = path.resolve(
    process.env.SMOKE_ACCEPTANCE_BRAND_SCREENSHOT_PATH ||
      DEFAULT_BRAND_ACCEPTED_SCREENSHOT_PATH,
  );
  const creatorGateScreenshotPath = path.resolve(
    process.env.SMOKE_ACCEPTANCE_CREATOR_GATE_SCREENSHOT_PATH ||
      DEFAULT_CREATOR_GATE_SCREENSHOT_PATH,
  );
  const creatorRoomScreenshotPath = path.resolve(
    process.env.SMOKE_ACCEPTANCE_CREATOR_ROOM_SCREENSHOT_PATH ||
      DEFAULT_CREATOR_ROOM_SCREENSHOT_PATH,
  );
  const devServer = (await isExistingDevServerReady(targets.baseUrl))
    ? null
    : await ensureDevServer(targets.baseUrl);
  const admin = createAdminClient();
  const debugPort = await findFreePort();
  const userDataDir = await mkdtemp(
    path.join(tmpdir(), "popsdrops-application-acceptance-smoke-"),
  );
  let chrome;
  let client;
  const consoleErrors = [];
  const smokeEvidence = {
    brandAcceptedText: "",
    creatorGateText: "",
    publicApplyAfterAcceptText: "",
    signedCreatorRoomText: "",
    agreementAcceptanceCount: 0,
  };

  try {
    const { brandId } = await setupApplicationFlowSmokeData(admin, targets);
    await createSmokeCampaignAgreement(admin, targets, brandId);

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

    await submitCreatorApplication(client, targets);
    await ensureSmokeDataDevUser(admin, "creator");
    smokeEvidence.brandAcceptedText = await acceptCreatorApplication(
      client,
      targets,
    );
    await captureScreenshot(client, brandScreenshotPath);

    const creatorRoomEvidence = await openAcceptedCreatorRoom(client, targets, {
      creatorGateScreenshotPath,
    });
    smokeEvidence.creatorGateText = creatorRoomEvidence.creatorGateText;
    smokeEvidence.publicApplyAfterAcceptText =
      creatorRoomEvidence.publicApplyAfterAcceptText;
    smokeEvidence.signedCreatorRoomText =
      creatorRoomEvidence.signedCreatorRoomText;
    smokeEvidence.agreementAcceptanceCount = await countSmokeAgreementAcceptances(
      admin,
      targets.campaignId,
    );
    await captureScreenshot(client, creatorRoomScreenshotPath);

    validateApplicationAcceptanceSmoke({
      ...smokeEvidence,
      consoleErrors,
    });

    return {
      ok: true,
      baseUrl: targets.baseUrl,
      applyUrl: targets.applyUrl,
      brandCampaignUrl: targets.brandCampaignUrl,
      creatorCampaignUrl: targets.creatorCampaignUrl,
      brandScreenshotPath,
      creatorGateScreenshotPath,
      creatorRoomScreenshotPath,
      agreementAcceptanceCount: smokeEvidence.agreementAcceptanceCount,
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
  }
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] === currentFile) {
  runApplicationAcceptanceSmoke()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
