#!/usr/bin/env node

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
  checkedQuery,
  cleanupApplicationFlowSmokeData,
  createAdminClient,
  ensureSmokeDataDevUser,
  ensureSmokeIdentityEnvDefaults,
  getSmokeCampaignTitle,
  getSmokeCreatorDisplayName,
  isExistingDevServerReady,
  loadLocalEnv,
  setupApplicationFlowSmokeData,
} from "./smoke-application-flow.mjs";
import { submitCreatorApplication } from "./smoke-application-acceptance.mjs";

export const DEFAULT_CONTENT_REPORT_CAMPAIGN_ID =
  "a0000000-0000-4000-8000-000000000104";

const DRAFT_CONTENT_URL = "https://example.com/popsdrops-smoke-draft";
const LIVE_TIKTOK_URL = "https://www.tiktok.com/@devcreator/video/1234567890";
const DEFAULT_CREATOR_REPORT_SCREENSHOT_PATH =
  "output/playwright/content-report-creator-proof-smoke.png";
const DEFAULT_BRAND_REPORT_SCREENSHOT_PATH =
  "output/playwright/content-report-brand-verified-smoke.png";
const DEFAULT_CREATOR_HANDOFF_SCREENSHOT_PATH =
  "output/playwright/content-report-creator-handoff-smoke.png";
const DEFAULT_BRAND_HANDOFF_SCREENSHOT_PATH =
  "output/playwright/content-report-brand-handoff-smoke.png";
const DEFAULT_CREATOR_LIVE_URL_SCREENSHOT_PATH =
  "output/playwright/content-report-creator-live-url-smoke.png";
const DEFAULT_CREATOR_PROOF_NEEDED_SCREENSHOT_PATH =
  "output/playwright/content-report-creator-proof-needed-smoke.png";
const DEFAULT_BRAND_PROOF_QUEUE_SCREENSHOT_PATH =
  "output/playwright/content-report-brand-proof-queue-smoke.png";
const DEFAULT_BRAND_EVIDENCE_TRAIL_SCREENSHOT_PATH =
  "output/playwright/content-report-brand-evidence-trail-smoke.png";
const REPORT_EVIDENCE_TRAIL_WAIT_MS = 120000;
const REPORT_EVIDENCE_TRAIL_NAVIGATION_ATTEMPTS = 4;

export function buildContentReportWorkflowSmokeTargets({
  baseUrl,
  campaignId =
    process.env.SMOKE_CONTENT_REPORT_CAMPAIGN_ID ||
    DEFAULT_CONTENT_REPORT_CAMPAIGN_ID,
} = {}) {
  const targets = buildApplicationFlowSmokeTargets({ baseUrl, campaignId });

  return {
    ...targets,
    brandReportUrl: `${targets.baseUrl}/b/campaigns/${campaignId}/report`,
    creatorCampaignUrl: `${targets.baseUrl}/i/campaigns/${campaignId}`,
  };
}

export function validateContentReportWorkflowSmoke({
  creatorSubmissionText,
  brandContentText,
  creatorReportText,
  brandReportText,
  consoleErrors,
}) {
  const normalizedCreatorSubmissionText = creatorSubmissionText.toLowerCase();
  const normalizedBrandContentText = brandContentText.toLowerCase();
  const normalizedCreatorReportText = creatorReportText.toLowerCase();
  const normalizedBrandReportText = brandReportText.toLowerCase();

  const requiredCreatorSubmissionText = [
    ["campaign title", getSmokeCampaignTitle()],
    ["submit tab", "Submit"],
    ["platform", "TikTok"],
    ["submission version", "v1"],
    ["submitted state", "Submitted"],
  ];
  const requiredBrandContentText = [
    ["campaign title", getSmokeCampaignTitle()],
    ["content tab", "Content"],
    ["creator name", getSmokeCreatorDisplayName()],
    ["platform", "TikTok"],
    ["submitted state", "Submitted"],
    ["approval action", "Approve"],
  ];
  const requiredCreatorReportText = [
    ["campaign title", getSmokeCampaignTitle()],
    ["post-submit status", "Proof sent for review"],
  ];
  const requiredBrandReportText = [
    ["campaign title", getSmokeCampaignTitle()],
    ["evidence trail", "Evidence Trail"],
    ["creator name", getSmokeCreatorDisplayName()],
    ["platform", "TikTok"],
    ["report impact label", "Report impact"],
    ["verified report proof", "Verified"],
    ["included report impact", "Included in report totals"],
  ];
  const requiredCreatorHandoffText = [
    ["draft stage", "Draft"],
    ["live URL stage", "Live URL"],
    ["proof stage", "Proof"],
  ];
  const requiredBrandHandoffText = [
    ["draft stage", "Draft"],
    ["live URL stage", "Live URL"],
    ["proof stage", "Proof"],
  ];

  for (const [label, text] of requiredCreatorSubmissionText) {
    if (!normalizedCreatorSubmissionText.includes(text.toLowerCase())) {
      throw new Error(`Missing creator submission proof: ${label}`);
    }
  }

  for (const [label, text] of requiredCreatorHandoffText) {
    if (!normalizedCreatorSubmissionText.includes(text.toLowerCase())) {
      throw new Error(`Missing creator handoff sequence: ${label}`);
    }
  }

  for (const [label, text] of requiredBrandContentText) {
    if (!normalizedBrandContentText.includes(text.toLowerCase())) {
      throw new Error(`Missing brand content proof: ${label}`);
    }
  }

  for (const [label, text] of requiredBrandHandoffText) {
    if (!normalizedBrandContentText.includes(text.toLowerCase())) {
      throw new Error(`Missing brand handoff sequence: ${label}`);
    }
  }

  for (const [label, text] of requiredCreatorReportText) {
    if (!normalizedCreatorReportText.includes(text.toLowerCase())) {
      throw new Error(`Missing creator report proof: ${label}`);
    }
  }

  for (const [label, text] of requiredBrandReportText) {
    if (!normalizedBrandReportText.includes(text.toLowerCase())) {
      throw new Error(`Missing brand report proof: ${label}`);
    }
  }

  if (consoleErrors.length > 0) {
    throw new Error(`Console errors found: ${consoleErrors.join(" | ")}`);
  }

  return { ok: true };
}

