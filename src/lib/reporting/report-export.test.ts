import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

import {
  buildCsvContent,
  buildHtmlDocument,
  buildJsonContent,
  getReportBodyKpis,
  getReportDisplayTitle,
  getReportEvidenceStatusValue,
  getReportTrustDecision,
  buildSafeExportName,
  type ReportExportData,
} from "./report-export";

const exportData: ReportExportData = {
  campaignTitle: "Spring Launch / Seoul",
  dateRange: "May 7, 2026 to May 15, 2026",
  generatedAt: "2026-05-06T00:00:00.000Z",
  campaignImageUrl: "https://example.com/campaign-cover.jpg",
  campaignImageAlt: "Maison Lumiere hero visual",
  composition: {
    presetId: "leadership",
    presetTitle: "Leadership brief",
    presetDetail: "Board-ready summary, channel story, trust, and next actions.",
    bestFor: "Senior launch readouts and market-entry decisions.",
    executiveQuestion:
      "Did this campaign create enough confidence to continue the market launch?",
    chartModeId: "trend",
    chartModeTitle: "Trend view",
    chartModeDetail: "Time-based growth and pacing.",
    chartLayoutTitle: "Timeline readout",
    chartLayoutDetail:
      "Lead with movement over time, pacing, and the final decision signal.",
  },
  blocks: [
    {
      id: "executive_summary",
      title: "Executive summary",
      detail: "Top KPIs for leadership.",
      executivePurpose:
        "Start with the leadership readout: outcome, spend, and confidence at a glance.",
    },
    {
      id: "channel_story",
      title: "Channel story",
      detail: "Platform-native performance charts.",
      executivePurpose:
        "Explain performance by platform without mixing metrics that each network defines differently.",
    },
    {
      id: "proof_sources",
      title: "Proof sources",
      detail: "Supporting channels kept separate from totals.",
      executivePurpose:
        "Keep non-primary evidence visible while protecting campaign totals from unsupported comparisons.",
    },
    {
      id: "report_trust",
      title: "Report trust",
      detail: "Evidence coverage and review state.",
      executivePurpose:
        "Show legal, finance, and leadership how each number was evidenced and reviewed.",
    },
    {
      id: "creator_table",
      title: "Creator table",
      detail: "Creator-level performance and spend.",
      executivePurpose:
        "Give operators the creator-level detail behind the executive narrative.",
    },
    {
      id: "recommendations",
      title: "Recommendations",
      detail: "Data-earned next actions.",
      executivePurpose:
        "Close with data-earned actions the brand can decide on next.",
    },
  ],
  kpis: [
    { label: "Views", value: "47.4K", detail: "2 channels" },
    { label: "Engagement Rate", value: "13.1%", detail: "All Channels" },
  ],
  trust: [
    {
      key: "evidence_backed_reads",
      label: "Evidence-backed reads",
      value: "6/6",
      detail: "Native analytics screenshots",
    },
    {
      key: "verified_reads",
      label: "Verified reads",
      value: "6/6",
      detail: "Brand-reviewed proof",
    },
    {
      key: "data_window",
      label: "Data window",
      value: "May 30, 2026 ~ May 30, 2026",
      detail: "Platform read dates",
    },
    {
      key: "report_status",
      label: "Report status",
      value: "Ready for leadership",
      detail: "6/6 submitted",
    },
    {
      key: "data_source",
      label: "Data source",
      value: "Brand-reviewed proof",
      detail: "Creator evidence reviewed by brand",
    },
  ],
  recommendations: [
    { title: "Top creator", value: "Ava Kim", detail: "30.6K views on TikTok" },
    { title: "Best channel", value: "TikTok", detail: "11.4% engagement rate across 2 reads" },
  ],
  sections: [
    {
      title: "All Channels",
      detail: "Compared by channel.",
      sourceGroup: "campaign_channel",
      metrics: [
        {
          label: "Views",
          value: "47.4K",
          detail: "2 channels",
          points: [
            { date: "2026-05-09", value: 22000, label: "22.0K" },
            { date: "2026-05-18", value: 47400, label: "47.4K" },
          ],
        },
      ],
    },
    {
      title: "Proof Source - X",
      detail: "Supporting evidence only. Not mixed into campaign channel totals.",
      sourceGroup: "proof_source",
      metrics: [
        {
          label: "Engagements",
          value: "8",
          detail: "1 read",
          points: [{ date: "2026-05-18", value: 8, label: "8" }],
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
      cpe: "$0.43",
      spent: "$1,500",
      rating: "-",
    },
  ],
};

describe("report export helpers", () => {
  it("builds stable export file names", () => {
    expect(buildSafeExportName(exportData.campaignTitle)).toBe("spring-launch-seoul");
  });

  it("uses brand-written report titles before falling back to campaign report names", () => {
    expect(getReportDisplayTitle(exportData)).toBe("Spring Launch / Seoul Report");
    expect(
      getReportDisplayTitle({
        ...exportData,
        composition: {
          ...exportData.composition!,
          reportTitle: "  Korea board readout  ",
        },
      }),
    ).toBe("Korea board readout");
  });

  it("uses proof-review impact before evidence coverage ratios for executive covers", () => {
    expect(
      getReportEvidenceStatusValue({
        ...exportData,
        trust: [
          {
            key: "evidence_backed_reads",
            label: "Evidence-backed reads",
            value: "1/1",
            detail: "Native analytics screenshots",
          },
          {
            key: "verified_reads",
            label: "Verified reads",
            value: "0/1",
            detail: "Supported by source evidence",
          },
          {
            key: "report_status",
            label: "Report status",
            value: "1 awaiting review",
            detail: "1/1 submitted",
          },
        ],
      }),
    ).toBe("1 awaiting review");

    expect(
      getReportEvidenceStatusValue({
        ...exportData,
        trust: [
          {
            key: "evidence_backed_reads",
            label: "Evidence-backed reads",
            value: "1/1",
            detail: "Native analytics screenshots",
          },
          {
            key: "report_status",
            label: "Report status",
            value: "Ready for review",
            detail: "1/1 submitted",
          },
        ],
      }),
    ).toBe("1/1");
  });

  it("builds JSON with sectioned report data", () => {
    const json = JSON.parse(buildJsonContent(exportData)) as ReportExportData;

    expect(json.campaignTitle).toBe("Spring Launch / Seoul");
    expect(json.composition?.presetTitle).toBe("Leadership brief");
    expect(json.composition?.executiveQuestion).toBe(
      "Did this campaign create enough confidence to continue the market launch?",
    );
    expect(json.composition?.chartModeTitle).toBe("Trend view");
    expect(json.composition?.chartLayoutTitle).toBe("Timeline readout");
    expect(json.composition?.chartLayoutDetail).toBe(
      "Lead with movement over time, pacing, and the final decision signal.",
    );
    expect(json.blocks?.[0]?.executivePurpose).toBe(
      "Start with the leadership readout: outcome, spend, and confidence at a glance.",
    );
    expect(json.recommendations[0].title).toBe("Top creator");
    expect(json.sections[0].metrics[0].points[1].label).toBe("47.4K");
  });

  it("builds JSON with the same decision story as the executive HTML artifact", () => {
    const json = JSON.parse(buildJsonContent(exportData)) as ReportExportData;

    expect(json.story).toEqual({
      decisionRead:
        "Did this campaign create enough confidence to continue the market launch?",
      evidenceTrail: "Evidence-backed reads: 6/6 / Brand-reviewed proof",
      trustDecision: "Ready for leadership sharing.",
      nextAction: "Compare first and latest reads before deciding.",
    });
  });

  it("carries proof review provenance through JSON, CSV, and HTML artifacts", () => {
    const data: ReportExportData = {
      ...exportData,
      proofReview: {
        label: "Proof review",
        value: "Reviewed 2026/06/04",
        detail: "Reviewer recorded",
        reviewedAt: "2026-06-04T03:20:00.000Z",
        reviewerRecorded: true,
      },
    };

    const json = JSON.parse(buildJsonContent(data)) as ReportExportData;
    const csv = buildCsvContent(data);
    const html = buildHtmlDocument(data);

    expect(json.proofReview).toMatchObject({
      value: "Reviewed 2026/06/04",
      detail: "Reviewer recorded",
    });
    expect(json.story?.evidenceTrail).toBe(
      "Evidence-backed reads: 6/6 / Brand-reviewed proof / Reviewed 2026/06/04",
    );
    expect(csv).toContain(
      "Evidence gate,Evidence-backed reads: 6/6 / Brand-reviewed proof / Reviewed 2026/06/04",
    );
    expect(csv).toContain("Proof Review");
    expect(csv).toContain("Proof review,Reviewed 2026/06/04,Reviewer recorded");
    expect(html).toContain("Proof review");
    expect(html).toContain("Reviewed 2026/06/04");
    expect(html).toContain(
      "Evidence-backed reads: 6/6 / Brand-reviewed proof / Reviewed 2026/06/04",
    );
  });

  it("exports legacy manual source rows as brand-reviewed proof when evidence is fully verified", () => {
    const data: ReportExportData = {
      ...exportData,
      trust: [
        {
          key: "evidence_backed_reads",
          label: "Proof coverage",
          value: "1/1",
          detail: "Native analytics screenshots",
        },
        {
          key: "verified_reads",
          label: "Verified reads",
          value: "1/1",
          detail: "Brand-reviewed proof",
        },
        {
          key: "report_status",
          label: "Report status",
          value: "Ready for leadership",
          detail: "1/1 submitted",
        },
        {
          key: "data_source",
          label: "Data source",
          value: "Manual entry",
          detail: "How metrics entered PopsDrops",
        },
      ],
    };

    const json = JSON.parse(buildJsonContent(data)) as ReportExportData;
    const csv = buildCsvContent(data);
    const html = buildHtmlDocument(data);

    expect(json.trust.find((item) => item.key === "data_source")).toMatchObject({
      value: "Brand-reviewed proof",
      detail: "Creator evidence reviewed by brand",
    });
    expect(csv).toContain(
      "Data source,Brand-reviewed proof,Creator evidence reviewed by brand",
    );
    expect(csv).not.toContain("Data source,Manual entry");
    expect(html).toContain("Proof coverage: 1/1 / Brand-reviewed proof");
    expect(html).toContain("<strong>Brand-reviewed proof</strong>");
    expect(html).not.toContain("Manual entry");
  });

  it("exports legacy manual source rows as creator-entered proof while review is pending", () => {
    const data: ReportExportData = {
      ...exportData,
      trust: [
        {
          key: "evidence_backed_reads",
          label: "Proof coverage",
          value: "1/1",
          detail: "Native analytics screenshots",
        },
        {
          key: "verified_reads",
          label: "Verified reads",
          value: "0/1",
          detail: "Supported by source evidence",
        },
        {
          key: "report_status",
          label: "Report status",
          value: "1 awaiting review",
          detail: "1/1 submitted",
        },
        {
          key: "data_source",
          label: "Data source",
          value: "Manual entry",
          detail: "How metrics entered PopsDrops",
        },
      ],
    };

    const json = JSON.parse(buildJsonContent(data)) as ReportExportData;
    const csv = buildCsvContent(data);
    const html = buildHtmlDocument(data);

    expect(json.trust.find((item) => item.key === "data_source")).toMatchObject({
      value: "Creator-entered proof",
      detail: "Creator-submitted values awaiting brand review",
    });
    expect(csv).toContain(
      "Data source,Creator-entered proof,Creator-submitted values awaiting brand review",
    );
    expect(csv).not.toContain("Data source,Manual entry");
    expect(html).toContain("Proof coverage: 1/1 / Creator-entered proof");
    expect(html).toContain("<strong>Creator-entered proof</strong>");
    expect(html).not.toContain("Manual entry");
  });

  it("keeps proof-only exports on leadership hold until a verified-read signal exists", () => {
    const data: ReportExportData = {
      ...exportData,
      trust: [
        {
          key: "evidence_backed_reads",
          label: "Proof coverage",
          value: "1/1",
          detail: "Native analytics screenshots",
        },
        {
          key: "report_status",
          label: "Report status",
          value: "Ready for leadership",
          detail: "1/1 submitted",
        },
        {
          key: "data_source",
          label: "Data source",
          value: "Manual entry",
          detail: "How metrics entered PopsDrops",
        },
      ],
    };

    const json = JSON.parse(buildJsonContent(data)) as ReportExportData;
    const csv = buildCsvContent(data);
    const html = buildHtmlDocument(data);

    expect(getReportTrustDecision(data)).toBe(
      "Keep in proof room until evidence is reviewed.",
    );
    expect(json.story?.trustDecision).toBe(
      "Keep in proof room until evidence is reviewed.",
    );
    expect(json.trust.find((item) => item.key === "data_source")).toMatchObject({
      value: "Creator-entered proof",
      detail: "Creator-submitted values awaiting brand review",
    });
    expect(csv).toContain(
      "Data source,Creator-entered proof,Creator-submitted values awaiting brand review",
    );
    expect(html).toContain('data-leadership-handoff-state="hold"');
    expect(html).toContain("Keep in proof room until evidence is reviewed.");
    expect(html).not.toContain("Share with leadership");
  });

  it("exports a structured leadership handoff contract in JSON and CSV", () => {
    const data: ReportExportData = {
      ...exportData,
      trust: [
        {
          key: "evidence_backed_reads",
          label: "Proof coverage",
          value: "3/4",
          detail: "Native analytics screenshots",
        },
        {
          key: "verified_reads",
          label: "Verified reads",
          value: "2/4",
          detail: "Brand-reviewed proof",
        },
        {
          key: "report_status",
          label: "Report status",
          value: "1 correction pending",
          detail: "Creator reporting tasks",
        },
      ],
    };

    const json = JSON.parse(buildJsonContent(data)) as ReportExportData & {
      leadershipHandoff?: unknown;
    };
    const csv = buildCsvContent(data);

    expect(json.leadershipHandoff).toEqual({
      state: "hold",
      label: "Keep in proof room",
      decision: "Resolve correction requests before leadership sharing.",
      proofBasis: [
        { key: "included", label: "Included", value: 2 },
        { key: "needs-review", label: "Needs review", value: 0 },
        { key: "corrections", label: "Corrections", value: 1 },
        { key: "missing-proof", label: "Missing proof", value: 1 },
      ],
    });
    expect(csv).toContain("Leadership Handoff");
    expect(csv).toContain("State,hold");
    expect(csv).toContain("Label,Keep in proof room");
    expect(csv).toContain(
      "Decision,Resolve correction requests before leadership sharing.",
    );
    expect(csv).toContain("Proof basis,Included,2");
    expect(csv).toContain("Proof basis,Corrections,1");
    expect(csv).toContain("Proof basis,Missing proof,1");
  });

  it("exports proof operations readiness for a 100-read proof room", () => {
    const data: ReportExportData = {
      ...exportData,
      trust: [
        {
          key: "evidence_backed_reads",
          label: "Evidence-backed reads",
          value: "96/100",
          detail: "Native analytics screenshots",
        },
        {
          key: "verified_reads",
          label: "Verified reads",
          value: "91/100",
          detail: "Brand-reviewed proof",
        },
        {
          key: "report_status",
          label: "Report status",
          value: "2 correction pending",
          detail: "96/100 submitted",
        },
      ],
    };
    const json = JSON.parse(buildJsonContent(data)) as ReportExportData;
    const csv = buildCsvContent(data);
    const html = buildHtmlDocument(data);

    expect(json.proofOperations).toEqual({
      scope: "scale",
      state: "hold",
      label: "Scale proof room",
      decision: "Resolve correction requests before leadership sharing.",
      verifiedCoverage: "91/100",
      attentionCount: 9,
      proofBasis: [
        { key: "included", label: "Included", value: 91 },
        { key: "needs-review", label: "Needs review", value: 3 },
        { key: "corrections", label: "Corrections", value: 2 },
        { key: "missing-proof", label: "Missing proof", value: 4 },
      ],
    });
    expect(csv).toContain("Proof Operations");
    expect(csv).toContain("Scope,scale");
    expect(csv).toContain("Label,Scale proof room");
    expect(csv).toContain("Verified coverage,91/100");
    expect(csv).toContain("Attention count,9");
    expect(html).toContain('class="proof-operations"');
    expect(html).toContain('data-proof-operations-scope="scale"');
    expect(html).toContain('data-proof-operations-state="hold"');
    expect(html).toContain("Scale proof room");
    expect(html).toContain("91/100 verified");
    expect(html).toContain("9 open proof actions");
  });

  it("keeps proof operations visible when an export selects report trust without primary story", () => {
    const html = buildHtmlDocument({
      ...exportData,
      blocks: [
        {
          id: "report_trust",
          title: "Report trust",
          detail: "Evidence coverage and review state.",
        },
      ],
      trust: [
        {
          key: "evidence_backed_reads",
          label: "Evidence-backed reads",
          value: "96/100",
          detail: "Native analytics screenshots",
        },
        {
          key: "verified_reads",
          label: "Verified reads",
          value: "91/100",
          detail: "Brand-reviewed proof",
        },
        {
          key: "report_status",
          label: "Report status",
          value: "2 correction pending",
          detail: "96/100 submitted",
        },
      ],
    });

    expect(html).not.toContain("Primary report story");
    expect(html).toContain('class="proof-operations"');
    expect(html).toContain('data-proof-operations-scope="scale"');
    expect(html).toContain("91/100 verified");
  });

  it("keeps a precomputed leadership handoff authoritative when visible trust tiles are filtered", () => {
    const data: ReportExportData = {
      ...exportData,
      trust: [
        {
          key: "evidence_backed_reads",
          label: "Proof coverage",
          value: "1/1",
          detail: "Native analytics screenshots",
        },
        {
          key: "data_source",
          label: "Data source",
          value: "Manual entry",
          detail: "How metrics entered PopsDrops",
        },
      ],
      leadershipHandoff: {
        state: "ready",
        label: "Share with leadership",
        decision: "Ready for leadership sharing.",
        proofBasis: [
          { key: "included", label: "Included", value: 1 },
          { key: "needs-review", label: "Needs review", value: 0 },
          { key: "corrections", label: "Corrections", value: 0 },
          { key: "missing-proof", label: "Missing proof", value: 0 },
        ],
      },
    };

    const json = JSON.parse(buildJsonContent(data)) as ReportExportData;
    const csv = buildCsvContent(data);
    const html = buildHtmlDocument(data);

    expect(getReportTrustDecision(data)).toBe("Ready for leadership sharing.");
    expect(json.story?.trustDecision).toBe("Ready for leadership sharing.");
    expect(json.leadershipHandoff).toMatchObject({
      state: "ready",
      decision: "Ready for leadership sharing.",
    });
    expect(json.trust.find((item) => item.key === "data_source")).toMatchObject({
      value: "Brand-reviewed proof",
      detail: "Creator evidence reviewed by brand",
    });
    expect(csv).toContain("Leadership Handoff");
    expect(csv).toContain("State,ready");
    expect(csv).toContain("Data source,Brand-reviewed proof,Creator evidence reviewed by brand");
    expect(html).toContain('data-leadership-handoff-state="ready"');
    expect(html).toContain("Share with leadership");
  });

  it("builds CSV from creator performance rows", () => {
    const csv = buildCsvContent(exportData);

    expect(csv).toContain("Report Overview");
    expect(csv).toContain("Field,Value");
    expect(csv).toContain("Report title,Spring Launch / Seoul Report");
    expect(csv).toContain("Campaign,Spring Launch / Seoul");
    expect(csv).toContain("Generated,2026/05/06");
    expect(csv).toContain("Report window,2026/05/07 - 2026/05/15");
    expect(csv).toContain("Report Trust");
    expect(csv).toContain("Report Composition");
    expect(csv).toContain(
      "Report plan,Leadership brief,\"Board-ready summary, channel story, trust, and next actions.\"",
    );
    expect(csv).toContain(
      "Best for,Senior launch readouts and market-entry decisions.",
    );
    expect(csv).toContain(
      "Executive question,Did this campaign create enough confidence to continue the market launch?",
    );
    expect(csv).toContain("Chart,Trend view,Time-based growth and pacing.");
    expect(csv).toContain(
      "Chart layout,Timeline readout,\"Lead with movement over time, pacing, and the final decision signal.\"",
    );
    expect(csv).toContain("Report Decision Recipe");
    expect(csv).toContain(
      "Question,Did this campaign create enough confidence to continue the market launch?",
    );
    expect(csv).toContain(
      "Visual job,Timeline readout,\"Lead with movement over time, pacing, and the final decision signal.\"",
    );
    expect(csv).toContain(
      "Evidence gate,Evidence-backed reads: 6/6 / Brand-reviewed proof",
    );
    expect(csv).toContain(
      "Action,Compare first and latest reads before deciding.",
    );
    expect(csv).toContain("Cover,Campaign visual");
    expect(csv).toContain("Typography,Quiet");
    expect(csv).toContain("Density,Editorial");
    expect(csv).toContain("Report Blocks");
    expect(csv).toContain("ID,Title,Detail,Executive purpose");
    expect(csv).toContain(
      "executive_summary,Executive summary,Top KPIs for leadership.,\"Start with the leadership readout: outcome, spend, and confidence at a glance.\"",
    );
    expect(csv).toContain(
      "Data window,2026/05/30 - 2026/05/30,Platform read dates",
    );
    expect(csv).toContain(
      "Data source,Brand-reviewed proof,Creator evidence reviewed by brand",
    );
    expect(csv).not.toContain("May 30, 2026 ~ May 30, 2026");
    expect(csv).toContain("Recommendations");
    expect(csv).toContain("Top creator,Ava Kim,30.6K views on TikTok");
    expect(csv).toContain("Report Sections");
    expect(csv).toContain("Proof Source - X,Proof source,Engagements,8,1 read");
    expect(csv).toContain("Creator Performance");
    expect(csv).toContain("Creator,Market,Platform,Views,Engagements,ER,CPE,Spent,Rating");
    expect(csv).toContain('Ava Kim,South Korea,TikTok,30.6K,3.5K,11.4%,$0.43,"$1,500",-');
  });

  it("builds a standalone HTML report with inline charts", () => {
    const html = buildHtmlDocument(exportData);

    expect(html).toContain("<!doctype html>");
    expect(html).toContain("Spring Launch / Seoul Report");
    expect(html).toContain('data-report-chart-mode="trend"');
    expect(html).toContain("Primary report story");
    expect(html).toContain("report-story--trend");
    expect(html).toContain("Timeline readout");
    expect(html).toContain("Lead metric");
    expect(html).toContain("22.0K to 47.4K");
    expect(html).toContain('data-chart-recipe="trend-movement"');
    expect(html).toContain("Movement");
    expect(html).toContain("Start read");
    expect(html).toContain("Latest read");
    expect(html).toContain("Change");
    expect(html).toContain("+115%");
    expect(html).toContain("2026/05/09");
    expect(html).toContain("2026/05/18");
    expect(html).toContain("Evidence-backed reads");
    expect(html).toContain("Leadership brief");
    expect(html).toContain("Trend view");
    expect(html).toContain("Timeline readout");
    expect(html).toContain(
      "Lead with movement over time, pacing, and the final decision signal.",
    );
    expect(html).not.toContain("Report composition");
    expect(html).not.toContain("Decision recipe");
    expect(html).not.toContain("<p>Executive question</p>");
    expect(html).not.toContain("Report blocks");
    expect(html).toContain("Recommendations");
    expect(html).toContain("30.6K views on TikTok");
    expect(html).toContain("Proof source");
    expect(html).toContain("Supporting evidence only. Not mixed into campaign channel totals.");
    expect(html).toContain("<svg");
    expect(html).toContain("Ava Kim");
    expect(html).not.toContain("<link");
    expect(html).not.toContain("/_next");
    expect(html).not.toContain("http://localhost");
  });

  it("keeps the HTML story tied to decision, evidence, and next action", () => {
    const html = buildHtmlDocument(exportData);

    expect(html).toContain('class="proof-story-rail"');
    expect(html).toContain("Decision read");
    expect(html).toContain(
      "Did this campaign create enough confidence to continue the market launch?",
    );
    expect(html).toContain("Evidence trail");
    expect(html).toContain("Evidence-backed reads: 6/6 / Brand-reviewed proof");
    expect(html).toContain("Next action");
    expect(html).toContain("Compare first and latest reads before deciding.");
  });

  it("adds an executive trust decision when report proof still needs correction", () => {
    const html = buildHtmlDocument({
      ...exportData,
      composition: {
        ...exportData.composition!,
        chartModeId: "proof",
        chartModeTitle: "Proof view",
        chartLayoutTitle: "Evidence audit",
        chartLayoutDetail:
          "Lead with source coverage, review state, and missing proof before performance detail.",
      },
      trust: [
        {
          key: "evidence_backed_reads",
          label: "Proof coverage",
          value: "1/1",
          detail: "Native analytics screenshots",
        },
        {
          key: "verified_reads",
          label: "Verified reads",
          value: "0/1",
          detail: "Brand-reviewed proof",
        },
        {
          key: "report_status",
          label: "Report status",
          value: "Correction requested",
          detail: "Creator reporting tasks",
        },
        {
          key: "data_source",
          label: "Metric origin",
          value: "Manual entry",
          detail: "How metrics entered PopsDrops",
        },
      ],
    });

    expect(html).toContain("Trust decision");
    expect(html).toContain("Correction requested");
    expect(html).toContain("Resolve correction requests before leadership sharing.");
    expect(html).not.toContain("Ready for leadership sharing.");
  });

  it("keeps exported reports on hold when no proof reads have been submitted", () => {
    const data: ReportExportData = {
      ...exportData,
      trust: [
        {
          key: "evidence_backed_reads",
          label: "Evidence-backed reads",
          value: "0/0",
          detail: "Native analytics screenshots",
        },
        {
          key: "verified_reads",
          label: "Verified reads",
          value: "0/0",
          detail: "Brand-reviewed proof",
        },
        {
          key: "report_status",
          label: "Report status",
          value: "Ready for review",
          detail: "0/0 submitted",
        },
        {
          key: "data_source",
          label: "Data source",
          value: "Manual entry",
          detail: "How metrics entered PopsDrops",
        },
      ],
    };

    expect(getReportTrustDecision(data)).toBe(
      "Keep in proof room until at least one proof read is submitted and reviewed.",
    );

    const html = buildHtmlDocument({
      ...data,
      composition: {
        ...data.composition!,
        chartModeId: "proof",
        chartModeTitle: "Proof view",
      },
    });
    const json = JSON.parse(buildJsonContent(data)) as ReportExportData;
    const dataSource = json.trust.find((item) => item.key === "data_source");

    expect(html).toContain(
      "Keep in proof room until at least one proof read is submitted and reviewed.",
    );
    expect(html).not.toContain("Share the verified proof room with leadership.");
    expect(dataSource).toMatchObject({
      value: "Creator-entered proof",
      detail: "Creator-submitted values awaiting brand review",
    });
  });

  it("uses configured proof metrics on standalone HTML covers", () => {
    const html = buildHtmlDocument({
      ...exportData,
      kpis: [],
      trust: [
        {
          key: "evidence_backed_reads",
          label: "Proof coverage",
          value: "1/1",
          detail: "Native analytics screenshots",
        },
        {
          key: "verified_reads",
          label: "Verified reads",
          value: "0/1",
          detail: "Brand-reviewed proof",
        },
        {
          key: "report_status",
          label: "Report status",
          value: "1 awaiting review",
          detail: "1/1 submitted",
        },
        {
          key: "data_source",
          label: "Metric origin",
          value: "Manual entry",
          detail: "How metrics entered PopsDrops",
        },
      ],
    });

    expect(html).toContain(`data-cover-metric-source="trust" data-cover-metric-key="evidence_backed_reads"`);
    expect(html).toContain(`<span>Proof coverage</span>
                <strong>1/1</strong>
                <small>Native analytics screenshots</small>`);
    expect(html).toContain(`<span>Report status</span>
                <strong>1 awaiting review</strong>
                <small>1/1 submitted</small>`);
    expect(html).not.toContain("<span>Evidence status</span>");
  });

  it("keeps the HTML evidence rail truthful after teams rename proof tiles", () => {
    const html = buildHtmlDocument({
      ...exportData,
      trust: [
        {
          key: "evidence_backed_reads",
          label: "Proof coverage",
          value: "1/1",
          detail: "Native analytics screenshots",
        },
        {
          key: "data_source",
          label: "Metric origin",
          value: "Manual entry",
          detail: "How metrics entered PopsDrops",
        },
      ],
    });

    expect(html).toContain("Evidence trail");
    expect(html).toContain("Proof coverage: 1/1 / Creator-entered proof");
    expect(html).not.toContain("Evidence-backed reads: not reviewed");
  });

  it("applies brand-selected presentation controls to the standalone HTML artifact", () => {
    const html = buildHtmlDocument({
      ...exportData,
      composition: {
        ...exportData.composition!,
        presentation: {
          coverMode: "proof_room",
          typography: "compact",
          density: "compact",
        },
      },
    });

    expect(html).toContain('data-report-cover-mode="proof_room"');
    expect(html).toContain('data-report-typography="compact"');
    expect(html).toContain('data-report-density="compact"');
    expect(html).toContain("report-hero--proof-room");
    expect(html).toContain("report-document--compact");
    expect(html).toContain("report-document--dense");
  });

  it("uses a visual-led hero and editorial metric strip for board-ready exports", () => {
    const html = buildHtmlDocument({
      ...exportData,
      kpis: [
        ...exportData.kpis,
        {
          key: "cpe",
          label: "Cost per Engagement",
          value: "$0.43",
          detail: "$1,500 spend",
        },
        {
          key: "saves",
          label: "Saved proof",
          value: "184",
          detail: "Creator-confirmed saves",
        },
      ],
    });

    expect(html).toContain('class="report-hero report-hero--visual-led"');
    expect(html).toContain('<figure class="campaign-visual campaign-visual--hero">');
    expect(html).toContain('<section class="metric-strip metric-strip--editorial"');
    expect(html).toContain('<article class="metric-tile" data-summary-metric-key="cpe">');
    expect(html).toContain(".metric-strip--editorial {");
    expect(html).toContain(".metric-tile + .metric-tile {");
    expect(html).not.toContain('class="metric-card"');
    expect(html).not.toContain(".metric-card");
  });

  it("does not repeat cover KPIs inside the body scorecard", () => {
    const reportData: ReportExportData = {
      ...exportData,
      kpis: [
        {
          key: "views",
          label: "Qualified reach",
          value: "47.4K",
          detail: "2 channels",
        },
        {
          key: "engagementRate",
          label: "Engagement signal",
          value: "13.1%",
          detail: "All Channels",
        },
        {
          key: "cpe",
          label: "Efficiency signal",
          value: "$0.43",
          detail: "$1,500 spend",
        },
      ],
    };
    const html = buildHtmlDocument(reportData);

    expect(getReportBodyKpis(reportData).map((metric) => metric.key)).toEqual([
      "cpe",
    ]);
    expect(html).toContain('data-cover-metric-key="views"');
    expect(html).toContain('data-cover-metric-key="engagementRate"');
    expect(html).not.toContain('data-summary-metric-key="views"');
    expect(html).not.toContain('data-summary-metric-key="engagementRate"');
    expect(html).toContain('data-summary-metric-key="cpe"');
    expect(html).toContain("Efficiency signal");
  });

  it("renders a single remaining body KPI as a compact leadership watchpoint", () => {
    const reportData: ReportExportData = {
      ...exportData,
      kpis: [
        {
          key: "views",
          label: "Qualified reach",
          value: "47.4K",
          detail: "2 channels",
        },
        {
          key: "engagementRate",
          label: "Engagement signal",
          value: "13.1%",
          detail: "All Channels",
        },
        {
          key: "cpe",
          label: "Efficiency signal",
          value: "$0.43",
          detail: "$1,500 spend",
        },
      ],
    };
    const html = buildHtmlDocument(reportData);

    expect(getReportBodyKpis(reportData).map((metric) => metric.key)).toEqual([
      "cpe",
    ]);
    expect(html).toContain('<section class="metric-callout"');
    expect(html).toContain('data-section-label="Executive summary"');
    expect(html).toContain("Leadership watchpoint");
    expect(html).toContain('data-summary-metric-key="cpe"');
    expect(html).not.toContain('<section class="metric-strip metric-strip--editorial"');
  });

  it("omits the body scorecard when every selected KPI is already on the cover", () => {
    const reportData: ReportExportData = {
      ...exportData,
      kpis: [
        {
          key: "views",
          label: "Qualified reach",
          value: "47.4K",
          detail: "2 channels",
        },
        {
          key: "engagementRate",
          label: "Engagement signal",
          value: "13.1%",
          detail: "All Channels",
        },
      ],
    };
    const html = buildHtmlDocument(reportData);

    expect(getReportBodyKpis(reportData)).toEqual([]);
    expect(html).toContain('data-cover-metric-key="views"');
    expect(html).toContain('data-cover-metric-key="engagementRate"');
    expect(html).not.toContain('data-summary-metric-key="views"');
    expect(html).not.toContain('data-summary-metric-key="engagementRate"');
    expect(html).not.toContain("Cover scorecard");
  });

  it("uses brand-renamed section labels in the standalone HTML artifact", () => {
    const html = buildHtmlDocument({
      ...exportData,
      blocks: [
        {
          id: "executive_summary",
          title: "Board evidence scorecard",
          detail: "Top KPIs for leadership.",
        },
        {
          id: "channel_story",
          title: "Channel evidence story",
          detail: "Platform-native performance charts.",
        },
        {
          id: "report_trust",
          title: "Audit confidence",
          detail: "Evidence coverage and review state.",
        },
        {
          id: "recommendations",
          title: "Next market actions",
          detail: "Data-earned next actions.",
        },
      ],
    });

    expect(html).not.toContain('data-section-label="Board evidence scorecard"');
    expect(html).toContain("Channel evidence story");
    expect(html).toContain('data-section-label="Audit confidence"');
    expect(html).toContain("<h2>Next market actions</h2>");
  });

  it("uses brand-renamed KPI and proof tile labels in the standalone HTML artifact", () => {
    const html = buildHtmlDocument({
      ...exportData,
      kpis: exportData.kpis.map((item) =>
        item.label === "Views"
          ? { ...item, label: "Qualified reach" }
          : item.label === "Engagement Rate"
            ? { ...item, label: "Efficiency signal" }
            : item,
      ),
      trust: exportData.trust.map((item) =>
        item.label === "Evidence-backed reads"
          ? { ...item, label: "Proof coverage" }
          : item.label === "Data source"
            ? { ...item, label: "Metric origin" }
            : item,
      ),
    });

    expect(html).toContain("<span>Qualified reach</span>");
    expect(html).toContain("<span>Efficiency signal</span>");
    expect(html).toContain("<p>Proof coverage</p>");
    expect(html).toContain("<p>Metric origin</p>");
  });

  it("uses brand-renamed KPI labels inside comparison detail rows", () => {
    const html = buildHtmlDocument({
      ...exportData,
      composition: {
        ...exportData.composition!,
        chartModeId: "comparison",
        chartModeTitle: "Comparison view",
        chartLayoutTitle: "Ranked comparison",
        chartLayoutDetail:
          "Lead with creator and channel contrast before detail rows.",
        presentation: {
          chartMetricKey: "cpe",
          coverMode: "campaign_visual",
          density: "compact",
          kpiLabels: {
            cpe: "Efficiency signal",
            engagements: "Audience actions",
            views: "Qualified reach",
          },
          typography: "compact",
        },
      },
      kpis: [
        { key: "views", label: "Qualified reach", value: "47.4K", detail: "2 channels" },
        {
          key: "engagements",
          label: "Audience actions",
          value: "3.5K",
          detail: "2 channels",
        },
        { key: "cpe", label: "Efficiency signal", value: "$0.43", detail: "$1,500 spend" },
      ],
    });

    expect(html).toContain("Creator comparison by Efficiency signal");
    expect(html).toContain("Qualified reach 30.6K");
    expect(html).toContain("Audience actions 3.5K");
    expect(html).not.toContain("Views 30.6K");
    expect(html).not.toContain("Engagements 3.5K");
  });

  it("renders selected report blocks in the brand-chosen story order", () => {
    const html = buildHtmlDocument({
      ...exportData,
      kpis: [
        ...exportData.kpis,
        {
          key: "cpe",
          label: "Cost per Engagement",
          value: "$0.43",
          detail: "$1,500 spend",
        },
      ],
      blocks: [
        {
          id: "recommendations",
          title: "Recommendations",
          detail: "Data-earned next actions.",
        },
        {
          id: "executive_summary",
          title: "Executive summary",
          detail: "Top KPIs for leadership.",
        },
        {
          id: "channel_story",
          title: "Channel story",
          detail: "Platform-native performance charts.",
        },
        {
          id: "report_trust",
          title: "Report trust",
          detail: "Evidence coverage and review state.",
        },
      ],
    });

    const recommendationsIndex = html.indexOf(
      '<section class="recommendations recommendation-memo">',
    );
    const executiveIndex = html.indexOf('<section class="metric-callout"');
    const channelIndex = html.indexOf('<section class="report-story');
    const trustIndex = html.indexOf('<section class="trust-grid"');

    expect(recommendationsIndex).toBeGreaterThan(-1);
    expect(executiveIndex).toBeGreaterThan(-1);
    expect(channelIndex).toBeGreaterThan(-1);
    expect(trustIndex).toBeGreaterThan(-1);
    expect(recommendationsIndex).toBeLessThan(executiveIndex);
    expect(executiveIndex).toBeLessThan(channelIndex);
    expect(channelIndex).toBeLessThan(trustIndex);
  });

  it("frames the standalone HTML report as an executive proof artifact", () => {
    const html = buildHtmlDocument(exportData);

    expect(html).toContain('class="report-hero report-hero--visual-led"');
    expect(html).toContain("Global Proof Room");
    expect(html).toContain("Proof-backed campaign report");
    expect(html).toContain('class="report-meta report-evidence-strip"');
    expect(html).toContain('data-cover-metric-source="kpi" data-cover-metric-key="views"');
    expect(html).toContain("Views");
    expect(html).toContain('data-cover-metric-source="kpi" data-cover-metric-key="engagementRate"');
    expect(html).toContain("Engagement Rate");
    expect(html).toContain('data-cover-metric-source="trust" data-cover-metric-key="evidence_backed_reads"');
    expect(html).toContain("Evidence-backed reads");
    expect(html).not.toContain("<span>Report type</span>");
    expect(html).not.toContain("<span>Primary view</span>");
    expect(html).not.toContain("<span>Evidence status</span>");
    expect(html).toContain("--shadow: 0 18px 48px rgba(15, 23, 42, 0.07);");
    expect(html).toContain(".report-story {");
    expect(html).toContain("box-shadow: var(--shadow);");
  });

  it("uses a snapshot recipe instead of a line chart when there is only one read", () => {
    const singleReadData: ReportExportData = {
      ...exportData,
      sections: [
        {
          title: "TikTok",
          detail: "Platform-native metrics",
          sourceGroup: "campaign_channel",
          metrics: [
            {
              label: "Views",
              value: "12.0K",
              detail: "1 read",
              points: [{ date: "2026-05-30", value: 12000, label: "12.0K" }],
            },
          ],
        },
      ],
    };
    const html = buildHtmlDocument(singleReadData);

    expect(html).toContain("Snapshot read");
    expect(html).toContain(
      "One verified read; use a snapshot until there is enough history for a trend.",
    );
    expect(html).toContain("2026/05/30");
    expect(html).not.toContain('<svg class="chart-svg"');
    expect(html).not.toContain('<path class="chart-line"');
  });

  it("keeps repeated single-read detail metrics compact after the primary story", () => {
    const singleReadData: ReportExportData = {
      ...exportData,
      sections: [
        {
          title: "TikTok",
          detail: "Platform-native metrics",
          sourceGroup: "campaign_channel",
          metrics: [
            {
              label: "Views",
              value: "12.0K",
              detail: "1 read",
              points: [{ date: "2026-05-30", value: 12000, label: "12.0K" }],
            },
            {
              label: "Engagements",
              value: "933",
              detail: "1 read",
              points: [{ date: "2026-05-30", value: 933, label: "933" }],
            },
          ],
        },
      ],
    };
    const html = buildHtmlDocument(singleReadData);

    const guidanceCount = html.match(/One verified read; use a snapshot/g)?.length ?? 0;

    expect(guidanceCount).toBe(1);
    expect(html).toContain('class="metric-ledger" data-chart-recipe="single-read-ledger"');
    expect(html).toContain('<span class="ledger-date">2026/05/30</span>');
    expect(html).toContain("<strong>12.0K</strong>");
    expect(html).toContain("<strong>933</strong>");
    expect(html).not.toContain('class="chart-card"');
    expect(html).not.toContain('<span>Read date</span>');
    expect(html).not.toContain('class="snapshot-card snapshot-card--compact"');
  });

  it("renders recommendations and creator rows as executive detail, not card noise", () => {
    const html = buildHtmlDocument(exportData);

    expect(html).toContain('<section class="recommendations recommendation-memo">');
    expect(html).toContain('<div class="recommendation-primary">');
    expect(html).toContain("<p>Recommended move</p>");
    expect(html).toContain("<small>Supporting evidence</small>");
    expect(html).toContain('<span class="decision-index">02</span>');
    expect(html).toContain('<div class="creator-table-head">');
    expect(html).toContain("Creator-level evidence");
    expect(html).toContain("<strong>Ava Kim</strong>");
    expect(html).toContain(".creator-table td strong");
    expect(html).not.toContain('class="recommendation-card"');
  });

  it("keeps standalone report typography restrained for executive forwarding", () => {
    const html = buildHtmlDocument(exportData);

    expect(html).toContain("--mono-font: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", monospace;");
    expect(html).toContain("--value: #475569;");
    expect(html).toContain("font-size: 25px;");
    expect(html).toContain("font-weight: 610;");
    expect(html).toContain(".brand { font-size: 20px; font-weight: 650;");
    expect(html).toContain(".metric-tile strong {\n        color: var(--value);");
    expect(html).toContain("font-family: var(--mono-font);");
    expect(html).toContain("font-size: 13px;");
    expect(html).toContain("font-weight: 500;");
    expect(html).toContain("overflow-wrap: anywhere;");
    expect(html).toContain(".composition-row strong {\n        color: var(--value);");
    expect(html).toContain("font-size: 14px;");
    expect(html).toContain("font-weight: 580;");
    expect(html).toContain(".block-row strong {\n        color: var(--value);");
    expect(html).toContain(".trust-card strong {\n        color: var(--value);");
    expect(html).toContain("font-family: var(--mono-font);");
    expect(html).toContain("font-size: 13px;");
    expect(html).toContain("font-weight: 500;");
    expect(html).toContain(".trust-card--date strong {\n        font-size: 11px;");
    expect(html).toContain(".chart-card-head strong {\n        color: var(--value);");
  });

  it("formats report dates and hero visuals like a premium artifact", () => {
    const html = buildHtmlDocument(exportData);

    expect(html).toContain('<div class="generated">Generated 2026/05/06</div>');
    expect(html).toContain('<p class="date-range"><span>Report window</span>2026/05/07 - 2026/05/15</p>');
    expect(html).toContain("<strong>2026/05/30 - 2026/05/30</strong>");
    expect(html).toContain('<p class="decision-question"><span>Executive question</span>');
    expect(html).toContain('<aside class="report-meta report-evidence-strip" aria-label="Report summary">');
    expect(html).toContain('<div class="report-evidence-item" data-cover-metric-source="trust" data-cover-metric-key="evidence_backed_reads">');
    expect(html).toContain('<article class="trust-card">\n              <p>Evidence-backed reads</p>\n              <strong>6/6</strong>');
    expect(html).toContain('<article class="trust-card trust-card--date">\n              <p>Data window</p>\n              <strong>2026/05/30 - 2026/05/30</strong>');
    expect(html).toContain('<figure class="campaign-visual campaign-visual--hero">');
    expect(html).toContain('src="https://example.com/campaign-cover.jpg"');
    expect(html).toContain('alt="Maison Lumiere hero visual"');
    expect(html).toContain('<figcaption>Maison Lumiere hero visual</figcaption>');
    expect(html).toContain("object-fit: contain;");
    expect(html).toContain("padding: 18px 18px 58px;");
    expect(html).not.toContain("object-fit: cover;");
    expect(html).not.toContain('alt="Spring Launch / Seoul Report campaign visual"');
    expect(html).toContain(".report-hero {");
    expect(html).toContain("overflow: hidden;");
    expect(html).toContain("padding: 0;");
    expect(html).toContain(".report-title-stack {\n        display: flex;");
    expect(html).toContain("justify-content: flex-start;");
    expect(html).toContain(".decision-question {\n        border-inline-start: 2px solid var(--ink);");
    expect(html).toContain(".report-evidence-strip {\n        border-top: 1px solid var(--line);");
    expect(html).toContain(".report-evidence-item + .report-evidence-item");
    expect(html).toContain(".campaign-visual {\n        align-self: stretch;");
    expect(html).toContain("min-height: 230px;");
    expect(html).toContain(".trust-card--date strong {\n        font-size: 11px;");
    expect(html).toContain("font-weight: 540;");
    expect(html).not.toContain("May 7, 2026 to May 15, 2026");
    expect(html).not.toContain("May 30, 2026 ~ May 30, 2026");
  });

  it("uses brand-written executive framing for the artifact title and decision read", () => {
    const html = buildHtmlDocument({
      ...exportData,
      composition: {
        ...exportData.composition!,
        reportTitle: "Korea board readout",
        executiveQuestion: "Should leadership expand the launch budget?",
      },
    });

    expect(html).toContain("<title>Korea board readout</title>");
    expect(html).toContain("<h1>Korea board readout</h1>");
    expect(html).toContain("Should leadership expand the launch budget?");
    expect(html).not.toContain("Spring Launch / Seoul Report");
  });

  it("shows report framing only when the brand selects that block", () => {
    const html = buildHtmlDocument({
      ...exportData,
      composition: {
        ...exportData.composition!,
        templateName: "Global launch leadership proof",
        templateDescription: "The team default for executive launch readouts.",
      },
      blocks: [
        {
          id: "report_framing",
          title: "Report framing",
          detail: "Optional preset, chart mode, and executive question context.",
        },
        ...exportData.blocks!,
      ],
    });

    const csv = buildCsvContent({
      ...exportData,
      composition: {
        ...exportData.composition!,
        templateName: "Global launch leadership proof",
        templateDescription: "The team default for executive launch readouts.",
      },
      blocks: [
        {
          id: "report_framing",
          title: "Report framing",
          detail: "Optional preset, chart mode, and executive question context.",
        },
        ...exportData.blocks!,
      ],
    });

    expect(html).toContain("Report composition");
    expect(html).toContain("Report plan");
    expect(html).toContain("Leadership brief");
    expect(html).toContain('class="composition-ledger"');
    expect(html).toContain('class="composition-row"');
    expect(html).toContain('data-composition-row="report-plan"');
    expect(html).toContain('data-composition-row="executive-question"');
    expect(html).toContain('data-composition-row="chart-mode"');
    expect(html).toContain('data-composition-row="chart-layout"');
    expect(html).not.toContain('class="composition-grid"');
    expect(html).not.toContain('class="composition-card"');
    expect(html).not.toContain("Team template");
    expect(html).not.toContain("Global launch leadership proof");
    expect(csv).toContain("Report plan");
    expect(csv).not.toContain("Team template");
    expect(csv).not.toContain("Global launch leadership proof");
    expect(html).toContain('class="decision-recipe" data-chart-recipe="decision-recipe"');
    expect(html).toContain('class="decision-recipe-rail"');
    expect(html).toContain('class="decision-recipe-step"');
    expect(html).toContain('data-recipe-step="question"');
    expect(html).toContain('<span class="decision-recipe-index">01</span>');
    expect(html).toContain("Decision recipe");
    expect(html).toContain("Question, visual job, evidence gate, and action");
    expect(html).toContain("<p>Question</p>");
    expect(html).toContain(
      "Did this campaign create enough confidence to continue the market launch?",
    );
    expect(html).toContain("<p>Visual job</p>");
    expect(html).not.toContain("<p>Comparison</p>");
    expect(html).toContain("Timeline readout");
    expect(html).toContain("<p>Evidence gate</p>");
    expect(html).toContain("Evidence-backed reads: 6/6 / Brand-reviewed proof");
    expect(html).toContain("<p>Action</p>");
    expect(html).toContain("Compare first and latest reads before deciding.");
    expect(html).not.toContain('class="decision-recipe-grid"');
    expect(html).toContain("Executive question");
    expect(html).toContain(
      "Did this campaign create enough confidence to continue the market launch?",
    );
    expect(html).toContain("Report blocks");
    expect(html).toContain("6 selected");
    expect(html).toContain('class="block-ledger"');
    expect(html).toContain('class="block-row"');
    expect(html).toContain('data-report-block-row="executive_summary"');
    expect(html).toContain('data-report-block-row="channel_story"');
    expect(html).toContain('data-report-block-row="report_trust"');
    expect(html).not.toContain('class="block-grid"');
    expect(html).not.toContain('class="block-card"');
    expect(html).not.toContain("<p>Report framing</p>");
  });

  it("changes the standalone HTML report body for comparison mode", () => {
    const html = buildHtmlDocument({
      ...exportData,
      composition: {
        ...exportData.composition!,
        chartModeId: "comparison",
        chartModeTitle: "Comparison view",
        chartModeDetail: "Rank creators and channels by what leadership can act on.",
        chartLayoutTitle: "Ranked comparison",
        chartLayoutDetail:
          "Lead with the strongest creator, channel, or market contrast.",
      },
      creators: [
        ...exportData.creators,
        {
          name: "Mina Park",
          market: "South Korea",
          platform: "Instagram",
          views: "12.0K",
          engagements: "900",
          er: "7.5%",
          cpe: "$0.88",
          spent: "$800",
          rating: "-",
        },
      ],
    });

    expect(html).toContain('data-report-chart-mode="comparison"');
    expect(html).toContain("report-story--comparison");
    expect(html).toContain("Ranked comparison");
    expect(html).toContain("Creator comparison");
    expect(html).toContain("Ava Kim");
    expect(html).toContain("Mina Park");
    expect(html).toContain("comparison-rank");
  });

  it("ranks comparison reports by the brand-selected chart metric", () => {
    const html = buildHtmlDocument({
      ...exportData,
      composition: {
        ...exportData.composition!,
        chartModeId: "comparison",
        chartModeTitle: "Comparison view",
        chartModeDetail: "Rank creators and channels by what leadership can act on.",
        chartLayoutTitle: "Ranked comparison",
        chartLayoutDetail:
          "Lead with the strongest creator, channel, or market contrast.",
        presentation: {
          coverMode: "campaign_visual",
          typography: "quiet",
          density: "editorial",
          chartMetricKey: "cpe",
        },
      },
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
          market: "South Korea",
          platform: "Instagram",
          views: "12.0K",
          engagements: "900",
          er: "7.5%",
          cpe: "$0.32",
          spent: "$800",
          rating: "-",
        },
      ],
    });

    const minaIndex = html.indexOf("<strong>Mina Park</strong>");
    const avaIndex = html.indexOf("<strong>Ava Kim</strong>");

    expect(html).toContain('data-comparison-focus="cpe"');
    expect(html).toContain("Creator comparison by Cost per Engagement");
    expect(html).toContain("Sorted by Cost per Engagement. Lower CPE ranks first.");
    expect(html).toContain("Cost per Engagement $0.32");
    expect(minaIndex).toBeGreaterThan(-1);
    expect(avaIndex).toBeGreaterThan(-1);
    expect(minaIndex).toBeLessThan(avaIndex);
  });

  it("changes the standalone HTML report body for proof mode", () => {
    const html = buildHtmlDocument({
      ...exportData,
      composition: {
        ...exportData.composition!,
        chartModeId: "proof",
        chartModeTitle: "Proof view",
        chartModeDetail: "Audit the evidence behind the numbers.",
        chartLayoutTitle: "Evidence audit",
        chartLayoutDetail:
          "Lead with source coverage, creator confirmation, and review state.",
      },
    });

    expect(html).toContain('data-report-chart-mode="proof"');
    expect(html).toContain("report-story--proof");
    expect(html).toContain("Evidence audit");
    expect(html).toContain("Proof source readiness");
    expect(html).toContain("Evidence-backed reads");
    expect(html).toContain("Data source");
    expect(html).toContain("Proof Source - X");
  });

  it("keeps proof-mode HTML copy aligned with verified evidence when campaign metric sections are omitted", () => {
    const html = buildHtmlDocument({
      ...exportData,
      composition: {
        ...exportData.composition!,
        chartModeId: "proof",
        chartModeTitle: "Proof view",
        chartModeDetail: "Evidence coverage and source confidence first.",
        chartLayoutTitle: "Evidence audit",
        chartLayoutDetail:
          "Lead with source coverage, creator confirmation, and review state.",
      },
      blocks: [
        {
          id: "proof_sources",
          title: "Proof sources",
          detail: "Supporting channels kept separate from totals.",
          executivePurpose:
            "Keep non-primary evidence visible while protecting campaign totals from unsupported comparisons.",
        },
        {
          id: "report_trust",
          title: "Report trust",
          detail: "Evidence coverage and review state.",
          executivePurpose:
            "Show legal, finance, and leadership how each number was evidenced and reviewed.",
        },
      ],
      sections: [],
    });

    expect(html).toContain("Evidence-backed reads: 6/6 / Brand-reviewed proof");
    expect(html).toContain("Share the verified proof room with leadership.");
    expect(html).not.toContain("No metric reads yet.");
    expect(html).not.toContain(
      "Resolve missing or unreviewed evidence before leadership sharing.",
    );
  });

  it("does not render a missing proof-source card when proof coverage is already evidenced", () => {
    const html = buildHtmlDocument({
      ...exportData,
      composition: {
        ...exportData.composition!,
        chartModeId: "proof",
        chartModeTitle: "Proof view",
        chartModeDetail: "Evidence coverage and source confidence first.",
        chartLayoutTitle: "Evidence audit",
        chartLayoutDetail:
          "Lead with source coverage, creator confirmation, and review state.",
      },
      sections: exportData.sections.filter(
        (section) => section.sourceGroup !== "proof_source",
      ),
      trust: [
        {
          key: "evidence_backed_reads",
          label: "Proof coverage",
          value: "1/1",
          detail: "Native analytics screenshots",
        },
        {
          key: "data_source",
          label: "Metric origin",
          value: "Manual entry",
          detail: "Creator-entered, brand-reviewed metrics",
        },
      ],
    });

    expect(html).toContain("Proof source summary");
    expect(html).toContain("Native analytics screenshots");
    expect(html).toContain("Proof coverage: 1/1");
    expect(html).not.toContain("<strong>None</strong>");
    expect(html).not.toContain("No additional proof-source lanes were included.");
  });

  it("exports proof-mode leadership impact counts before proof detail cards", () => {
    const html = buildHtmlDocument({
      ...exportData,
      composition: {
        ...exportData.composition!,
        chartModeId: "proof",
        chartModeTitle: "Proof view",
        chartModeDetail: "Evidence coverage and source confidence first.",
        chartLayoutTitle: "Evidence audit",
        chartLayoutDetail:
          "Lead with source coverage, creator confirmation, and review state.",
      },
      trust: [
        {
          key: "evidence_backed_reads",
          label: "Proof coverage",
          value: "3/3",
          detail: "Native analytics screenshots",
        },
        {
          key: "verified_reads",
          label: "Verified reads",
          value: "2/3",
          detail: "Brand-reviewed proof",
        },
        {
          key: "report_status",
          label: "Report status",
          value: "1 correction pending",
          detail: "Creator reporting tasks",
        },
        {
          key: "data_source",
          label: "Metric origin",
          value: "Manual entry",
          detail: "Creator-entered, brand-reviewed metrics",
        },
      ],
    });

    expect(html).toContain("Leadership impact");
    expect(html).toContain("What is included in leadership totals");
    expect(html).toContain('data-impact-key="included"');
    expect(html).toContain("<strong>2</strong>");
    expect(html).toContain("Included");
    expect(html).toContain('data-impact-key="needs-review"');
    expect(html).toContain("Needs review");
    expect(html).toContain('data-impact-key="corrections"');
    expect(html).toContain("Corrections");
    expect(html).toContain('data-impact-key="missing-proof"');
    expect(html).toContain("Missing proof");
  });

  it("exports the leadership handoff gate with proof-basis counts", () => {
    const html = buildHtmlDocument({
      ...exportData,
      composition: {
        ...exportData.composition!,
        chartModeId: "proof",
        chartModeTitle: "Proof view",
        chartModeDetail: "Evidence coverage and source confidence first.",
        chartLayoutTitle: "Evidence audit",
        chartLayoutDetail:
          "Lead with source coverage, creator confirmation, and review state.",
      },
    });

    expect(html).toContain('class="leadership-handoff"');
    expect(html).toContain('data-leadership-handoff-state="ready"');
    expect(html).toContain("Leadership handoff");
    expect(html).toContain("Share with leadership");
    expect(html).toContain("Ready for leadership sharing.");
    expect(html).toContain("Proof basis");
    expect(html).toContain('data-proof-basis-key="included"');
    expect(html).toContain("<strong>6</strong>");
    expect(html).toContain('data-proof-basis-key="needs-review"');
    expect(html).toContain('data-proof-basis-key="corrections"');
    expect(html).toContain('data-proof-basis-key="missing-proof"');
  });

  it("exports the leadership handoff gate in trend mode too", () => {
    const html = buildHtmlDocument({
      ...exportData,
      composition: {
        ...exportData.composition!,
        chartModeId: "trend",
        chartModeTitle: "Trend view",
        chartModeDetail: "Time-based growth and pacing.",
        chartLayoutTitle: "Timeline readout",
        chartLayoutDetail:
          "Lead with movement over time, pacing, and the final decision signal.",
      },
    });

    expect(html).toContain('data-report-chart-mode="trend"');
    expect(html).toContain('class="leadership-handoff"');
    expect(html).toContain('data-leadership-handoff-state="ready"');
    expect(html).toContain("Share with leadership");
    expect(html).toContain("Proof basis");
    expect(html).toContain('data-proof-basis-key="included"');
  });

  it("exports a hold-state leadership handoff when proof is missing or not reviewed", () => {
    const html = buildHtmlDocument({
      ...exportData,
      composition: {
        ...exportData.composition!,
        chartModeId: "proof",
        chartModeTitle: "Proof view",
        chartModeDetail: "Evidence coverage and source confidence first.",
        chartLayoutTitle: "Evidence audit",
        chartLayoutDetail:
          "Lead with source coverage, creator confirmation, and review state.",
      },
      trust: [
        {
          key: "evidence_backed_reads",
          label: "Proof coverage",
          value: "3/4",
          detail: "Native analytics screenshots",
        },
        {
          key: "verified_reads",
          label: "Verified reads",
          value: "2/4",
          detail: "Brand-reviewed proof",
        },
        {
          key: "data_source",
          label: "Metric origin",
          value: "Manual entry",
          detail: "Creator-entered, waiting for brand review",
        },
      ],
    });

    expect(html).toContain('data-leadership-handoff-state="hold"');
    expect(html).toContain("Leadership handoff");
    expect(html).toContain("Keep in proof room");
    expect(html).toContain(
      "Keep in proof room until all required proof is present.",
    );
    expect(html).toContain("Proof basis");
    expect(html).toContain('data-proof-basis-key="included"');
    expect(html).toContain("<strong>2</strong>");
    expect(html).toContain('data-proof-basis-key="needs-review"');
    expect(html).toContain("<strong>1</strong>");
    expect(html).toContain('data-proof-basis-key="missing-proof"');
  });

  it("keeps the Supabase report worker aligned with proof-mode trust copy", () => {
    const workerSource = readFileSync(
      "supabase/functions/_shared/report-export.ts",
      "utf8",
    );

    expect(workerSource).toContain("Share the verified proof room with leadership.");
    expect(workerSource).toContain("const storySummary = chartModeId === \"proof\"");
    expect(workerSource).toContain("getReportEvidenceTrail(data)");
    expect(workerSource).toContain("function getEvidenceCoverageItem");
    expect(workerSource).toContain("Proof source summary");
    expect(workerSource).toContain("Leadership impact");
    expect(workerSource).toContain("getReportLeadershipImpactSummary");
    expect(workerSource).toContain("buildHtmlLeadershipHandoffGate");
    expect(workerSource).toContain("data-leadership-handoff-state");
    expect(workerSource).toContain("data-proof-basis-key");
    expect(workerSource).not.toContain(
      'return "Resolve missing or unreviewed evidence before leadership sharing.";',
    );
    expect(workerSource).not.toContain("No additional proof-source lanes were included.");
  });
});
