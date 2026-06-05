import { describe, expect, it } from "vitest";
import {
  buildCsvContent,
  buildHtmlDocument,
  buildJsonContent,
  getReportBodyKpis,
  type ReportExportData,
} from "./report-export.ts";

function singleReadReport(): ReportExportData {
  return {
    campaignTitle: "Application Flow Smoke Campaign",
    dateRange: "Jun 7, 2026 to Jun 10, 2026",
    generatedAt: "2026-05-30T00:00:00.000Z",
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
    kpis: [{ label: "Views", value: "12.0K", detail: "1 channel" }],
    trust: [
      {
        label: "Evidence-backed reads",
        value: "1/1",
        detail: "Native analytics screenshots",
      },
      {
        label: "Data window",
        value: "May 30, 2026 ~ May 30, 2026",
        detail: "Platform read dates",
      },
    ],
    recommendations: [
      {
        title: "Top creator",
        value: "Dev Creator",
        detail: "12.0K views on TikTok",
      },
    ],
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
    creators: [],
  };
}

describe("Supabase report export artifact", () => {
  it("uses snapshot cards instead of line charts for single-read exports", () => {
    const html = buildHtmlDocument(singleReadReport());

    expect(html).toContain("Snapshot read");
    expect(html).toContain(
      "One verified read; use a snapshot until there is enough history for a trend.",
    );
    expect(html).toContain("2026/05/30");
    expect(html).not.toContain('<svg class="chart-svg"');
    expect(html).not.toContain('<path class="chart-line"');
  });

  it("keeps durable HTML exports tied to decision, evidence, and next action", () => {
    const html = buildHtmlDocument({
      ...singleReadReport(),
      trust: [
        ...singleReadReport().trust,
        {
          label: "Data source",
          value: "Manual entry",
          detail: "How metrics entered PopsDrops",
        },
      ],
    });

    expect(html).toContain('class="proof-story-rail"');
    expect(html).toContain("Decision read");
    expect(html).toContain(
      "Did this campaign create enough confidence to continue the market launch?",
    );
    expect(html).toContain("Evidence trail");
    expect(html).toContain("Evidence-backed reads: 1/1 / Creator-entered proof");
    expect(html).toContain("Next action");
    expect(html).toContain("Compare first and latest reads before deciding.");
    expect(html).toContain("Trust decision");
    expect(html).toContain("Keep in proof room until evidence is reviewed.");
  });

  it("keeps proof review provenance in durable JSON, CSV, and HTML exports", () => {
    const report: ReportExportData = {
      ...singleReadReport(),
      proofReview: {
        label: "Proof review",
        value: "Reviewed 2026/06/04",
        detail: "Reviewer recorded",
        reviewedAt: "2026-06-04T03:20:00.000Z",
        reviewerRecorded: true,
      },
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
          value: "Brand-reviewed proof",
          detail: "Creator evidence reviewed by brand",
        },
      ],
    };
    const html = buildHtmlDocument(report);
    const csv = buildCsvContent(report);
    const json = JSON.parse(buildJsonContent(report)) as ReportExportData;

    expect(json.proofReview).toMatchObject({
      value: "Reviewed 2026/06/04",
      detail: "Reviewer recorded",
    });
    expect(json.story?.evidenceTrail).toBe(
      "Proof coverage: 1/1 / Brand-reviewed proof / Reviewed 2026/06/04",
    );
    expect(csv).toContain("Proof Review");
    expect(csv).toContain("Proof review,Reviewed 2026/06/04,Reviewer recorded");
    expect(html).toContain("Proof review");
    expect(html).toContain("Reviewed 2026/06/04");
    expect(html).toContain(
      "Proof coverage: 1/1 / Brand-reviewed proof / Reviewed 2026/06/04",
    );
  });

  it("adds a durable executive trust decision when report proof still needs correction", () => {
    const html = buildHtmlDocument({
      ...singleReadReport(),
      composition: {
        ...singleReadReport().composition!,
        chartModeId: "proof",
        chartModeTitle: "Proof view",
        chartLayoutTitle: "Evidence audit",
        chartLayoutDetail:
          "Lead with source coverage, review state, and missing proof before performance detail.",
      },
      blocks: [
        {
          id: "proof_sources",
          title: "Proof sources",
          detail: "Evidence readiness by source.",
        },
        {
          id: "report_trust",
          title: "Report trust",
          detail: "Evidence coverage and review state.",
        },
      ],
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

  it("keeps durable exports on leadership hold when no proof reads have been submitted", () => {
    const report: ReportExportData = {
      ...singleReadReport(),
      composition: {
        ...singleReadReport().composition!,
        chartModeId: "proof",
        chartModeTitle: "Proof view",
        chartLayoutTitle: "Evidence audit",
        chartLayoutDetail:
          "Lead with source coverage, review state, and missing proof before performance detail.",
      },
      blocks: [
        {
          id: "proof_sources",
          title: "Proof sources",
          detail: "Evidence readiness by source.",
        },
        {
          id: "report_trust",
          title: "Report trust",
          detail: "Evidence coverage and review state.",
        },
      ],
      trust: [
        {
          key: "evidence_backed_reads",
          label: "Proof coverage",
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
          label: "Metric origin",
          value: "Manual entry",
          detail: "How metrics entered PopsDrops",
        },
      ],
    };
    const expectedDecision =
      "Keep in proof room until at least one proof read is submitted and reviewed.";
    const html = buildHtmlDocument(report);
    const json = JSON.parse(buildJsonContent(report)) as ReportExportData;
    const dataSource = json.trust.find((item) => item.key === "data_source");

    expect(html).toContain("Trust decision");
    expect(html).toContain(expectedDecision);
    expect(html).not.toContain("Share the verified proof room with leadership.");
    expect(json.story?.trustDecision).toBe(expectedDecision);
    expect(json.story?.nextAction).toBe(expectedDecision);
    expect(dataSource).toMatchObject({
      value: "Creator-entered proof",
      detail: "Creator-submitted values awaiting brand review",
    });
  });

  it("keeps durable HTML exports truthful after teams rename proof tiles", () => {
    const html = buildHtmlDocument({
      ...singleReadReport(),
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

  it("keeps repeated single-read detail metrics compact after the primary story", () => {
    const html = buildHtmlDocument({
      ...singleReadReport(),
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
    });
    const guidanceCount = html.match(/One verified read; use a snapshot/g)?.length ?? 0;

    expect(guidanceCount).toBe(1);
    expect(html).toContain('class="metric-ledger" data-chart-recipe="single-read-ledger"');
    expect(html).toContain('<span class="ledger-date">2026/05/30</span>');
    expect(html).toContain("<strong>12.0K</strong>");
    expect(html).toContain("<strong>933</strong>");
    expect(html).not.toContain('class="chart-card"');
    expect(html).not.toContain("<span>Read date</span>");
    expect(html).not.toContain('class="snapshot-card snapshot-card--compact"');
  });

  it("renders recommendations and creator rows as executive detail, not card noise", () => {
    const html = buildHtmlDocument({
      ...singleReadReport(),
      blocks: [
        {
          id: "recommendations",
          title: "Recommendations",
          detail: "Data-earned next actions.",
        },
        {
          id: "creator_table",
          title: "Creator table",
          detail: "Creator-level performance and spend.",
        },
      ],
      recommendations: [
        {
          title: "Top creator",
          value: "Dev Creator",
          detail: "12.0K views on TikTok",
        },
        {
          title: "Best channel",
          value: "TikTok",
          detail: "Single verified read with proof attached",
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
    });

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

  it("keeps the standalone artifact typography restrained", () => {
    const html = buildHtmlDocument(singleReadReport());

    expect(html).toContain("--value: #475569;");
    expect(html).toContain("font-size: 25px;");
    expect(html).toContain("font-weight: 610;");
    expect(html).toContain(".brand { font-size: 20px; font-weight: 650;");
    expect(html).toContain(".metric-tile strong {\n        color: var(--value);");
    expect(html).toContain("font-size: 17px;");
    expect(html).toContain("font-weight: 560;");
    expect(html).toContain(".composition-row strong {\n        color: var(--value);");
    expect(html).toContain("font-size: 14px;");
    expect(html).toContain("font-weight: 580;");
    expect(html).toContain(".trust-card strong {\n        color: var(--value);");
    expect(html).toContain("font-size: 14px;");
    expect(html).toContain(".trust-card--date strong {\n        font-size: 11px;");
    expect(html).toContain(".chart-card-head strong {\n        color: var(--value);");
  });

  it("formats report dates and hero visuals like a premium artifact", () => {
    const html = buildHtmlDocument(singleReadReport());

    expect(html).toContain('<div class="generated">Generated 2026/05/30</div>');
    expect(html).toContain('<p class="date-range"><span>Report window</span>2026/06/07 - 2026/06/10</p>');
    expect(html).toContain("<strong>2026/05/30 - 2026/05/30</strong>");
    expect(html).toContain('<p class="decision-question"><span>Executive question</span>');
    expect(html).toContain('<aside class="report-meta report-evidence-strip" aria-label="Report summary">');
    expect(html).toContain('<div class="report-evidence-item" data-cover-metric-source="trust" data-cover-metric-key="evidence_backed_reads">');
    expect(html).toContain('<figure class="campaign-visual campaign-visual--hero">');
    expect(html).toContain('src="https://example.com/campaign-cover.jpg"');
    expect(html).toContain('alt="Maison Lumiere hero visual"');
    expect(html).toContain("<figcaption>Maison Lumiere hero visual</figcaption>");
    expect(html).toContain("object-fit: contain;");
    expect(html).toContain("padding: 18px 18px 58px;");
    expect(html).not.toContain("object-fit: cover;");
    expect(html).not.toContain("Application Flow Smoke Campaign Report campaign visual");
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
    expect(html).not.toContain("Jun 7, 2026 to Jun 10, 2026");
    expect(html).not.toContain("May 30, 2026 ~ May 30, 2026");
  });

  it("uses a visual-led hero and editorial metric strip for board-ready exports", () => {
    const html = buildHtmlDocument({
      ...singleReadReport(),
      kpis: [
        {
          key: "views",
          label: "Qualified reach",
          value: "12.0K",
          detail: "1 channel",
        },
        {
          key: "engagements",
          label: "Audience actions",
          value: "933",
          detail: "1 channel",
        },
        {
          key: "cpe",
          label: "Efficiency signal",
          value: "$0.29",
          detail: "$275 spend",
        },
        {
          key: "saves",
          label: "Saved proof",
          value: "184",
          detail: "Creator-confirmed saves",
        },
      ],
      blocks: [
        {
          id: "executive_summary",
          title: "Executive summary",
          detail: "Top KPIs for leadership.",
        },
        ...singleReadReport().blocks!,
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

  it("does not repeat durable cover KPIs inside the body scorecard", () => {
    const report = {
      ...singleReadReport(),
      blocks: [
        {
          id: "executive_summary",
          title: "Executive summary",
          detail: "Top KPIs for leadership.",
        },
        ...singleReadReport().blocks!,
      ],
    };
    const html = buildHtmlDocument(report);

    expect(getReportBodyKpis(report)).toEqual([]);
    expect(html).toContain('data-cover-metric-key="views"');
    expect(html).not.toContain('data-summary-metric-key="views"');
    expect(html).not.toContain("Cover scorecard");
    expect(html).not.toContain("metric-summary-note");
  });

  it("renders a single durable body KPI as a compact leadership watchpoint", () => {
    const report = {
      ...singleReadReport(),
      kpis: [
        {
          key: "views",
          label: "Qualified reach",
          value: "12.0K",
          detail: "1 channel",
        },
        {
          key: "engagements",
          label: "Audience actions",
          value: "933",
          detail: "1 channel",
        },
        {
          key: "cpe",
          label: "Efficiency signal",
          value: "$0.29",
          detail: "$275 spend",
        },
      ],
      blocks: [
        {
          id: "executive_summary",
          title: "Executive summary",
          detail: "Top KPIs for leadership.",
        },
        ...singleReadReport().blocks!,
      ],
    };
    const html = buildHtmlDocument(report);

    expect(getReportBodyKpis(report).map((metric) => metric.key)).toEqual([
      "cpe",
    ]);
    expect(html).toContain('<section class="metric-callout"');
    expect(html).toContain('data-section-label="Executive summary"');
    expect(html).toContain("Leadership watchpoint");
    expect(html).toContain('data-summary-metric-key="cpe"');
    expect(html).not.toContain('<section class="metric-strip metric-strip--editorial"');
  });

  it("hides builder framing unless the report framing block is selected", () => {
    const html = buildHtmlDocument(singleReadReport());
    const framedHtml = buildHtmlDocument({
      ...singleReadReport(),
      blocks: [
        {
          id: "report_framing",
          title: "Report framing",
          detail: "Optional preset, chart mode, and executive question context.",
        },
        ...singleReadReport().blocks!,
      ],
    });

    expect(html).not.toContain("Report composition");
    expect(html).not.toContain("Decision recipe");
    expect(html).not.toContain("<p>Executive question</p>");
    expect(html).not.toContain("Report blocks");
    expect(framedHtml).toContain("Report composition");
    expect(framedHtml).toContain('class="composition-ledger"');
    expect(framedHtml).toContain('class="composition-row"');
    expect(framedHtml).toContain('data-composition-row="report-plan"');
    expect(framedHtml).toContain('data-composition-row="executive-question"');
    expect(framedHtml).toContain('data-composition-row="chart-mode"');
    expect(framedHtml).toContain('data-composition-row="chart-layout"');
    expect(framedHtml).not.toContain('class="composition-grid"');
    expect(framedHtml).not.toContain('class="composition-card"');
    expect(framedHtml).toContain('class="decision-recipe" data-chart-recipe="decision-recipe"');
    expect(framedHtml).toContain("Decision recipe");
    expect(framedHtml).toContain("Question, visual job, evidence gate, and action");
    expect(framedHtml).toContain("<p>Question</p>");
    expect(framedHtml).toContain("<p>Visual job</p>");
    expect(framedHtml).not.toContain("<p>Comparison</p>");
    expect(framedHtml).toContain("<p>Evidence gate</p>");
    expect(framedHtml).toContain("<p>Action</p>");
    expect(framedHtml).toContain("Timeline readout");
    expect(framedHtml).toContain("Evidence-backed reads: 1/1");
    expect(framedHtml).toContain("Compare first and latest reads before deciding.");
    expect(framedHtml).toContain("Executive question");
    expect(framedHtml).toContain("Report blocks");
    expect(framedHtml).toContain('class="block-ledger"');
    expect(framedHtml).toContain('class="block-row"');
    expect(framedHtml).toContain('data-report-block-row="channel_story"');
    expect(framedHtml).toContain('data-report-block-row="report_trust"');
    expect(framedHtml).not.toContain('class="block-grid"');
    expect(framedHtml).not.toContain('class="block-card"');
  });

  it("exports durable CSV report framing as an executive decision recipe", () => {
    const csv = buildCsvContent({
      ...singleReadReport(),
      blocks: [
        {
          id: "report_framing",
          title: "Report framing",
          detail: "Optional preset, chart mode, and executive question context.",
        },
        ...singleReadReport().blocks!,
      ],
    });

    expect(csv).toContain("Report Composition");
    expect(csv).toContain("Report Decision Recipe");
    expect(csv).toContain("Step,Value,Detail");
    expect(csv).toContain(
      "Question,Did this campaign create enough confidence to continue the market launch?,",
    );
    expect(csv).toContain(
      "Visual job,Timeline readout,\"Lead with movement over time, pacing, and the final decision signal.\"",
    );
    expect(csv).toContain("Evidence gate,Evidence-backed reads: 1/1,");
    expect(csv).toContain("Action,Compare first and latest reads before deciding.,");
    expect(csv).toContain("Report Presentation");
  });

  it("renders selected report blocks in the brand-chosen story order", () => {
    const html = buildHtmlDocument({
      ...singleReadReport(),
      kpis: [
        ...singleReadReport().kpis,
        {
          key: "engagements",
          label: "Audience actions",
          value: "933",
          detail: "1 channel",
        },
        {
          key: "cpe",
          label: "Efficiency signal",
          value: "$0.29",
          detail: "$275 spend",
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
});