export async function clickButtonByText(client, text, scopeSelector = "body") {
  await evaluate(
    client,
    `(() => {
      const scope = document.querySelector(${JSON.stringify(scopeSelector)});
      const button = [...(scope?.querySelectorAll("button") ?? [])]
        .find((node) => node.textContent.trim().includes(${JSON.stringify(text)}) && !node.disabled);
      if (!button) throw new Error("Missing enabled button: ${text}");
      button.click();
      return true;
    })()`,
  );
}

export function getSubmitPerformanceProofButtonTexts() {
  return ["Send 7-day report proof", "Resubmit proof"];
}

export async function clickFirstEnabledButtonByText(
  client,
  texts,
  scopeSelector = "body",
) {
  await evaluate(
    client,
    `(() => {
      const scope = document.querySelector(${JSON.stringify(scopeSelector)});
      const texts = ${JSON.stringify(texts)};
      const button = [...(scope?.querySelectorAll("button") ?? [])]
        .find((node) => texts.some((text) => node.textContent.trim().includes(text)) && !node.disabled);
      if (!button) throw new Error("Missing enabled button: " + texts.join(" or "));
      button.click();
      return button.textContent.trim();
    })()`,
  );
}

export async function waitForBrandCampaignTitle(
  client,
  targets,
  description,
) {
  let lastPageState = "not inspected";

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await waitForExpression(
        client,
        `(document.body?.innerText || "").includes(${JSON.stringify(getSmokeCampaignTitle())})`,
        `${description} attempt ${attempt}`,
        30000,
      );
    } catch (error) {
      lastPageState = await evaluate(
        client,
        `(() => {
          const pageText = (document.body?.innerText || "").replace(/\\s+/g, " ").slice(0, 700);
          return location.href + " | " + pageText;
        })()`,
      ).catch(() => error.message);

      const sawDevErrorBoundary =
        lastPageState.includes("This page couldn't load") ||
        lastPageState.includes("This page couldn’t load");
      const sawShellOnly =
        lastPageState.includes("PopsDrops") &&
        lastPageState.includes("Campaigns") &&
        !lastPageState.includes(getSmokeCampaignTitle());
      const canRecover = sawDevErrorBoundary || sawShellOnly;

      if (!canRecover || attempt === 3) {
        throw new Error(
          `Timed out waiting for ${description}: ${lastPageState}`,
        );
      }

      await navigate(client, targets.brandCampaignUrl);
    }
  }

  throw new Error(`Timed out waiting for ${description}: ${lastPageState}`);
}

export function buildSetInputValueExpression(selector, value) {
  return `(() => {
      const input = document.querySelector(${JSON.stringify(selector)});
      if (!input) throw new Error(${JSON.stringify(`Missing input: ${selector}`)});
      const descriptor = Object.getOwnPropertyDescriptor(
        input instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype,
        "value",
      );
      descriptor.set.call(input, ${JSON.stringify(value)});
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    })()`;
}

export async function setInputValue(client, selector, value) {
  await evaluate(client, buildSetInputValueExpression(selector, value));
}

export async function fillCreatorPerformanceMetricInputs(client) {
  await evaluate(
    client,
    `(() => {
      const values = ["12000", "900", "33", "12", "19", "8", "62"];
      const inputs = [...document.querySelectorAll('[data-testid="performance-metric-input-control"] input')];
      if (inputs.length === 0) throw new Error("Missing performance metric inputs");
      inputs.forEach((input, index) => {
        const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
        descriptor.set.call(input, values[index] ?? "1");
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
      return inputs.length;
    })()`,
  );
}

export function getCreatorReportSubmittedWaitExpression() {
  return `(() => {
    const submittedCard = document
      .querySelector("[data-testid=\\"performance-report-submitted\\"]")
      ?.innerText.toLowerCase().includes("submitted");
    const submittedReportRow = [
      ...document.querySelectorAll("[data-testid=\\"creator-report-status-row\\"]"),
    ].some((row) => {
      const text = row.innerText.toLowerCase();
      return text.includes("tiktok") && text.includes("submitted");
    });
    const submittedHandoffRow = [
      ...document.querySelectorAll("[data-testid=\\"creator-handoff-row\\"]"),
    ].some((row) => {
      const rowText = row.innerText.toLowerCase();
      const proofText = row
        .querySelector("[data-testid=\\"creator-report-status-row\\"]")
        ?.innerText.toLowerCase() ?? "";
      return rowText.includes("tiktok") && proofText.includes("submitted");
    });
    const pageText = document.body.innerText.toLowerCase();
    const refreshedToReview =
      pageText.includes("proof sent for review") &&
      !pageText.includes("performance overdue") &&
      !document.querySelector("[data-testid=\\"performance-evidence-block\\"]");
    return Boolean(
      submittedCard ||
      submittedReportRow ||
      submittedHandoffRow ||
      refreshedToReview
    );
  })()`;
}

