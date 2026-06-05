import { describe, expect, it } from "vitest";

import {
  buildAllPlatformReportMetrics,
  buildPlatformReportMetrics,
  buildReportCompletionMetric,
  buildReportEvidenceMetric,
  expandReportReadByMetricPlatforms,
  getAcceptedReportReads,
  getCurrentReportReadsWithHistory,
  getCurrentReportReads,
  getAvailableReportPlatforms,
  getMetricValueSourceType,
  partitionReportPlatforms,
} from "./campaign-report-metrics";

describe("campaign report metrics", () => {
  it("keeps raw performance metrics scoped to the selected platform", () => {
    const reads = [
      {
        campaignMemberId: "member-1",
        platform: "tiktok",
        reportedAt: "2026-05-08T10:00:00.000Z",
        views: 1200,
        likes: 60,
        comments: 12,
        shares: 8,
        saves: 5,
        evidenceVerificationStatus: "verified",
      },
      {
        campaignMemberId: "member-2",
        platform: "instagram",
        reportedAt: "2026-05-08T10:00:00.000Z",
        views: 900,
        likes: 90,
        comments: 9,
        shares: 4,
        saves: 7,
        evidenceVerificationStatus: "verified",
      },
    ];

    expect(getAvailableReportPlatforms(reads)).toEqual(["tiktok", "instagram"]);

    const tiktok = buildPlatformReportMetrics({
      reads,
      memberRates: new Map([
        ["member-1", 300],
        ["member-2", 250],
      ]),
      platform: "tiktok",
    });

    expect(tiktok.views).toBe(1200);
    expect(tiktok.engagements).toBe(85);
    expect(tiktok.spend).toBe(300);
    expect(tiktok.cpe).toBeCloseTo(3.529, 3);
  });

  it("splits stored metric values into campaign and proof-source lanes", () => {
    const expanded = expandReportReadByMetricPlatforms(
      {
        campaignMemberId: "member-1",
        submissionId: "submission-1",
        reportTaskId: "task-1",
        platform: "tiktok",
        reportedAt: "2026-05-10T10:00:00.000Z",
        screenshotUrl: "campaign-evidence/campaign/member/task/proof.png",
        evidenceVerificationStatus: "verified",
      },
      [
        {
          platform: "tiktok",
          metric_key: "comments",
          metric_value: 12,
          source_type: "creator_confirmed",
        },
        {
          platform: "tiktok",
          metric_key: "favorites",
          metric_value: 8,
          source_type: "creator_confirmed",
        },
        {
          platform: "x",
          metric_key: "replies",
          metric_value: 5,
          source_type: "creator_confirmed",
        },
        {
          platform: "x",
          metric_key: "bookmarks",
          metric_value: 3,
          source_type: "creator_confirmed",
        },
      ],
    );

    expect(expanded).toMatchObject([
      {
        platform: "tiktok",
        comments: 12,
        saves: 8,
        sourceType: "creator_confirmed",
      },
      {
        platform: "x",
        comments: 5,
        saves: 3,
        sourceType: "creator_confirmed",
      },
    ]);
  });

  it("keeps proof-only sources out of campaign channel partitions", () => {
    expect(
      partitionReportPlatforms({
        availablePlatforms: ["tiktok", "x", "generic"],
        campaignPlatforms: ["tiktok"],
      }),
    ).toEqual({
      campaignPlatforms: ["tiktok"],
      proofSourcePlatforms: ["x", "generic"],
    });
  });

  it("builds date-ordered sparkline series from platform-native reads", () => {
    const metrics = buildPlatformReportMetrics({
      reads: [
        {
          campaignMemberId: "member-1",
          platform: "tiktok",
          reportedAt: "2026-05-10T10:00:00.000Z",
          views: 1800,
          likes: 100,
          comments: 12,
          shares: 10,
          saves: 8,
          evidenceVerificationStatus: "verified",
        },
        {
          campaignMemberId: "member-1",
          platform: "tiktok",
          reportedAt: "2026-05-08T10:00:00.000Z",
          views: 1000,
          likes: 70,
          comments: 8,
          shares: 5,
          saves: 4,
          evidenceVerificationStatus: "verified",
        },
      ],
      memberRates: new Map([["member-1", 300]]),
      platform: "tiktok",
    });

    expect(metrics.series).toEqual([
      { date: "2026-05-08", views: 1000, engagements: 87 },
      { date: "2026-05-10", views: 1800, engagements: 130 },
    ]);
    expect(metrics.readCount).toBe(2);
  });

  it("keeps pending and rejected correction reads out of accepted report metrics", () => {
    const metrics = buildPlatformReportMetrics({
      reads: [
        {
          campaignMemberId: "member-1",
          submissionId: "submission-1",
          reportTaskId: "task-1",
          platform: "tiktok",
          reportedAt: "2026-05-10T10:00:00.000Z",
          views: 1200,
          likes: 80,
          comments: 10,
          shares: 5,
          evidenceVerificationStatus: "verified",
        },
        {
          campaignMemberId: "member-1",
          submissionId: "submission-1",
          reportTaskId: "task-1",
          platform: "tiktok",
          reportedAt: "2026-05-11T10:00:00.000Z",
          views: 9999,
          likes: 999,
          comments: 99,
          shares: 9,
          evidenceVerificationStatus: "rejected",
        },
        {
          campaignMemberId: "member-1",
          submissionId: "submission-1",
          reportTaskId: "task-1",
          platform: "tiktok",
          reportedAt: "2026-05-12T10:00:00.000Z",
          views: 8888,
          likes: 888,
          comments: 88,
          shares: 8,
          evidenceVerificationStatus: "submitted",
        },
      ],
      memberRates: new Map([["member-1", 300]]),
      platform: "tiktok",
    });

    expect(metrics.views).toBe(1200);
    expect(metrics.engagements).toBe(95);
    expect(metrics.readCount).toBe(1);
    expect(metrics.series).toEqual([
      { date: "2026-05-10", views: 1200, engagements: 95 },
    ]);
  });

  it("keeps unconfirmed AI extraction values out of accepted report metrics", () => {
    const reads = [
      {
        campaignMemberId: "member-1",
        submissionId: "submission-1",
        reportTaskId: "task-1",
        platform: "tiktok",
        reportedAt: "2026-05-10T10:00:00.000Z",
        views: 9999,
        likes: 900,
        comments: 90,
        shares: 9,
        evidenceVerificationStatus: "verified",
        sourceType: "ai_extracted",
        aiExtractionStatus: "pending_confirmation",
      },
      {
        campaignMemberId: "member-2",
        submissionId: "submission-2",
        reportTaskId: "task-1",
        platform: "tiktok",
        reportedAt: "2026-05-10T11:00:00.000Z",
        views: 1200,
        likes: 80,
        comments: 10,
        shares: 5,
        evidenceVerificationStatus: "verified",
        sourceType: "creator_confirmed",
        aiExtractionStatus: "accepted_by_creator",
      },
      {
        campaignMemberId: "member-3",
        submissionId: "submission-3",
        reportTaskId: "task-1",
        platform: "tiktok",
        reportedAt: "2026-05-10T12:00:00.000Z",
        views: 300,
        likes: 20,
        comments: 2,
        shares: 1,
        evidenceVerificationStatus: "verified",
        sourceType: "creator_manual",
      },
    ];

    expect(getAcceptedReportReads(reads).map((read) => read.submissionId)).toEqual([
      "submission-2",
      "submission-3",
    ]);

    const metrics = buildPlatformReportMetrics({
      reads,
      memberRates: new Map([
        ["member-1", 300],
        ["member-2", 250],
        ["member-3", 100],
      ]),
      platform: "tiktok",
    });

    expect(metrics.views).toBe(1500);
    expect(metrics.engagements).toBe(118);
    expect(metrics.spend).toBe(350);
    expect(metrics.readCount).toBe(2);
  });

  it("keeps only the latest proof row per submission and report task for evidence tables", () => {
    const reads = [
      {
        campaignMemberId: "member-1",
        submissionId: "submission-1",
        reportTaskId: "task-1",
        platform: "instagram",
        reportedAt: "2026-05-09T10:00:00.000Z",
        evidenceVerificationStatus: "rejected",
      },
      {
        campaignMemberId: "member-1",
        submissionId: "submission-1",
        reportTaskId: "task-1",
        platform: "instagram",
        reportedAt: "2026-05-09T11:00:00.000Z",
        evidenceVerificationStatus: "verified",
      },
      {
        campaignMemberId: "member-1",
        submissionId: "submission-2",
        reportTaskId: "task-1",
        platform: "tiktok",
        reportedAt: "2026-05-09T10:30:00.000Z",
        evidenceVerificationStatus: "verified",
      },
    ];

    expect(getCurrentReportReads(reads).map((read) => ({
      submissionId: read.submissionId,
      status: read.evidenceVerificationStatus,
    }))).toEqual([
      { submissionId: "submission-1", status: "verified" },
      { submissionId: "submission-2", status: "verified" },
    ]);
  });

  it("marks a returned correction when the latest proof replaces a rejected row", () => {
    const reads = [
      {
        campaignMemberId: "member-1",
        submissionId: "submission-1",
        reportTaskId: "task-1",
        platform: "instagram",
        reportedAt: "2026-05-09T10:00:00.000Z",
        evidenceVerificationStatus: "rejected",
      },
      {
        campaignMemberId: "member-1",
        submissionId: "submission-1",
        reportTaskId: "task-1",
        platform: "instagram",
        reportedAt: "2026-05-09T11:00:00.000Z",
        evidenceVerificationStatus: "submitted",
      },
    ];

    expect(getCurrentReportReadsWithHistory(reads)).toMatchObject([
      {
        submissionId: "submission-1",
        evidenceVerificationStatus: "submitted",
        hasReturnedCorrection: true,
      },
    ]);
  });

  it("builds all-channel totals without duplicating creator spend across platforms", () => {
    const allChannels = buildAllPlatformReportMetrics({
      reads: [
        {
          campaignMemberId: "member-1",
          platform: "tiktok",
          reportedAt: "2026-05-09T10:00:00.000Z",
          views: 100,
          likes: 8,
          comments: 1,
          shares: 1,
          evidenceVerificationStatus: "verified",
        },
        {
          campaignMemberId: "member-1",
          platform: "instagram",
          reportedAt: "2026-05-10T10:00:00.000Z",
          views: 50,
          likes: 4,
          comments: 1,
          evidenceVerificationStatus: "verified",
        },
        {
          campaignMemberId: "member-2",
          platform: "instagram",
          reportedAt: "2026-05-10T10:00:00.000Z",
          views: 70,
          likes: 6,
          comments: 1,
          evidenceVerificationStatus: "verified",
        },
      ],
      memberRates: new Map([
        ["member-1", 300],
        ["member-2", 200],
      ]),
    });

    expect(allChannels.views).toBe(220);
    expect(allChannels.engagements).toBe(22);
    expect(allChannels.spend).toBe(500);
    expect(allChannels.cpe).toBeCloseTo(22.727, 3);
    expect(allChannels.readCount).toBe(3);
    expect(allChannels.series).toEqual([
      { date: "2026-05-09", views: 100, engagements: 10 },
      { date: "2026-05-10", views: 220, engagements: 22 },
    ]);
  });

  it("summarizes report task completion without affecting platform metrics", () => {
    const completion = buildReportCompletionMetric([
      {
        dueAt: "2026-05-11T10:00:00.000Z",
        status: "submitted",
        submittedAt: "2026-05-11T09:00:00.000Z",
      },
      {
        dueAt: "2026-05-12T10:00:00.000Z",
        status: "missed",
        submittedAt: null,
      },
      {
        dueAt: "2026-05-13T10:00:00.000Z",
        status: "pending",
        submittedAt: null,
      },
    ]);

    expect(completion.submitted).toBe(1);
    expect(completion.missed).toBe(1);
    expect(completion.total).toBe(3);
    expect(completion.percent).toBe(33);
    expect(completion.series).toEqual([
      { date: "2026-05-11", submitted: 1 },
      { date: "2026-05-12", submitted: 1 },
      { date: "2026-05-13", submitted: 1 },
    ]);
  });

  it("labels brand-reviewed AI-assisted reads as brand-reviewed proof", () => {
    const evidence = buildReportEvidenceMetric({
      reads: [
        {
          campaignMemberId: "member-1",
          platform: "instagram",
          reportedAt: "2026-05-10T10:00:00.000Z",
          views: 1000,
          likes: 80,
          comments: 10,
          shares: 5,
          screenshotUrl: "campaign-evidence/campaign/member/task/evidence.png",
          verificationStatus: "screenshot_verified",
          sourceType: "creator_confirmed",
          aiExtractionStatus: "edited_by_creator",
        },
      ],
      tasks: [
        {
          dueAt: "2026-05-18T10:00:00.000Z",
          status: "submitted",
          submittedAt: "2026-05-17T10:00:00.000Z",
        },
      ],
    });

    expect(evidence.confidence).toBe("verified");
    expect(evidence.sourceLabels).toEqual(["Brand-reviewed proof"]);
  });

  it("keeps unreviewed AI-assisted reads labeled as creator confirmed", () => {
    const evidence = buildReportEvidenceMetric({
      reads: [
        {
          campaignMemberId: "member-1",
          platform: "instagram",
          reportedAt: "2026-05-10T10:00:00.000Z",
          views: 1000,
          likes: 80,
          comments: 10,
          shares: 5,
          screenshotUrl: "campaign-evidence/campaign/member/task/evidence.png",
          sourceType: "creator_confirmed",
          aiExtractionStatus: "accepted_by_creator",
        },
      ],
      tasks: [
        {
          dueAt: "2026-05-18T10:00:00.000Z",
          status: "submitted",
          submittedAt: "2026-05-17T10:00:00.000Z",
        },
      ],
    });

    expect(evidence.confidence).toBe("supported");
    expect(evidence.sourceLabels).toEqual(["AI read, creator confirmed"]);
  });

  it("labels verified creator-entered fallback reads as brand-reviewed proof", () => {
    const evidence = buildReportEvidenceMetric({
      reads: [
        {
          campaignMemberId: "member-1",
          platform: "tiktok",
          reportedAt: "2026-05-10T10:00:00.000Z",
          views: 12000,
          screenshotUrl: "campaign-evidence/campaign/member/task/manual-proof.csv",
          evidenceVerificationStatus: "verified",
          sourceType: "creator_manual",
        },
      ],
      tasks: [
        {
          dueAt: "2026-05-10T10:00:00.000Z",
          status: "verified",
          submittedAt: "2026-05-10T09:30:00.000Z",
        },
      ],
    });

    expect(evidence.confidence).toBe("verified");
    expect(evidence.sourceLabels).toEqual(["Brand-reviewed proof"]);
    expect(evidence.sourceLabels).not.toContain("Manual entry");
  });

  it("labels submitted creator-entered fallback reads as creator-entered proof", () => {
    const evidence = buildReportEvidenceMetric({
      reads: [
        {
          campaignMemberId: "member-1",
          platform: "tiktok",
          reportedAt: "2026-05-10T10:00:00.000Z",
          views: 12000,
          screenshotUrl: "campaign-evidence/campaign/member/task/manual-proof.csv",
          evidenceVerificationStatus: "submitted",
          sourceType: "creator_manual",
        },
      ],
      tasks: [
        {
          dueAt: "2026-05-10T10:00:00.000Z",
          status: "submitted",
          submittedAt: "2026-05-10T09:30:00.000Z",
        },
      ],
    });

    expect(evidence.confidence).toBe("supported");
    expect(evidence.sourceLabels).toEqual(["Creator-entered proof"]);
  });

  it("derives the read source from stored metric value provenance", () => {
    expect(getMetricValueSourceType([
      { source_type: "creator_manual" },
      { source_type: "creator_manual" },
    ])).toBe("creator_manual");

    expect(getMetricValueSourceType([
      { source_type: "ai_extracted" },
      { source_type: "ai_extracted" },
    ])).toBe("ai_extracted");

    expect(getMetricValueSourceType([
      { source_type: "creator_manual" },
      { source_type: "creator_confirmed" },
    ])).toBe("creator_confirmed");
  });
});
