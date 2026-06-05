import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const reportingEvidenceSource = readFileSync(
  new URL("./reporting-evidence.ts", import.meta.url),
  "utf8",
);
const lifecycleSource = readFileSync(
  new URL("../../lib/campaigns/lifecycle.ts", import.meta.url),
  "utf8",
);

describe("campaign proof review lifecycle guard", () => {
  it("guards brand-side proof decisions behind active campaign work stages", () => {
    expect(reportingEvidenceSource).toContain("assertCampaignAllowsProofDecision");
    expect(lifecycleSource).toContain(
      '["in_progress", "publishing", "monitoring"]',
    );
    expect(lifecycleSource).toContain(
      'throw new Error("Proof decisions are closed for this campaign stage.")',
    );

    const guardedFunctions = [
      {
        name: "export async function reviewPerformanceEvidence",
        assertion: "assertCampaignAllowsProofDecision(campaignForReview);",
      },
      {
        name: "export async function reviewPerformanceProofLink",
        assertion: "assertCampaignAllowsProofDecision(taskCampaign);",
      },
      {
        name: "export async function markReportTaskExcused",
        assertion: "assertCampaignAllowsProofDecision(campaign);",
      },
      {
        name: "export async function requestMissedReportFollowUp",
        assertion: "assertCampaignAllowsProofDecision(campaign);",
      },
      {
        name: "export async function requestMissedReportFollowUpsBatch",
        assertion: "assertCampaignAllowsProofDecision(campaign);",
      },
    ];

    for (const { name, assertion } of guardedFunctions) {
      const functionSource = reportingEvidenceSource.slice(
        reportingEvidenceSource.indexOf(name),
        reportingEvidenceSource.indexOf(
          "export async function",
          reportingEvidenceSource.indexOf(name) + 1,
        ),
      );
      expect(functionSource).toContain(assertion);
    }
  });

  it("guards creator-side proof work behind active campaign work stages", () => {
    expect(reportingEvidenceSource).toContain("assertCampaignAllowsProofSubmission");
    expect(lifecycleSource).toContain(
      'throw new Error("Proof submission is closed for this campaign stage.")',
    );

    const guardedFunctions = [
      {
        name: "export async function createPerformanceEvidenceUpload",
        assertion: "assertCampaignAllowsProofSubmission(taskCampaign);",
      },
      {
        name: "export async function analyzePerformanceEvidence",
        assertion: "assertCampaignAllowsProofSubmission(taskCampaign);",
      },
      {
        name: "export async function createExtraPerformanceReportTask",
        assertion: "assertCampaignAllowsProofSubmission(memberCampaign);",
      },
      {
        name: "export async function confirmAiExtraction",
        assertion: "assertCampaignAllowsProofSubmission(taskCampaign);",
      },
    ];

    for (const { name, assertion } of guardedFunctions) {
      const functionSource = reportingEvidenceSource.slice(
        reportingEvidenceSource.indexOf(name),
        reportingEvidenceSource.indexOf(
          "export async function",
          reportingEvidenceSource.indexOf(name) + 1,
        ),
      );
      expect(functionSource).toContain(assertion);
    }
  });
});