export async function acceptCreatorApplication(client, targets) {
  await loginForSmoke(client, {
    loginUrl: targets.brandLoginUrl,
    expectedUrlPrefix: `${targets.baseUrl}/b/campaigns`,
    description: "brand dev login redirect",
  });
  await navigate(client, targets.brandCampaignUrl);
  await waitForBrandCampaignTitle(
    client,
    targets,
    "brand campaign detail before acceptance",
  );
  await clickTab(client, "Creators");
  await waitForExpression(
    client,
    `document.querySelector("[data-testid=\\"campaign-creators-section-applicants\\"]")?.innerText.includes(${JSON.stringify(getSmokeCreatorDisplayName())})`,
    "brand pending applicant",
  );
  await clickButtonByText(
    client,
    "Accept",
    '[data-testid="campaign-creators-section-applicants"]',
  );
  await waitForExpression(
    client,
    `document.querySelector("[data-testid=\\"campaign-creators-section-members\\"]")?.innerText.includes(${JSON.stringify(getSmokeCreatorDisplayName())})`,
    "accepted member row",
    180000,
  );
}

export async function transitionSmokeCampaignToActiveWork(admin, campaignId) {
  await checkedQuery(
    "Move accepted smoke campaign into active content work",
    admin
      .from("campaigns")
      .update({
        status: "in_progress",
        updated_at: new Date().toISOString(),
      })
      .eq("id", campaignId),
  );
}

export async function submitCreatorDraft(client, targets) {
  await loginForSmoke(client, {
    loginUrl: targets.creatorLoginUrl,
    expectedUrlPrefix: `${targets.baseUrl}/i/home`,
    description: "creator dev login redirect for content submission",
  });
  await navigate(client, `${targets.creatorCampaignUrl}?tab=submit`);
  await waitForExpression(
    client,
    `document.body.innerText.includes(${JSON.stringify(getSmokeCampaignTitle())}) && document.querySelector("[data-testid=\\"creator-submit-workspace\\"]") != null`,
    "creator campaign room before content submission",
  );
  await waitForExpression(
    client,
    'new URL(location.href).searchParams.get("tab") === "submit"',
    "creator submit tab URL state",
  );
  await waitForExpression(
    client,
    'document.querySelector("[data-testid=\\"creator-submit-workspace\\"] input[type=url]") != null',
    "creator content URL input",
  );
  await setInputValue(
    client,
    '[data-testid="creator-submit-workspace"] input[type=url]',
    DRAFT_CONTENT_URL,
  );
  await setInputValue(
    client,
    '[data-testid="creator-submit-workspace"] textarea',
    "Smoke draft for brand review.",
  );
  await clickButtonByText(client, "Submit draft", '[data-testid="creator-submit-workspace"]');
  await waitForExpression(
    client,
    `(() => {
      const text = document.body?.innerText ?? "";
      return text.includes(${JSON.stringify(getSmokeCampaignTitle())}) && (text.includes("Submitted for review") || text.includes("Content submitted"));
    })()`,
    "creator post-submit review state",
  );
  await clickTab(client, "Submit");
  await waitForExpression(
    client,
    `document.body.innerText.includes(${JSON.stringify(getSmokeCampaignTitle())}) && document.body.innerText.includes("TikTok") && document.body.innerText.includes("v1") && document.body.innerText.includes("Submitted") && document.querySelector("[data-testid=\\"creator-handoff-list\\"]")?.innerText.includes("Draft") && document.querySelector("[data-testid=\\"creator-handoff-list\\"]")?.innerText.includes("Live URL") && document.querySelector("[data-testid=\\"creator-handoff-list\\"]")?.innerText.includes("Proof")`,
    "creator submitted content row",
  );

  return evaluate(client, "document.body.innerText");
}

export async function approveBrandContent(client, targets) {
  await loginForSmoke(client, {
    loginUrl: targets.brandLoginUrl,
    expectedUrlPrefix: `${targets.baseUrl}/b/campaigns`,
    description: "brand dev login redirect for content review",
  });
  await navigate(client, targets.brandCampaignUrl);
  await waitForBrandCampaignTitle(
    client,
    targets,
    "brand campaign detail before content review",
  );
  await clickTab(client, "Content");
  await waitForExpression(
    client,
    `document.querySelector("[data-testid=\\"campaign-content-table\\"]")?.innerText.includes(${JSON.stringify(getSmokeCreatorDisplayName())}) && document.querySelector("[data-testid=\\"campaign-content-table\\"]")?.innerText.includes("Submitted") && document.querySelector("[data-testid=\\"campaign-content-handoff-grid\\"]")?.innerText.includes("Draft") && document.querySelector("[data-testid=\\"campaign-content-handoff-grid\\"]")?.innerText.includes("Live URL") && document.querySelector("[data-testid=\\"campaign-content-handoff-grid\\"]")?.innerText.includes("Proof")`,
    "brand content submission row",
  );
  const brandContentText = await evaluate(client, "document.body.innerText");
  await clickButtonByText(client, "Approve", '[data-testid="campaign-content-table"]');
  await waitForExpression(
    client,
    `document.querySelector("[data-testid=\\"campaign-content-table\\"]")?.innerText.includes("Approved")`,
    "brand approved content row",
  );

  return brandContentText;
}

