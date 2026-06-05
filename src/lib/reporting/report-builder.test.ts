import { describe, expect, it } from "vitest";
import {
  REPORT_BUILDER_BLOCKS,
  REPORT_BUILDER_DEFAULT_BLOCK_IDS,
  REPORT_BUILDER_DEFAULT_PRESENTATION,
  REPORT_BUILDER_DEFAULT_PRESET_ID,
  REPORT_BUILDER_CUSTOM_PRESET,
  REPORT_BUILDER_PRESETS,
  buildReportCompositionExportData,
  buildReportExportDataForBlocks,
  moveReportBuilderBlockSelection,
  normalizeReportBuilderPresentation,
  normalizeReportCompositionSelection,
  normalizeReportBuilderSelection,
  type ReportBuilderBlockId,
} from "./report-builder";
import type { ReportExportData } from "./report-export";

function sampleReportData(): ReportExportData {
  return {
    campaignTitle: "Paris Launch",
    dateRange: "May 1 to May 14",
    generatedAt: "2026-05-30T00:00:00.000Z",
    kpis: [
      { key: "views", label: "Views", value: "42.8K", detail: "All channels" },
      {
        key: "engagementRate",
        label: "Engagement Rate",
        value: "8.4%",
        detail: "All channels",
      },
      {
        key: "cpe",
        label: "Cost per Engagement",
        value: "$0.29",
        detail: "$275 spend",
      },
    ],
    trust: [
      {
        key: "evidence_backed_reads",
        label: "Evidence-backed reads",
        value: "3/3",
        detail: "Native analytics screenshots",
      },
      {
        key: "report_status",
        label: "Report status",
        value: "3/3 submitted",
        detail: "Creator reporting tasks",
      },
      {
        key: "data_source",
        label: "Data source",
        value: "Brand-reviewed proof",
        detail: "Creator evidence reviewed by brand",
      },
    ],
    recommendations: [
      {
        title: "Top creator",
        value: "Mina Kwon",
        detail: "18.2K views on TikTok",
      },
    ],
    sections: [
      {
        title: "All Channels",
        detail: "Compared by channel.",
        sourceGroup: "campaign_channel",
        metrics: [
          {
            key: "views",
            label: "Views",
            value: "42.8K",
            detail: "2 channels",
            points: [{ date: "2026-05-30", label: "42.8K", value: 42800 }],
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
            label: "Engagements",
            value: "1.2K",
            detail: "1 read",
            points: [{ date: "2026-05-30", label: "1.2K", value: 1200 }],
          },
        ],
      },
    ],
    creators: [
      {
        name: "Mina Kwon",
        market: "South Korea",
        platform: "TikTok",
        views: "18.2K",
        engagements: "1.9K",
        er: "10.4%",
        cpe: "$0.16",
        spent: "$300",
        rating: "4.8",
      },
    ],
  };
}

