#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import net from "node:net";

export const DEFAULT_CAMPAIGN_ID = "d0000000-0000-4000-8000-000000000001";
const DEFAULT_BASE_URL = "http://127.0.0.1:4000";
const SMOKE_HEALTH_PATH = "/api/smoke/health";
const DEFAULT_SCREENSHOT_PATH =
  "output/playwright/campaign-detail-smoke.png";
const CHROME_PATHS = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Google Chrome Canary.app/Contents/MacOS/Google Chrome Canary",
];

export function buildSmokeTargets({
  baseUrl = process.env.SMOKE_BASE_URL || DEFAULT_BASE_URL,
  campaignId = process.env.SMOKE_CAMPAIGN_ID || DEFAULT_CAMPAIGN_ID,
} = {}) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

  return {
    baseUrl: normalizedBaseUrl,
    campaignId,
    loginUrl: `${normalizedBaseUrl}/auth/dev-login?role=brand`,
    campaignUrl: `${normalizedBaseUrl}/b/campaigns/${campaignId}`,
  };
}

export function validateCampaignDetailSmoke({
  bodyText,
  overviewLabel,
  quickActionsCount,
  tabRailClass,
  directContentTabLabel,
  contentUrlAfterReload,
  contentUrlAfterClick,
  reportingUrlAfterClick,
  statusSort,
  consoleErrors,
}) {
  const requiredText = [
    ["campaign title", "Chrome Launch Smoke Campaign"],
    ["overview tab", "Overview"],
    ["completed status", "Completed"],
    ["creative kit", "Creative Kit"],
    ["campaign rules", "Campaign Rules"],
    ["reporting operations", "Reporting Operations"],
    ["report link", "View Report"],
  ];

  for (const [label, text] of requiredText) {
    if (!bodyText.includes(text)) {
      throw new Error(`Missing campaign detail proof: ${label}`);
    }
  }

  if (!overviewLabel.includes("Completed")) {
    throw new Error(`Expected overview tab to show Completed. Got: ${overviewLabel}`);
  }

  if (quickActionsCount !== 0) {
    throw new Error(`Expected no completed-campaign quick actions. Found: ${quickActionsCount}`);
  }

  const requiredRailClasses = [
    "sticky",
    "top-14",
    "lg:top-0",
    "z-20",
    "backdrop-blur",
  ];
  const missingRailClasses = requiredRailClasses.filter(
    (className) => !tabRailClass?.split(/\s+/).includes(className),
  );
  if (missingRailClasses.length > 0) {
    throw new Error(
      `Expected workspace tab rail to stay visible while scanning. Missing: ${missingRailClasses.join(", ")}`,
    );
  }

  if (
    !directContentTabLabel?.includes("Content") ||
    !contentUrlAfterReload?.includes("tab=content") ||
    !contentUrlAfterClick?.includes("tab=content") ||
    !reportingUrlAfterClick?.includes("tab=reporting")
  ) {
    throw new Error("Expected URL-addressable campaign tabs to survive direct links, refresh, and tab clicks.");
  }

  if (statusSort !== "ascending") {
    throw new Error(`Expected Status column sort to be ascending. Got: ${statusSort}`);
  }

  const singularGrammarLeaks = [
    /\b1 report proofs\b/i,
    /\b1 creator reports\b/i,
    /\b1 creators\b/i,
    /\b1 submissions\b/i,
    /\b1 approved posts\b/i,
  ];
  if (singularGrammarLeaks.some((pattern) => pattern.test(bodyText))) {
    throw new Error("Expected singular command-center grammar for one-count work.");
  }

  if (consoleErrors.length > 0) {
    throw new Error(`Console errors found: ${consoleErrors.join(" | ")}`);
  }

  return { ok: true };
}

