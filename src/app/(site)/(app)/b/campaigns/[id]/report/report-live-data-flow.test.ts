import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const reportPageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const reportShareActionsSource = readFileSync(
  new URL("../../../../../../actions/report-shares.ts", import.meta.url),
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

describe("campaign report live data flow", () => {
  it("uses the campaign data as the report title instead of a fixed report name", () => {
    expect(stringsSource).toContain('"titleForCampaign": "{title} Report"');
    expect(englishBundleSource).toContain('"titleForCampaign": "{title} Report"');
    expect(reportPageSource).toContain('t("titleForCampaign", { title: campaign.title })');
    expect(reportPageSource).not.toContain('<h1 className="text-2xl font-bold text-foreground">{t("title")}</h1>');
  });

  it("loads measurement type for seeded reads and updates when report data changes", () => {
    expect(reportPageSource).toContain("measurement_type");
    expect(reportPageSource).toContain("screenshot_url");
    expect(reportPageSource).toContain("verification_status");
    expect(reportPageSource).toContain("content_performance_metric_values");
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
    expect(stringsSource).toContain('"export": "Export"');
    expect(stringsSource).toContain('"export.pdf": "PDF report"');
    expect(stringsSource).toContain('"export.html": "HTML report"');
    expect(stringsSource).toContain('"export.json": "JSON data"');
    expect(stringsSource).toContain('"export.csv": "CSV table"');
    expect(stringsSource).toContain('"export.pptx": "PowerPoint deck"');
    expect(reportPageSource).toContain("DropdownMenu");
    expect(reportPageSource).toContain("buildReportExportData");
    expect(reportPageSource).toContain("exportReportPDF");
    expect(reportPageSource).toContain("exportReportHTML");
    expect(reportPageSource).toContain("exportReportJSON");
    expect(reportPageSource).toContain("exportReportCSV");
    expect(reportPageSource).toContain("exportReportPPTX");
    expect(reportPageSource).toContain("data-testid=\"report-export-menu\"");
    expect(reportPageSource).not.toContain("Export PDF");
  });

  it("offers a secure share report workflow alongside exports", () => {
    expect(stringsSource).toContain('"share": "Share"');
    expect(stringsSource).toContain('"share.create": "Create link"');
    expect(stringsSource).toContain('"share.linkLabel": "Report link"');
    expect(englishBundleSource).toContain('"share.create": "Create link"');
    expect(englishBundleSource).toContain('"share.linkLabel": "Report link"');
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
    expect(reportPageSource).toContain("data-testid=\"report-share-url\"");
    expect(reportPageSource).not.toContain('t("share.newLinkHint")');
    expect(reportPageSource).not.toContain('t("share.revoked")');
    expect(reportPageSource).not.toContain("setShareLoading");
    expect(reportPageSource).not.toContain('loading ? t("share.generating")');
    expect(reportShareActionsSource).toContain('.select("id")');
    expect(reportShareActionsSource).toContain(".maybeSingle()");
    expect(reportShareActionsSource).toContain("Share link could not be revoked.");
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

  it("shows hover details on report line chart points", () => {
    expect(reportPageSource).toContain("hoveredPoint");
    expect(reportPageSource).toContain("setHoveredPoint");
    expect(reportPageSource).toContain("data-testid=\"report-chart-tooltip\"");
    expect(reportPageSource).toContain("onMouseEnter");
    expect(reportPageSource).toContain("onFocus");
    expect(reportPageSource).toContain("tabIndex={0}");
  });

  it("keeps report KPI cards as a compact single-row desktop strip", () => {
    expect(reportPageSource).toContain("grid grid-cols-5 gap-2");
    expect(reportPageSource).toContain("grid-rows-[2.5rem_auto_1fr]");
    expect(reportPageSource).toContain("self-end");
    expect(reportPageSource).toContain("text-xl font-semibold");
    expect(reportPageSource).toContain("text-[11px] font-medium");
    expect(designSource).toContain("Metric cards must keep numeric values on a shared baseline");
    expect(reportPageSource).not.toContain("lg:grid-cols-5");
    expect(reportPageSource).not.toContain("xl:grid-cols-5");
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
  });

  it("formats the trust data window as an editorial date range, not raw ISO-style dates", () => {
    expect(reportPageSource).toContain("formatTrustWindowRange");
    expect(reportPageSource).toContain(" ~ ");
    expect(reportPageSource).toContain("trust.windowYearDetail");
    expect(reportPageSource).not.toContain("formatCompactDate(evidence.dataWindow.start)");
    expect(stringsSource).toContain('"trust.windowYearDetail": "{year}, platform read dates"');
    expect(englishBundleSource).toContain('"trust.windowYearDetail": "{year}, platform read dates"');
  });
});
