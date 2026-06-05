import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const reportPageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const reportOutputContractPanelSource = readFileSync(
  new URL("./report-output-contract-panel.tsx", import.meta.url),
  "utf8",
);
const reportBuilderPanelSource = readFileSync(
  new URL("./report-builder-panel.tsx", import.meta.url),
  "utf8",
);
const campaignDetailLayoutSource = readFileSync(
  new URL("../layout.tsx", import.meta.url),
  "utf8",
);
const reportShareActionsSource = readFileSync(
  new URL("../../../../../../actions/report-shares.ts", import.meta.url),
  "utf8",
);
const reportExportJobsSource = readFileSync(
  new URL("../../../../../../actions/report-export-jobs.ts", import.meta.url),
  "utf8",
);
const stringsSource = readFileSync(
  new URL("../../../../../../../lib/i18n/strings.ts", import.meta.url),
  "utf8",
);
const englishBundleSource = readFileSync(
  new URL(
    "../../../../../../../lib/i18n/generated/platform-bundles/en.json",
    import.meta.url,
  ),
  "utf8",
);
const designSource = readFileSync(new URL("../../../../../../../../DESIGN.md", import.meta.url), "utf8");
const sharedReportDataSource = readFileSync(
  new URL("../../../../../../../lib/reporting/shared-report-data.ts", import.meta.url),
  "utf8",
);
const reportMetricsSource = readFileSync(
  new URL("../../../../../../../lib/reporting/campaign-report-metrics.ts", import.meta.url),
  "utf8",
);
const exportPdfSource = readFileSync(
  new URL("../../../../../../../lib/export-report-pdf.ts", import.meta.url),
  "utf8",
);
const reportBuilderSource = readFileSync(
  new URL("../../../../../../../lib/reporting/report-builder.ts", import.meta.url),
  "utf8",
);

