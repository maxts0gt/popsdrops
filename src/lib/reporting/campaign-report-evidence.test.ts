import { describe, expect, it } from "vitest";

import {
  buildProofRoomScaleReadiness,
  buildReportEvidenceMetric,
} from "./campaign-report-metrics";

describe("campaign report evidence metric", () => {
  it("prioritizes proof-room exceptions for 100-creator operating review", () => {
    const readiness = buildProofRoomScaleReadiness({
      totalReads: 100,
      evidenceBackedReads: 96,
      verifiedReads: 91,
      pendingReviewReads: 7,
      correctionRequestedReads: 2,
      missingEvidenceReads: 4,
      totalTasks: 100,
      submittedTasks: 96,
      missedTasks: 3,
      actionRequiredTasks: 5,
      confidence: "incomplete",
      dataWindow: {
        start: "2026-05-01",
        end: "2026-05-30",
      },
      sourceLabels: ["Creator-confirmed manual entry"],
    });

    expect(readiness).toEqual({
      action: "request_corrections",
      attentionCount: 16,
      readyForLeadership: false,
      scaleScope: "scale",
      severity: "blocked",
      totalReads: 100,
      totalTasks: 100,
      verifiedCoveragePercent: 91,
      verifiedReads: 91,
      lanes: [
        { id: "correction", count: 2 },
        { id: "missed", count: 3 },
        { id: "missing_proof", count: 4 },
        { id: "review", count: 7 },
      ],
    });
  });

  it("marks fully verified proof as leadership-ready even at scale", () => {
    const readiness = buildProofRoomScaleReadiness({
      totalReads: 100,
      evidenceBackedReads: 100,
      verifiedReads: 100,
      pendingReviewReads: 0,
      correctionRequestedReads: 0,
      missingEvidenceReads: 0,
      totalTasks: 100,
      submittedTasks: 100,
      missedTasks: 0,
      actionRequiredTasks: 0,
      confidence: "verified",
      dataWindow: {
        start: "2026-05-01",
        end: "2026-05-30",
      },
      sourceLabels: ["Brand-reviewed proof"],
    });

    expect(readiness).toMatchObject({
      action: "share",
      attentionCount: 0,
      readyForLeadership: true,
      scaleScope: "scale",
      severity: "ready",
      verifiedCoveragePercent: 100,
      lanes: [],
    });
  });

  it("summarizes source evidence, verified reads, data window, and missed report tasks", () => {
    const evidence = buildReportEvidenceMetric({
      reads: [
        {
          campaignMemberId: "member-1",
          platform: "tiktok",
          reportedAt: "2026-05-09T10:00:00.000Z",
          views: 1000,
          screenshotUrl: "campaign-evidence/campaign/member/task/analytics-48h.png",
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
          screenshotUrl: "campaign-evidence/campaign/member/task/analytics-final.png",
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

  it("separates review, correction, and missing proof counts for brand trust", () => {
    const evidence = buildReportEvidenceMetric({
      reads: [
        {
          campaignMemberId: "member-1",
          platform: "instagram",
          reportedAt: "2026-05-10T10:00:00.000Z",
          views: 1200,
          screenshotUrl: "campaign-evidence/campaign/member/task/evidence-a.png",
          verificationStatus: "submitted",
          evidenceVerificationStatus: "submitted",
        },
        {
          campaignMemberId: "member-2",
          platform: "tiktok",
          reportedAt: "2026-05-11T10:00:00.000Z",
          views: 900,
          screenshotUrl: "campaign-evidence/campaign/member/task/evidence-b.png",
          verificationStatus: "rejected",
          evidenceVerificationStatus: "rejected",
        },
        {
          campaignMemberId: "member-3",
          platform: "youtube",
          reportedAt: "2026-05-12T10:00:00.000Z",
          views: 600,
          screenshotUrl: null,
          verificationStatus: "submitted",
        },
      ],
      tasks: [
        {
          dueAt: "2026-05-12T10:00:00.000Z",
          status: "needs_revision",
          submittedAt: "2026-05-12T09:00:00.000Z",
        },
        {
          dueAt: "2026-05-13T10:00:00.000Z",
          status: "missed",
          submittedAt: null,
        },
      ],
    });

    expect(evidence.pendingReviewReads).toBe(1);
    expect(evidence.correctionRequestedReads).toBe(1);
    expect(evidence.missingEvidenceReads).toBe(1);
    expect(evidence.actionRequiredTasks).toBe(2);
    expect(evidence.confidence).toBe("incomplete");
  });

  it("treats submitted tasks without proof rows as missing proof before leadership sharing", () => {
    const evidence = buildReportEvidenceMetric({
      reads: [],
      tasks: [
        {
          id: "report-task-without-proof",
          dueAt: "2026-05-12T10:00:00.000Z",
          status: "submitted",
          submittedAt: "2026-05-12T09:00:00.000Z",
        },
      ],
    });
    const readiness = buildProofRoomScaleReadiness(evidence);

    expect(evidence.totalReads).toBe(0);
    expect(evidence.missingEvidenceReads).toBe(1);
    expect(evidence.confidence).toBe("incomplete");
    expect(readiness).toMatchObject({
      action: "collect_missing_proof",
      readyForLeadership: false,
      severity: "blocked",
    });
    expect(readiness.lanes).toEqual([{ id: "missing_proof", count: 1 }]);
  });

  it("only treats openable platform proof as evidence-backed", () => {
    const evidence = buildReportEvidenceMetric({
      reads: [
        {
          campaignMemberId: "member-1",
          platform: "instagram",
          reportedAt: "2026-05-10T10:00:00.000Z",
          views: 1200,
          screenshotUrl: "https://example.com/not-storage-proof.png",
          verificationStatus: "brand_verified",
        },
      ],
      tasks: [
        {
          dueAt: "2026-05-12T10:00:00.000Z",
          status: "verified",
          submittedAt: "2026-05-12T09:00:00.000Z",
        },
      ],
    });

    expect(evidence.evidenceBackedReads).toBe(0);
    expect(evidence.verifiedReads).toBe(0);
    expect(evidence.missingEvidenceReads).toBe(1);
    expect(evidence.confidence).toBe("incomplete");
  });

  it("scores trust from the latest read per submission so corrected proof clears the alert", () => {
    const evidence = buildReportEvidenceMetric({
      reads: [
        {
          campaignMemberId: "member-1",
          submissionId: "submission-1",
          reportTaskId: "report-task-1",
          platform: "tiktok",
          reportedAt: "2026-05-14T10:00:00.000Z",
          views: 1200,
          screenshotUrl: "campaign-evidence/campaign/member/task/rejected.png",
          verificationStatus: "rejected",
          evidenceVerificationStatus: "rejected",
        },
        {
          campaignMemberId: "member-1",
          submissionId: "submission-1",
          reportTaskId: "report-task-1",
          platform: "tiktok",
          reportedAt: "2026-05-15T10:00:00.000Z",
          views: 1500,
          screenshotUrl: "campaign-evidence/campaign/member/task/corrected.png",
          verificationStatus: "brand_verified",
          evidenceVerificationStatus: "verified",
        },
      ],
      tasks: [
        {
          dueAt: "2026-05-15T10:00:00.000Z",
          status: "verified",
          submittedAt: "2026-05-15T09:30:00.000Z",
        },
      ],
    });

    expect(evidence.totalReads).toBe(1);
    expect(evidence.evidenceBackedReads).toBe(1);
    expect(evidence.verifiedReads).toBe(1);
    expect(evidence.correctionRequestedReads).toBe(0);
    expect(evidence.confidence).toBe("verified");
    expect(evidence.dataWindow).toEqual({
      start: "2026-05-15",
      end: "2026-05-15",
    });
  });

  it("uses verified measurement reads for the data window, not only the latest trust state", () => {
    const evidence = buildReportEvidenceMetric({
      reads: [
        {
          campaignMemberId: "member-1",
          submissionId: "submission-1",
          reportTaskId: "report-task-1",
          platform: "tiktok",
          reportedAt: "2026-05-09T10:00:00.000Z",
          views: 1000,
          screenshotUrl: "campaign-evidence/campaign/member/task/read-1.png",
          verificationStatus: "brand_verified",
          evidenceVerificationStatus: "verified",
        },
        {
          campaignMemberId: "member-1",
          submissionId: "submission-1",
          reportTaskId: "report-task-1",
          platform: "tiktok",
          reportedAt: "2026-05-14T10:00:00.000Z",
          views: 1800,
          screenshotUrl: "campaign-evidence/campaign/member/task/read-2.png",
          verificationStatus: "brand_verified",
          evidenceVerificationStatus: "verified",
        },
        {
          campaignMemberId: "member-1",
          submissionId: "submission-1",
          reportTaskId: "report-task-1",
          platform: "tiktok",
          reportedAt: "2026-05-18T10:00:00.000Z",
          views: 2400,
          screenshotUrl: "campaign-evidence/campaign/member/task/read-3.png",
          verificationStatus: "brand_verified",
          evidenceVerificationStatus: "verified",
        },
      ],
      tasks: [
        {
          dueAt: "2026-05-18T10:00:00.000Z",
          status: "verified",
          submittedAt: "2026-05-18T09:30:00.000Z",
        },
      ],
    });

    expect(evidence.totalReads).toBe(1);
    expect(evidence.dataWindow).toEqual({
      start: "2026-05-09",
      end: "2026-05-18",
    });
  });
});
