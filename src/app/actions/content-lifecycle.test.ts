import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const contentActionsSource = readFileSync(
  new URL("./content.ts", import.meta.url),
  "utf8",
);
const lifecycleSource = readFileSync(
  new URL("../../lib/campaigns/lifecycle.ts", import.meta.url),
  "utf8",
);

describe("campaign content review lifecycle guard", () => {
  it("guards brand-side content decisions behind active campaign work stages", () => {
    expect(contentActionsSource).toContain("assertCampaignAllowsContentDecision");
    expect(lifecycleSource).toContain(
      '["in_progress", "publishing", "monitoring"]',
    );
    expect(lifecycleSource).toContain(
      'throw new Error("Content decisions are closed for this campaign stage.")',
    );

    const guardedFunctions = [
      "export async function approveContent",
      "export async function requestRevision",
    ];

    for (const functionName of guardedFunctions) {
      const functionSource = contentActionsSource.slice(
        contentActionsSource.indexOf(functionName),
        contentActionsSource.indexOf(
          "export async function",
          contentActionsSource.indexOf(functionName) + 1,
        ),
      );
      expect(functionSource).toContain(
        "assertCampaignAllowsContentDecision(member.campaigns);",
      );
    }
  });

  it("guards creator-side content work behind active campaign work stages", () => {
    expect(contentActionsSource).toContain("assertCampaignAllowsCreatorWork");
    expect(lifecycleSource).toContain(
      'throw new Error("Creator work is closed for this campaign stage.")',
    );

    const guardedFunctions = [
      {
        name: "export async function submitContent",
        assertion: "assertCampaignAllowsCreatorWork(memberCampaign);",
      },
      {
        name: "export async function publishContent",
        assertion: "assertCampaignAllowsCreatorWork(member.campaigns);",
      },
      {
        name: "export async function submitPerformance",
        assertion: "assertCampaignAllowsCreatorWork(member.campaigns);",
      },
    ];

    for (const { name, assertion } of guardedFunctions) {
      const functionSource = contentActionsSource.slice(
        contentActionsSource.indexOf(name),
        contentActionsSource.indexOf(
          "export async function",
          contentActionsSource.indexOf(name) + 1,
        ),
      );
      expect(functionSource).toContain(assertion);
    }
  });
});
