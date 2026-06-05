import { describe, expect, it } from "vitest";

import { buildSharedReportStory } from "./shared-report-story";
import type { ReportExportData } from "./report-export";

function reportData(overrides: Partial<ReportExportData> = {}): ReportExportData {
  return {
    campaignTitle: "Maison proof launch",
    dateRange: "2026/05/07 - 2026/05/15",
    generatedAt: "2026-05-16T00:00:00.000Z",
    composition: {
      presetId: "leadership",
      presetTitle: "Leadership brief",
      presetDetail: "Board-ready summary, channel story, trust, and next actions.",
      bestFor: "Senior launch readouts and market-entry decisions.",
      executiveQuestion: "Should leadership expand the campaign?",
      chartModeId: "trend",
      chartModeTitle: "Trend view",
      chartModeDetail: "Time-based growth and pacing.",
      chartLayoutTitle: "Timeline readout",
      chartLayoutDetail:
        "Lead with movement over time, pacing, and the final decision signal.",
      presentation: {
        coverMode: "campaign_visual",
        typography: "quiet",
        density: "editorial",
      },
    },
    kpis: [
      { key: "views", label: "Qualified reach", value: "47.4K", detail: "2 channels" },
      { key: "cpe", label: "Efficiency signal", value: "$0.29", detail: "$275 spend" },
    ],
    trust: [
      {
        key: "evidence_backed_reads",
        label: "Proof coverage",
        value: "2/2",
        detail: "Native analytics screenshots",
      },
      {
        key: "verified_reads",
        label: "Verified reads",
        value: "2/2",
        detail: "Brand-reviewed proof",
      },
      {
        key: "data_source",
        label: "Metric origin",
        value: "Brand-reviewed proof",
        detail: "Creator evidence reviewed by brand",
      },
    ],
    recommendations: [],
    sections: [
      {
        title: "All Channels",
        detail: "Compared by channel.",
        sourceGroup: "campaign_channel",
        metrics: [
          {
            key: "views",
            label: "Qualified reach",
            value: "47.4K",
            detail: "2 reads",
            points: [
              { date: "2026-05-07", value: 12000, label: "12.0K" },
              { date: "2026-05-15", value: 47400, label: "47.4K" },
            ],
          },
        ],
      },
      {
        title: "X proof",
        detail: "Supporting evidence only.",
        sourceGroup: "proof_source",
        metrics: [
          {
            key: "engagements",
            label: "Audience actions",
            value: "933",
            detail: "1 read",
            points: [{ date: "2026-05-15", value: 933, label: "933" }],
          },
        ],
      },
    ],
    creators: [
      {
        name: "Ava Kim",
        market: "South Korea",
        platform: "TikTok",
        views: "30.6K",
        engagements: "3.5K",
        er: "11.4%",
        cpe: "$1.20",
        spent: "$1,500",
        rating: "-",
      },
      {
        name: "Mina Park",
        market: "United States",
        platform: "Instagram",
        views: "12.0K",
        engagements: "900",
        er: "7.5%",
        cpe: "$0.32",
        spent: "$800",
        rating: "-",
      },
    ],
    ...overrides,
  };
}