export async function publishCreatorContent(
  client,
  targets,
  { liveUrlScreenshotPath, proofNeededScreenshotPath } = {},
) {
  await loginForSmoke(client, {
    loginUrl: targets.creatorLoginUrl,
    expectedUrlPrefix: `${targets.baseUrl}/i/home`,
    description: "creator dev login redirect for live URL",
  });
  await navigate(client, targets.creatorCampaignUrl);
  await waitForExpression(
    client,
    `document.body.innerText.includes(${JSON.stringify(getSmokeCampaignTitle())}) && document.body.innerText.includes("Publish approved post") && document.body.innerText.includes("Post the approved content on the platform") && document.body.innerText.includes("Publish next") && document.body.innerText.includes("Live post URL")`,
    "creator live URL form",
  );
  await clickTab(client, "Submit");
  await waitForExpression(
    client,
    'new URL(location.href).searchParams.get("tab") === "submit"',
    "creator live URL tab URL state",
  );
  if (liveUrlScreenshotPath) {
    await captureScreenshot(client, liveUrlScreenshotPath);
  }
  await setInputValue(
    client,
    '[data-testid="creator-submit-workspace"] input[type=url]',
    LIVE_TIKTOK_URL,
  );
  await clickButtonByText(client, "Save live URL", '[data-testid="creator-submit-workspace"]');
  await waitForExpression(
    client,
    `(document.body?.innerText || "").includes("Published") && (document.body?.innerText || "").includes("Upload analytics proof") && (document.body?.innerText || "").includes("Upload platform analytics") && (document.body?.innerText || "").includes("Upload screenshot or export") && document.querySelector("[data-testid=\\"performance-evidence-block\\"] input[type=file]") != null`,
    "creator performance proof form",
  );
  if (proofNeededScreenshotPath) {
    await evaluate(
      client,
      `(() => {
        const target = document.querySelector("[data-testid=\\"performance-evidence-block\\"]");
        if (!target) return false;
        const top = target.getBoundingClientRect().top + window.scrollY - 140;
        window.scrollTo({ top: Math.max(0, top), behavior: "instant" });
        return true;
      })()`,
    );
    await waitForExpression(
      client,
      `(() => {
        const target = document.querySelector("[data-testid=\\"performance-evidence-block\\"]");
        if (!target) return false;
        const rect = target.getBoundingClientRect();
        return rect.top >= 110 && rect.top <= window.innerHeight - 160;
      })()`,
      "creator proof evidence visible",
    );
    await captureScreenshot(client, proofNeededScreenshotPath);
  }
}

export async function submitCreatorPerformanceProof(
  client,
  {
    requireAiSuggestions = false,
    editExtractedMetric = false,
    manualOnlyEvidence = false,
  } = {},
) {
  await evaluate(
    client,
    `(() => {
      const input = document.querySelector('[data-testid="performance-evidence-block"] input[type=file]');
      if (!input) throw new Error("Missing performance evidence file input");
      const proof = ${manualOnlyEvidence
        ? `new File(
            ["This is not a valid PDF analytics export."],
            "popsdrops-unreadable-proof.pdf",
            { type: "application/pdf" },
          )`
        : `new File(
            ["metric,value\\nviews,12000\\nlikes,900\\ncomments,33\\nshares,12\\nsaves,19\\navg_watch_time_seconds,8\\ncompletion_rate,62\\n"],
            "popsdrops-proof.csv",
            { type: "text/csv" },
          )`};
      const transfer = new DataTransfer();
      transfer.items.add(proof);
      input.files = transfer.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    })()`,
  );
  await waitForExpression(
    client,
    `document.querySelector("[data-testid=\\"performance-evidence-block\\"]")?.innerText.includes("Ready") || document.querySelector("[data-testid=\\"performance-evidence-block\\"]")?.innerText.includes("Evidence uploaded") || document.querySelector("[data-testid=\\"performance-evidence-block\\"]")?.innerText.includes("Evidence read")`,
    "creator proof upload ready",
    60000,
  );

  if (requireAiSuggestions) {
    await waitForExpression(
      client,
      `(() => {
        const confirmationText = document.querySelector("[data-testid=\\"performance-ai-confirmation\\"]")?.innerText ?? "";
        const sourceTexts = [...document.querySelectorAll("[data-testid=\\"performance-metric-source\\"]")]
          .map((node) => node.textContent.trim());
        const inputs = [...document.querySelectorAll('[data-testid="performance-metric-input-control"] input')];
        const requiredInputs = inputs.slice(0, 3);
        return confirmationText.includes("AI") &&
          sourceTexts.some((text) => text.includes("Suggested")) &&
          requiredInputs.length === 3 &&
          requiredInputs.every((input) => input.value.trim().length > 0);
      })()`,
      "creator AI metric suggestions",
      90000,
    );
  } else if (manualOnlyEvidence) {
    await waitForExpression(
      client,
      `(() => {
        const confirmationText = document.querySelector("[data-testid=\\"performance-ai-confirmation\\"]")?.innerText ?? "";
        const sourceTexts = [...document.querySelectorAll("[data-testid=\\"performance-metric-source\\"]")]
          .map((node) => node.textContent.trim());
        return confirmationText.includes("Confirm proof numbers") &&
          sourceTexts.length === 0;
      })()`,
      "creator manual metric fallback",
      90000,
    );
    await fillCreatorPerformanceMetricInputs(client);
  } else {
    await fillCreatorPerformanceMetricInputs(client);
  }

  if (editExtractedMetric) {
    await evaluate(
      client,
      `(() => {
        const input = document.querySelector('[data-testid="performance-metric-input-control"] input');
        if (!input) throw new Error("Missing extracted metric input to edit");
        const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
        const currentValue = Number(input.value || 0);
        descriptor.set.call(input, String(currentValue + 1));
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        return input.value;
      })()`,
    );
    await waitForExpression(
      client,
      `(() => [...document.querySelectorAll("[data-testid=\\"performance-metric-source\\"]")]
        .some((node) => node.textContent.trim().includes("Edited")))()`,
      "creator edited one AI metric",
      60000,
    );
  }

  await waitForExpression(
    client,
    `(() => {
      const scope = document.querySelector("[data-testid=\\"creator-submit-workspace\\"]");
      const texts = ${JSON.stringify(getSubmitPerformanceProofButtonTexts())};
      return [...(scope?.querySelectorAll("button") ?? [])]
        .some((node) => texts.some((text) => node.textContent.trim().includes(text)) && !node.disabled);
    })()`,
    "enabled creator proof submit button",
    60000,
  );
  await clickFirstEnabledButtonByText(
    client,
    getSubmitPerformanceProofButtonTexts(),
    '[data-testid="creator-submit-workspace"]',
  );
  await waitForExpression(
    client,
    getCreatorReportSubmittedWaitExpression(),
    "creator report submitted state",
    60000,
  );
  if (manualOnlyEvidence) {
    await waitForExpression(
      client,
      `(() => {
        const pageText = document.body?.innerText || "";
        return pageText.includes(${JSON.stringify(getSmokeCampaignTitle())}) &&
          pageText.toLowerCase().includes("proof sent for review") &&
          !document.querySelector("[data-testid=\\"performance-evidence-block\\"]");
      })()`,
      "creator manual proof review state",
      120000,
    );
  }

  return evaluate(client, "document.body.innerText");
}

