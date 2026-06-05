import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_CAMPAIGN_DEADLINE_BOUNDARY_CAMPAIGN_ID,
  DEADLINE_CONTENT_DUE_LIMIT_COPY,
  buildCampaignDeadlineBoundarySmokeTargets,
  validateCampaignDeadlineBoundarySmoke,
} from "./smoke-campaign-deadline-boundary.mjs";
import { SMOKE_CAMPAIGN_TITLE } from "./smoke-application-flow.mjs";

describe("campaign deadline boundary smoke contract", () => {
  it("targets a disposable recruiting campaign and the brand overview tab", () => {
    expect(buildCampaignDeadlineBoundarySmokeTargets({})).toEqual({
      baseUrl: "http://127.0.0.1:4000",
      campaignId: DEFAULT_CAMPAIGN_DEADLINE_BOUNDARY_CAMPAIGN_ID,
      brandLoginUrl: "http://127.0.0.1:4000/auth/dev-login?role=brand",
      brandCampaignUrl: `http://127.0.0.1:4000/b/campaigns/${DEFAULT_CAMPAIGN_DEADLINE_BOUNDARY_CAMPAIGN_ID}`,
      brandCampaignOverviewUrl: `http://127.0.0.1:4000/b/campaigns/${DEFAULT_CAMPAIGN_DEADLINE_BOUNDARY_CAMPAIGN_ID}?tab=overview`,
    });
  });

  it("rejects a rendered form that does not expose the content due boundary", () => {
    expect(() =>
      validateCampaignDeadlineBoundarySmoke({
        pageText: `${SMOKE_CAMPAIGN_TITLE} Change application deadline Save`,
        controlsText: "Applications close before creators need to publish.",
        inputMin: "2026-06-01",
        inputMax: "",
        contentDueDateKey: "2026-06-06",
        deadlineBefore: "2026-06-03T00:00:00.000Z",
        deadlineAfter: "2026-06-04T00:00:00.000Z",
        invalidSaveErrorText: DEADLINE_CONTENT_DUE_LIMIT_COPY,
        consoleErrors: [],
        serverErrors: [],
      }),
    ).toThrow(/content due date max/i);
  });

  it("accepts the form only when UI and database both keep applications inside the timeline", () => {
    expect(
      validateCampaignDeadlineBoundarySmoke({
        pageText: `${SMOKE_CAMPAIGN_TITLE} Change application deadline Save`,
        controlsText: DEADLINE_CONTENT_DUE_LIMIT_COPY,
        inputMin: "2026-06-01",
        inputMax: "2026-06-06",
        contentDueDateKey: "2026-06-06",
        deadlineBefore: "2026-06-03T00:00:00.000Z",
        deadlineAfter: "2026-06-03T00:00:00.000Z",
        invalidSaveErrorText: DEADLINE_CONTENT_DUE_LIMIT_COPY,
        consoleErrors: [],
        serverErrors: [],
      }),
    ).toEqual({ ok: true });
  });

  it("rejects server errors from the invalid save path", () => {
    expect(() =>
      validateCampaignDeadlineBoundarySmoke({
        pageText: `${SMOKE_CAMPAIGN_TITLE} Change application deadline Save`,
        controlsText: DEADLINE_CONTENT_DUE_LIMIT_COPY,
        inputMin: "2026-06-01",
        inputMax: "2026-06-06",
        contentDueDateKey: "2026-06-06",
        deadlineBefore: "2026-06-03T00:00:00.000Z",
        deadlineAfter: "2026-06-03T00:00:00.000Z",
        invalidSaveErrorText: DEADLINE_CONTENT_DUE_LIMIT_COPY,
        consoleErrors: [],
        serverErrors: [
          "500 http://127.0.0.1:4000/b/campaigns/a0000000-0000-4000-8000-000000000117?tab=overview",
        ],
      }),
    ).toThrow(/server errors/i);
  });

  it("requires the invalid save to show an inline deadline error", () => {
    expect(() =>
      validateCampaignDeadlineBoundarySmoke({
        pageText: `${SMOKE_CAMPAIGN_TITLE} Change application deadline Save`,
        controlsText: DEADLINE_CONTENT_DUE_LIMIT_COPY,
        inputMin: "2026-06-01",
        inputMax: "2026-06-06",
        contentDueDateKey: "2026-06-06",
        deadlineBefore: "2026-06-03T00:00:00.000Z",
        deadlineAfter: "2026-06-03T00:00:00.000Z",
        invalidSaveErrorText: "",
        consoleErrors: [],
        serverErrors: [],
      }),
    ).toThrow(/inline deadline boundary error/i);
  });

  it("ships as a package smoke and proves the invalid save path", () => {
    const smokeSource = readFileSync(
      new URL("./smoke-campaign-deadline-boundary.mjs", import.meta.url),
      "utf8",
    );
    const packageJson = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf8"),
    );

    expect(smokeSource).toContain("runCampaignDeadlineBoundarySmoke");
    expect(smokeSource).toContain("validateCampaignDeadlineBoundarySmoke");
    expect(smokeSource).toContain("Change application deadline");
    expect(smokeSource).toContain("content_due_date");
    expect(smokeSource).toContain(DEADLINE_CONTENT_DUE_LIMIT_COPY);
    expect(smokeSource).toContain("campaign-deadline-boundary-smoke.png");
    expect(smokeSource).toContain("deadlineAfter");
    expect(smokeSource).toContain("Network.responseReceived");
    expect(smokeSource).toContain("serverErrors");
    expect(smokeSource).toContain("inline invalid campaign deadline error");
    expect(packageJson.scripts["smoke:campaign-deadline-boundary"]).toBe(
      "node scripts/smoke-campaign-deadline-boundary.mjs",
    );
    expect(fileURLToPath(new URL("./smoke-campaign-deadline-boundary.mjs", import.meta.url))).toMatch(
      /smoke-campaign-deadline-boundary\.mjs$/,
    );
  });
});