class CdpClient {
  constructor(wsUrl, { commandTimeoutMs = 60000 } = {}) {
    this.ws = new WebSocket(wsUrl);
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    this.commandTimeoutMs = commandTimeoutMs;
    this.ready = new Promise((resolve, reject) => {
      this.ws.addEventListener("open", resolve, { once: true });
      this.ws.addEventListener("error", reject, { once: true });
    });
    this.ws.addEventListener("message", (event) => this.handleMessage(event));
  }

  handleMessage(event) {
    const message = JSON.parse(event.data);
    if (message.id && this.pending.has(message.id)) {
      const { resolve, reject, timeout } = this.pending.get(message.id);
      clearTimeout(timeout);
      this.pending.delete(message.id);
      if (message.error) {
        reject(new Error(`${message.error.message}: ${message.error.data ?? ""}`));
      } else {
        resolve(message.result ?? {});
      }
      return;
    }

    const listeners = this.listeners.get(message.method) ?? [];
    for (const listener of listeners) {
      listener(message.params ?? {});
    }
  }

  on(method, listener) {
    const listeners = this.listeners.get(method) ?? [];
    listeners.push(listener);
    this.listeners.set(method, listeners);
  }

  async send(method, params = {}) {
    await this.ready;
    const id = this.nextId;
    this.nextId += 1;

    const response = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(
          new Error(
            `Timed out waiting for Chrome DevTools ${method} response after ${this.commandTimeoutMs}ms`,
          ),
        );
      }, this.commandTimeoutMs);
      this.pending.set(id, { resolve, reject, timeout });
    });

    this.ws.send(JSON.stringify({ id, method, params }));
    return response;
  }

  close() {
    for (const { reject, timeout } of this.pending.values()) {
      clearTimeout(timeout);
      reject(new Error("Chrome DevTools client closed before response"));
    }
    this.pending.clear();
    this.ws.close();
  }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 5000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForHttp(url, timeoutMs = 60000) {
  const startedAt = Date.now();
  let lastError;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetchWithTimeout(url, {}, 10000);
      if (response.status >= 200 && response.status < 400) {
        return true;
      }
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for ${url}: ${lastError?.message ?? "no response"}`);
}

async function waitForHttpGone(url, timeoutMs = 10000) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      await fetchWithTimeout(url, {}, 1000);
    } catch {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  throw new Error(`Timed out waiting for ${url} to stop responding`);
}

export async function findFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

function parsePort(baseUrl) {
  const url = new URL(baseUrl);
  if (url.port) {
    return url.port;
  }
  return url.protocol === "https:" ? "443" : "80";
}

export function isRecoverableNavigationState({
  currentHref,
  targetHref,
  readyState,
  text,
}) {
  if (currentHref !== targetHref) return false;
  if (readyState === "interactive" || readyState === "complete") return true;
  return typeof text === "string" && text.trim().length > 0;
}

export function buildSmokeHealthUrl(baseUrl) {
  return `${baseUrl}${SMOKE_HEALTH_PATH}`;
}

export function buildSmokeDevServerCommand(
  baseUrl,
  { nodePath = process.execPath } = {},
) {
  return {
    command: nodePath,
    args: [
      "node_modules/next/dist/bin/next",
      "dev",
      "--webpack",
      "-p",
      parsePort(baseUrl),
    ],
  };
}

export async function stopDevServer(devServer) {
  if (!devServer) return;

  const healthUrl = devServer.__popsdropsHealthUrl;
  const exited = new Promise((resolve) => {
    if (devServer.exitCode !== null || devServer.signalCode !== null) {
      resolve();
      return;
    }
    devServer.once("exit", resolve);
  });

  if (process.platform !== "win32" && devServer.pid) {
    try {
      process.kill(-devServer.pid, "SIGTERM");
    } catch (error) {
      if (error?.code !== "ESRCH") {
        devServer.kill("SIGTERM");
      }
    }
  } else {
    devServer.kill("SIGTERM");
  }

  await Promise.race([
    exited,
    new Promise((resolve) => setTimeout(resolve, 5000)),
  ]);

  if (healthUrl) {
    await waitForHttpGone(healthUrl);
  }
}

export async function ensureDevServer(baseUrl) {
  const healthUrl = buildSmokeHealthUrl(baseUrl);

  try {
    await waitForHttp(healthUrl, 3000);
    return null;
  } catch {
    const startDevServer = () => {
      const SMOKE_DEV_SERVER_ARGS = buildSmokeDevServerCommand(baseUrl);
      const devServer = spawn(SMOKE_DEV_SERVER_ARGS.command, SMOKE_DEV_SERVER_ARGS.args, {
        cwd: process.cwd(),
        env: process.env,
        stdio: ["ignore", "pipe", "pipe"],
        detached: process.platform !== "win32",
      });
      devServer.__popsdropsHealthUrl = healthUrl;

      devServer.stdout.on("data", (chunk) => {
        process.stdout.write(`[dev] ${chunk}`);
      });
      devServer.stderr.on("data", (chunk) => {
        process.stderr.write(`[dev] ${chunk}`);
      });

      return devServer;
    };

    let devServer = startDevServer();
    try {
      await waitForHttp(healthUrl, 120000);
      return devServer;
    } catch (error) {
      await stopDevServer(devServer).catch(() => {});
      await rm(".next", { recursive: true, force: true });
      process.stderr.write(
        `[dev] Retry once after clearing .next because ${error.message}\n`,
      );
      devServer = startDevServer();
      try {
        await waitForHttp(healthUrl, 120000);
        return devServer;
      } catch (retryError) {
        await stopDevServer(devServer).catch(() => {});
        throw retryError;
      }
    }
  }
}

function getChromePath() {
  if (process.env.CHROME_PATH) {
    return process.env.CHROME_PATH;
  }

  return CHROME_PATHS[0];
}

export async function launchChrome({ debugPort, userDataDir }) {
  const chromePath = getChromePath();
  const chrome = spawn(
    chromePath,
    [
      "--headless=new",
      `--remote-debugging-port=${debugPort}`,
      "--remote-debugging-address=127.0.0.1",
      `--user-data-dir=${userDataDir}`,
      "--window-size=1280,720",
      "--disable-extensions",
      "--disable-background-networking",
      "--disable-default-apps",
      "--disable-sync",
      "--no-first-run",
      "--no-default-browser-check",
      "about:blank",
    ],
    {
      stdio: ["ignore", "ignore", "pipe"],
    },
  );

  chrome.stderr.on("data", () => {});

  try {
    await waitForHttp(`http://127.0.0.1:${debugPort}/json/version`, 45000);
    return chrome;
  } catch (error) {
    chrome.kill();
    throw error;
  }
}

