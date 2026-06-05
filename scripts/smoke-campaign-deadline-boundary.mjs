#!/usr/bin/env node

import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  createCdpPage,
  ensureDevServer,
  evaluate,
  findFreePort,
  launchChrome,
  loginForSmoke,
  navigate,
  stopDevServer,
  waitForExpression,
} from "./smoke-campaign-detail.mjs";
import {
  SMOKE_CAMPAIGN_TITLE,
  captureScreenshot,
  checkedQuery,
  cleanupApplicationFlowSmokeData,
  createAdminClient,
  loadLocalEnv,
  setupApplicationFlowSmokeData,
} from "./smoke-application-flow.mjs";

export const DEFAULT_CAMPAIGN_DEADLINE_BOUNDARY_CAMPAIGN_ID =
  "a0000000-0000-4000-8000-000000000117";
export const DEADLINE_CONTENT_DUE_LIMIT_COPY =
  "Applications must close on or before content is due.";

const DEFAULT_BASE_URL = "http://127.0.0.1:4000";
const DEFAULT_SCREENSHOT_PATH =
  "output/playwright/campaign-deadline-boundary-smoke.png";

export function buildCampaignDeadlineBoundarySmokeTargets({
  baseUrl = process.env.SMOKE_BASE_URL || DEFAULT_BASE_URL,
  campaignId =
    process.env.SMOKE_CAMPAIGN_DEADLINE_BOUNDARY_ID ||
    DEFAULT_CAMPAIGN_DEADLINE_BOUNDARY_CAMPAIGN_ID,
} = {}) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

  return {
    baseUrl: normalizedBaseUrl,
    campaignId,
    brandLoginUrl: `${normalizedBaseUrl}/auth/dev-login?role=brand`,
    brandCampaignUrl: `${normalizedBaseUrl}/b/campaigns/${campaignId}`,
    brandCampaignOverviewUrl: `${normalizedBaseUrl}/b/campaigns/${campaignId}?tab=overview`,
  };
}

function dateKey(value) {
  return value?.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
}

function addUtcDaysToDateKey(value, days) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function validateCampaignDeadlineBoundarySmoke({
  pageText,
  controlsText,
  inputMin,
  inputMax,
  contentDueDateKey,
  deadlineBefore,
  deadlineAfter,
  invalidSaveErrorText,
  consoleErrors,
  serverErrors = [],
}) {
  if (!pageText.includes(SMOKE_CAMPAIGN_TITLE)) {
    throw new Error("Expected the recruiting smoke campaign to render.");
  }

  if (!pageText.includes("Change application deadline")) {
    throw new Error("Expected the brand controls to expose the deadline action.");
  }

  if (!inputMin) {
    throw new Error("Expected the date input to keep a future-only minimum.");
  }

  if (inputMax !== contentDueDateKey) {
    throw new Error(
      `Expected the date input content due date max to be ${contentDueDateKey}. Got: ${inputMax || "empty"}`,
    );
  }

  if (!controlsText.includes(DEADLINE_CONTENT_DUE_LIMIT_COPY)) {
    throw new Error("Expected the deadline helper copy to explain the content due boundary.");
  }

  if (deadlineAfter !== deadlineBefore) {
    throw new Error(
      `Expected an invalid deadline save to leave the database unchanged. Before: ${deadlineBefore}. After: ${deadlineAfter}.`,
    );
  }

  if (!invalidSaveErrorText.includes(DEADLINE_CONTENT_DUE_LIMIT_COPY)) {
    throw new Error("Expected the invalid save to render an inline deadline boundary error.");
  }

  if (consoleErrors.length > 0) {
    throw new Error(`Console errors found: ${consoleErrors.join(" | ")}`);
  }

  if (serverErrors.length > 0) {
    throw new Error(`Server errors found: ${serverErrors.join(" | ")}`);
  }

  return { ok: true };
}

async function readCampaignTimeline(admin, campaignId) {
  return checkedQuery(
    "Read smoke campaign timeline",
    admin
      .from("campaigns")
      .select("application_deadline, content_due_date")
      .eq("id", campaignId)
      .single(),
  );
}

async function openDeadlineEditor(client) {
  await waitForExpression(
    client,
    `(() => {
      const controls = document.querySelector('[data-testid="campaign-controls"]');
      return Boolean(
        controls &&
        document.body.innerText.includes(${JSON.stringify(SMOKE_CAMPAIGN_TITLE)}) &&
        controls.innerText.includes("Change application deadline")
      );
    })()`,
    "campaign deadline controls",
  );

  await evaluate(
    client,
    `(() => {
      const button = [...document.querySelectorAll('[data-testid="campaign-control-action"]')]
        .find((node) => node.textContent.includes("Change application deadline"));
      if (!button) throw new Error("Missing Change application deadline action");
      button.click();
      return true;
    })()`,
  );

  await waitForExpression(
    client,
    `Boolean(document.querySelector('[data-testid="campaign-controls"] input[type="date"]'))`,
    "campaign deadline date input",
  );
}

async function inspectDeadlineEditor(client) {
  return evaluate(
    client,
    `(() => {
      const controls = document.querySelector('[data-testid="campaign-controls"]');
      const input = controls?.querySelector('input[type="date"]');
      if (!controls || !input) throw new Error("Missing campaign deadline controls");
      return {
        pageText: document.body.innerText,
        controlsText: controls.innerText,
        inputMin: input.min || "",
        inputMax: input.max || "",
      };
    })()`,
  );
}