describe("shared report story", () => {
  it("turns trend-mode shared reports into a movement story", () => {
    const story = buildSharedReportStory(reportData());

    expect(story).toMatchObject({
      mode: "trend",
      title: "Timeline readout",
      detail: "Lead with movement over time, pacing, and the final decision signal.",
      decisionRead: "Should leadership expand the campaign?",
      evidenceTrail: "Proof coverage: 2/2 / Brand-reviewed proof",
    });
    expect(story.primaryMetric).toMatchObject({
      label: "Qualified reach",
      value: "47.4K",
      journey: "12.0K to 47.4K",
    });
  });

  it("uses brand-renamed KPI labels for single-read trend stories", () => {
    const story = buildSharedReportStory(
      reportData({
        sections: [
          {
            title: "All Channels",
            detail: "Snapshot read.",
            sourceGroup: "campaign_channel",
            metrics: [
              {
                key: "views",
                label: "Views",
                value: "12.0K",
                detail: "1 channel",
                points: [{ date: "2026-06-04", value: 12000, label: "12.0K" }],
              },
            ],
          },
        ],
      }),
    );

    expect(story.metricLabel).toBe("Qualified reach");
    expect(story.primaryMetric).toMatchObject({
      label: "Qualified reach",
      value: "12.0K",
      journey: "12.0K",
    });
    expect(story.primaryMetric?.journey).not.toContain("Views");
  });

  it("honors the selected comparison metric on shared report links", () => {
    const story = buildSharedReportStory(
      reportData({
        composition: {
          ...reportData().composition!,
          chartModeId: "comparison",
          chartModeTitle: "Comparison view",
          chartModeDetail: "Side-by-side channel and creator contrast.",
          chartLayoutTitle: "Ranked comparison",
          chartLayoutDetail:
            "Lead with creator and channel contrast before detail rows.",
          presentation: {
            coverMode: "campaign_visual",
            typography: "quiet",
            density: "editorial",
            chartMetricKey: "cpe",
          },
        },
      }),
    );

    expect(story).toMatchObject({
      mode: "comparison",
      title: "Ranked comparison",
      metricLabel: "Efficiency signal",
      sortDetail: "Sorted by Efficiency signal. Lower CPE ranks first.",
    });
    expect(story.comparisonRows.map((row) => [row.rank, row.name, row.metricValue])).toEqual([
      [1, "Mina Park", "$0.32"],
      [2, "Ava Kim", "$1.20"],
    ]);
    expect(story.comparisonRows.map((row) => row.supportingValue)).toEqual([
      "Qualified reach 12.0K",
      "Qualified reach 30.6K",
    ]);
  });

  it("keeps trust proof items available when comparison reports are leadership-held", () => {
    const story = buildSharedReportStory(
      reportData({
        composition: {
          ...reportData().composition!,
          chartModeId: "comparison",
          chartModeTitle: "Comparison view",
          chartModeDetail: "Side-by-side channel and creator contrast.",
        },
      }),
    );

    expect(story.mode).toBe("comparison");
    expect(story.proofItems.map((item) => item.label)).toContain("Proof coverage");
    expect(story.proofItems.map((item) => item.label)).toContain("Verified reads");
  });

  it("turns proof-mode shared reports into an evidence-first story", () => {
    const story = buildSharedReportStory(
      reportData({
        composition: {
          ...reportData().composition!,
          chartModeId: "proof",
          chartModeTitle: "Proof view",
          chartModeDetail: "Evidence coverage and source confidence first.",
          chartLayoutTitle: "Evidence audit",
          chartLayoutDetail:
            "Lead with source coverage, review state, and missing proof before performance detail.",
        },
      }),
    );

    expect(story).toMatchObject({
      mode: "proof",
      title: "Evidence audit",
      evidenceTrail: "Proof coverage: 2/2 / Brand-reviewed proof",
      trustDecision: "Ready for leadership sharing.",
      proofSourceCount: 1,
    });
    expect(story.proofItems.map((item) => item.label)).toEqual([
      "Proof coverage",
      "Verified reads",
      "Metric origin",
      "X proof",
    ]);
  });

  it("keeps concrete proof review provenance in shared report proof stories", () => {
    const story = buildSharedReportStory(
      reportData({
        composition: {
          ...reportData().composition!,
          chartModeId: "proof",
          chartModeTitle: "Proof view",
          chartModeDetail: "Evidence coverage and source confidence first.",
          chartLayoutTitle: "Evidence audit",
          chartLayoutDetail:
            "Lead with source coverage, review state, and missing proof before performance detail.",
        },
        proofReview: {
          label: "Proof review",
          value: "Reviewed 2026/06/04",
          detail: "Reviewer recorded",
          reviewedAt: "2026-06-04T03:20:00.000Z",
          reviewerRecorded: true,
        },
      }),
    );

    expect(story.evidenceTrail).toBe(
      "Proof coverage: 2/2 / Brand-reviewed proof / Reviewed 2026/06/04",
    );
    expect(story.proofItems).toContainEqual({
      label: "Proof review",
      value: "Reviewed 2026/06/04",
      detail: "Reviewer recorded",
    });
  });
});