export async function createCdpPage(debugPort) {
  const response = await fetchWithTimeout(
    `http://127.0.0.1:${debugPort}/json/new?about:blank`,
    { method: "PUT" },
    5000,
  );
  if (!response.ok) {
    throw new Error(`Unable to create Chrome target: ${response.status}`);
  }
  const target = await response.json();
  return new CdpClient(target.webSocketDebuggerUrl);
}

export async function evaluate(client, expression) {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  });

  if (result.exceptionDetails) {
    const description =
      result.exceptionDetails.exception?.description ||
      result.exceptionDetails.text ||
      "Evaluation failed";
    throw new Error(description);
  }

  return result.result?.value;
}

export async function waitForExpression(client, expression, description, timeoutMs = 90000) {
  const startedAt = Date.now();
  let lastError;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const value = await evaluate(client, expression);
      if (value) {
        return value;
      }
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  throw new Error(`Timed out waiting for ${description}: ${lastError?.message ?? "not ready"}`);
}

export async function waitForSmokePageSettled(
  client,
  { idleMs = 450, timeoutMs = 5000 } = {},
) {
  try {
    await evaluate(
      client,
      `((idleMs, timeoutMs) => new Promise((resolve) => {
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          resolve(true);
        };
        const settle = () => {
          requestAnimationFrame(() => setTimeout(finish, idleMs));
        };

        setTimeout(finish, timeoutMs);
        if (document.readyState === "loading") {
          window.addEventListener("DOMContentLoaded", settle, { once: true });
          return;
        }
        settle();
      }))(${JSON.stringify(idleMs)}, ${JSON.stringify(timeoutMs)})`,
    );
  } catch {
    // about:blank or a torn-down page should never block the next intentional navigation.
    await new Promise((resolve) => setTimeout(resolve, Math.min(idleMs, 250)));
  }
}

