import { describe, expect, it } from "vitest";

import { buildReportEvidenceMetric } from "./campaign-report-metrics";

describe("campaign report evidence metric", () => {
  it("summarizes source evidence, verified reads, data window, and missed report tasks", () => {
    const evidence = buildReportEvidenceMetric({
      reads: [
        {
          campaignMemberId: "member-1",
          platform: "tiktok",
          reportedAt: "2026-05-09T10:00:00.000Z",
          views: 1000,
          screenshotUrl: "https://example.com/analytics-48h.png",
          verificationStatus: "screenshot_verified",
        },
        {
          campaignMemberId: "member-1",
          platform: "tiktok",
          reportedAt: "2026-05-14T10:00:00.000Z",
          views: 1800,
          screenshotUrl: null,
          verificationStatus: "submitted",
        },
        {
          campaignMemberId: "member-2",
          platform: "instagram",
          reportedAt: "2026-05-18T10:00:00.000Z",
          views: 900,
          screenshotUrl: "https://example.com/analytics-final.png",
          verificationStatus: "brand_verified",
        },
      ],
      tasks: [
        {
          dueAt: "2026-05-18T10:00:00.000Z",
          status: "verified",
          submittedAt: "2026-05-18T09:00:00.000Z",
        },
        {
          dueAt: "2026-05-19T10:00:00.000Z",
          status: "missed",
          submittedAt: null,
        },
      ],
    });

    expect(evidence.totalReads).toBe(3);
    expect(evidence.evidenceBackedReads).toBe(2);
    expect(evidence.verifiedReads).toBe(2);
    expect(evidence.submittedTasks).toBe(1);
    expect(evidence.missedTasks).toBe(1);
    expect(evidence.confidence).toBe("incomplete");
    expect(evidence.dataWindow).toEqual({
      start: "2026-05-09",
      end: "2026-05-18",
    });
  });
});
