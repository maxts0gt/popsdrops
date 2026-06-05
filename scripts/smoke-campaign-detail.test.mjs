import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  DEFAULT_CAMPAIGN_ID,
  buildSmokeDevServerCommand,
  buildSmokeTargets,
  isRecoverableNavigationState,
  validateCampaignDetailSmoke,
} from "./smoke-campaign-detail.mjs";

const smokeCampaignDetailSource = readFileSync(
  new URL("./smoke-campaign-detail.mjs", import.meta.url),
  "utf8",
);
const browserLoginSmokeFiles = [
  "smoke-campaign-detail.mjs",
  "smoke-creator-campaign.mjs",
  "smoke-public-apply.mjs",
  "smoke-campaign-service-fee-gate.mjs",
  "smoke-application-flow.mjs",
  "smoke-application-acceptance.mjs",
  "smoke-counter-offer.mjs",
  "smoke-content-report-workflow.mjs",
  "smoke-content-report-recovery.mjs",
  "smoke-content-report-late.mjs",
  "smoke-content-report-excused.mjs",
  "smoke-product-notification-actions.mjs",
];

describe("campaign detail smoke script contract", () => {
  it("defaults to the Chrome-safe local host and campaign detail route", () => {
    expect(buildSmokeTargets({})).toEqual({
      baseUrl: "http://127.0.0.1:4000",
      campaignId: DEFAULT_CAMPAIGN_ID,
      loginUrl: "http://127.0.0.1:4000/auth/dev-login?role=brand",
      campaignUrl: `http://127.0.0.1:4000/b/campaigns/${DEFAULT_CAMPAIGN_ID}`,
    });
  });

  it("rejects a rendered shell that is missing campaign detail proof", () => {
    expect(() =>
      validateCampaignDetailSmoke({
        bodyText: "PopsDrops Home Campaigns Network",
        overviewLabel: "Overview Completed",
        quickActionsCount: 0,
        tabRailClass: "sticky top-0 z-20 backdrop-blur",
        directContentTabLabel: "Content 1/1",
        contentUrlAfterReload: "http://127.0.0.1:4000/b/campaigns/demo?tab=content",
        contentUrlAfterClick: "http://127.0.0.1:4000/b/campaigns/demo?tab=content",
        reportingUrlAfterClick: "http://127.0.0.1:4000/b/campaigns/demo?tab=reporting",
        statusSort: "ascending",
        consoleErrors: [],
      }),
    ).toThrow(/campaign title/i);
  });

  it("rejects a campaign workspace whose tab rail will scroll away", () => {
    expect(() =>
      validateCampaignDetailSmoke({
        bodyText:
          "Chrome Launch Smoke Campaign Overview Completed Creative Kit Campaign Rules Reporting Operations View Report",
        overviewLabel: "Overview Completed",
        quickActionsCount: 0,
        tabRailClass: "mb-5 w-full overflow-x-auto",
        directContentTabLabel: "Content 1/1",
        contentUrlAfterReload: "http://127.0.0.1:4000/b/campaigns/demo?tab=content",
        contentUrlAfterClick: "http://127.0.0.1:4000/b/campaigns/demo?tab=content",
        reportingUrlAfterClick: "http://127.0.0.1:4000/b/campaigns/demo?tab=reporting",
        statusSort: "ascending",
        consoleErrors: [],
      }),
    ).toThrow(/workspace tab rail/i);
  });

  it("rejects a sticky tab rail that can hide behind the mobile brand header", () => {
    expect(() =>
      validateCampaignDetailSmoke({
        bodyText:
          "Chrome Launch Smoke Campaign Overview Completed Creative Kit Campaign Rules Reporting Operations View Report",
        overviewLabel: "Overview Completed",
        quickActionsCount: 0,
        tabRailClass: "sticky top-0 z-20 backdrop-blur",
        directContentTabLabel: "Content 1/1",
        contentUrlAfterReload: "http://127.0.0.1:4000/b/campaigns/demo?tab=content",
        contentUrlAfterClick: "http://127.0.0.1:4000/b/campaigns/demo?tab=content",
        reportingUrlAfterClick: "http://127.0.0.1:4000/b/campaigns/demo?tab=reporting",
        statusSort: "ascending",
        consoleErrors: [],
      }),
    ).toThrow(/workspace tab rail/i);
  });

  it("rejects campaign tabs that do not survive direct links and refresh", () => {
    expect(() =>
      validateCampaignDetailSmoke({
        bodyText:
          "Chrome Launch Smoke Campaign Overview Completed Creative Kit Campaign Rules Reporting Operations View Report",
        overviewLabel: "Overview Completed",
        quickActionsCount: 0,
        tabRailClass: "sticky top-14 z-20 backdrop-blur lg:top-0",
        directContentTabLabel: "Overview Completed",
        contentUrlAfterReload: "http://127.0.0.1:4000/b/campaigns/demo",
        contentUrlAfterClick: "http://127.0.0.1:4000/b/campaigns/demo",
        reportingUrlAfterClick: "http://127.0.0.1:4000/b/campaigns/demo",
        statusSort: "ascending",
        consoleErrors: [],
      }),
    ).toThrow(/URL-addressable campaign tabs/i);
  });

  it("rejects singular command-center counts rendered with plural nouns", () => {
    expect(() =>
      validateCampaignDetailSmoke({
        bodyText:
          "Chrome Launch Smoke Campaign Overview Completed Creative Kit Campaign Rules Reporting Operations View Report 1 creators need to resubmit proof.",
        overviewLabel: "Overview Completed",
        quickActionsCount: 0,
        tabRailClass: "sticky top-14 z-20 backdrop-blur lg:top-0",
        directContentTabLabel: "Content 1/1",
        contentUrlAfterReload: "http://127.0.0.1:4000/b/campaigns/demo?tab=content",
        contentUrlAfterClick: "http://127.0.0.1:4000/b/campaigns/demo?tab=content",
        reportingUrlAfterClick: "http://127.0.0.1:4000/b/campaigns/demo?tab=reporting",
        statusSort: "ascending",
        consoleErrors: [],
      }),
    ).toThrow(/singular command-center grammar/i);
  });

  it("accepts the intended completed campaign workspace state", () => {
    expect(
      validateCampaignDetailSmoke({
        bodyText:
          "Chrome Launch Smoke Campaign Overview Completed Creative Kit Campaign Rules Reporting Operations View Report",
        overviewLabel: "Overview Completed",
        quickActionsCount: 0,
        tabRailClass: "sticky top-14 z-20 backdrop-blur lg:top-0",
        directContentTabLabel: "Content 1/1",
        contentUrlAfterReload: "http://127.0.0.1:4000/b/campaigns/demo?tab=content",
        contentUrlAfterClick: "http://127.0.0.1:4000/b/campaigns/demo?tab=content",
        reportingUrlAfterClick: "http://127.0.0.1:4000/b/campaigns/demo?tab=reporting",
        statusSort: "ascending",
        consoleErrors: [],
      }),
    ).toEqual({ ok: true });
  });

  it("recovers navigation when Chrome misses the response but the target body is visible", () => {
    expect(
      isRecoverableNavigationState({
        currentHref: "http://127.0.0.1:4000/b/campaigns/demo",
        targetHref: "http://127.0.0.1:4000/b/campaigns/demo",
        readyState: "loading",
        text: "PopsDrops Campaigns Network",
      }),
    ).toBe(true);

    expect(
      isRecoverableNavigationState({
        currentHref: "http://127.0.0.1:4000/b/campaigns/demo",
        targetHref: "http://127.0.0.1:4000/b/campaigns/demo",
        readyState: "loading",
        text: "",
      }),
    ).toBe(false);
  });

  it("does not leak Chrome when the remote debugging endpoint is slow", () => {
    const launchChromeSource = smokeCampaignDetailSource.slice(
      smokeCampaignDetailSource.indexOf("export async function launchChrome"),
      smokeCampaignDetailSource.indexOf("export async function createCdpPage"),
    );

    expect(launchChromeSource).toContain("try {");
    expect(launchChromeSource).toContain("chrome.kill()");
    expect(launchChromeSource).toContain("throw error");
    expect(launchChromeSource).toContain("/json/version`, 45000");
  });

  it("keeps browser dev login waits retryable with useful failure state", () => {
    const loginHelperSource = smokeCampaignDetailSource.slice(
      smokeCampaignDetailSource.indexOf("export async function loginForSmoke"),
      smokeCampaignDetailSource.indexOf("export async function clickTab"),
    );

    expect(loginHelperSource).toContain("attempt <= attempts");
    expect(loginHelperSource).toContain("timeoutMs = 30000");
    expect(loginHelperSource).toContain("Last browser state");
    expect(loginHelperSource).toContain("location.href.startsWith");
  });

  it("bounds every Chrome DevTools Protocol command so browser smokes cannot hang forever", () => {
    const cdpClientSource = smokeCampaignDetailSource.slice(
      smokeCampaignDetailSource.indexOf("class CdpClient"),
      smokeCampaignDetailSource.indexOf("async function fetchWithTimeout"),
    );

    expect(cdpClientSource).toContain("commandTimeoutMs");
    expect(cdpClientSource).toContain("setTimeout");
    expect(cdpClientSource).toContain("this.pending.delete(id)");
    expect(cdpClientSource).toContain("Timed out waiting for Chrome DevTools");
    expect(cdpClientSource).toContain("clearTimeout(timeout)");
  });

  it("does not treat missing app routes as a ready dev server", () => {
    const waitForHttpSource = smokeCampaignDetailSource.slice(
      smokeCampaignDetailSource.indexOf("async function waitForHttp"),
      smokeCampaignDetailSource.indexOf("export async function findFreePort"),
    );

    expect(waitForHttpSource).toContain("response.status >= 200");
    expect(waitForHttpSource).toContain("response.status < 400");
    expect(waitForHttpSource).not.toContain("response.status < 500");
  });

  it("uses a tiny app route as the browser smoke health route", () => {
    const healthRouteSource = readFileSync(
      new URL("../src/app/api/smoke/health/route.ts", import.meta.url),
      "utf8",
    );

    expect(smokeCampaignDetailSource).toContain(
      "SMOKE_HEALTH_PATH = \"/api/smoke/health\"",
    );
    expect(smokeCampaignDetailSource).toContain("buildSmokeHealthUrl(baseUrl)");
    expect(smokeCampaignDetailSource).not.toContain("SMOKE_HEALTH_PATH = \"/dev/login\"");
    expect(healthRouteSource).toContain("export async function GET");
    expect(healthRouteSource).toContain('process.env.NODE_ENV === "production"');
    expect(healthRouteSource).toContain("NextResponse.json");
  });

  it("stops the whole spawned Next dev-server group before the next smoke lane starts", () => {
    const ensureDevServerSource = smokeCampaignDetailSource.slice(
      smokeCampaignDetailSource.indexOf("export async function ensureDevServer"),
      smokeCampaignDetailSource.indexOf("function getChromePath"),
    );
    const stopDevServerSource = smokeCampaignDetailSource.slice(
      smokeCampaignDetailSource.indexOf("export async function stopDevServer"),
      smokeCampaignDetailSource.indexOf("export async function ensureDevServer"),
    );

    expect(ensureDevServerSource).toContain("detached: process.platform !== \"win32\"");
    expect(stopDevServerSource).toContain("process.kill(-devServer.pid");
    expect(stopDevServerSource).toContain("await waitForHttpGone");
  });

  it("recovers once from a poisoned Next dev route cache before failing smoke startup", () => {
    const ensureDevServerSource = smokeCampaignDetailSource.slice(
      smokeCampaignDetailSource.indexOf("export async function ensureDevServer"),
      smokeCampaignDetailSource.indexOf("function getChromePath"),
    );

    expect(ensureDevServerSource).toContain("startDevServer");
    expect(ensureDevServerSource).toContain('await rm(".next"');
    expect(ensureDevServerSource).toContain("recursive: true");
    expect(ensureDevServerSource).toContain("force: true");
    expect(ensureDevServerSource).toContain("await stopDevServer(devServer)");
    expect(ensureDevServerSource).toContain("Retry once");
  });

  it("starts browser smoke dev servers with webpack to avoid Turbopack route-compiler panics", () => {
    const devServerCommandSource = smokeCampaignDetailSource.slice(
      smokeCampaignDetailSource.indexOf("export function buildSmokeDevServerCommand"),
      smokeCampaignDetailSource.indexOf("export async function stopDevServer"),
    );

    expect(devServerCommandSource).toContain('"--webpack"');
    expect(smokeCampaignDetailSource).toContain("SMOKE_DEV_SERVER_ARGS");
    expect(devServerCommandSource).not.toContain('"--turbo"');
    expect(devServerCommandSource).not.toContain('"--turbopack"');
  });

  it("starts browser smoke dev servers through the current Node runtime when npm is unavailable", () => {
    expect(
      buildSmokeDevServerCommand("http://127.0.0.1:4123", {
        nodePath: "/runtime/node",
      }),
    ).toEqual({
      command: "/runtime/node",
      args: [
        "node_modules/next/dist/bin/next",
        "dev",
        "--webpack",
        "-p",
        "4123",
      ],
    });
  });

  it("does not leave spawned dev servers alive across browser smoke scripts", () => {
    for (const fileName of browserLoginSmokeFiles) {
      const source = readFileSync(new URL(`./${fileName}`, import.meta.url), "utf8");
      expect(source).not.toContain("devServer?.kill()");
      expect(source).toContain("stopDevServer");
    }
  });

  it("does not treat missing app routes as an existing reusable dev server", () => {
    const applicationFlowSource = readFileSync(
      new URL("./smoke-application-flow.mjs", import.meta.url),
      "utf8",
    );
    const readinessSource = applicationFlowSource.slice(
      applicationFlowSource.indexOf("export async function isExistingDevServerReady"),
      applicationFlowSource.indexOf("export function createAdminClient"),
    );

    expect(readinessSource).toContain("response.status >= 200");
    expect(readinessSource).toContain("response.status < 400");
    expect(readinessSource).toContain("buildSmokeHealthUrl(baseUrl)");
    expect(readinessSource).not.toContain("response.status < 500");
    expect(readinessSource).not.toContain("`${baseUrl}/login`");
  });

  it("routes release browser smoke auth through the shared login helper", () => {
    for (const fileName of browserLoginSmokeFiles) {
      const source = readFileSync(new URL(`./${fileName}`, import.meta.url), "utf8");
      expect(source).not.toMatch(
        /await navigate\(client, targets\.(brandLoginUrl|creatorLoginUrl|loginUrl)\)/,
      );
      expect(source).toContain("loginForSmoke");
    }
  });

  it("expects brand dev login to land on the campaign operations index", () => {
    for (const fileName of browserLoginSmokeFiles) {
      const source = readFileSync(new URL(`./${fileName}`, import.meta.url), "utf8");
      expect(source).not.toContain('expectedUrlPrefix: `${targets.baseUrl}/b/home`');
      if (source.includes("role=brand") || source.includes("brandLoginUrl")) {
        expect(source).toContain('expectedUrlPrefix: `${targets.baseUrl}/b/campaigns`');
      }
    }
  });

  it("recovers smoke login when a redirect shim temporarily serves a not-found page", () => {
    const loginHelperSource = smokeCampaignDetailSource.slice(
      smokeCampaignDetailSource.indexOf("export async function loginForSmoke"),
      smokeCampaignDetailSource.indexOf("export async function clickTab"),
    );

    expect(loginHelperSource).toContain("getLoginExpectedRouteFallbackUrl");
    expect(loginHelperSource).toContain("login fallback to expected route");
    expect(loginHelperSource).toContain('pathname === "/b/campaigns"');
    expect(loginHelperSource).toContain('pathname === "/i/home"');
    expect(loginHelperSource).toContain('pathname === "/admin"');
    expect(loginHelperSource).toContain("await navigate(client, expectedRouteFallbackUrl)");
  });

  it("retries browser navigation when Chrome DevTools drops a Page.navigate response", () => {
    const navigateSource = smokeCampaignDetailSource.slice(
      smokeCampaignDetailSource.indexOf("export async function navigate"),
      smokeCampaignDetailSource.indexOf("export async function loginForSmoke"),
    );

    expect(navigateSource).toContain("NAVIGATE_RETRY_ATTEMPTS");
    expect(navigateSource).toContain("getNavigationState");
    expect(navigateSource).toContain("navigation retry after Page.navigate timeout");
    expect(navigateSource).toContain("Page.stopLoading");
    expect(navigateSource).toContain("Timed out waiting for Chrome DevTools Page.navigate response");
  });

  it("settles browser pages before smoke navigation to avoid aborting in-flight app requests", () => {
    const settleSource = smokeCampaignDetailSource.slice(
      smokeCampaignDetailSource.indexOf("export async function waitForSmokePageSettled"),
      smokeCampaignDetailSource.indexOf("export async function navigate"),
    );
    const navigateSource = smokeCampaignDetailSource.slice(
      smokeCampaignDetailSource.indexOf("export async function navigate"),
      smokeCampaignDetailSource.indexOf("export async function loginForSmoke"),
    );

    expect(settleSource).toContain("idleMs = 450");
    expect(settleSource).toContain("requestAnimationFrame");
    expect(settleSource).toContain("document.readyState");
    expect(settleSource).toContain("setTimeout");
    expect(navigateSource).toContain("await waitForSmokePageSettled(client)");
    expect(navigateSource.indexOf("await waitForSmokePageSettled(client)")).toBeLessThan(
      navigateSource.indexOf('client.send("Page.navigate"'),
    );
  });

  it("waits for tracked app network requests before starting the next smoke navigation", () => {
    const networkIdleSource = smokeCampaignDetailSource.slice(
      smokeCampaignDetailSource.indexOf("function getSmokeNetworkIdleState"),
      smokeCampaignDetailSource.indexOf("export async function navigate"),
    );
    const navigateSource = smokeCampaignDetailSource.slice(
      smokeCampaignDetailSource.indexOf("export async function navigate"),
      smokeCampaignDetailSource.indexOf("export async function loginForSmoke"),
    );

    expect(networkIdleSource).toContain('client.send("Network.enable")');
    expect(networkIdleSource).toContain('client.on("Network.requestWillBeSent"');
    expect(networkIdleSource).toContain('client.on("Network.loadingFinished"');
    expect(networkIdleSource).toContain('client.on("Network.loadingFailed"');
    expect(networkIdleSource).toContain("idleMs = 900");
    expect(networkIdleSource).toContain("timeoutMs = 10000");
    expect(navigateSource).toContain("await waitForSmokeNetworkIdle(client)");
    expect(navigateSource.indexOf("await waitForSmokeNetworkIdle(client)")).toBeLessThan(
      navigateSource.indexOf('client.send("Page.navigate"'),
    );
  });
});