function getSmokeNetworkIdleState(client) {
  if (client.__popsdropsSmokeNetworkIdleState) {
    return client.__popsdropsSmokeNetworkIdleState;
  }

  const state = {
    enabled: null,
    inFlight: new Set(),
    lastActivityAt: Date.now(),
  };

  const shouldTrackRequest = (event) => {
    const url = event.request?.url || "";
    if (!/^https?:\/\//.test(url)) return false;
    return event.type !== "WebSocket" && event.type !== "EventSource";
  };

  const markComplete = (event) => {
    if (!event.requestId) return;
    state.inFlight.delete(event.requestId);
    state.lastActivityAt = Date.now();
  };

  client.on("Network.requestWillBeSent", (event) => {
    if (!event.requestId || !shouldTrackRequest(event)) return;
    state.inFlight.add(event.requestId);
    state.lastActivityAt = Date.now();
  });
  client.on("Network.loadingFinished", markComplete);
  client.on("Network.loadingFailed", markComplete);

  client.__popsdropsSmokeNetworkIdleState = state;
  return state;
}

export async function waitForSmokeNetworkIdle(
  client,
  { idleMs = 900, timeoutMs = 10000, pollMs = 100 } = {},
) {
  const state = getSmokeNetworkIdleState(client);
  state.enabled ??= client.send("Network.enable").catch(() => false);
  await state.enabled;

  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const quietForMs = Date.now() - state.lastActivityAt;
    if (state.inFlight.size === 0 && quietForMs >= idleMs) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  return false;
}

export async function navigate(client, url) {
  const NAVIGATE_RETRY_ATTEMPTS = 2;

  async function getNavigationState() {
    return evaluate(
      client,
      `(() => ({
        href: location.href,
        readyState: document.readyState,
        text: document.body?.innerText?.replace(/\\s+/g, " ").slice(0, 500) || "",
      }))()`,
    );
  }

  let lastError;
  let lastState = null;

  for (let attempt = 1; attempt <= NAVIGATE_RETRY_ATTEMPTS; attempt += 1) {
    try {
      await waitForSmokePageSettled(client);
      await waitForSmokeNetworkIdle(client);
      await client.send("Page.navigate", { url });
      await waitForExpression(
        client,
        'document.readyState === "interactive" || document.readyState === "complete"',
        `page load for ${url}`,
      );
      return;
    } catch (error) {
      lastError = error;
      lastState = await getNavigationState().catch(() => null);

      try {
        const targetHref = new URL(url).toString();
        const currentHref = new URL(lastState?.href || "").toString();
        if (
          isRecoverableNavigationState({
            currentHref,
            targetHref,
            readyState: lastState.readyState,
            text: lastState.text,
          })
        ) {
          return;
        }
      } catch {
        // Ignore URL parsing during recovery; the final error carries the browser state.
      }

      const isNavigateTimeout = error.message.includes(
        "Timed out waiting for Chrome DevTools Page.navigate response",
      );
      if (!isNavigateTimeout || attempt === NAVIGATE_RETRY_ATTEMPTS) {
        break;
      }

      await client.send("Page.stopLoading").catch(() => {});
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      await waitForExpression(
        client,
        "true",
        `navigation retry after Page.navigate timeout for ${url}`,
        1000,
      );
    }
  }

  throw new Error(
    `Navigation to ${url} failed after ${NAVIGATE_RETRY_ATTEMPTS} attempts. Last state: ${
      lastState ? `${lastState.href} | ${lastState.readyState} | ${lastState.text}` : "unavailable"
    }. Cause: ${lastError?.message ?? "unknown"}`,
  );
}

export async function loginForSmoke(
  client,
  {
    loginUrl,
    expectedUrlPrefix,
    description,
    attempts = 3,
    timeoutMs = 30000,
    retryDelayMs = 600,
  },
) {
  function getLoginExpectedRouteFallbackUrl(urlPrefix) {
    try {
      const url = new URL(urlPrefix);
      const { pathname } = url;

      if (
        pathname === "/b/campaigns" ||
        pathname === "/i/home" ||
        pathname === "/admin"
      ) {
        return url.toString();
      }
    } catch {
      return null;
    }

    return null;
  }

  const expectedRouteFallbackUrl =
    getLoginExpectedRouteFallbackUrl(expectedUrlPrefix);
  let lastState = "not attempted";

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await navigate(client, loginUrl);
      await waitForExpression(
        client,
        `location.href.startsWith(${JSON.stringify(expectedUrlPrefix)})`,
        `${description} attempt ${attempt}`,
        timeoutMs,
      );
      return;
    } catch (error) {
      const browserState = await evaluate(
        client,
        `(() => {
          const text = document.body?.innerText?.replace(/\\s+/g, " ").slice(0, 500) || "";
          return location.href + " | " + text;
        })()`,
      ).catch(() => error.message);
      lastState = browserState || error.message;

      if (expectedRouteFallbackUrl) {
        try {
          await navigate(client, expectedRouteFallbackUrl);
          await waitForExpression(
            client,
            `location.href.startsWith(${JSON.stringify(expectedUrlPrefix)})`,
            `${description} attempt ${attempt} login fallback to expected route`,
            timeoutMs,
          );
          return;
        } catch (fallbackError) {
          const fallbackState = await evaluate(
            client,
            `(() => {
              const text = document.body?.innerText?.replace(/\\s+/g, " ").slice(0, 500) || "";
              return location.href + " | " + text;
            })()`,
          ).catch(() => fallbackError.message);
          lastState = `${lastState}; login fallback to expected route failed: ${
            fallbackState || fallbackError.message
          }`;
        }
      }

      if (attempt === attempts) {
        throw new Error(
          `${description} failed after ${attempts} attempts. Last browser state: ${lastState}`,
        );
      }

      await new Promise((resolve) => setTimeout(resolve, retryDelayMs * attempt));
    }
  }
}

