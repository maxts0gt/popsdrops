import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./smoke-campaign-responsibilities.mjs", import.meta.url),
  "utf8",
);
const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8"),
);

describe("campaign responsibilities smoke", () => {
  it("drives the real campaign responsibility panel and verifies durable state", () => {
    expect(source).toContain("campaign-responsibility-panel");
    expect(source).toContain("campaign-responsibility-select-reporting");
    expect(source).toContain("campaign-responsibility-select-approvals");
    expect(source).toContain("campaign-responsibility-assignee-reporting");
    expect(source).toContain("campaign-content-approval-owner");
    expect(source).toContain("campaign-reporting-owner");
    expect(source).toContain("campaign-reporting-proof-queue-owner");
    expect(source).toContain("campaign-content-queue-filter-my_work");
    expect(source).toContain("campaign-content-queue-filter-needs_review");
    expect(source).toContain("campaign-reporting-proof-filter-my_work");
    expect(source).toContain("campaign-reporting-proof-filter-needs_review");
    expect(source).toContain("campaign-list-responsibilities");
    expect(source).toContain("campaign-list-responsibility-reporting");
    expect(source).toContain("campaign-work-filter-mine");
    expect(source).toContain("campaign-work-filter-needs-owner");
    expect(source).toContain("campaign_responsibility_assignments");
    expect(source).toContain("campaign_responsibility_updated");
    expect(source).toContain("output/playwright/campaign-responsibilities-smoke.png");
    expect(source).toContain("output/playwright/campaign-responsibility-list-smoke.png");
    expect(source).toContain("output/playwright/campaign-responsibility-my-work-smoke.png");
    expect(source).toContain("output/playwright/campaign-responsibility-needs-owner-smoke.png");
    expect(source).toContain("output/playwright/campaign-responsibility-content-owner-smoke.png");
    expect(source).toContain("output/playwright/campaign-responsibility-reporting-owner-smoke.png");
  });

  it("is available as a named smoke command", () => {
    expect(packageJson.scripts["smoke:campaign-responsibilities"]).toBe(
      "node scripts/smoke-campaign-responsibilities.mjs",
    );
  });
});