export async function openBrandReportEvidenceTrail(
  client,
  targets,
  options = {},
) {
  const { description, proofQueueScreenshotPath } =
    typeof options === "string"
      ? { description: options, proofQueueScreenshotPath: undefined }
      : {
          description: "brand report evidence trail",
          proofQueueScreenshotPath: undefined,
          ...options,
        };

  const proofQueueOptions = {
    expectedTexts: [getSmokeCreatorDisplayName()],
    proofQueueScreenshotPath,
    requireReviewControls: true,
  };

  await openBrandReportingProofQueue(client, targets, proofQueueOptions);

  const evidenceTrailExpression = `document.body.innerText.includes(${JSON.stringify(getSmokeCampaignTitle())}) && document.querySelector("[data-testid=\\"report-evidence-trail\\"]") != null`;
  let lastError = null;
  let lastReportPage = "not inspected";

  for (let attempt = 1; attempt <= REPORT_EVIDENCE_TRAIL_NAVIGATION_ATTEMPTS; attempt += 1) {
    if (attempt > 1) {
      await openBrandReportingProofQueue(client, targets, proofQueueOptions);
    }

    await navigate(client, targets.brandReportUrl);
    try {
      await waitForExpression(
        client,
        evidenceTrailExpression,
        description,
        attempt === REPORT_EVIDENCE_TRAIL_NAVIGATION_ATTEMPTS
          ? REPORT_EVIDENCE_TRAIL_WAIT_MS
          : 15000,
      );
      return;
    } catch (error) {
      lastError = error;
      const pageText = await evaluate(
        client,
        `(document.body.innerText || document.title || "")
          .replace(/\\s+/g, " ")
          .slice(0, 1200)`,
      ).catch(() => "");
      lastReportPage = pageText || "empty report page";
      const transientNotFound =
        /404|not found|could not be found/i.test(pageText);
      const canRetry = attempt < REPORT_EVIDENCE_TRAIL_NAVIGATION_ATTEMPTS;
      if (!canRetry) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `${message}. Last report page: ${lastReportPage}`,
        );
      }
      await new Promise((resolve) =>
        setTimeout(resolve, transientNotFound ? 1500 * attempt : 750 * attempt),
      );
    }
  }

  const message = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`${message}. Last report page: ${lastReportPage}`);
}

export async function openBrandReportingProofQueue(
  client,
  targets,
  {
    description = "brand reporting proof queue",
    expectedTexts = [getSmokeCreatorDisplayName()],
    proofQueueScreenshotPath,
    requireReviewControls = false,
  } = {},
) {
  await navigate(client, `${targets.brandCampaignUrl}?tab=reporting`);
  await waitForExpression(
    client,
    `document.body.innerText.includes(${JSON.stringify(getSmokeCampaignTitle())}) && new URL(location.href).searchParams.get("tab") === "reporting"`,
    "brand campaign reporting workspace",
    60000,
  );
  await waitForExpression(
    client,
    `(() => {
      const queue = document.querySelector("[data-testid=\\"campaign-reporting-proof-queue\\"]");
      const text = queue?.innerText ?? "";
      const expectedTexts = ${JSON.stringify(expectedTexts)};
      return Boolean(queue) && expectedTexts.every((expectedText) => text.includes(expectedText));
    })()`,
    description,
    60000,
  );

  if (requireReviewControls) {
    await waitForExpression(
      client,
      `(() => {
        const queue = document.querySelector("[data-testid=\\"campaign-reporting-proof-queue\\"]");
        const text = queue?.innerText ?? "";
        const waitingAge = queue?.querySelector("[data-testid=\\"campaign-reporting-proof-review-age\\"]");
        return text.includes("Needs review") || text.includes("Correction returned") ?
          text.includes("Open proof") &&
            text.includes("Verify") &&
            text.includes("Request correction") &&
            text.includes("Report impact") &&
            text.includes("Excluded until brand review") &&
            Boolean(waitingAge) &&
            waitingAge.getAttribute("data-proof-waiting-state") === "waiting" &&
            waitingAge.innerText.includes("Waiting") :
          false;
      })()`,
      "brand proof queue review controls",
      60000,
    );
  }

  if (proofQueueScreenshotPath) {
    await evaluate(
      client,
      `(() => {
        const target = document.querySelector("[data-testid=\\"campaign-reporting-proof-queue\\"]");
        if (!target) return false;
        const top = target.getBoundingClientRect().top + window.scrollY - 96;
        window.scrollTo({ top: Math.max(0, top), behavior: "instant" });
        return true;
      })()`,
    );
    await waitForExpression(
      client,
      `(() => {
        const target = document.querySelector("[data-testid=\\"campaign-reporting-proof-queue\\"]");
        if (!target) return false;
        const rect = target.getBoundingClientRect();
        return rect.top >= 64 && rect.top < window.innerHeight - 180;
      })()`,
      "brand proof queue visible",
      60000,
    );
    await captureScreenshot(client, proofQueueScreenshotPath);
  }

  return evaluate(
    client,
    'document.querySelector("[data-testid=\\"campaign-reporting-proof-queue\\"]")?.innerText ?? ""',
  );
}

