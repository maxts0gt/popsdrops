import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  buildClientExportCompositionSummary,
  buildClientExportCampaignVisualCaption,
  buildClientExportEvidenceTrail,
  buildClientExportHeroMeta,
  buildClientExportMetricRecipe,
  buildClientExportTrustItems,
  fitReportImageToBox,
  type ReportExportData,
  type ReportExportMetric,
} from "./export-report-pdf";

const baseData: ReportExportData = {
  campaignTitle: "Application Flow Smoke Campaign",
  dateRange: "Jun 7, 2026 to Jun 10, 2026",
  generatedAt: "2026-05-31T03:20:00.000Z",
  composition: {
    presetId: "leadership",
    presetTitle: "Leadership brief",
    presetDetail: "Board-ready summary.",
    chartModeId: "trend",
    chartModeTitle: "Trend view",
    chartModeDetail: "Time-based growth and pacing.",
    chartLayoutTitle: "Timeline readout",
    chartLayoutDetail: "Lead with movement over time.",
  },
  blocks: [
    {
      id: "recommendations",
      title: "Recommendations",
      detail: "Data-earned next actions.",
    },
  ],
  kpis: [],
  trust: [
    {
      key: "evidence_backed_reads",
      label: "Evidence-backed reads",
      value: "1/1",
      detail: "Native analytics screenshots",
    },
  ],
  recommendations: [],
  sections: [],
  creators: [],
};

const singleReadMetric: ReportExportMetric = {
  label: "Views",
  value: "12.0K",
  detail: "1 channels",
  points: [{ date: "2026-05-30", label: "12.0K", value: 12000 }],
};

const exportPdfSource = readFileSync("src/lib/export-report-pdf.ts", "utf8");

function getFunctionSource(functionName: string): string {
  const start = exportPdfSource.indexOf(`function ${functionName}`);
  expect(start).toBeGreaterThanOrEqual(0);
  const next = exportPdfSource.indexOf("\nfunction ", start + 1);
  return exportPdfSource.slice(start, next === -1 ? undefined : next);
}