export async function clickTab(client, label) {
  await waitForExpression(
    client,
    `([...document.querySelectorAll('[role="tab"]')]
      .some((node) => node.textContent.includes(${JSON.stringify(label)})))`,
    `${label} tab`,
  );
  await evaluate(
    client,
    `(() => {
      const tab = [...document.querySelectorAll('[role="tab"]')]
        .find((node) => node.textContent.includes(${JSON.stringify(label)}));
      if (!tab) throw new Error("Missing tab: ${label}");
      tab.click();
      return true;
    })()`,
  );
}

async function clickContentStatusSort(client) {
  await clickTab(client, "Content");
  await waitForExpression(
    client,
    'Boolean(document.querySelector(\'[data-testid="campaign-content-sort-header"]\'))',
    "content tab",
  );
  await evaluate(
    client,
    `(() => {
      const button = [...document.querySelectorAll('[data-testid="campaign-content-sort-header"]')]
        .find((node) => node.textContent.includes("Status"));
      if (!button) throw new Error("Missing Status sort button");
      button.click();
      return true;
    })()`,
  );

  return waitForExpression(
    client,
    `(() => {
      const button = [...document.querySelectorAll('[data-testid="campaign-content-sort-header"]')]
        .find((node) => node.textContent.includes("Status"));
      return button?.closest("th")?.getAttribute("aria-sort") === "ascending"
        ? "ascending"
        : "";
    })()`,
    "Status column ascending sort",
  );
}