export async function verifyBrandReportEvidence(client, targets, options = {}) {
  const { evidenceTrailScreenshotPath } = options;

  await loginForSmoke(client, {
    loginUrl: targets.brandLoginUrl,
    expectedUrlPrefix: `${targets.baseUrl}/b/campaigns`,
    description: "brand dev login redirect for report review",
  });
  await openBrandReportEvidenceTrail(client, targets, options);
  try {
    await waitForExpression(
      client,
      `(() => {
        const trail = document.querySelector("[data-testid=\\"report-evidence-trail\\"]");
        const command = document.querySelector("[data-testid=\\"report-evidence-command\\"]");
        const handoffGate = document.querySelector("[data-testid=\\"report-evidence-handoff-gate\\"]");
        const handoffCounts = document.querySelector("[data-testid=\\"report-evidence-handoff-counts\\"]");
        const provenance = document.querySelector("[data-testid=\\"report-evidence-review-provenance\\"]");
        const text = trail?.innerText ?? "";
        const provenanceText = provenance?.innerText ?? "";
        const commandText = command?.innerText?.toLowerCase() ?? "";
        const handoffText = handoffGate?.innerText ?? "";
        const countsText = handoffCounts?.innerText ?? "";
        const normalizedHandoffText = handoffText.toLowerCase();
        const normalizedCountsText = countsText.toLowerCase();
        const handoffLabel = "Leadership handoff".toLowerCase();
        const handoffHold = "Keep in proof room".toLowerCase();
        const countsLabel = "Proof basis".toLowerCase();
        const needsReviewLabel = "Needs review".toLowerCase();
        return document.querySelector("[data-testid=\\"report-evidence-verify\\"]") != null &&
          commandText.includes("proof review command") &&
          commandText.includes("hold in proof room") &&
          handoffGate?.getAttribute("data-report-handoff-state") === "hold" &&
          normalizedHandoffText.includes(handoffLabel) &&
          normalizedHandoffText.includes(handoffHold) &&
          normalizedCountsText.includes(countsLabel) &&
          normalizedCountsText.includes(needsReviewLabel) &&
          provenanceText.includes("Awaiting brand decision") &&
          text.includes("Report impact") &&
          (text.includes("Excluded until brand review") ||
            text.includes("Correction returned"));
      })()`,
      "brand evidence verify action",
    );
  } catch (error) {
    const diagnostics = await evaluate(
      client,
      `(() => JSON.stringify({
        href: location.href,
        role: document.querySelector("[data-report-role]")?.getAttribute("data-report-role") ?? null,
        verifyButtons: document.querySelectorAll("[data-testid=\\"report-evidence-verify\\"]").length,
        commandText: document.querySelector("[data-testid=\\"report-evidence-command\\"]")?.innerText?.replace(/\\s+/g, " ").slice(0, 800) ?? "",
        handoffState: document.querySelector("[data-testid=\\"report-evidence-handoff-gate\\"]")?.getAttribute("data-report-handoff-state") ?? null,
        handoffText: document.querySelector("[data-testid=\\"report-evidence-handoff-gate\\"]")?.innerText?.replace(/\\s+/g, " ").slice(0, 500) ?? "",
        handoffCounts: document.querySelector("[data-testid=\\"report-evidence-handoff-counts\\"]")?.innerText?.replace(/\\s+/g, " ").slice(0, 500) ?? "",
        provenanceText: document.querySelector("[data-testid=\\"report-evidence-review-provenance\\"]")?.innerText?.replace(/\\s+/g, " ").slice(0, 400) ?? "",
        trailText: document.querySelector("[data-testid=\\"report-evidence-trail\\"]")?.innerText?.replace(/\\s+/g, " ").slice(0, 1200) ?? "",
        bodyText: document.body?.innerText?.replace(/\\s+/g, " ").slice(0, 1200) ?? ""
      }))()`,
    ).catch(() => "");
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `${message}. Report evidence verify diagnostics: ${diagnostics}`,
    );
  }
  await clickButtonByText(client, "Verify", '[data-testid="report-evidence-trail"]');
  await waitForExpression(
    client,
    `(() => {
      const trail = document.querySelector("[data-testid=\\"report-evidence-trail\\"]");
      const command = document.querySelector("[data-testid=\\"report-evidence-command\\"]");
      const handoffGate = document.querySelector("[data-testid=\\"report-evidence-handoff-gate\\"]");
      const handoffCounts = document.querySelector("[data-testid=\\"report-evidence-handoff-counts\\"]");
      const provenance = document.querySelector("[data-testid=\\"report-evidence-review-provenance\\"]");
      const commandText = command?.innerText?.toLowerCase() ?? "";
      const handoffText = handoffGate?.innerText ?? "";
      const countsText = handoffCounts?.innerText ?? "";
      const normalizedHandoffText = handoffText.toLowerCase();
      const normalizedCountsText = countsText.toLowerCase();
      const handoffLabel = "Leadership handoff".toLowerCase();
      const handoffReady = "Share with leadership".toLowerCase();
      const countsLabel = "Proof basis".toLowerCase();
      const includedLabel = "Included".toLowerCase();
      const provenanceText = provenance?.innerText ?? "";
      return trail?.innerText.includes("Verified") &&
        trail?.innerText.includes("Included in report totals") &&
        provenanceText.includes("Reviewed") &&
        commandText.includes("ready to share") &&
        handoffGate?.getAttribute("data-report-handoff-state") === "ready" &&
        normalizedHandoffText.includes(handoffLabel) &&
        normalizedHandoffText.includes(handoffReady) &&
        normalizedCountsText.includes(countsLabel) &&
        normalizedCountsText.includes(includedLabel);
    })()`,
    "brand verified report evidence",
    60000,
  );
  try {
    await waitForExpression(
      client,
      `(() => {
        const summary = document.querySelector("[data-testid=\\"report-evidence-summary\\"]");
        const trail = document.querySelector("[data-testid=\\"report-evidence-trail\\"]");
        const text = trail?.innerText ?? "";
        const normalizedText = text.toLowerCase();
        const leadershipImpactTitle = "Leadership impact";
        return Boolean(summary) &&
          normalizedText.includes(leadershipImpactTitle.toLowerCase()) &&
          normalizedText.includes("included") &&
          normalizedText.includes("needs review") &&
          normalizedText.includes("corrections") &&
          normalizedText.includes("missing proof");
      })()`,
      "brand evidence leadership impact summary",
      60000,
    );
  } catch (error) {
    const diagnostics = await evaluate(
      client,
      `(() => JSON.stringify({
        href: location.href,
        htmlLang: document.documentElement.lang,
        summaryExists: document.querySelector("[data-testid=\\"report-evidence-summary\\"]") != null,
        summaryItemCount: document.querySelectorAll("[data-testid=\\"report-evidence-summary-item\\"]").length,
        summaryText: document.querySelector("[data-testid=\\"report-evidence-summary\\"]")?.innerText?.replace(/\\s+/g, " ").slice(0, 800) ?? "",
        trailText: document.querySelector("[data-testid=\\"report-evidence-trail\\"]")?.innerText?.replace(/\\s+/g, " ").slice(0, 1600) ?? "",
        bodyText: document.body?.innerText?.replace(/\\s+/g, " ").slice(0, 1600) ?? ""
      }))()`,
    ).catch(() => "");
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `${message}. Leadership impact diagnostics: ${diagnostics}`,
    );
  }

  if (evidenceTrailScreenshotPath) {
    await evaluate(
      client,
      `(() => {
        const target = document.querySelector("[data-testid=\\"report-evidence-trail\\"]");
        if (!target) return false;
        const top = target.getBoundingClientRect().top + window.scrollY - 96;
        window.scrollTo({ top: Math.max(0, top), behavior: "instant" });
        return true;
      })()`,
    );
    await waitForExpression(
      client,
      `(() => {
        const target = document.querySelector("[data-testid=\\"report-evidence-trail\\"]");
        if (!target) return false;
        const rect = target.getBoundingClientRect();
        return rect.top >= 64 && rect.top < window.innerHeight - 180;
      })()`,
      "brand evidence trail visible",
      60000,
    );
    await captureScreenshot(client, evidenceTrailScreenshotPath);
  }

  return evaluate(client, "document.body.innerText");
}