describe("campaign report live data flow", () => {
  it("keeps the nested report route behind an explicit campaign detail layout", () => {
    expect(campaignDetailLayoutSource).toContain("function CampaignDetailLayout");
    expect(campaignDetailLayoutSource).toContain("return children;");
  });

  it("uses the campaign data as the report title instead of a fixed report name", () => {
    expect(stringsSource).toContain('titleForCampaign: "{title} Report"');
    expect(englishBundleSource).toContain('"titleForCampaign": "{title} Report"');
    expect(reportPageSource).toContain('t("titleForCampaign", { title: campaign.title })');
    expect(reportPageSource).not.toContain('<h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>');
  });

  it("shows a real unavailable state when the campaign report cannot load", () => {
    expect(stringsSource).toContain('"unavailable.title": "Report unavailable"');
    expect(stringsSource).toContain('"unavailable.body":');
    expect(stringsSource).toContain("This campaign may have been removed, or your access may have changed.");
    expect(stringsSource).toContain('"unavailable.cta": "Back to campaigns"');
    expect(englishBundleSource).toContain('"unavailable.title": "Report unavailable"');
    expect(reportPageSource).toContain('data-testid="campaign-report-unavailable"');
    expect(reportPageSource).toContain('t("unavailable.title")');
    expect(reportPageSource).toContain('href="/b/campaigns"');
    expect(reportPageSource).not.toContain("if (!campaign) return null;");
  });

  it("loads measurement type for seeded reads and updates when report data changes", () => {
    expect(reportPageSource).toContain("measurement_type");
    expect(reportPageSource).toContain("screenshot_url");
    expect(reportPageSource).toContain("verification_status");
    expect(reportPageSource).toContain("content_performance_metric_values");
    expect(reportPageSource).toContain("content_performance_ai_extractions");
    expect(reportPageSource).toContain("aiExtractionStatus");
    expect(reportPageSource).toContain("source_type");
    expect(reportPageSource).toContain("buildReportEvidenceMetric");
    expect(reportPageSource).toContain("supabase.channel");
    expect(reportPageSource).toContain("content_performance");
    expect(reportPageSource).toContain("campaign_report_tasks");
    expect(reportPageSource).toContain("channel.unsubscribe()");
    expect(reportPageSource).toContain("window.setInterval");
    expect(reportPageSource).toContain("window.clearInterval");
  });

  it("renders one primary report story chart instead of tiny KPI card charts", () => {
    expect(reportPageSource).toContain("interface ReportMetricPoint");
    expect(reportPageSource).toContain("type ReportMetricKey");
    expect(reportPageSource).toContain("formatChartDate");
    expect(reportPageSource).toContain("buildMetricPoints");
    expect(reportPageSource).toContain("buildChartMovement");
    expect(reportPageSource).toContain("ReportChartMovement");
    expect(reportPageSource).toContain("ReportStoryChart");
    expect(reportPageSource).toContain("selectedMetricKey");
    expect(reportPageSource).toContain("<circle");
    expect(reportPageSource).toContain("data-testid=\"report-chart-movement\"");
    expect(reportPageSource).toContain("data-testid=\"report-story-chart\"");
    expect(reportPageSource).toContain("data-testid=\"report-story-point\"");
    expect(reportPageSource).toContain("data-testid=\"report-story-axis-date\"");
    expect(reportPageSource).toContain("data-testid=\"report-story-final-value\"");
    expect(reportPageSource).toContain("data-testid=\"report-metric-tab\"");
    expect(reportPageSource).toContain("points = []");
    expect(reportPageSource).not.toContain("values: number[]");
    expect(reportPageSource).not.toContain("<MetricTrendChart");
    expect(reportPageSource).not.toContain("function MetricSparkline");
    expect(reportPageSource).not.toContain("buildChartInsight");
    expect(reportPageSource).not.toContain("chart.insight.range");
  });

  it("uses a live snapshot readout instead of a trend chart for single-read reports", () => {
    expect(stringsSource).toContain('"chart.snapshot.title": "Snapshot read"');
    expect(stringsSource).toContain(
      '"chart.snapshot.detail": "One verified read; use a snapshot until there is enough history for a trend."',
    );
    expect(englishBundleSource).toContain('"chart.snapshot.title": "Snapshot read"');
    expect(reportPageSource).toContain("function ReportSnapshotReadout");
    expect(reportPageSource).toContain('data-testid="report-story-snapshot"');
    expect(reportPageSource).toContain('data-chart-recipe="snapshot"');
    expect(reportPageSource).toContain("points.length === 1");
    expect(reportPageSource).toContain("<ReportSnapshotReadout");
  });

  it("keeps executive report count labels grammatically clean", () => {
    expect(stringsSource).toContain('"metric.channel": "1 channel"');
    expect(englishBundleSource).toContain('"metric.channel": "1 channel"');
    expect(reportPageSource).toContain("function formatLiveReportChannelCount");
    expect(reportPageSource).toContain('t("metric.channel")');
    expect(reportPageSource).toContain(
      "formatLiveReportChannelCount(campaignChannelPlatforms.length, t)",
    );
    expect(sharedReportDataSource).toContain("formatReportChannelCount");
    expect(sharedReportDataSource).toContain(
      "readDetail: formatReportChannelCount(campaignChannelPlatforms.length)",
    );
    expect(sharedReportDataSource).not.toContain(
      "readDetail: `${campaignChannelPlatforms.length} channels`",
    );
  });

  it("defaults to an all-channel comparison chart before platform drilldown", () => {
    expect(stringsSource).toContain('"filter.allChannels": "All Channels"');
    expect(stringsSource).toContain('"chart.allChannelsTitle": "{metric} by channel"');
    expect(stringsSource).toContain('"chart.allChannelsDetail": "Compared by channel."');
    expect(stringsSource).toContain('"chart.movementLabel": "{start} to {end}"');
    expect(englishBundleSource).toContain('"filter.allChannels": "All Channels"');
    expect(reportPageSource).toContain("buildAllPlatformReportMetrics");
    expect(reportPageSource).toContain("ReportComparisonChart");
    expect(reportPageSource).toContain('selectedPlatform === "all"');
    expect(reportPageSource).toContain("data-testid=\"report-comparison-chart\"");
    expect(reportPageSource).toContain("data-testid=\"report-comparison-line\"");
    expect(reportPageSource).toContain("data-testid=\"report-comparison-label\"");
  });

  it("offers PDF, HTML, JSON, CSV, and PPTX exports from one report export menu", () => {
    const exportPdfImportBlockStart = reportPageSource.indexOf(
      'from "@/lib/export-report-pdf"',
    );
    const exportPdfImportBlock = reportPageSource.slice(
      Math.max(0, exportPdfImportBlockStart - 240),
      exportPdfImportBlockStart + 40,
    );

    expect(stringsSource).toContain('export: "Export"');
    expect(stringsSource).toContain('"export.pdf": "PDF report"');
    expect(stringsSource).toContain('"export.html": "HTML report"');
    expect(stringsSource).toContain('"export.json": "JSON data"');
    expect(stringsSource).toContain('"export.csv": "CSV table"');
    expect(stringsSource).toContain('"export.pptx": "PowerPoint deck"');
    expect(reportPageSource).toContain("DropdownMenu");
    expect(reportPageSource).toContain("buildReportExportData");
    expect(reportPageSource).toContain("downloadClientPdfReport");
    expect(reportPageSource).toContain('import("@/lib/export-report-pdf")');
    expect(exportPdfImportBlock).not.toContain("exportReportPDF");
    expect(exportPdfImportBlock).not.toContain("exportReportPPTX");
    expect(reportPageSource).toContain("requestReportExport");
    expect(reportPageSource).toContain('handleDurableReportExport("html")');
    expect(reportPageSource).toContain('handleDurableReportExport("json")');
    expect(reportPageSource).toContain('handleDurableReportExport("csv")');
    expect(reportPageSource).toContain("downloadClientPptxReport");
    expect(reportPageSource).toContain("data-testid=\"report-export-menu\"");
    expect(reportPageSource).not.toContain("Export PDF");
  });

  it("lets brands choose report blocks before export", () => {
    expect(reportBuilderSource).toContain("REPORT_BUILDER_BLOCKS");
    expect(reportBuilderSource).toContain("REPORT_BUILDER_PRESETS");
    expect(reportBuilderSource).toContain("REPORT_BUILDER_CHART_MODES");
    expect(reportBuilderSource).toContain("buildReportCompositionExportData");
    expect(stringsSource).toContain('"builder.title": "Report plan"');
    expect(stringsSource).toContain('"builder.presets.title": "Report preset"');
    expect(stringsSource).toContain('"builder.chartMode.title": "Chart mode"');
    expect(stringsSource).toContain('"builder.exportFollows": "Exports follow this order."');
    expect(englishBundleSource).toContain('"builder.title": "Report plan"');
    expect(englishBundleSource).toContain('"builder.preset.leadership.title": "Leadership brief"');
    expect(reportPageSource).toContain("REPORT_BUILDER_BLOCKS");
    expect(reportPageSource).toContain("REPORT_BUILDER_PRESETS");
    expect(reportPageSource).toContain("REPORT_BUILDER_CHART_MODES");
    expect(reportPageSource).toContain('data-testid="report-builder-save-template-dialog"');
    expect(reportPageSource).toContain("selectedReportBlockIds");
    expect(reportPageSource).toContain("selectedReportPresetId");
    expect(reportPageSource).toContain("selectedReportChartModeId");
    expect(reportPageSource).toContain("selectReportPreset");
    expect(reportPageSource).toContain("toggleReportBlock");
    expect(reportPageSource).toContain("moveReportBlock");
    expect(reportPageSource).toContain("moveReportBuilderBlockSelection");
    expect(reportPageSource).toContain(
      'import { ReportBuilderPanel } from "./report-builder-panel";',
    );
    expect(reportPageSource).not.toContain("interface ReportBuilderPanelProps");
    expect(reportPageSource).not.toContain("function getReportBuilderBlockIcon");
    expect(reportPageSource).not.toContain("function ReportBuilderPanel");
    expect(reportBuilderPanelSource).toContain("interface ReportBuilderPanelProps");
    expect(reportBuilderPanelSource).toContain("function getReportBuilderBlockIcon");
    expect(reportBuilderPanelSource).toContain("export function ReportBuilderPanel");
    expect(reportBuilderPanelSource).toContain("REPORT_BUILDER_BLOCKS");
    expect(reportBuilderPanelSource).toContain("REPORT_BUILDER_PRESETS");
    expect(reportBuilderPanelSource).toContain("REPORT_BUILDER_CHART_MODES");
    expect(reportBuilderPanelSource).toContain('data-testid="report-builder"');
    expect(reportBuilderPanelSource).toContain('data-testid="report-builder-preset"');
    expect(reportBuilderPanelSource).toContain('data-testid="report-builder-chart-mode"');
    expect(reportBuilderPanelSource).toContain(
      'data-testid="report-builder-block-order"',
    );
    expect(reportBuilderPanelSource).toContain(
      'data-testid="report-builder-block-move-earlier"',
    );
    expect(reportBuilderPanelSource).toContain(
      'data-testid="report-builder-block-move-later"',
    );
    expect(reportBuilderPanelSource).toContain('data-testid="report-builder-block"');
    expect(reportPageSource).toContain("buildReportCompositionExportData(fullReportExportData");
    expect(reportPageSource).toContain("isReportBlockSelected(\"channel_story\")");
    expect(reportPageSource).toContain("isReportBlockSelected(\"creator_table\")");
    expect(stringsSource).toContain('"builder.order.title": "Report order"');
    expect(stringsSource).toContain('"builder.order.moveEarlier": "Move {block} earlier"');
    expect(englishBundleSource).toContain('"builder.order.title": "Report order"');
  });

  it("keeps chart-mode changes from orphaning the live report story block", () => {
    const handlerSource = reportPageSource.slice(
      reportPageSource.indexOf("const selectReportChartMode"),
      reportPageSource.indexOf("const selectReportPresentation"),
    );

    expect(handlerSource).toContain("normalizeReportCompositionSelection");
    expect(handlerSource).toContain("blockIds: current");
    expect(handlerSource).toContain("setSelectedReportBlockIds");
  });

  it("shows a builder-side export contract before the brand saves or exports", () => {
    expect(reportBuilderPanelSource).toContain("trustDecision: string;");
    expect(reportBuilderPanelSource).toContain("nextAction: string;");
    expect(reportBuilderPanelSource).toContain("const activeBlockSequence =");
    expect(reportBuilderPanelSource).toContain('data-testid="report-builder-export-contract"');
    expect(reportBuilderPanelSource).toContain('data-testid="report-builder-contract-item"');
    expect(reportBuilderPanelSource).toContain("data-contract-item={item.key}");
    expect(reportBuilderPanelSource).toContain('key: "lead-metric"');
    expect(reportBuilderPanelSource).toContain('key: "trust-gate"');
    expect(reportBuilderPanelSource).toContain('key: "block-sequence"');
    expect(reportBuilderPanelSource).toContain("value: activeChartMetricLabel");
    expect(reportBuilderPanelSource).toContain("value: trustDecision");
    expect(reportBuilderPanelSource).toContain("value: activeBlockSequence");
    expect(reportPageSource).toContain("trustDecision={selectedReportTrustDecision}");
    expect(reportPageSource).toContain("nextAction={selectedReportStory.nextAction}");
  });

  it("shows the export decision recipe inside the builder before save or export", () => {
    const builderRecipeSource = reportBuilderPanelSource.slice(
      reportBuilderPanelSource.indexOf('data-testid="report-builder-decision-recipe"'),
      reportBuilderPanelSource.indexOf('data-testid="report-builder-export-contract"'),
    );

    expect(reportBuilderPanelSource).toContain("const builderDecisionRecipeItems =");
    expect(reportBuilderPanelSource).toContain('data-testid="report-builder-decision-recipe"');
    expect(reportBuilderPanelSource).toContain(
      'data-testid="report-builder-decision-recipe-item"',
    );
    expect(reportBuilderPanelSource).toContain("data-recipe-step={item.key}");
    expect(reportBuilderPanelSource).toContain('key: "question"');
    expect(reportBuilderPanelSource).toContain('key: "visual-job"');
    expect(reportBuilderPanelSource).toContain('key: "evidence-gate"');
    expect(reportBuilderPanelSource).toContain('key: "next-action"');
    expect(reportBuilderPanelSource).toContain('t("builder.output.recipeQuestion")');
    expect(reportBuilderPanelSource).toContain('t("builder.output.recipeVisualJob")');
    expect(reportBuilderPanelSource).toContain('t("builder.output.recipeEvidenceGate")');
    expect(reportBuilderPanelSource).toContain('t("builder.output.recipeNextAction")');
    expect(reportBuilderPanelSource).toContain("activeExecutiveQuestion");
    expect(reportBuilderPanelSource).toContain("activeChartLayoutTitle");
    expect(reportBuilderPanelSource).toContain("activeChartModeTitle");
    expect(reportBuilderPanelSource).toContain("trustDecision");
    expect(reportBuilderPanelSource).toContain("nextAction");
    expect(builderRecipeSource).toContain('t("builder.output.recipe")');
    expect(builderRecipeSource).toContain('t("builder.output.recipeDetail")');
    expect(builderRecipeSource).toContain("builderDecisionRecipeItems.map");
    expect(builderRecipeSource).toContain("{item.label}");
    expect(builderRecipeSource).toContain("{item.value}");
    expect(builderRecipeSource).toContain("{item.detail}");
    expect(reportBuilderPanelSource.indexOf('data-testid="report-builder-decision-recipe"')).toBeLessThan(
      reportBuilderPanelSource.indexOf('data-testid="report-builder-export-contract"'),
    );
  });

  it("summarizes the leadership reader promise before detailed report controls", () => {
    expect(stringsSource).toContain('"builder.promise.title": "Reader promise"');
    expect(stringsSource).toContain('"builder.promise.detail": "What leadership will learn, why the evidence can be trusted, and what export shape will carry it."');
    expect(stringsSource).toContain('"builder.promise.story": "Leadership story"');
    expect(stringsSource).toContain('"builder.promise.proof": "Proof gate"');
    expect(stringsSource).toContain('"builder.promise.artifact": "Export artifact"');
    expect(englishBundleSource).toContain('"builder.promise.title": "Reader promise"');
    expect(reportBuilderPanelSource).toContain("const readerPromiseItems =");
    expect(reportBuilderPanelSource).toContain('key: "story"');
    expect(reportBuilderPanelSource).toContain('key: "proof"');
    expect(reportBuilderPanelSource).toContain('key: "artifact"');
    expect(reportBuilderPanelSource).toContain("value: activeExecutiveQuestion");
    expect(reportBuilderPanelSource).toContain("value: trustDecision");
    expect(reportBuilderPanelSource).toContain("value: activePresentationLabel");
    expect(reportBuilderPanelSource).toContain('data-testid="report-builder-reader-promise"');
    expect(reportBuilderPanelSource).toContain('data-testid="report-builder-reader-promise-item"');
    expect(reportBuilderPanelSource.indexOf('data-testid="report-builder-reader-promise"')).toBeLessThan(
      reportBuilderPanelSource.indexOf('data-testid="report-builder-layout"'),
    );
  });

  it("shows a board-room report output plan before export or share", () => {
    const outputContractSource = reportPageSource.slice(
      reportPageSource.indexOf("<ReportOutputContractPanel"),
      reportPageSource.indexOf("<ReportBuilderPanel"),
    );

    expect(stringsSource).toContain('"builder.output.title": "Executive output plan"');
    expect(stringsSource).toContain(
      '"builder.output.detail": "Exports and shared links follow this saved presentation plan."',
    );
    expect(stringsSource).toContain('"builder.output.recipe": "Decision recipe"');
    expect(stringsSource).toContain(
      '"builder.output.recipeDetail": "Question, visual job, evidence gate, and next action for this export."',
    );
    expect(stringsSource).toContain('"builder.output.recipeVisualJob": "Visual job"');
    expect(stringsSource).toContain('"builder.output.recipeEvidenceGate": "Evidence gate"');
    expect(stringsSource).toContain('"builder.output.recipeNextAction": "Next action"');
    expect(stringsSource).toContain('"builder.output.shape": "Preset"');
    expect(stringsSource).toContain('"builder.output.chart": "Chart"');
    expect(stringsSource).toContain('"builder.output.chartLayout": "Chart layout"');
    expect(stringsSource).toContain('"builder.output.trustDecision": "Trust decision"');
    expect(stringsSource).toContain(
      '"builder.output.trustDecisionDetail": "Use this as the forwarding gate for leadership, legal, and finance review."',
    );
    expect(stringsSource).toContain('"builder.output.blocks": "Blocks"');
    expect(englishBundleSource).toContain('"builder.output.title": "Executive output plan"');
    expect(reportPageSource).toContain(
      'import { ReportOutputContractPanel } from "./report-output-contract-panel";',
    );
    expect(reportPageSource).not.toContain("interface ReportOutputContractPanelProps");
    expect(reportPageSource).not.toContain("function ReportOutputContractPanel");
    expect(reportOutputContractPanelSource).toContain(
      "interface ReportOutputContractPanelProps",
    );
    expect(reportOutputContractPanelSource).toContain(
      "export function ReportOutputContractPanel",
    );
    expect(reportOutputContractPanelSource).toContain(
      'data-testid="report-output-contract"',
    );
    expect(reportOutputContractPanelSource).toContain(
      'data-testid="report-output-summary"',
    );
    expect(reportOutputContractPanelSource).toContain(
      'data-testid="report-output-spine"',
    );
    expect(reportOutputContractPanelSource).toContain(
      'data-testid="report-output-decision-recipe"',
    );
    expect(reportOutputContractPanelSource).toContain(
      'data-testid="report-output-decision-recipe-item"',
    );
    expect(reportOutputContractPanelSource).toContain("data-recipe-step");
    expect(reportOutputContractPanelSource).toContain("decisionRead");
    expect(reportOutputContractPanelSource).toContain("evidenceTrail");
    expect(reportOutputContractPanelSource).toContain("nextAction");
    expect(reportOutputContractPanelSource).toContain(
      'data-testid="report-output-block-order"',
    );
    expect(reportOutputContractPanelSource).toContain(
      'data-testid="report-output-block-order-item"',
    );
    expect(reportPageSource).not.toContain(
      "lg:grid-cols-[minmax(0,0.72fr)_minmax(560px,1fr)]",
    );
    expect(reportPageSource).toContain("selectedReportOutputTitle");
    expect(reportPageSource).toContain("selectedReportChartModeLabel");
    expect(reportPageSource).toContain("selectedReportChartLayoutTitle");
    expect(reportPageSource).toContain("selectedReportChartLayoutDetail");
    expect(reportPageSource).toContain("selectedReportBlockLabels");
    expect(reportPageSource).toContain("selectedReportTrustDecision");
    expect(reportPageSource).toContain("buildReportExportStory(reportExportData)");
    expect(reportPageSource).toContain("selectedReportStory.decisionRead");
    expect(reportPageSource).toContain("selectedReportStory.evidenceTrail");
    expect(reportPageSource).toContain("selectedReportStory.nextAction");
    expect(reportPageSource).toContain("getReportTrustDecision(reportExportData)");
    expect(outputContractSource).toContain("shape={selectedReportOutputTitle}");
    expect(outputContractSource).toContain("readinessDecision={selectedReportTrustDecision}");
    expect(outputContractSource).toContain("chart={selectedReportChartModeLabel}");
    expect(outputContractSource).toContain("chartLayoutTitle={selectedReportChartLayoutTitle}");
    expect(outputContractSource).toContain("chartLayoutDetail={selectedReportChartLayoutDetail}");
    expect(outputContractSource).toContain("blocks={selectedReportBlockLabels}");
  });

  it("keeps the live report story aligned with the export decision recipe", () => {
    const chartStoryStart = reportPageSource.indexOf("function ReportChartModeStory");
    const chartStorySource = reportPageSource.slice(
      chartStoryStart,
      reportPageSource.indexOf("function buildReportTrustExportItems", chartStoryStart),
    );
    const chartStoryCallStart = reportPageSource.indexOf("<ReportChartModeStory");
    const chartStoryCallSource = reportPageSource.slice(
      chartStoryCallStart,
      reportPageSource.indexOf("/>", chartStoryCallStart),
    );

    expect(chartStorySource).toContain("trustDecision:");
    expect(chartStorySource).toContain("const selectedMetricLabel =");
    expect(chartStorySource).toContain("const evidenceGateDetail =");
    expect(chartStorySource).toContain('label: t("builder.output.recipeQuestion")');
    expect(chartStorySource).toContain('label: t("builder.output.recipeVisualJob")');
    expect(chartStorySource).toContain('label: t("builder.output.recipeEvidenceGate")');
    expect(chartStorySource).toContain('label: t("builder.output.recipeNextAction")');
    expect(chartStorySource).toContain('key: "question"');
    expect(chartStorySource).toContain('key: "visual"');
    expect(chartStorySource).toContain('key: "evidence"');
    expect(chartStorySource).toContain('key: "action"');
    expect(chartStorySource).toContain("value: trustDecision");
    expect(chartStorySource).toContain("detail: evidenceGateDetail");
    expect(chartStorySource).toContain("data-story-step={item.key}");
    expect(chartStorySource).not.toContain('label: t("builder.chartStory.decisionRead")');
    expect(chartStorySource).not.toContain('label: t("builder.chartStory.evidenceTrail")');
    expect(chartStoryCallSource).toContain("trustDecision={selectedReportTrustDecision}");
    expect(stringsSource).toContain(
      '"builder.output.recipeDetail": "Question, visual job, evidence gate, and next action for this export."',
    );
    expect(englishBundleSource).toContain(
      '"builder.output.recipeDetail": "Question, visual job, evidence gate, and next action for this export."',
    );
  });

  it("uses the primary report story component for proof-mode proof sources", () => {
    const proofSourcesStart = reportPageSource.indexOf(
      '{isReportBlockSelected("proof_sources") && (',
    );
    const proofSourcesSource = reportPageSource.slice(
      proofSourcesStart,
      reportPageSource.indexOf('{isReportBlockSelected("report_trust")', proofSourcesStart),
    );

    expect(proofSourcesSource).toContain('selectedReportChartModeId === "proof"');
    expect(proofSourcesSource).toContain("<ReportChartModeStory");
    expect(proofSourcesSource).toContain("chartModeId={selectedReportChartModeId}");
    expect(proofSourcesSource).toContain("trustDecision={selectedReportTrustDecision}");
    expect(proofSourcesSource).toContain("<ProofSourceLanes");
    expect(proofSourcesSource.indexOf("<ReportChartModeStory")).toBeLessThan(
      proofSourcesSource.indexOf("<ProofSourceLanes"),
    );
  });

  it("keeps client PDF and PowerPoint exports in the configured report block order", () => {
    expect(exportPdfSource).toContain("getReportArtifactBlockIds");
    expect(exportPdfSource).toContain("renderReportPdfBlock");
    expect(exportPdfSource).toContain("renderReportDeckBlock");
    expect(exportPdfSource).toContain("for (const blockId of getReportArtifactBlockIds(data))");
    expect(exportPdfSource).toContain('case "recommendations":');
    expect(exportPdfSource).toContain('case "creator_table":');
    expect(exportPdfSource).not.toContain("data.sections.forEach((section) => {");
    expect(exportPdfSource).not.toContain("const overview = pptx.addSlide()");
  });

  it("keeps report helper actions in the header as icon-first controls on small screens", () => {
    expect(reportPageSource).toContain("flex items-start justify-between gap-3");
    expect(reportPageSource).toContain("flex-1");
    expect(reportPageSource).toContain("shrink-0");
    expect(reportPageSource).toContain("size-8");
    expect(reportPageSource).toContain("text-[11px]");
    expect(reportPageSource).toContain("lg:w-auto");
    expect(reportPageSource).toContain("aria-label={t(\"share\")}");
    expect(reportPageSource).toContain("aria-label={t(\"export\")}");
    expect(reportPageSource).toContain("<span className=\"hidden lg:inline\">{t(\"share\")}</span>");
    expect(reportPageSource).toContain("<span className=\"hidden lg:inline\">{t(\"export\")}</span>");
    expect(reportPageSource).not.toContain("flex flex-col gap-4 sm:flex-row");
  });

  it("lets the report title metadata wrap instead of truncating the campaign date on small screens", () => {
    expect(reportPageSource).toContain("text-pretty");
    expect(reportPageSource).toContain("leading-snug");
    expect(reportPageSource).toContain('data-testid="report-page-date-range"');
    expect(reportPageSource).toContain("{t(\"cover.window\")} &middot; {compactDateRangeLabel}");
    expect(reportPageSource).toContain('data-testid="report-executive-cover-date-range"');
    expect(reportPageSource).toContain('data-testid="report-executive-cover-window"');
    expect(reportPageSource).toContain("font-mono text-[11px] font-medium text-slate-600 [overflow-wrap:anywhere]");
    expect(reportPageSource).not.toContain("truncate text-sm text-muted-foreground");
    expect(reportPageSource).not.toContain('<span className="truncate text-slate-700">{dateRange}</span>');
    expect(reportPageSource).not.toContain("rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5");
    expect(reportPageSource).not.toContain("{campaign.title} &middot; {compactDateRangeLabel}");
    expect(reportPageSource).not.toContain(
      "{campaign.title} &middot; {formatDate(campaign.posting_window_start, locale)} {t(\"dateRange.to\")} {formatDate(campaign.posting_window_end, locale)}",
    );
  });

  it("opens the live report with an executive proof-room cover before builder controls", () => {
    const coverStart = reportPageSource.indexOf("<ReportExecutiveCover");
    const coverSource = reportPageSource.slice(
      coverStart,
      reportPageSource.indexOf("{canShareReports && (", coverStart),
    );

    expect(stringsSource).toContain('"cover.kicker": "Global proof room"');
    expect(stringsSource).toContain('"cover.window": "Report window"');
    expect(stringsSource).toContain('"cover.windowPending": "Window pending"');
    expect(stringsSource).toContain('"cover.visualTitle": "PopsDrops"');
    expect(stringsSource).toContain('"cover.visualDetail": "Market launch visual"');
    expect(englishBundleSource).toContain('"cover.kicker": "Global proof room"');
    expect(englishBundleSource).toContain('"cover.visualDetail": "Market launch visual"');
    expect(reportPageSource).toContain("interface ReportExecutiveCoverProps");
    expect(reportPageSource).toContain("function ReportExecutiveCover");
    expect(reportPageSource).toContain('data-testid="report-executive-cover"');
    expect(reportPageSource).toContain('data-testid="report-executive-cover-metric"');
    expect(reportPageSource).toContain('data-testid="report-executive-cover-visual"');
    expect(reportPageSource).toContain("formatCompactDateRange");
    expect(reportPageSource).toContain("start: campaign.posting_window_start");
    expect(reportPageSource).toContain("end: campaign.posting_window_end");
    expect(reportPageSource).toContain("formatCompactDate(start)");
    expect(reportPageSource).toContain("formatCompactDate(end)");
    expect(reportPageSource).toContain("buildReportTrustExportItems");
    expect(reportPageSource).toContain("selectedReportCoverMetrics");
    expect(coverSource).toContain("headline={selectedReportDisplayTitle}");
    expect(coverSource).toContain("dateRange={compactDateRangeLabel}");
    expect(coverSource).toContain("metrics={selectedReportCoverMetrics}");
    expect(coverSource).not.toContain("reportType={selectedReportOutputTitle}");
    expect(coverSource).not.toContain("primaryView={selectedReportChartLayoutTitle}");
    expect(coverSource).not.toContain("evidenceStatus={coverEvidenceStatus}");
    expect(coverSource).not.toContain("<ReportOutputContractPanel");
  });

  it("drives the executive cover proof metrics from the configured KPI and trust tiles", () => {
    const coverPropsSource = reportPageSource.slice(
      reportPageSource.indexOf("interface ReportExecutiveCoverProps"),
      reportPageSource.indexOf("interface ReportMetricPoint"),
    );
    const coverSource = reportPageSource.slice(
      reportPageSource.indexOf("function ReportExecutiveCover"),
      reportPageSource.indexOf("function getReportBuilderBlockIcon"),
    );
    const coverCallStart = reportPageSource.indexOf("<ReportExecutiveCover");
    const coverCallSource = reportPageSource.slice(
      coverCallStart,
      reportPageSource.indexOf("{canShareReports && (", coverCallStart),
    );

    expect(reportPageSource).toContain("interface ReportExecutiveCoverMetric");
    expect(coverPropsSource).toContain("metrics: ReportExecutiveCoverMetric[];");
    expect(reportPageSource).toContain("const selectedReportCoverMetrics =");
    expect(reportPageSource).toContain("visibleReportCards.slice(0, 2)");
    expect(reportPageSource).toContain("visibleReportTrustItems.slice(0, 1)");
    expect(coverCallSource).toContain("metrics={selectedReportCoverMetrics}");
    expect(coverCallSource).not.toContain("reportType={selectedReportOutputTitle}");
    expect(coverCallSource).not.toContain("primaryView={selectedReportChartLayoutTitle}");
    expect(coverCallSource).not.toContain("evidenceStatus={coverEvidenceStatus}");
    expect(coverSource).toContain("const coverMetrics = metrics.length > 0");
    expect(coverSource).toContain("data-cover-metric-source={metric.source}");
    expect(coverSource).toContain("data-cover-metric-key={metric.key}");
    expect(coverSource).toContain("line-clamp-2 text-[10px] font-semibold uppercase leading-snug");
    expect(coverSource).toContain("mt-1 line-clamp-2 text-[11px] leading-tight text-slate-500");
    expect(coverSource).not.toContain("truncate text-[11px] font-semibold uppercase");
    expect(coverSource).not.toContain("mt-1 line-clamp-1 text-[11px] leading-tight text-slate-500");
    expect(coverSource).not.toContain('label: t("cover.reportType")');
    expect(coverSource).not.toContain('label: t("cover.primaryView")');
    expect(coverSource).not.toContain('label: t("cover.evidenceStatus")');
  });

  it("applies report presentation controls to the live executive cover", () => {
    const coverStart = reportPageSource.indexOf("function ReportExecutiveCover");
    const coverSource = reportPageSource.slice(
      coverStart,
      reportPageSource.indexOf("function getReportBuilderBlockIcon", coverStart),
    );
    const coverCallStart = reportPageSource.indexOf("<ReportExecutiveCover");
    const coverCallSource = reportPageSource.slice(
      coverCallStart,
      reportPageSource.indexOf("{canShareReports && (", coverCallStart),
    );

    expect(reportPageSource).toContain("presentation: ReportBuilderPresentation;");
    expect(coverCallSource).toContain("presentation={selectedReportPresentation}");
    expect(coverSource).toContain("presentation.coverMode");
    expect(coverSource).toContain("presentation.typography");
    expect(coverSource).toContain("presentation.density");
    expect(coverSource).toContain('data-cover-mode={presentation.coverMode}');
    expect(coverSource).toContain('data-typography={presentation.typography}');
    expect(coverSource).toContain('data-density={presentation.density}');
    expect(coverSource).toContain(
      'presentation.coverMode !== "proof_room" && Boolean(campaignImageUrl)',
    );
    expect(coverSource).toContain("const coverSource = shouldRenderCampaignImage");
    expect(coverSource).toContain(
      'presentation.coverMode === "proof_room" ? "proof-room" : "fallback"',
    );
    expect(coverSource).toContain("data-cover-source={coverSource}");
    expect(coverSource).toContain('presentation.typography === "compact"');
    expect(coverSource).toContain('presentation.density === "compact"');
    expect(reportPageSource).toContain('data-report-typography={selectedReportPresentation.typography}');
    expect(reportPageSource).toContain('data-report-density={selectedReportPresentation.density}');
    expect(reportPageSource).toContain("presentation={selectedReportPresentation}");
  });

  it("renders KPI and trust tiles as quiet configurable report readouts", () => {
    const metricCardStart = reportPageSource.indexOf("function ReportMetricCard");
    const metricCardSource = reportPageSource.slice(
      metricCardStart,
      reportPageSource.indexOf("function ReportExecutiveCover", metricCardStart),
    );
    const trustStripStart = reportPageSource.indexOf("function ReportTrustStrip");
    const trustStripSource = reportPageSource.slice(
      trustStripStart,
      reportPageSource.indexOf("function ProofSourceLanes", trustStripStart),
    );

    expect(metricCardSource).toContain('data-testid="report-metric-card-label"');
    expect(metricCardSource).toContain('data-testid="report-metric-card-value"');
    expect(metricCardSource).toContain('data-testid="report-metric-card-detail"');
    expect(metricCardSource).toContain('data-testid="report-metric-card"');
    expect(metricCardSource).toContain("border-slate-200 bg-white");
    expect(metricCardSource).toContain("font-mono text-[13px] font-medium leading-tight text-slate-700");
    expect(metricCardSource).not.toContain("rounded-xl border border-slate-200 bg-white/95 shadow-sm");
    expect(metricCardSource).not.toContain("text-2xl font-semibold");

    expect(trustStripSource).toContain('data-testid="report-trust-label"');
    expect(trustStripSource).toContain('data-testid="report-trust-value"');
    expect(trustStripSource).toContain('data-testid="report-trust-detail"');
    expect(trustStripSource).toContain("font-mono text-[13px] font-medium leading-tight text-slate-700");
    expect(trustStripSource).not.toContain("truncate text-sm font-medium leading-snug");
  });

  it("keeps the executive cover report type free of raw saved template names", () => {
    expect(reportPageSource).toContain("const selectedReportOutputTitle =");
    expect(reportPageSource).toContain(
      "selectedReportPreset\n    ? t(selectedReportPreset.titleKey)",
    );
    expect(reportPageSource).toContain("name: selectedReportTemplate.name");
    expect(reportPageSource).not.toContain(
      "const selectedReportOutputTitle =\n    selectedReportTemplate?.name ??",
    );
  });

  it("uses the creator-facing campaign image as the report cover and export visual", () => {
    expect(reportPageSource).toContain('import NextImage from "next/image";');
    expect(reportPageSource).toContain("mapCampaignAssetRow");
    expect(reportPageSource).toContain("pickCreatorFacingHeroAsset");
    expect(reportPageSource).toContain("type CampaignCreativeAsset");
    expect(reportPageSource).toContain("campaign_assets");
    expect(reportPageSource).toContain(".createSignedUrls(assetPaths, 600)");
    expect(reportPageSource).toContain("campaignCoverAsset");
    expect(reportPageSource).toContain('data-testid="report-executive-cover-image"');
    expect(reportPageSource).toContain('className="object-contain p-4"');
    expect(reportPageSource).toContain("data-cover-source={coverSource}");
    expect(reportPageSource).toContain("campaignImageUrl={campaignCoverAsset?.signedUrl ?? null}");
    expect(reportPageSource).toContain("campaignImageAlt={campaignCoverAsset?.title ?? null}");
    expect(reportPageSource).toContain("campaignImageUrl: campaignImageUrl ?? null");
    expect(reportPageSource).toContain("campaignImageAlt: campaignImageAlt ?? null");
    expect(reportPageSource).toContain("campaignImageUrl: campaignCoverAsset?.signedUrl ?? null");
    expect(reportPageSource).toContain("campaignImageAlt: campaignCoverAsset?.title ?? null");
  });

  it("keeps the image-led executive cover visually intentional if the campaign asset fails", () => {
    const coverStart = reportPageSource.indexOf("function ReportExecutiveCover");
    const coverSource = reportPageSource.slice(
      coverStart,
      reportPageSource.indexOf("function getReportExecutiveCoverMetricIcon", coverStart),
    );

    expect(coverSource).toContain("const [campaignImageFailed, setCampaignImageFailed] = useState(false);");
    expect(coverSource).toContain('data-testid="report-executive-cover-visual-backdrop"');
    expect(coverSource).toContain('data-testid="report-executive-cover-proof-card"');
    expect(coverSource).toContain('onError={() => setCampaignImageFailed(true)}');
    expect(coverSource).toContain('shouldRenderCampaignImage');
    expect(coverSource).toContain('!campaignImageFailed');
    expect(coverSource).toContain('data-cover-source={coverSource}');
    expect(coverSource).not.toContain("data-cover-source={shouldUseCampaignImage ? \"campaign-image\" : coverSource}");
  });

  it("renders an intentional proof visual when a campaign image is not available", () => {
    const coverStart = reportPageSource.indexOf("function ReportExecutiveCover");
    const coverSource = reportPageSource.slice(
      coverStart,
      reportPageSource.indexOf("function getReportExecutiveCoverMetricIcon", coverStart),
    );
    const fallbackSource = coverSource.slice(
      coverSource.indexOf('data-testid="report-executive-cover-fallback"'),
      coverSource.indexOf('data-testid="report-executive-cover-fallback-window"'),
    );

    expect(stringsSource).toContain('"cover.fallbackTitle": "Proof visual"');
    expect(stringsSource).toContain(
      '"cover.fallbackDetail": "Built from the report question, evidence state, and selected metrics."',
    );
    expect(englishBundleSource).toContain('"cover.fallbackTitle": "Proof visual"');
    expect(coverSource).toContain('data-testid="report-executive-cover-fallback"');
    expect(coverSource).toContain('data-testid="report-executive-cover-fallback-signal"');
    expect(coverSource).toContain('data-testid="report-executive-cover-fallback-window"');
    expect(coverSource).toContain("coverMetrics.slice(0, 3)");
    expect(coverSource).toContain('t("cover.fallbackTitle")');
    expect(coverSource).toContain('t("cover.fallbackDetail")');
    expect(fallbackSource).toContain("{headline}");
    expect(fallbackSource).toContain("{metric.label}");
    expect(fallbackSource).toContain("{metric.value}");
    expect(fallbackSource).not.toContain('t("cover.visualTitle")');
    expect(fallbackSource).not.toContain('t("cover.visualDetail")');
    expect(coverSource).not.toContain('className="h-24 rounded-xl border border-white/10 bg-white/[0.08]"');
    expect(coverSource).not.toContain('className="grid grid-cols-3 gap-2"');
  });

  it("frames the live cover as an executive artifact instead of boxed dashboard cards", () => {
    const coverPropsSource = reportPageSource.slice(
      reportPageSource.indexOf("interface ReportExecutiveCoverProps"),
      reportPageSource.indexOf("interface ReportExecutiveCoverMetric"),
    );
    const coverStart = reportPageSource.indexOf("function ReportExecutiveCover");
    const coverSource = reportPageSource.slice(
      coverStart,
      reportPageSource.indexOf("function getReportExecutiveCoverMetricIcon", coverStart),
    );
    const coverCallStart = reportPageSource.indexOf("<ReportExecutiveCover");
    const coverCallSource = reportPageSource.slice(
      coverCallStart,
      reportPageSource.indexOf("{canShareReports && (", coverCallStart),
    );

    expect(coverCallSource).toContain("executiveQuestion={selectedReportExecutiveQuestion}");
    expect(coverPropsSource).toContain("executiveQuestion?: string | null;");
    expect(coverSource).toContain('data-testid="report-executive-cover-question"');
    expect(coverSource).toContain('data-testid="report-executive-cover-evidence-strip"');
    expect(coverSource).toContain('data-testid="report-executive-cover-evidence-item"');
    expect(coverSource).toContain("divide-y divide-slate-200");
    expect(coverSource).toContain("sm:divide-x sm:divide-y-0");
    expect(coverSource).not.toContain("grid gap-2 sm:grid-cols-3");
    expect(coverSource).not.toContain("min-w-0 rounded-xl border border-slate-200 bg-white px-3");
  });

  it("offers a secure share report workflow alongside exports", () => {
    expect(stringsSource).toContain('share: "Share"');
    expect(stringsSource).toContain('"share.create": "Create link"');
    expect(stringsSource).toContain('"share.linkLabel": "Report link"');
    expect(stringsSource).toContain('"share.trustGate": "Leadership gate"');
    expect(stringsSource).toContain(
      "Shared links show this same trust decision before any leadership KPIs.",
    );
    expect(englishBundleSource).toContain('"share.create": "Create link"');
    expect(englishBundleSource).toContain('"share.linkLabel": "Report link"');
    expect(englishBundleSource).toContain('"share.trustGate": "Leadership gate"');
    expect(stringsSource).toContain('"share.revoke": "Revoke"');
    expect(stringsSource).not.toContain("share.newLinkHint");
    expect(stringsSource).not.toContain("share.revoked");
    expect(englishBundleSource).not.toContain("share.newLinkHint");
    expect(englishBundleSource).not.toContain("share.revoked");
    expect(reportPageSource).toContain("createReportShareLink");
    expect(reportPageSource).toContain("listReportShareLinks");
    expect(reportPageSource).toContain("revokeReportShareLink");
    expect(reportPageSource).toContain("activeShareLinks");
    expect(reportPageSource).toContain("shareCreating");
    expect(reportPageSource).toContain("shareRevokingId");
    expect(reportPageSource).toContain("data-testid=\"report-share-button\"");
    expect(reportPageSource).toContain("data-testid=\"report-share-trust-gate\"");
    expect(reportPageSource).toContain("data-testid=\"report-share-trust-decision\"");
    expect(reportPageSource).toContain("data-testid=\"report-share-trust-detail\"");
    expect(reportPageSource).toContain("trustDecision={selectedReportTrustDecision}");
    expect(reportPageSource).toContain("leadershipState={selectedReportLeadershipHandoff.state}");
    expect(reportPageSource).not.toContain(
      'trustDecision === "Ready for leadership sharing." ? "ready" : "hold"',
    );
    expect(reportPageSource).toContain("data-testid=\"report-share-url\"");
    expect(reportPageSource).not.toContain('t("share.newLinkHint")');
    expect(reportPageSource).not.toContain('t("share.revoked")');
    expect(reportPageSource).not.toContain("setShareLoading");
    expect(reportPageSource).not.toContain('loading ? t("share.generating")');
    expect(reportShareActionsSource).toContain('from "next/headers"');
    expect(reportShareActionsSource).toContain("await getShareOrigin()");
    expect(reportShareActionsSource).toContain('requestHeaders.get("host")');
    expect(reportShareActionsSource).not.toContain("localhost:3000");
    expect(reportShareActionsSource).toContain('.select("id")');
    expect(reportShareActionsSource).toContain(".maybeSingle()");
    expect(reportShareActionsSource).toContain("Share link could not be revoked.");
  });

  it("keeps report sharing actions behind the share_reports permission", () => {
    expect(reportPageSource).toContain("hasBrandWorkspacePermission");
    expect(reportPageSource).toContain("canShareReports");
    expect(reportPageSource).toContain('"share_reports"');
    expect(reportPageSource).toContain("{canShareReports && (");
    expect(reportShareActionsSource).toContain("assertBrandReportShareAccess");
    expect(reportShareActionsSource).toContain('"view_campaigns"');
    expect(reportShareActionsSource).toContain('"share_reports"');
  });

  it("keeps report exports behind the same share_reports permission as secure links", () => {
    const helperActionsSource = reportPageSource.slice(
      reportPageSource.indexOf('data-testid="report-share-button"') - 500,
      reportPageSource.indexOf("<ReportShareDialog"),
    );

    expect(helperActionsSource).toContain("{canShareReports && (");
    expect(helperActionsSource).toContain('data-testid="report-export-menu"');
    expect(helperActionsSource).toContain("handleDurableReportExport");
    expect(reportExportJobsSource).toContain("assertBrandWorkspacePermission");
    expect(reportExportJobsSource).toContain('"share_reports"');
  });

  it("builds durable exports from unfiltered report data before applying current export blocks", () => {
    expect(sharedReportDataSource).toContain("applyCampaignComposition?: boolean");
    expect(sharedReportDataSource).toContain(
      "const shouldApplyCampaignComposition = options.applyCampaignComposition ?? true",
    );
    expect(sharedReportDataSource).toContain("if (!shouldApplyCampaignComposition) {");
    expect(sharedReportDataSource).toContain(
      "story: buildReportExportStory(baseReportWithLeadershipHandoff)",
    );
    expect(reportExportJobsSource).toContain(
      "buildCampaignSharedReport(campaignId, { applyCampaignComposition: false })",
    );
  });

  it("exposes report permission load state for role smoke checks", () => {
    expect(reportPageSource).toContain('data-testid="campaign-report-page"');
    expect(reportPageSource).toContain(
      'data-report-role={currentBrandRole ?? "loading"}',
    );
  });

  it("keeps share modal dates compact so the year does not wrap in link rows", () => {
    const formatShareDateSource = reportPageSource.slice(
      reportPageSource.indexOf("function formatShareDate"),
      reportPageSource.indexOf("function getInitials"),
    );

    expect(formatShareDateSource).toContain('month: "short"');
    expect(formatShareDateSource).toContain('day: "numeric"');
    expect(formatShareDateSource).not.toContain('year: "numeric"');
  });

  it("preserves late-report context in the evidence trail instead of flattening it to review state", () => {
    expect(reportPageSource).toContain("reportTaskStatus");
    expect(reportPageSource).toContain("reportTaskDueAt");
    expect(reportPageSource).toContain("reportTaskSubmittedAt");
    expect(reportPageSource).toContain('t("evidence.submittedLate")');
    expect(reportPageSource).toContain('t("evidence.verifiedLate")');
    expect(stringsSource).toContain('"evidence.submittedLate": "Submitted late"');
    expect(stringsSource).toContain('"evidence.verifiedLate": "Verified late"');
    expect(englishBundleSource).toContain('"evidence.submittedLate": "Submitted late"');
    expect(englishBundleSource).toContain('"evidence.verifiedLate": "Verified late"');
  });

  it("shows hover details on report line chart points", () => {
    expect(reportPageSource).toContain("hoveredPoint");
    expect(reportPageSource).toContain("setHoveredPoint");
    expect(reportPageSource).toContain("data-testid=\"report-chart-tooltip\"");
    expect(reportPageSource).toContain("onMouseEnter");
    expect(reportPageSource).toContain("onFocus");
    expect(reportPageSource).toContain("tabIndex={0}");
  });

  it("shows a private evidence trail and opens proof through signed Storage URLs", () => {
    expect(stringsSource).toContain('"section.evidenceTrail": "Evidence Trail"');
    expect(stringsSource).toContain('"evidence.open": "Open proof"');
    expect(stringsSource).toContain('"evidence.verify": "Verify"');
    expect(stringsSource).toContain('"evidence.requestCorrection": "Request correction"');
    expect(stringsSource).toContain('"evidence.correctionReason": "Correction reason"');
    expect(stringsSource).toContain('"evidence.correctionPlaceholder": "Tell the creator what to fix."');
    expect(stringsSource).toContain('"evidence.sendCorrection": "Send request"');
    expect(stringsSource).toContain('"evidence.cancelCorrection": "Cancel"');
    expect(stringsSource).toContain('"evidence.reasonRequired": "Add a correction reason."');
    expect(stringsSource).toContain('"evidence.verified": "Verified"');
    expect(stringsSource).toContain('"evidence.correctionRequested": "Correction requested"');
    expect(englishBundleSource).toContain('"section.evidenceTrail": "Evidence Trail"');
    expect(englishBundleSource).toContain('"evidence.correctionReason": "Correction reason"');
    expect(reportPageSource).toContain("EvidenceTrail");
    expect(reportPageSource).toContain("reviewPerformanceEvidence");
    expect(reportPageSource).toContain("parseEvidenceStorageReference");
    expect(reportPageSource).toContain("createSignedUrl");
    expect(reportPageSource).toContain("data-testid=\"report-evidence-trail\"");
    expect(reportPageSource).toContain("data-testid=\"report-evidence-open\"");
    expect(reportPageSource).toContain("data-testid=\"report-evidence-verify\"");
    expect(reportPageSource).toContain("data-testid=\"report-evidence-correction\"");
    expect(reportPageSource).toContain("data-testid=\"report-correction-dialog\"");
    expect(reportPageSource).toContain("data-testid=\"report-correction-note\"");
    expect(reportPageSource).toContain("data-testid=\"report-correction-submit\"");
    expect(reportPageSource).toContain("correctionNote");
    expect(reportPageSource).toContain("setReportReloadKey");
  });

  it("keeps report KPI cards as a quiet responsive strip instead of heavy black dashboard tiles", () => {
    expect(reportPageSource).toContain('data-testid="report-metric-strip"');
    expect(reportPageSource).toContain("grid grid-cols-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm sm:grid-cols-2 lg:grid-cols-5");
    expect(reportPageSource).toContain('selectedReportPresentation.density === "compact" ? "mb-6" : "mb-8"');
    expect(reportPageSource).toContain("data-testid=\"report-metric-card\"");
    expect(reportPageSource).toContain("border-slate-200 bg-white");
    expect(reportPageSource).toContain("text-[11px] font-semibold uppercase tracking-normal text-slate-500");
    expect(reportPageSource).toContain("font-mono text-[13px] font-medium leading-tight text-slate-700");
    expect(reportPageSource).toContain("[overflow-wrap:anywhere]");
    expect(reportPageSource).toContain('compactTypography ? "tracking-normal" : "tracking-[0.01em]"');
    expect(reportPageSource).toContain("mt-1 line-clamp-2 leading-tight text-slate-500");
    expect(reportPageSource).toContain('compactTypography ? "text-[11px]" : "text-xs"');
    expect(designSource).toContain("Metric cards must keep numeric values on a shared baseline");
    expect(reportPageSource).not.toContain("mb-8 grid grid-cols-5 gap-2");
    expect(reportPageSource).not.toContain("rounded-xl border border-slate-200 bg-white/95 shadow-sm");
    expect(reportPageSource).not.toContain("grid-rows-[2.5rem_auto_1fr]");
    expect(reportPageSource).not.toContain("truncate font-semibold leading-none text-slate-700");
    expect(reportPageSource).not.toContain("text-lg font-semibold leading-none text-slate-700");
    expect(reportPageSource).not.toContain("text-xl font-semibold leading-none text-foreground");
    expect(reportPageSource).not.toContain("min-h-28");
    expect(reportPageSource).not.toContain("h-28");
  });

  it("renders a report trust layer before creator-level performance", () => {
    expect(reportPageSource).toContain("data-testid=\"report-trust-strip\"");
    expect(reportPageSource).toContain("section.reportTrust");
    expect(reportPageSource).toContain("trust.evidenceBacked");
    expect(reportPageSource).toContain("trust.verifiedReads");
    expect(reportPageSource).toContain("trust.dataWindow");
    expect(reportPageSource).toContain("trust.reportStatus");
    expect(reportPageSource).toContain("buildReportStatusValue");
    expect(reportPageSource).toContain("trust.reviewStatus");
    expect(reportPageSource).toContain("trust.correctionStatus");
    expect(reportPageSource).toContain("trust.missingProofStatus");
    expect(reportPageSource).toContain("pendingReviewReads");
    expect(reportPageSource).toContain("correctionRequestedReads");
    expect(reportPageSource).toContain("missingEvidenceReads");
  });

  it("uses segmented presentation controls instead of card-style typography choices", () => {
    const presentationSource = reportBuilderPanelSource.slice(
      reportBuilderPanelSource.indexOf('data-testid="report-builder-presentation"'),
      reportBuilderPanelSource.indexOf('data-testid="report-builder-block"'),
    );

    expect(presentationSource).toContain('data-testid="report-builder-presentation-segmented"');
    expect(presentationSource).toContain("grid grid-cols-2 overflow-hidden rounded-lg border border-slate-200 bg-white");
    expect(presentationSource).toContain("min-h-[44px] px-3 py-2");
    expect(presentationSource).not.toContain("min-h-[70px] rounded-lg border p-3");
    expect(presentationSource).not.toContain("block text-xs leading-5 text-muted-foreground");
  });

  it("keeps shared report trust status action-aware like the brand report", () => {
    expect(sharedReportDataSource).toContain("function buildSharedReportStatusValue");
    expect(sharedReportDataSource).toContain("evidence.correctionRequestedReads > 0");
    expect(sharedReportDataSource).toContain("correction requested");
    expect(sharedReportDataSource).toContain("evidence.missingEvidenceReads > 0");
    expect(sharedReportDataSource).toContain("missing proof");
    expect(sharedReportDataSource).toContain("evidence.pendingReviewReads > 0");
    expect(sharedReportDataSource).toContain("awaiting review");
    expect(sharedReportDataSource).toContain("buildSharedReportStatusValue(evidence)");
  });

  it("counts submitted report tasks with no proof row as missing proof in every report surface", () => {
    expect(reportMetricsSource).toContain("submittedTasksWithoutProof");
    expect(reportMetricsSource).toContain('task.status === "submitted"');
    expect(reportMetricsSource).toContain('task.status === "submitted_late"');
    expect(reportMetricsSource).toContain("!currentReadTaskIds.has(task.id as string)");
    expect(reportMetricsSource).toContain(
      "currentReads.length - evidenceBackedReads + submittedTasksWithoutProof",
    );
    expect(reportMetricsSource).toContain("missingEvidenceReads > 0");
    expect(reportPageSource).toContain("id: task.id");
    expect(sharedReportDataSource).toContain("id: task.id");
  });

  it("uses only accepted evidence for report charts and performer totals", () => {
    expect(reportPageSource).toContain("getAcceptedReportReads");
    expect(reportPageSource).toContain("trustedReportReads");
    expect(reportPageSource).toContain(
      "const trustedReportReads = useMemo(() => getAcceptedReportReads(reportReads), [reportReads])",
    );
    expect(reportPageSource).toContain("getAvailableReportPlatforms(trustedReportReads)");
    expect(reportPageSource).toContain("reads: trustedReportReads");
    expect(reportPageSource).toContain("for (const read of getAcceptedReportReads(reads))");
    expect(reportPageSource).toContain("setPerformers(buildMemberPerformanceRows({");

    expect(sharedReportDataSource).toContain("getAcceptedReportReads");
    expect(sharedReportDataSource).toContain("const trustedReportReads = getAcceptedReportReads(reportReads)");
    expect(sharedReportDataSource).toContain("buildAllPlatformReportMetrics({ reads: campaignChannelReads");
    expect(sharedReportDataSource).toContain("for (const read of trustedReportReads)");
  });

  it("preserves AI-confirmed metric source labels in shared reports and exports", () => {
    expect(sharedReportDataSource).toContain("content_performance_evidence");
    expect(sharedReportDataSource).toContain("content_performance_ai_extractions");
    expect(sharedReportDataSource).toContain("content_performance_metric_values");
    expect(sharedReportDataSource).toContain("source_type");
    expect(reportMetricsSource).toContain("export function getMetricValueSourceType");
    expect(sharedReportDataSource).toContain("getMetricValueSourceType(metricValues)");
    expect(reportPageSource).toContain("getMetricValueSourceType(metricValues)");
    expect(sharedReportDataSource).not.toContain("const hasCreatorConfirmedValues");
    expect(reportPageSource).not.toContain("const hasCreatorConfirmedValues");
    expect(sharedReportDataSource).toContain("aiExtractionStatus");
    expect(sharedReportDataSource).toContain("sourceType: getMetricValueSourceType(metricValues)");
    expect(sharedReportDataSource).toContain('label: "Data source"');
    expect(sharedReportDataSource).toContain("evidence.sourceLabels.join");
    expect(reportPageSource).toContain("trust.dataSource");
    expect(reportPageSource).toContain("evidence.sourceLabels.join");
    expect(exportPdfSource).toContain("buildClientExportTrustItems(data).slice(0, 5)");
  });

  it("separates additional proof sources from campaign channel totals and exports", () => {
    expect(reportMetricsSource).toContain("expandReportReadByMetricPlatforms");
    expect(reportMetricsSource).toContain("partitionReportPlatforms");
    expect(reportPageSource).toContain("platform_label");
    expect(reportPageSource).toContain("campaign.platforms");
    expect(reportPageSource).toContain("campaignChannelPlatforms");
    expect(reportPageSource).toContain("proofSourceMetricItems");
    expect(reportPageSource).toContain("ProofSourceLanes");
    expect(reportPageSource).toContain('data-testid="report-proof-source-lanes"');
    expect(reportPageSource).toContain('"proof_source"');
    expect(sharedReportDataSource).toContain("expandReportReadByMetricPlatforms");
    expect(sharedReportDataSource).toContain("partitionReportPlatforms");
    expect(sharedReportDataSource).toContain("proofSourceMetrics");
    expect(stringsSource).toContain('"section.proofSources": "Additional proof sources"');
    expect(stringsSource).toContain('"proofSources.exportDetail": "Supporting evidence only. Not mixed into campaign channel totals."');
    expect(englishBundleSource).toContain('"section.proofSources": "Additional proof sources"');
    expect(exportPdfSource).toContain("section.sourceGroup === \"proof_source\"");
  });

  it("formats the trust data window as compact proof dates instead of verbose month text", () => {
    expect(reportPageSource).toContain("formatTrustWindowRange");
    expect(reportPageSource).toContain("const compactStart = formatCompactDate(start)");
    expect(reportPageSource).toContain("const compactEnd = formatCompactDate(end)");
    expect(reportPageSource).toContain("compactStart === compactEnd");
    expect(reportPageSource).toContain("trust.windowYearDetail");
    expect(reportPageSource).toContain("text-sm font-medium leading-snug text-slate-700");
    expect(reportPageSource).toContain("text-[11px] leading-tight text-slate-500");
    expect(reportPageSource).not.toContain("formatMonthDay");
    expect(reportPageSource).not.toContain("text-lg font-semibold leading-tight text-foreground");
    expect(stringsSource).toContain('"trust.windowYearDetail": "{year}, platform read dates"');
    expect(englishBundleSource).toContain('"trust.windowYearDetail": "{year}, platform read dates"');
  });

  it("keeps evidence row status separate from proof actions", () => {
    expect(stringsSource).toContain('"table.status": "Status"');
    expect(stringsSource).toContain('"table.source": "Source"');
    expect(stringsSource).toContain('"table.review": "Review"');
    expect(stringsSource).toContain('"evidence.needsReview": "Needs review"');
    expect(stringsSource).toContain('"evidence.missingProof": "Missing proof"');
    expect(stringsSource).toContain('"evidence.noProof": "No proof"');
    expect(englishBundleSource).toContain('"table.status": "Status"');
    expect(englishBundleSource).toContain('"table.source": "Source"');
    expect(englishBundleSource).toContain('"table.review": "Review"');
    expect(englishBundleSource).toContain('"evidence.needsReview": "Needs review"');
    expect(reportPageSource).toContain("getEvidenceStatusMeta");
    expect(reportPageSource).toContain("data-testid=\"report-evidence-status\"");
    expect(reportPageSource).toContain("data-testid=\"report-evidence-source\"");
    expect(reportPageSource).not.toContain(
      'read.sourceType === "brand_verified" ||\n    read.verificationStatus === "brand_verified"',
    );
    expect(reportPageSource).toContain("data-testid=\"report-evidence-proof-cell\"");
    expect(reportPageSource).toContain("data-testid=\"report-evidence-review-cell\"");
    expect(reportPageSource).toContain("hasEvidenceProofReference(read.screenshotUrl)");
    expect(reportPageSource).toContain("getExternalEvidenceUrl(read.screenshotUrl)");
    expect(reportPageSource).toContain("reviewPerformanceProofLink");
    expect(reportPageSource).toContain("t(\"evidence.noProof\")");
    expect(reportPageSource).toContain('sortKey="source"');
    expect(reportPageSource).toContain('sortKey="proof"');
    expect(reportPageSource).toContain('sortKey="review"');
    expect(reportPageSource).not.toContain("<TableHead className=\"text-end\">{t(\"table.proof\")}</TableHead>");
    expect(reportPageSource).not.toContain("flex flex-wrap items-center justify-end gap-2");
    expect(reportPageSource).not.toContain("const evidenceReads = useMemo(");
  });

  it("keeps evidence proof and review actions compact inside fixed table columns", () => {
    expect(reportPageSource).toContain("inline-flex h-7 items-center justify-center");
    expect(reportPageSource).toContain("text-[11px] font-medium");
    expect(reportPageSource).toContain("flex flex-nowrap items-center gap-1.5");
    expect(reportPageSource).toContain(
      'className="w-[112px]" data-testid="report-evidence-proof-cell"',
    );
    expect(reportPageSource).toContain(
      'className="w-[230px]" data-testid="report-evidence-review-cell"',
    );
    expect(reportPageSource).not.toContain(
      "flex flex-wrap items-center justify-end gap-2",
    );
    expect(reportPageSource).not.toContain(
      "data-testid=\"report-evidence-open\"\n      data-evidence-id={read.evidenceId ?? undefined}\n      onClick={() => void onOpenEvidence(read)}\n      className=\"inline-flex h-8",
    );
  });

  it("shows the evidence data source so brands know how each number entered the report", () => {
    expect(stringsSource).toContain('"evidence.source.aiAccepted": "AI read, creator confirmed"');
    expect(stringsSource).toContain('"evidence.source.aiEdited": "AI read, creator edited"');
    expect(stringsSource).toContain('"evidence.source.manual": "Creator-entered proof"');
    expect(stringsSource).toContain('"evidence.source.brandVerified": "Brand-reviewed proof"');
    expect(stringsSource).toContain('"trust.sourceReviewedDetail": "Creator evidence reviewed by brand"');
    expect(stringsSource).toContain('"trust.sourcePendingDetail": "Creator-submitted values awaiting brand review"');
    expect(englishBundleSource).toContain('"evidence.source.aiAccepted": "AI read, creator confirmed"');
    expect(englishBundleSource).toContain('"evidence.source.aiEdited": "AI read, creator edited"');
    expect(englishBundleSource).toContain('"evidence.source.manual": "Creator-entered proof"');
    expect(englishBundleSource).toContain('"evidence.source.brandVerified": "Brand-reviewed proof"');
    expect(englishBundleSource).toContain('"trust.sourceReviewedDetail": "Creator evidence reviewed by brand"');
    expect(englishBundleSource).toContain('"trust.sourcePendingDetail": "Creator-submitted values awaiting brand review"');
    expect(reportPageSource).toContain("interface EvidenceSourceMeta");
    expect(reportPageSource).toContain("function getEvidenceSourceMeta");
    expect(reportPageSource).toContain("function buildReportSourceDetail");
    expect(reportPageSource).toContain("aiExtractionStatus === \"edited_by_creator\"");
    expect(reportPageSource).toContain("aiExtractionStatus === \"accepted_by_creator\"");
    expect(reportPageSource).toContain("const source = getEvidenceSourceMeta");
    expect(reportPageSource).toContain("sourceLabel");
    expect(sharedReportDataSource).toContain("function buildSourceDetail");
    expect(sharedReportDataSource).toContain("Creator evidence reviewed by brand");
    expect(sharedReportDataSource).toContain("Creator-submitted values awaiting brand review");
    expect(sharedReportDataSource).not.toContain('detail: "How metrics entered PopsDrops"');
  });

  it("shows each proof row's report impact so managers know what reaches leadership totals", () => {
    expect(stringsSource).toContain('"table.impact": "Report impact"');
    expect(stringsSource).toContain('"evidence.impact.included": "Included in report totals"');
    expect(stringsSource).toContain('"evidence.impact.pending": "Excluded until brand review"');
    expect(stringsSource).toContain('"evidence.impact.rejected": "Excluded; correction required"');
    expect(stringsSource).toContain('"evidence.impact.missing": "Excluded until proof is uploaded"');
    expect(stringsSource).toContain('"evidence.impact.returned": "Correction returned; review before totals"');
    expect(englishBundleSource).toContain('"table.impact": "Report impact"');
    expect(englishBundleSource).toContain('"evidence.impact.included": "Included in report totals"');
    expect(reportPageSource).toContain("interface EvidenceImpactMeta");
    expect(reportPageSource).toContain("function getEvidenceImpactMeta");
    expect(reportPageSource).toContain("const impact = getEvidenceImpactMeta");
    expect(reportPageSource).toContain('sortKey="impact"');
    expect(reportPageSource).toContain("data-testid=\"report-evidence-impact\"");
    expect(reportPageSource).toContain("read.evidenceVerificationStatus === \"rejected\"");
    expect(reportPageSource).toContain("read.hasReturnedCorrection");
  });

  it("shows proof review provenance so included numbers have an accountable decision trail", () => {
    expect(stringsSource).toContain('"evidence.reviewedAt": "Reviewed {date}"');
    expect(stringsSource).toContain('"evidence.awaitingDecision": "Awaiting brand decision"');
    expect(stringsSource).toContain('"evidence.reviewedBy": "Reviewer recorded"');
    expect(englishBundleSource).toContain('"evidence.reviewedAt": "Reviewed {date}"');
    expect(reportPageSource).toContain("evidenceReviewedAt?: string | null");
    expect(reportPageSource).toContain("evidenceReviewedBy?: string | null");
    expect(reportPageSource).toContain("function getEvidenceReviewProvenance");
    expect(reportPageSource).toContain("reviewed_by, reviewed_at");
    expect(reportPageSource).toContain("evidenceReviewedAt: evidence?.reviewed_at ?? null");
    expect(reportPageSource).toContain('data-testid="report-evidence-impact-cell"');
    expect(reportPageSource).toContain("data-testid=\"report-evidence-review-provenance\"");
    expect(reportPageSource).toContain("getEvidenceReviewProvenance(read, t, locale)");
  });

  it("summarizes leadership impact before row-level proof details", () => {
    expect(stringsSource).toContain('"evidence.summary.title": "Leadership impact"');
    expect(stringsSource).toContain('"evidence.summary.detail":');
    expect(stringsSource).toContain(
      "What is included in leadership totals, what is waiting, and what needs creator action.",
    );
    expect(stringsSource).toContain('"evidence.summary.included": "Included"');
    expect(stringsSource).toContain('"evidence.summary.review": "Needs review"');
    expect(stringsSource).toContain('"evidence.summary.corrections": "Corrections"');
    expect(stringsSource).toContain('"evidence.summary.missing": "Missing proof"');
    expect(reportPageSource).toContain("function buildEvidenceTrailSummary");
    expect(reportPageSource).toContain("data-testid=\"report-evidence-summary\"");
    expect(reportPageSource).toContain("data-testid=\"report-evidence-summary-item\"");
    expect(reportPageSource).toContain("summary.included");
    expect(reportPageSource).toContain("summary.pendingReview");
    expect(reportPageSource).toContain("summary.corrections");
    expect(reportPageSource).toContain("summary.missingProof");
  });

  it("keeps zero proof issue counts visually neutral", () => {
    expect(reportPageSource).toContain("const issueCountClassName =");
    expect(reportPageSource).toContain("summary.pendingReview > 0");
    expect(reportPageSource).toContain("summary.corrections > 0");
    expect(reportPageSource).toContain("summary.missingProof > 0");
    expect(reportPageSource).toContain("border-amber-200 bg-amber-50 text-amber-900");
    expect(reportPageSource).toContain("border-red-200 bg-red-50 text-red-700");
    expect(reportPageSource).toContain("border-slate-200 bg-white text-slate-500");
  });

  it("adds a proof review command bar before row-level evidence details", () => {
    expect(stringsSource).toContain('"evidence.command.title": "Proof review command"');
    expect(stringsSource).toContain('"evidence.command.handoffLabel": "Leadership handoff"');
    expect(stringsSource).toContain('"evidence.command.handoffReady": "Share with leadership"');
    expect(stringsSource).toContain('"evidence.command.handoffHold": "Keep in proof room"');
    expect(stringsSource).toContain('"evidence.command.countsLabel": "Proof basis"');
    expect(stringsSource).toContain('"evidence.command.statusLabel": "Leadership status"');
    expect(stringsSource).toContain('"evidence.command.actionLabel": "Next action"');
    expect(stringsSource).toContain('"evidence.command.ready.title": "Ready for leadership"');
    expect(stringsSource).toContain('"evidence.command.ready.detail": "All submitted proof is reviewed and included."');
    expect(stringsSource).toContain('"evidence.command.ready.status": "Ready to share"');
    expect(stringsSource).toContain('"evidence.command.ready.action": "Export leadership report"');
    expect(stringsSource).toContain('"evidence.command.review.title": "Review submitted proof"');
    expect(stringsSource).toContain('"evidence.command.review.detail": "Submitted proof is waiting before totals can be shared."');
    expect(stringsSource).toContain('"evidence.command.review.status": "Hold in proof room"');
    expect(stringsSource).toContain('"evidence.command.review.action": "Verify or request correction"');
    expect(stringsSource).toContain('"evidence.command.corrections.title": "Creator correction needed"');
    expect(stringsSource).toContain('"evidence.command.corrections.action": "Wait for corrected proof"');
    expect(stringsSource).toContain('"evidence.command.missing.title": "Missing proof"');
    expect(stringsSource).toContain('"evidence.command.missing.action": "Ask creator to upload proof"');
    expect(englishBundleSource).toContain('"evidence.command.title": "Proof review command"');
    expect(englishBundleSource).toContain('"evidence.command.handoffLabel": "Leadership handoff"');
    expect(englishBundleSource).toContain('"evidence.command.handoffReady": "Share with leadership"');
    expect(englishBundleSource).toContain('"evidence.command.handoffHold": "Keep in proof room"');
    expect(englishBundleSource).toContain('"evidence.command.countsLabel": "Proof basis"');
    expect(englishBundleSource).toContain('"evidence.command.ready.status": "Ready to share"');
    expect(englishBundleSource).toContain('"evidence.command.review.status": "Hold in proof room"');
    expect(reportPageSource).toContain("interface EvidenceReviewCommand");
    expect(reportPageSource).toContain("function buildEvidenceReviewCommand");
    expect(reportPageSource).toContain("data-testid=\"report-evidence-command\"");
    expect(reportPageSource).toContain("data-testid=\"report-evidence-handoff-gate\"");
    expect(reportPageSource).toContain("data-testid=\"report-evidence-handoff-counts\"");
    expect(reportPageSource).toContain('data-report-handoff-state={reviewCommand.tone}');
    expect(reportPageSource).toContain('t("evidence.command.handoffLabel")');
    expect(reportPageSource).toContain('t("evidence.command.handoffReady")');
    expect(reportPageSource).toContain('t("evidence.command.handoffHold")');
    expect(reportPageSource).toContain('t("evidence.command.countsLabel")');
    expect(reportPageSource).toContain("data-testid=\"report-evidence-command-status\"");
    expect(reportPageSource).toContain("data-testid=\"report-evidence-command-action\"");
    expect(reportPageSource).toContain("data-testid=\"report-evidence-command-primary\"");
    expect(reportPageSource).toContain("buildEvidenceReviewCommand({ summary, t })");
  });

  it("renders mobile proof rows instead of forcing the desktop evidence table on narrow screens", () => {
    expect(reportPageSource).toContain("data-testid=\"report-evidence-mobile-list\"");
    expect(reportPageSource).toContain("data-testid=\"report-evidence-mobile-row\"");
    expect(reportPageSource).toContain("className=\"space-y-2 md:hidden\"");
    expect(reportPageSource).toContain("className=\"hidden overflow-x-auto md:block\"");
    expect(reportPageSource).toContain("EvidenceProofAction");
    expect(reportPageSource).toContain("EvidenceReviewActions");
  });

  it("highlights an exact evidence row when admin drills into correction proof", () => {
    expect(reportPageSource).toContain("useSearchParams");
    expect(reportPageSource).toContain("focusedEvidenceId");
    expect(reportPageSource).toContain("focusedReportTaskId");
    expect(reportPageSource).toContain("created_at");
    expect(reportPageSource).toContain(".order(\"created_at\", { ascending: false })");
    expect(reportPageSource).toContain("!evidenceByPerformanceId.has(evidence.performance_id)");
    expect(reportPageSource).toContain("resolvedFocusedEvidenceId");
    expect(reportPageSource).toContain("focusedReportTaskId");
    expect(reportPageSource).toContain("auditReads.find");
    expect(reportPageSource).toContain("data-report-task-id");
    expect(reportPageSource).toContain('id="report-evidence-trail"');
    expect(reportPageSource).toContain('data-testid="report-evidence-focused-row"');
    expect(reportPageSource).toContain('data-focused={isFocused ? "true" : undefined}');
    expect(reportPageSource).toContain("read.evidenceId === focusedEvidenceId");
  });

  it("renders creator performance as compact mobile rows while preserving the sortable desktop table", () => {
    expect(reportPageSource).toContain("CreatorPerformanceMobileRow");
    expect(reportPageSource).toContain("CreatorPerformanceDesktopTable");
    expect(reportPageSource).toContain("data-testid=\"report-creators-mobile-list\"");
    expect(reportPageSource).toContain("data-testid=\"report-creators-mobile-row\"");
    expect(reportPageSource).toContain("data-testid=\"report-creators-desktop-table\"");
    expect(reportPageSource).toContain("className=\"space-y-2 md:hidden\"");
    expect(reportPageSource).toContain("className=\"hidden overflow-x-auto md:block\"");
    expect(reportPageSource).toContain('sortKey="views"');
    expect(reportPageSource).toContain('sortKey="er"');
    expect(reportPageSource).toContain('sortKey="cpe"');
  });

  it("renders data-backed recommendations without generic strategy filler", () => {
    expect(reportPageSource).toContain("interface ReportRecommendation");
    expect(reportPageSource).toContain("function buildReportRecommendations");
    expect(reportPageSource).toContain("getAcceptedReportReads(reads)");
    expect(reportPageSource).toContain("data-testid=\"report-recommendations\"");
    expect(reportPageSource).toContain("data-testid=\"report-recommendation-card\"");
    expect(reportPageSource).toContain("recommendations.length === 0");
    expect(reportPageSource).toContain("recommendations: recommendations.map");
    expect(sharedReportDataSource).toContain("function buildRecommendations");
    expect(sharedReportDataSource).toContain("recommendations: buildRecommendations");
    expect(reportPageSource).toContain('t("rec.topCreator")');
    expect(reportPageSource).toContain('t("rec.bestChannel")');
    expect(reportPageSource).toContain('t("rec.efficiency")');
    expect(stringsSource).toContain('"rec.topCreator": "Top creator"');
    expect(stringsSource).toContain('"rec.topCreatorDetail": "{views} views on {platform}"');
    expect(stringsSource).toContain('"rec.bestChannel": "Best channel"');
    expect(stringsSource).toContain('"rec.bestChannelDetail": "{rate} engagement rate across {reads}"');
    expect(stringsSource).toContain('"rec.efficiency": "Efficiency"');
    expect(englishBundleSource).toContain('"rec.topCreator": "Top creator"');
    expect(designSource).toContain("Report recommendations must be earned by the data on the page");
    expect(reportPageSource).not.toContain("AI recommendation");
    expect(reportPageSource).not.toContain("Consider expanding");
  });

  it("keeps recommendation detail in PDF and PowerPoint exports", () => {
    expect(exportPdfSource).toContain("if (data.recommendations?.length)");
    expect(exportPdfSource).toContain("doc.text(item.detail");
    expect(exportPdfSource).toContain("const recommendationLine = data.recommendations");
    expect(exportPdfSource).toContain("${item.title}: ${item.value} (${item.detail})");
  });

  it("keeps PDF and PowerPoint exports aligned to the premium HTML report contract", () => {
    expect(exportPdfSource).toContain("buildClientExportHeroMeta(data)");
    expect(exportPdfSource).toContain("buildClientExportMetricRecipe(metric)");
    expect(exportPdfSource).toContain("renderReportPdfHero");
    expect(exportPdfSource).toContain("renderReportPdfMetricReadout");
    expect(exportPdfSource).toContain("addDeckVisualLedHero");
    expect(exportPdfSource).toContain("addDeckMetricReadout");
    expect(exportPdfSource).toContain("Creator-level evidence");
    expect(exportPdfSource).not.toContain("doc.text(data.dateRange, margin, y)");
    expect(exportPdfSource).not.toContain("addDeckText(cover, data.dateRange");
  });

  it("keeps rejected evidence as history instead of offering review actions again", () => {
    expect(reportPageSource).toContain("function canReviewEvidence");
    expect(reportPageSource).toContain('read.evidenceVerificationStatus !== "rejected"');
    expect(reportPageSource).toContain("canReviewEvidence(read)");
    expect(reportPageSource).not.toContain('read.evidenceId && read.evidenceVerificationStatus !== "verified"');
    expect(reportPageSource).not.toContain('read.evidenceId && read.evidenceVerificationStatus !== "rejected"');
  });

  it("shows only the current proof row in the evidence table after a correction is resolved", () => {
    expect(reportMetricsSource).toContain("export function getCurrentReportReads");
    expect(reportMetricsSource).toContain("export function getCurrentReportReadsWithHistory");
    expect(reportPageSource).toContain("getCurrentReportReadsWithHistory(reads)");
    expect(reportPageSource).toContain("read.hasReturnedCorrection");
    expect(reportPageSource).toContain('t("evidence.correctionReturned")');
    expect(stringsSource).toContain('"evidence.correctionReturned": "Correction returned"');
    expect(englishBundleSource).toContain('"evidence.correctionReturned": "Correction returned"');
    expect(reportPageSource).not.toContain("reads.toSorted((first, second) => {");
  });

  it("makes report tables sortable from their column headers", () => {
    expect(reportPageSource).toContain("type SortDirection");
    expect(reportPageSource).toContain("function SortableTableHead");
    expect(reportPageSource).toContain("data-testid=\"report-sort-header\"");
    expect(reportPageSource).toContain("aria-sort=");
    expect(reportPageSource).toContain("setEvidenceSort");
    expect(reportPageSource).toContain("setPerformerSort");
    expect(reportPageSource).toContain("sortedPerformers");
    expect(reportPageSource).toContain('sortKey="creator"');
    expect(reportPageSource).toContain('sortKey="reported"');
    expect(reportPageSource).toContain('sortKey="views"');
    expect(reportPageSource).toContain('sortKey="engagements"');
    expect(designSource).toContain("Every data table should support sorting from the column header");
  });

  it("applies the campaign-level report goal before falling back to the team default template", () => {
    expect(reportPageSource).toContain(".from(\"campaign_reporting_plans\")");
    expect(reportPageSource).toContain("report_template_id");
    expect(reportPageSource).toContain("report_preset_id");
    expect(reportPageSource).toContain("report_chart_mode_id");
    expect(reportPageSource).toContain("report_block_ids");
    expect(reportPageSource).toContain("setCampaignReportGoalApplied(true)");
    expect(reportPageSource).toContain("campaignReportGoalApplied");
  });

  it("shows the executive question behind the selected report preset", () => {
    expect(reportPageSource).toContain("selectedReportExecutiveQuestion");
    expect(reportPageSource).toContain("selectedReportBestFor");
    expect(reportOutputContractPanelSource).toContain(
      'data-testid="report-output-executive-question"',
    );
    expect(reportOutputContractPanelSource).toContain(
      'data-testid="report-output-chart-layout"',
    );
    expect(reportOutputContractPanelSource).toContain("builder.output.executiveQuestion");
    expect(reportOutputContractPanelSource).toContain("builder.output.bestFor");
    expect(reportOutputContractPanelSource).toContain("builder.output.chartLayout");
  });

  it("shows a leadership handoff gate inside the report builder preview", () => {
    expect(stringsSource).toContain('"builder.story.handoff": "Leadership handoff"');
    expect(stringsSource).toContain(
      '"builder.story.handoffDetail": "Save the report shape, then exports and shared links carry this trust gate."',
    );
    expect(englishBundleSource).toContain('"builder.story.handoff": "Leadership handoff"');
    expect(englishBundleSource).toContain(
      '"builder.story.handoffDetail": "Save the report shape, then exports and shared links carry this trust gate."',
    );
    expect(reportBuilderPanelSource).toContain('key: "leadership-handoff"');
    expect(reportBuilderPanelSource).toContain('label: t("builder.story.handoff")');
    expect(reportBuilderPanelSource).toContain('detail: t("builder.story.handoffDetail")');
    expect(reportBuilderPanelSource).toContain("detail?: string");
    expect(reportBuilderPanelSource).toContain("item.detail");
    expect(reportBuilderPanelSource).toContain('data-contract-item={item.key}');
  });

  it("turns report output into an executive readiness rail instead of a card wall", () => {
    expect(stringsSource).toContain('"builder.output.readiness": "Leadership readiness"');
    expect(stringsSource).toContain('"builder.output.decision": "Decision"');
    expect(stringsSource).toContain('"builder.output.evidence": "Evidence"');
    expect(stringsSource).toContain('"builder.output.trustDecision": "Trust decision"');
    expect(stringsSource).toContain('"builder.output.trustDecisionDetail":');
    expect(stringsSource).toContain('"builder.output.exportShape": "Presentation plan"');
    expect(englishBundleSource).toContain('"builder.output.readiness": "Leadership readiness"');
    expect(englishBundleSource).toContain('"builder.output.trustDecision": "Trust decision"');
    expect(englishBundleSource).toContain('"builder.output.trustDecisionDetail":');
    expect(reportOutputContractPanelSource).toContain(
      'data-testid="report-output-readiness-rail"',
    );
    expect(reportOutputContractPanelSource).toContain(
      'data-testid="report-output-readiness-step"',
    );
    expect(reportOutputContractPanelSource).toContain(
      'data-readiness-step="decision"',
    );
    expect(reportOutputContractPanelSource).toContain(
      'data-readiness-step="evidence"',
    );
    expect(reportOutputContractPanelSource).toContain(
      'data-readiness-step="trust-decision"',
    );
    expect(reportOutputContractPanelSource).toContain(
      'data-readiness-step="export"',
    );
  });

  it("puts a board-facing executive read before report configuration detail", () => {
    const executiveReadStart = reportOutputContractPanelSource.indexOf(
      'data-testid="report-output-executive-read"',
    );
    const executiveReadSource = reportOutputContractPanelSource.slice(
      executiveReadStart,
      reportOutputContractPanelSource.indexOf(
        'data-testid="report-output-proof-basis"',
        executiveReadStart,
      ),
    );

    expect(reportOutputContractPanelSource).toContain(
      'data-testid="report-output-executive-read"',
    );
    expect(reportOutputContractPanelSource).toContain(
      "data-executive-read-state={leadershipHandoff.state}",
    );
    expect(reportOutputContractPanelSource).not.toContain(
      'data-executive-read-state={readinessDecision === "Ready for leadership sharing." ? "ready" : "hold"}',
    );
    expect(executiveReadSource).toContain("border-slate-200 bg-white px-4 py-3");
    expect(executiveReadSource).toContain('data-testid="report-output-next-action-note"');
    expect(executiveReadSource).toContain("border-slate-200 bg-slate-50/80 px-3 py-2");
    expect(reportOutputContractPanelSource).toContain("decisionRead");
    expect(reportOutputContractPanelSource).toContain("nextAction");
    expect(reportOutputContractPanelSource.indexOf('data-testid="report-output-executive-read"')).toBeLessThan(
      reportOutputContractPanelSource.indexOf('data-testid="report-output-spine"'),
    );
    expect(executiveReadSource).not.toContain("bg-slate-950");
    expect(executiveReadSource).not.toContain("text-white");
    expect(executiveReadSource).not.toContain("border-white/10 bg-white/[0.04]");
  });

  it("shows leadership proof-basis counts in the report output gate before export detail", () => {
    expect(stringsSource).toContain('"evidence.command.countsLabel": "Proof basis"');
    expect(stringsSource).toContain('"evidence.summary.included": "Included"');
    expect(stringsSource).toContain('"evidence.summary.review": "Needs review"');
    expect(stringsSource).toContain('"evidence.summary.corrections": "Corrections"');
    expect(stringsSource).toContain('"evidence.summary.missing": "Missing proof"');
    expect(englishBundleSource).toContain('"evidence.command.countsLabel": "Proof basis"');
    expect(reportPageSource).toContain("buildReportLeadershipHandoff(fullReportExportData)");
    expect(reportPageSource).toContain("buildReportProofOperations(reportExportDataWithoutProofOperations)");
    expect(reportPageSource).toContain(
      "leadershipHandoff={selectedReportLeadershipHandoff}",
    );
    expect(reportOutputContractPanelSource).toContain("ReportLeadershipHandoff");
    expect(reportOutputContractPanelSource).toContain("leadershipHandoff");
    expect(reportOutputContractPanelSource).toContain(
      'data-testid="report-output-proof-basis"',
    );
    expect(reportOutputContractPanelSource).toContain(
      'data-testid="report-output-proof-basis-item"',
    );
    expect(reportOutputContractPanelSource).toContain(
      "data-proof-basis-key={item.key}",
    );
    expect(reportOutputContractPanelSource).toContain('t("evidence.command.countsLabel")');
    expect(reportOutputContractPanelSource.indexOf('data-testid="report-output-proof-basis"')).toBeLessThan(
      reportOutputContractPanelSource.indexOf('data-testid="report-output-decision-recipe"'),
    );
  });

  it("shows proof operations readiness before teams inspect creator evidence rows", () => {
    expect(stringsSource).toContain('"proofOps.title": "Proof operations"');
    expect(stringsSource).toContain('"proofOps.ready": "Ready for leadership sharing"');
    expect(stringsSource).toContain('"proofOps.correction": "Corrections block leadership sharing"');
    expect(stringsSource).toContain('"proofOps.verifiedCoverage": "{verified}/{total} verified reads"');
    expect(englishBundleSource).toContain('"proofOps.title": "Proof operations"');
    expect(reportPageSource).toContain("buildProofRoomScaleReadiness(evidenceMetric)");
    expect(reportPageSource).toContain("function ProofRoomScaleReadinessPanel");
    expect(reportPageSource).toContain('data-testid="proof-room-scale-readiness"');
    expect(reportPageSource).toContain('data-testid="proof-room-scale-lane"');
    expect(reportPageSource).toContain('data-proof-readiness-action={readiness.action}');
    expect(reportPageSource).toContain("<ProofRoomScaleReadinessPanel");
    expect(reportPageSource.indexOf("<ProofRoomScaleReadinessPanel")).toBeLessThan(
      reportPageSource.indexOf("<EvidenceTrail"),
    );
  });

  it("renders report output detail selections as compact chips and a ledger", () => {
    expect(reportPageSource).not.toContain("function splitReportLabelList");
    expect(reportOutputContractPanelSource).toContain("function splitReportLabelList");
    expect(reportOutputContractPanelSource).toContain(
      'data-testid="report-output-details-ledger"',
    );
    expect(reportOutputContractPanelSource).toContain(
      'data-testid="report-output-tile-chip"',
    );
  });

  it("makes the selected chart mode change the visible report body story", () => {
    expect(stringsSource).toContain('"builder.chartStory.title": "Primary report story"');
    expect(stringsSource).toContain('"builder.chartStory.mode": "Mode"');
    expect(stringsSource).toContain('"builder.chartStory.evidenceStatus": "Evidence status"');
    expect(stringsSource).toContain('"builder.chartStory.proofSources": "Proof sources"');
    expect(englishBundleSource).toContain('"builder.chartStory.title": "Primary report story"');
    expect(reportPageSource).toContain("function ReportChartModeStory");
    expect(reportPageSource).toContain("function ReportProofAuditPanel");
    expect(reportPageSource).toContain('data-testid="report-chart-layout-story"');
    expect(reportPageSource).toContain('data-chart-mode={chartModeId}');
    expect(reportPageSource).toContain('data-testid="report-proof-audit-panel"');
    expect(reportPageSource).toContain('chartModeId === "proof"');
    expect(reportPageSource).toContain('chartModeId === "comparison"');
    expect(reportPageSource).toContain("layoutTitle={selectedReportChartLayoutTitle}");
    expect(reportPageSource).toContain("layoutDetail={selectedReportChartLayoutDetail}");
  });

  it("keeps the proof audit summary from calling trust evidence empty", () => {
    const panelStart = reportPageSource.indexOf("function ReportProofAuditPanel");
    const panelSource = reportPageSource.slice(
      panelStart,
      reportPageSource.indexOf("function ReportChartModeStory", panelStart),
    );
    const headerSource = panelSource.slice(
      panelSource.indexOf("const proofSourceLabel"),
      panelSource.indexOf("<CardContent"),
    );

    expect(panelSource).toContain("const proofSourceLabel = proofSourceItems.length > 0");
    expect(panelSource).toContain(': t("builder.chartStory.proofSources")');
    expect(headerSource).not.toContain('t("builder.chartStory.noProofSources")');
  });

  it("surfaces the executive decision spine before the primary report visual", () => {
    expect(stringsSource).toContain('"builder.chartStory.noNextAction": "No recommendation yet"');
    expect(stringsSource).toContain('"builder.output.recipeQuestion": "Question"');
    expect(stringsSource).toContain('"builder.output.recipeVisualJob": "Visual job"');
    expect(stringsSource).toContain('"builder.output.recipeEvidenceGate": "Evidence gate"');
    expect(stringsSource).toContain('"builder.output.recipeNextAction": "Next action"');
    expect(englishBundleSource).toContain('"builder.output.recipeQuestion": "Question"');
    expect(reportPageSource).toContain('data-testid="report-story-decision-rail"');
    expect(reportPageSource).toContain('data-testid="report-story-decision-step"');
    expect(reportPageSource).toContain('data-decision-step={item.key}');
    expect(reportPageSource).toContain("String(index + 1).padStart(2, \"0\")");
    expect(reportPageSource).not.toContain('data-testid="report-story-decision-card"');
    expect(reportPageSource).not.toContain("grid gap-2 md:grid-cols-2 xl:grid-cols-4");
    expect(reportPageSource).toContain("executiveQuestion={selectedReportExecutiveQuestion}");
    expect(reportPageSource).toContain("nextAction={recommendations[0] ?? null}");
    expect(reportPageSource).toContain("trustDecision={selectedReportTrustDecision}");
    expect(reportPageSource).toContain('t("builder.output.recipeQuestion")');
    expect(reportPageSource).toContain('t("builder.output.recipeVisualJob")');
    expect(reportPageSource).toContain('t("builder.output.recipeEvidenceGate")');
    expect(reportPageSource).toContain('t("builder.output.recipeNextAction")');
  });
});