describe("report builder", () => {
  it("keeps report block selections ordered, known, and trust-backed", () => {
    const selected = normalizeReportBuilderSelection([
      "creator_table",
      "not_a_block",
      "channel_story",
      "creator_table",
    ]);

    expect(selected).toEqual([
      "creator_table",
      "channel_story",
      "report_trust",
    ]);
  });

  it("starts from an executive-ready default composition", () => {
    expect(REPORT_BUILDER_DEFAULT_BLOCK_IDS).toEqual([
      "executive_summary",
      "channel_story",
      "report_trust",
      "creator_table",
      "recommendations",
    ] satisfies ReportBuilderBlockId[]);
  });

  it("filters report export payloads to the selected report blocks", () => {
    const filtered = buildReportExportDataForBlocks(sampleReportData(), [
      "channel_story",
      "report_trust",
    ]);

    expect(filtered.kpis).toEqual([]);
    expect(filtered.recommendations).toEqual([]);
    expect(filtered.creators).toEqual([]);
    expect(filtered.trust).toHaveLength(3);
    expect(filtered.sections).toHaveLength(1);
    expect(filtered.sections[0]?.sourceGroup).toBe("campaign_channel");
    expect(filtered.blocks).toEqual([
      {
        id: "channel_story",
        title: "Channel story",
        detail: "Platform-native performance charts.",
        executivePurpose:
          "Explain performance by platform without mixing metrics that each network defines differently.",
      },
      {
        id: "report_trust",
        title: "Report trust",
        detail: "Evidence coverage, review state, and data source.",
        executivePurpose:
          "Show legal, finance, and leadership how each number was evidenced and reviewed.",
      },
    ]);
  });

  it("keeps the brand-selected report block order in export payloads", () => {
    const filtered = buildReportExportDataForBlocks(sampleReportData(), [
      "recommendations",
      "creator_table",
      "executive_summary",
    ]);

    expect(filtered.blocks?.map((block) => block.id)).toEqual([
      "recommendations",
      "creator_table",
      "executive_summary",
      "report_trust",
    ]);
    expect(filtered.recommendations).toHaveLength(1);
    expect(filtered.creators).toHaveLength(1);
    expect(filtered.kpis).toHaveLength(3);
    expect(filtered.trust).toHaveLength(3);
  });

  it("moves selected report blocks while preserving the trust-backed requirement", () => {
    expect(
      moveReportBuilderBlockSelection(
        ["executive_summary", "channel_story"],
        "report_trust",
        "earlier",
      ),
    ).toEqual([
      "executive_summary",
      "report_trust",
      "channel_story",
    ]);

    expect(
      moveReportBuilderBlockSelection(
        ["executive_summary", "report_trust", "recommendations"],
        "executive_summary",
        "earlier",
      ),
    ).toEqual([
      "executive_summary",
      "report_trust",
      "recommendations",
    ]);

    expect(
      moveReportBuilderBlockSelection(
        ["executive_summary", "report_trust", "recommendations"],
        "executive_summary",
        "later",
      ),
    ).toEqual([
      "report_trust",
      "executive_summary",
      "recommendations",
    ]);
  });

  it("starts from a creator performance preset that matches the default blocks", () => {
    const preset = REPORT_BUILDER_PRESETS.find(
      (item) => item.id === REPORT_BUILDER_DEFAULT_PRESET_ID,
    );

    expect(preset?.title).toBe("Creator performance");
    expect(preset?.chartModeId).toBe("comparison");
    expect(preset?.blockIds).toEqual(REPORT_BUILDER_DEFAULT_BLOCK_IDS);
    expect(REPORT_BUILDER_DEFAULT_BLOCK_IDS).not.toContain("report_framing");
    expect(REPORT_BUILDER_BLOCKS.find((block) => block.id === "report_framing"))
      .toMatchObject({
        title: "Report framing",
        defaultSelected: false,
        required: false,
      });
  });

  it("builds report composition payloads from premium presets", () => {
    const composed = buildReportCompositionExportData(sampleReportData(), {
      presetId: "proof_audit",
    });

    expect(composed.composition).toEqual({
      presetId: "proof_audit",
      presetTitle: "Proof audit",
      presetDetail: "Evidence, proof sources, and creator rows for legal review.",
      bestFor: "Legal, finance, and regional brand review.",
      executiveQuestion:
        "Can every reported number be traced to trusted evidence and a brand decision?",
      chartModeId: "proof",
      chartModeTitle: "Proof view",
      chartModeDetail: "Evidence coverage and source confidence first.",
      chartLayoutTitle: "Evidence audit",
      chartLayoutDetail:
        "Lead with source coverage, review state, and missing proof before performance detail.",
      presentation: {
        coverMode: "campaign_visual",
        typography: "quiet",
        density: "editorial",
      },
    });
    expect(composed.kpis).toEqual([]);
    expect(composed.recommendations).toEqual([]);
    expect(composed.trust).toHaveLength(3);
    expect(composed.sections).toHaveLength(1);
    expect(composed.sections[0]?.sourceGroup).toBe("proof_source");
    expect(composed.creators).toHaveLength(1);
    expect(composed.blocks?.map((block) => block.executivePurpose)).toEqual([
      "Keep non-primary evidence visible while protecting campaign totals from unsupported comparisons.",
      "Show legal, finance, and leadership how each number was evidenced and reviewed.",
      "Give operators the creator-level detail behind the executive narrative.",
    ]);
  });

  it("keeps custom compositions trust-backed while honoring the chosen chart mode", () => {
    const composed = buildReportCompositionExportData(sampleReportData(), {
      blockIds: ["channel_story"],
      chartModeId: "trend",
      presetId: "custom",
    });

    expect(composed.composition).toMatchObject({
      presetId: "custom",
      presetTitle: "Custom report",
      bestFor: "A team-defined proof room export.",
      executiveQuestion:
        "What decision can leadership make from the evidence this campaign collected?",
      chartModeId: "trend",
      chartModeTitle: "Trend view",
      chartLayoutTitle: "Timeline readout",
      chartLayoutDetail:
        "Lead with movement over time, pacing, and the final decision signal.",
    });
    expect(composed.blocks?.map((block) => block.id)).toEqual([
      "channel_story",
      "report_trust",
    ]);
  });

  it("keeps the custom default executive question decision-oriented", () => {
    expect(REPORT_BUILDER_CUSTOM_PRESET.executiveQuestion).toBe(
      "What decision can leadership make from the evidence this campaign collected?",
    );
    expect(REPORT_BUILDER_CUSTOM_PRESET.executiveQuestion).not.toMatch(
      /exact story|chose|choose to prove/i,
    );
  });

  it("keeps the selected chart mode visible by carrying its story block", () => {
    const proofSelection = normalizeReportCompositionSelection({
      blockIds: ["executive_summary"],
      chartModeId: "proof",
      presetId: "custom",
    });
    const proofExport = buildReportCompositionExportData(sampleReportData(), {
      blockIds: ["executive_summary"],
      chartModeId: "proof",
      presetId: "custom",
    });

    expect(proofSelection.blockIds).toEqual([
      "executive_summary",
      "proof_sources",
      "report_trust",
    ]);
    expect(proofExport.blocks?.map((block) => block.id)).toEqual([
      "executive_summary",
      "proof_sources",
      "report_trust",
    ]);
    expect(proofExport.sections.map((section) => section.sourceGroup)).toEqual([
      "proof_source",
    ]);

    const comparisonSelection = normalizeReportCompositionSelection({
      blockIds: ["executive_summary"],
      chartModeId: "comparison",
      presetId: "custom",
    });
    const comparisonExport = buildReportCompositionExportData(sampleReportData(), {
      blockIds: ["executive_summary"],
      chartModeId: "comparison",
      presetId: "custom",
    });

    expect(comparisonSelection.blockIds).toEqual([
      "executive_summary",
      "channel_story",
      "report_trust",
    ]);
    expect(comparisonExport.blocks?.map((block) => block.id)).toEqual([
      "executive_summary",
      "channel_story",
      "report_trust",
    ]);
    expect(comparisonExport.sections.map((section) => section.sourceGroup)).toEqual([
      "campaign_channel",
    ]);
  });

  it("lets brands opt into report framing metadata as a normal configurable block", () => {
    const composed = buildReportCompositionExportData(sampleReportData(), {
      blockIds: ["report_framing", "executive_summary", "report_trust"],
      chartModeId: "trend",
      presetId: "leadership",
    });

    expect(composed.blocks?.map((block) => block.id)).toEqual([
      "report_framing",
      "executive_summary",
      "channel_story",
      "report_trust",
    ]);
    expect(composed.blocks?.[0]).toMatchObject({
      title: "Report framing",
      detail: "Optional preset, chart mode, and executive question context.",
    });
  });

  it("normalizes campaign report goals without needing a saved template name", () => {
    const selection = normalizeReportCompositionSelection({
      presetId: "leadership",
      chartModeId: "proof",
      blockIds: ["executive_summary", "unknown", "executive_summary"],
      presentation: {
        coverMode: "proof_room",
        typography: "compact",
        density: "compact",
      },
    });

    expect(selection).toEqual({
      presetId: "leadership",
      chartModeId: "proof",
      blockIds: ["executive_summary", "proof_sources", "report_trust"],
      presentation: {
        coverMode: "proof_room",
        typography: "compact",
        density: "compact",
      },
    });
  });

  it("defaults report presentation to a calm executive artifact", () => {
    expect(REPORT_BUILDER_DEFAULT_PRESENTATION).toEqual({
      coverMode: "campaign_visual",
      typography: "quiet",
      density: "editorial",
    });

    expect(
      normalizeReportBuilderPresentation({
        coverMode: "unknown",
        typography: "compact",
      }),
    ).toEqual({
      coverMode: "campaign_visual",
      typography: "compact",
      density: "editorial",
    });
  });

  it("normalizes the brand-selected chart focus for comparison exports", () => {
    expect(
      normalizeReportBuilderPresentation({
        chartMetricKey: "cpe",
        coverMode: "campaign_visual",
        typography: "quiet",
        density: "editorial",
      }),
    ).toEqual({
      chartMetricKey: "cpe",
      coverMode: "campaign_visual",
      typography: "quiet",
      density: "editorial",
    });

    expect(
      normalizeReportBuilderPresentation({
        chartMetricKey: "reports",
      }),
    ).toEqual(REPORT_BUILDER_DEFAULT_PRESENTATION);
  });

  it("carries the brand-selected presentation into exported report composition", () => {
    const composed = buildReportCompositionExportData(sampleReportData(), {
      blockIds: ["executive_summary", "report_trust"],
      chartModeId: "trend",
      presetId: "custom",
      presentation: {
        coverMode: "proof_room",
        typography: "compact",
        density: "compact",
      },
    });

    expect(composed.composition?.presentation).toEqual({
      coverMode: "proof_room",
      typography: "compact",
      density: "compact",
    });
  });

  it("carries brand-written executive framing into exported report composition", () => {
    const presentation = normalizeReportBuilderPresentation({
      coverMode: "campaign_visual",
      typography: "quiet",
      density: "editorial",
      headline: "  Korea board readout  ",
      executiveQuestion: "  Should leadership expand the launch budget?  ",
    });

    expect(presentation).toMatchObject({
      headline: "Korea board readout",
      executiveQuestion: "Should leadership expand the launch budget?",
    });

    const composed = buildReportCompositionExportData(sampleReportData(), {
      blockIds: ["executive_summary", "report_trust"],
      chartModeId: "trend",
      presetId: "leadership",
      presentation,
    });

    expect(composed.composition).toMatchObject({
      reportTitle: "Korea board readout",
      executiveQuestion: "Should leadership expand the launch budget?",
    });
  });

  it("carries the selected comparison metric into exported report composition", () => {
    const composed = buildReportCompositionExportData(sampleReportData(), {
      blockIds: ["channel_story", "creator_table", "report_trust"],
      chartModeId: "comparison",
      presetId: "custom",
      presentation: {
        coverMode: "campaign_visual",
        typography: "quiet",
        density: "editorial",
        chartMetricKey: "cpe",
      },
    });

    expect(composed.composition?.presentation).toMatchObject({
      chartMetricKey: "cpe",
    });
  });

  it("lets brands choose the exact KPI and proof tiles in the export summary", () => {
    const composed = buildReportCompositionExportData(sampleReportData(), {
      blockIds: ["executive_summary", "report_trust"],
      chartModeId: "trend",
      presetId: "custom",
      presentation: {
        coverMode: "campaign_visual",
        typography: "quiet",
        density: "editorial",
        kpiIds: ["views", "cpe"],
        trustIds: ["evidence_backed_reads", "data_source"],
      },
    });

    expect(composed.kpis.map((item) => item.label)).toEqual([
      "Views",
      "Cost per Engagement",
    ]);
    expect(composed.trust.map((item) => item.label)).toEqual([
      "Evidence-backed reads",
      "Data source",
    ]);
    expect(composed.composition?.presentation).toMatchObject({
      kpiIds: ["views", "cpe"],
      trustIds: ["evidence_backed_reads", "data_source"],
    });
  });

  it("lets brands rename KPI and proof tiles in executive-facing exports", () => {
    const presentation = normalizeReportBuilderPresentation({
      coverMode: "campaign_visual",
      typography: "quiet",
      density: "editorial",
      kpiIds: ["views", "cpe"],
      trustIds: ["evidence_backed_reads", "data_source"],
      kpiLabels: {
        views: "Qualified reach",
        cpe: "Efficiency signal",
        unknown_metric: "Should not survive composition",
      },
      trustLabels: {
        evidence_backed_reads: "Proof coverage",
        data_source: "Metric origin",
        report_status: "Hidden status",
      },
    });

    const composed = buildReportCompositionExportData(sampleReportData(), {
      blockIds: ["executive_summary", "report_trust"],
      chartModeId: "trend",
      presetId: "custom",
      presentation,
    });

    expect(composed.kpis.map((item) => item.label)).toEqual([
      "Qualified reach",
      "Efficiency signal",
    ]);
    expect(composed.trust.map((item) => item.label)).toEqual([
      "Proof coverage",
      "Metric origin",
    ]);
    expect(composed.composition?.presentation).toMatchObject({
      kpiLabels: {
        views: "Qualified reach",
        cpe: "Efficiency signal",
      },
      trustLabels: {
        evidence_backed_reads: "Proof coverage",
        data_source: "Metric origin",
      },
    });
    expect(composed.composition?.presentation).not.toMatchObject({
      kpiLabels: {
        unknown_metric: "Should not survive composition",
      },
      trustLabels: {
        report_status: "Hidden status",
      },
    });
  });

  it("lets brands rename report sections for executive-facing exports", () => {
    const presentation = normalizeReportBuilderPresentation({
      coverMode: "campaign_visual",
      typography: "quiet",
      density: "editorial",
      sectionLabels: {
        executive_summary: "Board evidence scorecard",
        report_trust: "Audit confidence",
        recommendations: "Next market actions",
        channel_story: "   ",
        unknown_block: "Should not persist",
      },
    });

    const composed = buildReportCompositionExportData(sampleReportData(), {
      blockIds: ["executive_summary", "recommendations", "report_trust"],
      chartModeId: "trend",
      presetId: "custom",
      presentation,
    });

    expect(composed.blocks?.map((block) => [block.id, block.title])).toEqual([
      ["executive_summary", "Board evidence scorecard"],
      ["recommendations", "Next market actions"],
      ["channel_story", "Channel story"],
      ["report_trust", "Audit confidence"],
    ]);
    expect(composed.composition?.presentation).toMatchObject({
      sectionLabels: {
        executive_summary: "Board evidence scorecard",
        report_trust: "Audit confidence",
        recommendations: "Next market actions",
      },
    });
    expect(composed.composition?.presentation).not.toMatchObject({
      sectionLabels: {
        unknown_block: "Should not persist",
      },
    });
  });

  it("carries saved team template identity into exported report composition", () => {
    const composed = buildReportCompositionExportData(sampleReportData(), {
      blockIds: ["executive_summary", "report_trust"],
      chartModeId: "trend",
      presetId: "custom",
      template: {
        id: "11111111-2222-4333-8444-555555555555",
        name: "Global launch leadership proof",
        description: "The team default for executive launch readouts.",
        presentation: {
          coverMode: "campaign_visual",
          typography: "quiet",
          density: "compact",
        },
      },
    });

    expect(composed.composition).toMatchObject({
      presetId: "custom",
      presetTitle: "Custom report",
      chartModeId: "trend",
      chartModeTitle: "Trend view",
      chartLayoutTitle: "Timeline readout",
      chartLayoutDetail:
        "Lead with movement over time, pacing, and the final decision signal.",
      templateId: "11111111-2222-4333-8444-555555555555",
      templateName: "Global launch leadership proof",
      templateDescription: "The team default for executive launch readouts.",
      presentation: {
        coverMode: "campaign_visual",
        typography: "quiet",
        density: "compact",
      },
    });
  });
});