export function isRecoverableBrowserSmokeError(error) {
  const message = error?.message ?? String(error);

  return (
    message.includes("Timed out waiting for Chrome DevTools") ||
    message.includes("dev login redirect failed") ||
    message.includes("Unable to create Chrome target") ||
    message.includes("WebSocket")
  );
}

async function createSmokeBrowserSession(consoleErrors) {
  const debugPort = await findFreePort();
  const userDataDir = await mkdtemp(
    path.join(tmpdir(), "popsdrops-content-report-smoke-"),
  );
  const chrome = await launchChrome({ debugPort, userDataDir });
  const client = await createCdpPage(debugPort);

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

  return { chrome, client, userDataDir };
}

async function closeSmokeBrowserSession(session) {
  if (!session) return;

  session.client?.close();
  session.chrome?.kill();
  await rm(session.userDataDir, {
    recursive: true,
    force: true,
    maxRetries: 3,
    retryDelay: 100,
  });
}

async function restartSmokeBrowserSession(session, consoleErrors) {
  await closeSmokeBrowserSession(session);
  return createSmokeBrowserSession(consoleErrors);
}

async function runContentReportWorkflowSmoke() {
  await loadLocalEnv();
  ensureSmokeIdentityEnvDefaults();

  const targets = buildContentReportWorkflowSmokeTargets();
  const creatorReportScreenshotPath = path.resolve(
    process.env.SMOKE_CONTENT_REPORT_CREATOR_SCREENSHOT_PATH ||
      DEFAULT_CREATOR_REPORT_SCREENSHOT_PATH,
  );
  const brandReportScreenshotPath = path.resolve(
    process.env.SMOKE_CONTENT_REPORT_BRAND_SCREENSHOT_PATH ||
      DEFAULT_BRAND_REPORT_SCREENSHOT_PATH,
  );
  const creatorHandoffScreenshotPath = path.resolve(
    process.env.SMOKE_CONTENT_REPORT_CREATOR_HANDOFF_SCREENSHOT_PATH ||
      DEFAULT_CREATOR_HANDOFF_SCREENSHOT_PATH,
  );
  const brandHandoffScreenshotPath = path.resolve(
    process.env.SMOKE_CONTENT_REPORT_BRAND_HANDOFF_SCREENSHOT_PATH ||
      DEFAULT_BRAND_HANDOFF_SCREENSHOT_PATH,
  );
  const creatorLiveUrlScreenshotPath = path.resolve(
    process.env.SMOKE_CREATOR_LIVE_URL_SCREENSHOT_PATH ||
      DEFAULT_CREATOR_LIVE_URL_SCREENSHOT_PATH,
  );
  const creatorProofNeededScreenshotPath = path.resolve(
    process.env.SMOKE_CREATOR_PROOF_NEEDED_SCREENSHOT_PATH ||
      DEFAULT_CREATOR_PROOF_NEEDED_SCREENSHOT_PATH,
  );
  const brandProofQueueScreenshotPath = path.resolve(
    process.env.SMOKE_CONTENT_REPORT_BRAND_PROOF_QUEUE_SCREENSHOT_PATH ||
      DEFAULT_BRAND_PROOF_QUEUE_SCREENSHOT_PATH,
  );
  const brandEvidenceTrailScreenshotPath = path.resolve(
    process.env.SMOKE_CONTENT_REPORT_BRAND_EVIDENCE_TRAIL_SCREENSHOT_PATH ||
      DEFAULT_BRAND_EVIDENCE_TRAIL_SCREENSHOT_PATH,
  );
  const devServer = (await isExistingDevServerReady(targets.baseUrl))
    ? null
    : await ensureDevServer(targets.baseUrl);
  const admin = createAdminClient();
  let browserSession;
  let client;
  const consoleErrors = [];
  const smokeEvidence = {
    creatorSubmissionText: "",
    brandContentText: "",
    creatorReportText: "",
    brandReportText: "",
  };

  try {
    await setupApplicationFlowSmokeData(admin, targets);

    browserSession = await createSmokeBrowserSession(consoleErrors);
    client = browserSession.client;

    const runRecoverableStep = async (description, step) => {
      try {
        return await step();
      } catch (error) {
        if (!isRecoverableBrowserSmokeError(error)) {
          throw error;
        }

        process.stderr.write(
          `[smoke] Retrying content report smoke step "${description}" after browser reset: ${error.message}\n`,
        );
        browserSession = await restartSmokeBrowserSession(
          browserSession,
          consoleErrors,
        );
        client = browserSession.client;
        return step();
      }
    };

    await submitCreatorApplication(client, targets);
    await ensureSmokeDataDevUser(admin, "creator");
    await runRecoverableStep("accept creator application", () =>
      acceptCreatorApplication(client, targets),
    );
    await transitionSmokeCampaignToActiveWork(admin, targets.campaignId);
    smokeEvidence.creatorSubmissionText = await runRecoverableStep(
      "submit creator draft",
      () => submitCreatorDraft(client, targets),
    );
    await ensureSmokeDataDevUser(admin, "creator");
    await captureScreenshot(client, creatorHandoffScreenshotPath);
    smokeEvidence.brandContentText = await runRecoverableStep(
      "approve brand content",
      () => approveBrandContent(client, targets),
    );
    await captureScreenshot(client, brandHandoffScreenshotPath);
    await runRecoverableStep("publish creator content", () =>
      publishCreatorContent(client, targets, {
        liveUrlScreenshotPath: creatorLiveUrlScreenshotPath,
        proofNeededScreenshotPath: creatorProofNeededScreenshotPath,
      }),
    );
    smokeEvidence.creatorReportText = await runRecoverableStep(
      "submit creator performance proof",
      () => submitCreatorPerformanceProof(client),
    );
    await ensureSmokeDataDevUser(admin, "creator");
    await captureScreenshot(client, creatorReportScreenshotPath);
    smokeEvidence.brandReportText = await runRecoverableStep(
      "verify brand report evidence",
      () =>
        verifyBrandReportEvidence(client, targets, {
          proofQueueScreenshotPath: brandProofQueueScreenshotPath,
          evidenceTrailScreenshotPath: brandEvidenceTrailScreenshotPath,
        }),
    );
    await captureScreenshot(client, brandReportScreenshotPath);

    validateContentReportWorkflowSmoke({
      ...smokeEvidence,
      consoleErrors,
    });

    return {
      ok: true,
      baseUrl: targets.baseUrl,
      brandCampaignUrl: targets.brandCampaignUrl,
      brandReportUrl: targets.brandReportUrl,
      creatorCampaignUrl: targets.creatorCampaignUrl,
      creatorHandoffScreenshotPath,
      brandHandoffScreenshotPath,
      creatorLiveUrlScreenshotPath,
      creatorProofNeededScreenshotPath,
      brandProofQueueScreenshotPath,
      brandEvidenceTrailScreenshotPath,
      creatorReportScreenshotPath,
      brandReportScreenshotPath,
      keptSmokeData: process.env.SMOKE_KEEP_DATA === "1",
      devServerStarted: Boolean(devServer),
    };
  } finally {
    await closeSmokeBrowserSession(browserSession);

    if (process.env.SMOKE_KEEP_DATA !== "1") {
      await cleanupApplicationFlowSmokeData(admin, targets.campaignId);
    }
    await stopDevServer(devServer);
  }
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] === currentFile) {
  runContentReportWorkflowSmoke()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
