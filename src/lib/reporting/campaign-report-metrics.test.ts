import { describe, expect, it } from "vitest";

import {
  buildAllPlatformReportMetrics,
  buildPlatformReportMetrics,
  buildReportCompletionMetric,
  buildReportEvidenceMetric,
  getAvailableReportPlatforms,
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
        },
        {
          campaignMemberId: "member-1",
          platform: "instagram",
          reportedAt: "2026-05-10T10:00:00.000Z",
          views: 50,
          likes: 4,
          comments: 1,
        },
        {
          campaignMemberId: "member-2",
          platform: "instagram",
          reportedAt: "2026-05-10T10:00:00.000Z",
          views: 70,
          likes: 6,
          comments: 1,
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

  it("labels report reads by strongest available data source", () => {
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
          screenshotUrl: "https://example.com/evidence.png",
          verificationStatus: "screenshot_verified",
          sourceType: "creator_confirmed",
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
    expect(evidence.sourceLabels).toEqual(["AI extracted and creator confirmed"]);
  });
});