describe("client report PDF/PPTX export helpers", () => {
  it("normalizes executive dates and proof-room hero metadata", () => {
    expect(buildClientExportHeroMeta(baseData)).toEqual({
      generatedDate: "2026/05/31",
      reportWindow: "2026/06/07 - 2026/06/10",
      reportTitle: "Application Flow Smoke Campaign Report",
      heroMetrics: [
        {
          detail: "Native analytics screenshots",
          key: "evidence_backed_reads",
          label: "Evidence-backed reads",
          source: "trust",
          value: "1/1",
        },
      ],
    });
  });

  it("uses the actual campaign image name as the PDF and deck cover caption", () => {
    expect(
      buildClientExportCampaignVisualCaption({
        ...baseData,
        campaignImageAlt: "Maison Lumiere New York launch still",
      }),
    ).toBe("Maison Lumiere New York launch still");

    expect(
      buildClientExportCampaignVisualCaption({
        ...baseData,
        campaignImageAlt: "   ",
      }),
    ).toBe("Private campaign image");
  });

  it("keeps saved team template names out of executive export cover copy", () => {
    expect(
      buildClientExportCompositionSummary({
        ...baseData,
        composition: {
          ...baseData.composition!,
          presetId: "custom",
          presetTitle: "Custom report",
          presetDetail: "Manually selected report blocks.",
          templateName: "Global proof leadership smoke 1780582117557",
          templateDescription: "Saved during the report export UI smoke.",
        },
      }),
    ).toEqual({
      detail: "Manually selected report blocks.",
      label: "Report plan",
      line: "Report plan / Custom report",
      value: "Custom report",
    });

    expect(exportPdfSource).not.toContain("composition.templateName ? `${composition.templateName}");
    expect(exportPdfSource).not.toContain('label: "Team template"');
  });

  it("uses proof-review impact before evidence coverage ratios on export covers", () => {
    expect(
      buildClientExportHeroMeta({
        ...baseData,
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
    ).toMatchObject({
      heroMetrics: [
        {
          detail: "Native analytics screenshots",
          key: "evidence_backed_reads",
          label: "Evidence-backed reads",
          source: "trust",
          value: "1/1",
        },
        {
          detail: "Supported by source evidence",
          key: "verified_reads",
          label: "Verified reads",
          source: "trust",
          value: "0/1",
        },
        {
          detail: "1/1 submitted",
          key: "report_status",
          label: "Report status",
          source: "trust",
          value: "1 awaiting review",
        },
      ],
    });
  });

  it("renders client export covers from configured proof metrics instead of fixed labels", () => {
    expect(exportPdfSource).toContain("buildReportHeroMetrics(data)");
    expect(exportPdfSource).toContain("heroMeta.heroMetrics");
    expect(exportPdfSource).not.toContain('["Report type", heroMeta.reportType]');
    expect(exportPdfSource).not.toContain('["Primary view", heroMeta.primaryView]');
    expect(exportPdfSource).not.toContain('["Evidence status", heroMeta.evidenceStatus]');
  });

  it("lets client exports use the brand-written report title instead of appending another report label", () => {
    expect(
      buildClientExportHeroMeta({
        ...baseData,
        composition: {
          ...baseData.composition!,
          reportTitle: "Korea board readout",
        },
      }),
    ).toMatchObject({
      reportTitle: "Korea board readout",
    });

    expect(exportPdfSource).toContain("getReportDisplayTitle(data)");
    expect(exportPdfSource).toContain("pptx.title = getReportDisplayTitle(data)");
    expect(exportPdfSource).not.toContain("pptx.title = `${data.campaignTitle} Report`");
  });

  it("uses a compact snapshot recipe for single-read metrics", () => {
    expect(buildClientExportMetricRecipe(singleReadMetric)).toEqual({
      kind: "snapshot",
      readDate: "2026/05/30",
      value: "12.0K",
      label: "Views",
      detail: "1 channels",
      decisionUse:
        "One verified read; use a snapshot until there is enough history for a trend.",
    });
  });

  it("keeps multi-read metrics on the trend recipe", () => {
    const metric: ReportExportMetric = {
      ...singleReadMetric,
      points: [
        { date: "2026-05-30", label: "10.0K", value: 10000 },
        { date: "2026-06-01", label: "12.0K", value: 12000 },
      ],
    };

    expect(buildClientExportMetricRecipe(metric)).toEqual({
      kind: "trend",
      readDate: "2026/05/30 - 2026/06/01",
      value: "12.0K",
      label: "Views",
      detail: "1 channels",
      decisionUse: "Trend recipe: compare first and latest reads before deciding.",
    });
  });

  it("formats proof-room trust dates before PDF and PowerPoint rendering", () => {
    expect(
      buildClientExportTrustItems({
        ...baseData,
        trust: [
          ...baseData.trust,
          {
            label: "Data window",
            value: "May 30, 2026 ~ May 30, 2026",
            detail: "Platform read dates",
          },
        ],
      }),
    ).toEqual([
      {
        label: "Evidence-backed reads",
        value: "1/1",
        detail: "Native analytics screenshots",
      },
      {
        label: "Data window",
        value: "2026/05/30 - 2026/05/30",
        detail: "Platform read dates",
      },
    ]);
  });

  it("keeps the evidence rail truthful after teams customize trust labels", () => {
    expect(
      buildClientExportEvidenceTrail({
        ...baseData,
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
      }),
    ).toBe("Proof coverage: 1/1 / Creator-entered proof");
  });

  it("keeps proof review provenance in client export evidence trails", () => {
    expect(
      buildClientExportEvidenceTrail({
        ...baseData,
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
      }),
    ).toBe("Proof coverage: 1/1 / Brand-reviewed proof / Reviewed 2026/06/04");
  });

  it("fits real campaign visuals inside export hero bounds without cropping", () => {
    expect(
      fitReportImageToBox({
        boxHeight: 50,
        boxWidth: 90,
        boxX: 10,
        boxY: 20,
        sourceHeight: 800,
        sourceWidth: 1200,
      }),
    ).toEqual({
      h: 50,
      w: 75,
      x: 17.5,
      y: 20,
    });

    const portrait = fitReportImageToBox({
      boxHeight: 50,
      boxWidth: 90,
      boxX: 10,
      boxY: 20,
      sourceHeight: 900,
      sourceWidth: 600,
    });

    expect(portrait.h).toBe(50);
    expect(portrait.w).toBeCloseTo(33.33, 2);
    expect(portrait.x).toBeCloseTo(38.33, 2);
    expect(portrait.y).toBe(20);
  });

  it("embeds fetched campaign image data in PDF and PowerPoint cover exports", () => {
    expect(exportPdfSource).toContain("async function loadReportCampaignImage");
    expect(exportPdfSource).toContain("await loadReportCampaignImage(data.campaignImageUrl)");
    expect(exportPdfSource).toContain("doc.addImage(image.dataUrl");
    expect(exportPdfSource).toContain("slide.addImage({");
    expect(exportPdfSource).toContain("data: image.dataUrl");
    expect(exportPdfSource).not.toContain('data.campaignImageUrl ? "Campaign image" : "Smoke product image"');
  });

  it("keeps the PowerPoint cover from exporting as a sparse title slide", () => {
    expect(exportPdfSource).toContain("function addDeckCoverDecisionPanel");
    expect(exportPdfSource).toContain("function addDeckCoverRecommendations");
    expect(exportPdfSource).toContain("function addDeckCoverEditorialMetricStrip");
    expect(exportPdfSource).toContain("Executive decision");
    expect(exportPdfSource).toContain("Topline proof");
    expect(exportPdfSource).toContain("data.recommendations.slice(0, 3)");
    expect(exportPdfSource).toContain("data.kpis.slice(0, 4)");
  });

  it("surfaces the trust decision inside PDF and PowerPoint cover hero frames", () => {
    const deckHero = getFunctionSource("addDeckVisualLedHero");
    const pdfHero = getFunctionSource("renderReportPdfHero");

    expect(deckHero).toContain("Trust decision");
    expect(deckHero).toContain("getReportTrustDecision(data)");
    expect(pdfHero).toContain("Trust decision");
    expect(pdfHero).toContain("getReportTrustDecision(data)");
  });

  it("uses a visual-led executive cover instead of a dark masthead and boxed KPI cover", () => {
    expect(exportPdfSource).toContain("function renderReportPdfEditorialMetricStrip");
    expect(exportPdfSource).toContain("function addDeckCoverEditorialMetricStrip");
    expect(exportPdfSource).toContain("function addDeckVisualLedHero");
    expect(exportPdfSource).toContain("Generated on");
    expect(exportPdfSource).toContain("visualWidth = 112");
    expect(exportPdfSource).toContain("const visualW = 4.84");
    expect(exportPdfSource).not.toContain('doc.rect(0, 0, pageWidth, 28, "F")');
    expect(exportPdfSource).not.toContain("addDeckCoverKpiStrip(cover, data)");
  });

  it("keeps downloadable metric readouts editorial instead of heavy black KPI tiles", () => {
    expect(exportPdfSource).toContain("function addDeckMetricCard");
    expect(exportPdfSource).toContain("function renderReportPdfEditorialMetricStrip");
    expect(exportPdfSource).toContain("function addDeckCoverEditorialMetricStrip");
    expect(exportPdfSource).toContain("doc.line(x, y, x + itemWidth, y)");
    expect(exportPdfSource).toContain("color: deckColors.slate700,\n      fontFace: deckFontFace,\n      fontSize: 10.8,");
    expect(exportPdfSource).toContain("setTextColor(doc, slate700);\n    doc.setFontSize(9.2);");
    expect(exportPdfSource).not.toContain("setTextColor(doc, slate900);\n    doc.setFontSize(14);\n    doc.setFont(\"helvetica\", \"bold\");\n    doc.text(kpi.value");
  });

  it("uses a PowerPoint-safe sans font instead of risking serif fallback", () => {
    expect(exportPdfSource).toContain('const deckFontFace = "Arial"');
    expect(exportPdfSource).toContain("headFontFace: deckFontFace");
    expect(exportPdfSource).toContain("bodyFontFace: deckFontFace");
    expect(exportPdfSource).not.toContain('fontFace: "Inter"');
  });

  it("keeps PowerPoint body slides tied to decision, evidence, and action", () => {
    expect(exportPdfSource).toContain("function addDeckDecisionEvidenceActionRail");
    expect(exportPdfSource).toContain("Decision read");
    expect(exportPdfSource).toContain("Evidence trail");
    expect(exportPdfSource).toContain("Next action");
    expect(exportPdfSource).toContain("Trust decision");
    expect(exportPdfSource).toContain("getReportTrustDecision(data)");
    expect(exportPdfSource).toContain("addDeckDecisionEvidenceActionRail(");
    expect(exportPdfSource).toContain("Evidence-backed reads");
    expect(exportPdfSource).toContain("Repeat what worked, request corrections, or pause spend.");
  });

  it("keeps PDF body sections tied to the same proof story rail", () => {
    expect(exportPdfSource).toContain("function renderReportPdfDecisionEvidenceActionRail");
    expect(exportPdfSource).toContain("Decision read");
    expect(exportPdfSource).toContain("Evidence trail");
    expect(exportPdfSource).toContain("Next action");
    expect(exportPdfSource).toContain("Trust decision");
    expect(exportPdfSource).toContain("getReportTrustDecision(data)");
    expect(exportPdfSource).toContain("renderReportPdfDecisionEvidenceActionRail(context");
    expect(exportPdfSource).toContain("Compare first and latest reads before deciding.");
    expect(exportPdfSource).toContain("Resolve missing or unreviewed evidence before leadership sharing.");
  });

  it("keeps the brand-written executive question visible in lean PDF exports", () => {
    expect(exportPdfSource).toContain("function renderReportPdfExecutiveQuestionPanel");
    expect(exportPdfSource).toContain("data.composition.executiveQuestion");
    expect(exportPdfSource).toContain("Executive question");
    expect(exportPdfSource).toContain("renderReportPdfExecutiveQuestionPanel(context, y)");
    expect(exportPdfSource.indexOf("renderReportPdfExecutiveQuestionPanel(context, y)"))
      .toBeLessThan(exportPdfSource.indexOf("renderReportPdfDecisionEvidenceActionRail(context"));
  });
});