async function runCampaignDetailSmoke() {
  const targets = buildSmokeTargets();
  const screenshotPath = path.resolve(
    process.env.SMOKE_SCREENSHOT_PATH || DEFAULT_SCREENSHOT_PATH,
  );
  const devServer = await ensureDevServer(targets.baseUrl);
  const debugPort = await findFreePort();
  const userDataDir = await mkdtemp(path.join(tmpdir(), "popsdrops-smoke-chrome-"));
  let chrome;
  let client;
  const consoleErrors = [];
  const smokeEvidence = [];

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

    await client.send("Page.enable");
    await client.send("Runtime.enable");

    await loginForSmoke(client, {
      loginUrl: targets.loginUrl,
      expectedUrlPrefix: `${targets.baseUrl}/b/campaigns`,
      description: "brand dev login redirect",
    });

    await navigate(client, targets.campaignUrl);
    await waitForExpression(
      client,
      'document.body.innerText.includes("Chrome Launch Smoke Campaign")',
      "campaign detail title",
    );
    smokeEvidence.push(await evaluate(client, "document.body.innerText"));

    const overviewLabel = await evaluate(
      client,
      `(() => {
        const tab = [...document.querySelectorAll('[role="tab"]')]
          .find((node) => node.textContent.includes("Overview"));
        return tab?.innerText || "";
      })()`,
    );
    const quickActionsCount = await evaluate(
      client,
      'document.querySelectorAll(\'[data-testid="campaign-controls"]\').length',
    );
    const tabRailClass = await evaluate(
      client,
      'document.querySelector(\'[data-testid="campaign-detail-tab-rail"]\')?.className || ""',
    );
    await navigate(client, `${targets.campaignUrl}?tab=content`);
    await waitForExpression(
      client,
      'Boolean(document.querySelector(\'[data-testid="campaign-handoff-rail"]\'))',
      "direct content tab link",
    );
    const directContentTabLabel = await evaluate(
      client,
      `(() => {
        const tab = [...document.querySelectorAll('[role="tab"]')]
          .find((node) => node.getAttribute("aria-selected") === "true");
        return tab?.innerText || "";
      })()`,
    );
    await navigate(client, await evaluate(client, "location.href"));
    await waitForExpression(
      client,
      'Boolean(document.querySelector(\'[data-testid="campaign-handoff-rail"]\'))',
      "content tab refresh",
    );
    const contentUrlAfterReload = await evaluate(client, "location.href");

    await clickTab(client, "Setup");
    await waitForExpression(
      client,
      'document.body.innerText.includes("Creative Kit") && document.body.innerText.includes("Campaign Rules")',
      "brief tab proof",
    );
    smokeEvidence.push(await evaluate(client, "document.body.innerText"));

    const statusSort = await clickContentStatusSort(client);
    const contentUrlAfterClick = await evaluate(client, "location.href");
    smokeEvidence.push(await evaluate(client, "document.body.innerText"));

    await clickTab(client, "Reporting");
    await waitForExpression(
      client,
      'document.body.innerText.includes("Reporting Operations") && document.body.innerText.includes("View Report")',
      "reporting tab proof",
    );
    const reportingUrlAfterClick = await evaluate(client, "location.href");
    smokeEvidence.push(await evaluate(client, "document.body.innerText"));

    validateCampaignDetailSmoke({
      bodyText: smokeEvidence.join("\n"),
      overviewLabel,
      quickActionsCount,
      tabRailClass,
      directContentTabLabel,
      contentUrlAfterReload,
      contentUrlAfterClick,
      reportingUrlAfterClick,
      statusSort,
      consoleErrors,
    });

    const screenshot = await client.send("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: false,
    });
    await writeFile(screenshotPath, Buffer.from(screenshot.data, "base64"));

    return {
      ok: true,
      baseUrl: targets.baseUrl,
      campaignUrl: targets.campaignUrl,
      screenshotPath,
      devServerStarted: Boolean(devServer),
    };
  } finally {
    client?.close();
    chrome?.kill();
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
  runCampaignDetailSmoke()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}