async function tryInvalidDeadlineSave(client, invalidDeadline) {
  await evaluate(
    client,
    `(() => {
      const controls = document.querySelector('[data-testid="campaign-controls"]');
      const input = controls?.querySelector('input[type="date"]');
      if (!input) throw new Error("Missing campaign deadline input");

      const setValue = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      ).set;
      setValue.call(input, ${JSON.stringify(invalidDeadline)});
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      return input.value;
    })()`,
  );

  await waitForExpression(
    client,
    `(() => {
      const input = document.querySelector('[data-testid="campaign-controls"] input[type="date"]');
      return input?.value === ${JSON.stringify(invalidDeadline)};
    })()`,
    "invalid campaign deadline value",
  );

  await evaluate(
    client,
    `(() => {
      const controls = document.querySelector('[data-testid="campaign-controls"]');
      const button = [...(controls?.querySelectorAll("button") || [])]
        .find((node) => node.textContent.trim() === "Save");
      if (!button) throw new Error("Missing campaign deadline Save button");
      button.click();
      return true;
    })()`,
  );

  await waitForExpression(
    client,
    `(() => {
      const alert = document.querySelector('[data-testid="campaign-controls"] [role="alert"]');
      return alert?.textContent?.includes(${JSON.stringify(DEADLINE_CONTENT_DUE_LIMIT_COPY)});
    })()`,
    "inline invalid campaign deadline error",
  );

  return evaluate(
    client,
    `(() => {
      const alert = document.querySelector('[data-testid="campaign-controls"] [role="alert"]');
      return alert?.textContent || "";
    })()`,
  );
}

export async function runCampaignDeadlineBoundarySmoke() {
  await loadLocalEnv();

  process.env.POPSDROPS_SMOKE_QUEUE_ONLY ||= "1";

  const targets = buildCampaignDeadlineBoundarySmokeTargets();
  process.env.NEXT_PUBLIC_APP_URL = targets.baseUrl;

  const screenshotPath = path.resolve(
    process.env.SMOKE_CAMPAIGN_DEADLINE_BOUNDARY_SCREENSHOT_PATH ||
      DEFAULT_SCREENSHOT_PATH,
  );
  const admin = createAdminClient();
  await setupApplicationFlowSmokeData(admin, targets);

  const timelineBefore = await readCampaignTimeline(admin, targets.campaignId);
  const deadlineBefore = timelineBefore.application_deadline;
  const contentDueDateKey = dateKey(timelineBefore.content_due_date);
  if (!contentDueDateKey) {
    throw new Error("Smoke campaign is missing a content due date.");
  }
  const invalidDeadline = addUtcDaysToDateKey(contentDueDateKey, 1);

  const devServer = await ensureDevServer(targets.baseUrl);
  const debugPort = await findFreePort();
  const userDataDir = await mkdtemp(
    path.join(tmpdir(), "popsdrops-campaign-deadline-boundary-smoke-"),
  );
  let chrome;
  let client;
  const consoleErrors = [];
  const serverErrors = [];

  try {
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
    client.on("Network.responseReceived", (event) => {
      const { response } = event;
      if (
        response.status >= 500 &&
        response.url.includes(`/b/campaigns/${targets.campaignId}`)
      ) {
        serverErrors.push(`${response.status} ${response.url}`);
      }
    });

    await client.send("Page.enable");
    await client.send("Network.enable");
    await client.send("Runtime.enable");

    await loginForSmoke(client, {
      loginUrl: targets.brandLoginUrl,
      expectedUrlPrefix: `${targets.baseUrl}/b/`,
      description: "brand dev login redirect",
    });

    await navigate(client, targets.brandCampaignOverviewUrl);
    await openDeadlineEditor(client);
    const formState = await inspectDeadlineEditor(client);

    await evaluate(
      client,
      `(() => {
        const controls = document.querySelector('[data-testid="campaign-controls"]');
        if (!controls) throw new Error("Missing campaign controls");
        const top = controls.getBoundingClientRect().top + window.scrollY - 120;
        window.scrollTo({ top: Math.max(0, top), behavior: "instant" });
        return true;
      })()`,
    );
    const invalidSaveErrorText = await tryInvalidDeadlineSave(client, invalidDeadline);
    await captureScreenshot(client, screenshotPath);
    await sleep(1500);

    const timelineAfter = await readCampaignTimeline(admin, targets.campaignId);
    validateCampaignDeadlineBoundarySmoke({
      ...formState,
      contentDueDateKey,
      deadlineBefore,
      deadlineAfter: timelineAfter.application_deadline,
      invalidSaveErrorText,
      consoleErrors,
      serverErrors,
    });

    return {
      ok: true,
      campaignId: targets.campaignId,
      invalidDeadline,
      screenshotPath,
    };
  } finally {
    client?.close();
    chrome?.kill();
    await rm(userDataDir, { recursive: true, force: true }).catch(() => {});
    await cleanupApplicationFlowSmokeData(admin, targets.campaignId).catch(
      (error) => {
        process.stderr.write(`[smoke] Cleanup failed: ${error.message}\n`);
      },
    );
    await stopDevServer(devServer);
  }
}

const isDirectRun =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectRun) {
  runCampaignDeadlineBoundarySmoke()
    .then((result) => {
      process.stdout.write(
        `Campaign deadline boundary smoke passed: ${JSON.stringify(result)}\n`,
      );
    })
    .catch((error) => {
      process.stderr.write(
        `Campaign deadline boundary smoke failed: ${error.stack || error.message}\n`,
      );
      process.exitCode = 1;
    });
}
