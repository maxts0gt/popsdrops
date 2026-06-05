import { describe, expect, it } from "vitest";

import { buildCampaignReportHealth } from "./campaign-list-report-health";

describe("campaign list report health", () => {
  it("summarizes current proof work without stale corrections or collapsed reads", () => {
    const health = buildCampaignReportHealth({
      campaignIds: ["campaign-1"],
      evidenceRows: [
        {
          campaign_id: "campaign-1",
          campaign_member_id: "member-1",
          created_at: "2026-06-01T09:00:00.000Z",
          id: "old-rejected-proof",
          performance_id: "performance-1",
          report_task_id: "returned-task",
          submission_id: "submission-1",
          verification_status: "rejected",
        },
        {
          campaign_id: "campaign-1",
          campaign_member_id: "member-1",
          created_at: "2026-06-01T10:00:00.000Z",
          id: "returned-submitted-proof",
          performance_id: "performance-1",
          report_task_id: "returned-task",
          submission_id: "submission-1",
          verification_status: "submitted",
        },
        {
          campaign_id: "campaign-1",
          campaign_member_id: "member-2",
          created_at: "2026-06-01T10:30:00.000Z",
          id: "current-rejected-proof",
          performance_id: "performance-2",
          report_task_id: "rejected-task",
          submission_id: "submission-2",
          verification_status: "rejected",
        },
        {
          campaign_id: "campaign-1",
          campaign_member_id: "member-3",
          created_at: "2026-06-01T11:00:00.000Z",
          id: "submitted-proof-a",
          performance_id: "performance-3",
          report_task_id: "multi-read-task",
          submission_id: "submission-3",
          verification_status: "submitted",
        },
        {
          campaign_id: "campaign-1",
          campaign_member_id: "member-3",
          created_at: "2026-06-01T11:10:00.000Z",
          id: "submitted-proof-b",
          performance_id: "performance-4",
          report_task_id: "multi-read-task",
          submission_id: "submission-4",
          verification_status: "submitted",
        },
      ],
      performanceRows: [
        {
          campaign_id: "campaign-1",
          created_at: "2026-06-01T11:30:00.000Z",
          id: "external-link-proof",
          report_task_id: "external-link-task",
          reported_at: "2026-06-01T11:30:00.000Z",
          screenshot_url: "https://example.com/instagram-insights.png",
          submission_id: "submission-5",
          verification_status: "submitted",
        },
        {
          campaign_id: "campaign-1",
          created_at: "2026-06-01T11:40:00.000Z",
          id: "external-rejected-proof",
          report_task_id: "external-rejected-task",
          reported_at: "2026-06-01T11:40:00.000Z",
          screenshot_url: "https://example.com/tiktok-insights.png",
          submission_id: "submission-6",
          verification_status: "rejected",
        },
        {
          campaign_id: "campaign-1",
          created_at: "2026-06-01T11:50:00.000Z",
          id: "performance-3",
          report_task_id: "multi-read-task",
          reported_at: "2026-06-01T11:50:00.000Z",
          screenshot_url: "https://example.com/duplicate-file-backed-proof.png",
          submission_id: "submission-3",
          verification_status: "submitted",
        },
      ],
      reportTasks: [
        {
          campaign_id: "campaign-1",
          id: "missed-task",
          status: "missed",
        },
        {
          campaign_id: "campaign-1",
          id: "manual-correction-task",
          status: "needs_revision",
        },
        {
          campaign_id: "campaign-1",
          id: "submitted-without-proof",
          status: "submitted",
        },
      ],
    });

    expect(health.get("campaign-1")).toEqual({
      corrections: 3,
      missed: 1,
      toReview: 5,
    });
  });
});
