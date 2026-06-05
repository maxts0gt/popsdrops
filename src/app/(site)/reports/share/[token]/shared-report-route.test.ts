import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const sharedViewSource = readFileSync(
  new URL("../../../../../components/reports/shared-report-view.tsx", import.meta.url),
  "utf8",
);
const sharedReportDataSource = readFileSync(
  new URL("../../../../../lib/reporting/shared-report-data.ts", import.meta.url),
  "utf8",
);
const sharedReportTrustSource = readFileSync(
  new URL("../../../../../lib/reporting/shared-report-trust.ts", import.meta.url),
  "utf8",
);

describe("public shared report route", () => {
  it("loads reports by token without requiring a brand session", () => {
    expect(pageSource).toContain('export const dynamic = "force-dynamic"');
    expect(pageSource).toContain('export const fetchCache = "force-no-store"');
    expect(pageSource).toContain("export const revalidate = 0");
    expect(pageSource).toContain("getSharedReportByToken");
    expect(pageSource).toContain("<SharedReportView data={payload.report} share={payload.share} />");
    expect(pageSource).not.toContain("getUser");
    expect(pageSource).not.toContain("createClient");
  });

  it("keeps the public report interactive and read-only", () => {
    expect(sharedViewSource).toContain("selectedSectionIndex");
    expect(sharedViewSource).toContain("hoveredPoint");
    expect(sharedViewSource).toContain("creatorSort");
    expect(sharedViewSource).toContain("sortedCreators");
    expect(sharedViewSource).toContain("data-testid=\"shared-report-sort-header\"");
    expect(sharedViewSource).toContain("aria-sort=");
    expect(sharedViewSource).toContain("data-testid=\"shared-report-view\"");
    expect(sharedViewSource).toContain("data-testid=\"shared-report-point\"");
    expect(sharedViewSource).toContain("data-testid=\"shared-report-recommendations\"");
    expect(sharedViewSource).toContain("data-testid=\"shared-report-recommendation-primary\"");
    expect(sharedViewSource).toContain('t("section.recommendations")');
    expect(sharedViewSource).not.toContain("exportReportPDF");
    expect(sharedViewSource).not.toContain("revokeReportShareLink");
  });

  it("renders shared recommendations as an executive memo instead of a card grid", () => {
    const recommendationSource = sharedViewSource.slice(
      sharedViewSource.indexOf('case "recommendations"'),
      sharedViewSource.indexOf('case "creator_table"'),
    );

    expect(recommendationSource).toContain("Decision memo");
    expect(recommendationSource).toContain("Recommended move");
    expect(recommendationSource).toContain("Supporting evidence");
    expect(recommendationSource).toContain('data-testid="shared-report-recommendation-primary"');
    expect(recommendationSource).toContain('data-testid="shared-report-recommendation-evidence"');
    expect(recommendationSource).not.toContain("md:grid-cols-3");
    expect(recommendationSource).not.toContain("grid-rows-[1.25rem_auto_1fr]");
  });

  it("does not truncate shared report trust values like data window dates", () => {
    expect(sharedViewSource).toContain('data-testid="shared-report-trust-label"');
    expect(sharedViewSource).toContain('data-testid="shared-report-trust-value"');
    expect(sharedViewSource).toContain('data-testid="shared-report-trust-detail"');
    expect(sharedViewSource).toContain("font-mono text-[13px] font-medium leading-tight text-slate-700");
    expect(sharedViewSource).not.toContain('className="truncate text-lg font-semibold"');
    expect(sharedViewSource).not.toContain("break-words text-base font-semibold");
  });

  it("keeps shared report executive values restrained like the live report", () => {
    const sectionSource = sharedViewSource.slice(
      sharedViewSource.indexOf("function SharedReportSections"),
      sharedViewSource.indexOf("export function SharedReportView"),
    );
    const executiveSummarySource = sharedViewSource.slice(
      sharedViewSource.indexOf('case "executive_summary"'),
      sharedViewSource.indexOf('case "channel_story"'),
    );

    expect(sectionSource).toContain('data-testid="shared-report-selected-metric-value"');
    expect(sectionSource).toContain("font-mono text-[13px] font-medium leading-tight text-slate-700");
    expect(sectionSource).not.toContain("text-2xl font-semibold");

    expect(executiveSummarySource).toContain('data-testid="shared-report-kpi-card"');
    expect(executiveSummarySource).toContain('data-testid="shared-report-kpi-watchpoint"');
    expect(executiveSummarySource).toContain("Leadership watchpoint");
    expect(executiveSummarySource).toContain('data-testid="shared-report-kpi-value"');
    expect(executiveSummarySource).toContain("font-mono text-[13px] font-medium leading-tight text-slate-700");
    expect(executiveSummarySource).not.toContain("text-2xl font-semibold");
  });

  it("renders one-read report sections as snapshot ledgers instead of empty charts", () => {
    expect(sharedViewSource).toContain("function SharedReportSnapshotLedger");
    expect(sharedViewSource).toContain('data-testid="shared-report-snapshot-ledger"');
    expect(sharedViewSource).toContain('data-testid="shared-report-snapshot-row"');
    expect(sharedViewSource).toContain("const isSnapshotOnlySection =");
    expect(sharedViewSource).toContain("selectedSection.metrics.every");
    expect(sharedViewSource).toContain("const selectedSectionHeading = isSnapshotOnlySection");
    expect(sharedViewSource).toContain('t("share.snapshotReadLabel")');
    expect(sharedViewSource).toContain("const selectedSectionDetail = isSnapshotOnlySection");
    expect(sharedViewSource).toContain('t("chart.snapshot.detail")');
    expect(sharedViewSource).toContain("<SharedReportSnapshotLedger");
  });

  it("gives public shared reports the same executive cover contract as exports", () => {
    expect(sharedViewSource).toContain("function getSharedReportPresentation");
    expect(sharedViewSource).toContain("buildReportHeroMetrics");
    expect(sharedViewSource).toContain("ReportHeroMetric");
    expect(sharedViewSource).toContain("function SharedReportExecutiveCover");
    expect(sharedViewSource).toContain("metrics: ReportHeroMetric[]");
    expect(sharedViewSource).toContain("const defaultSharedReportCoverMetrics = buildReportHeroMetrics(data)");
    expect(sharedViewSource).toContain('data-testid="shared-report-executive-cover"');
    expect(sharedViewSource).toContain('data-cover-mode={presentation.coverMode}');
    expect(sharedViewSource).toContain('data-typography={presentation.typography}');
    expect(sharedViewSource).toContain('data-density={presentation.density}');
    expect(sharedViewSource).toContain('data-testid="shared-report-executive-cover-metric"');
    expect(sharedViewSource).toContain("data-cover-metric-source={metric.source}");
    expect(sharedViewSource).toContain("data-cover-metric-key={metric.key}");
    expect(sharedViewSource).toContain('data-testid="shared-report-executive-cover-metric-detail"');
    expect(sharedViewSource).toContain('data-testid="shared-report-executive-cover-visual"');
    expect(sharedViewSource).toContain("data-cover-source={coverSource}");
    expect(sharedViewSource).toContain('data-testid="shared-report-executive-cover-image"');
    expect(sharedViewSource).toContain('data-testid="shared-report-executive-cover-question"');
    expect(sharedViewSource).toContain('data-testid="shared-report-executive-cover-evidence-strip"');
    expect(sharedViewSource).toContain('data-testid="shared-report-executive-cover-evidence-item"');
    expect(sharedViewSource).toContain("divide-y divide-slate-200");
    expect(sharedViewSource).toContain("sm:divide-x sm:divide-y-0");
    expect(sharedViewSource).toContain('t("cover.kicker")');
    expect(sharedViewSource).toContain('t("cover.window")');
    expect(sharedViewSource).not.toContain('t("cover.reportType")');
    expect(sharedViewSource).not.toContain('t("cover.primaryView")');
    expect(sharedViewSource).not.toContain('t("cover.evidenceStatus")');
    expect(sharedViewSource).toContain("metrics={sharedReportCoverMetrics}");
    expect(sharedViewSource).toContain("campaignImageUrl={data.campaignImageUrl}");
    expect(sharedViewSource).toContain("campaignImageAlt={data.campaignImageAlt}");
    expect(sharedViewSource).toContain("campaignImageAlt?: string | null;");
    expect(sharedViewSource).toContain("campaignImageAlt ?? t(\"cover.visualDetail\")");
  });

  it("keeps shared report campaign-image covers resilient when the image asset fails", () => {
    const coverStart = sharedViewSource.indexOf("function SharedReportExecutiveCover");
    const coverSource = sharedViewSource.slice(
      coverStart,
      sharedViewSource.indexOf("function SharedReportChart", coverStart),
    );

    expect(coverSource).toContain("const [campaignImageFailed, setCampaignImageFailed] = useState(false);");
    expect(coverSource).toContain("const shouldRenderCampaignImage = shouldUseCampaignImage && !campaignImageFailed;");
    expect(coverSource).toContain('data-testid="shared-report-executive-cover-visual-backdrop"');
    expect(coverSource).toContain('data-testid="shared-report-executive-cover-proof-card"');
    expect(coverSource).toContain('onError={() => setCampaignImageFailed(true)}');
    expect(coverSource).toContain('data-cover-source={coverSource}');
  });

  it("shows the same leadership trust decision on shared links as exported reports", () => {
    expect(sharedViewSource).toContain("getSharedReportTrustDecision");
    expect(sharedViewSource).toContain('data-testid="shared-report-trust-decision"');
    expect(sharedViewSource).toContain('t("builder.output.trustDecision")');
    expect(sharedReportTrustSource).toContain("Ready for leadership sharing.");
    expect(sharedReportTrustSource).toContain("Resolve correction requests before leadership sharing.");
    expect(sharedReportTrustSource).toContain("Keep in proof room until evidence is reviewed.");
    expect(sharedReportTrustSource).toContain("const statusValueText =");
    expect(sharedReportTrustSource).toContain("const statusText =");
  });

  it("surfaces the trust decision directly on the shared executive cover", () => {
    expect(sharedViewSource).toContain('data-testid="shared-report-executive-cover-trust-decision"');
    expect(sharedViewSource).toContain("data-cover-trust-state={leadershipGate.state}");
    expect(sharedViewSource).toContain('t("builder.output.trustDecision")');
    expect(sharedViewSource).toContain("{leadershipGate.detail}");
  });

  it("marks public shared reports as leadership-ready or on leadership hold", () => {
    expect(sharedReportTrustSource).toContain('export type SharedReportLeadershipState = "ready" | "hold";');
    expect(sharedReportTrustSource).toContain("export function getSharedReportLeadershipGate");
    expect(sharedReportTrustSource).toContain("export function getSharedReportProofBasis");
    expect(sharedReportTrustSource).toContain('trustDecision === "Ready for leadership sharing."');
    expect(sharedViewSource).toContain('data-testid="shared-report-leadership-gate"');
    expect(sharedViewSource).toContain("data-leadership-state={leadershipGate.state}");
    expect(sharedViewSource).toContain("data-trust-state={leadershipGate.state}");
    expect(sharedViewSource).toContain('data-testid="shared-report-proof-basis"');
    expect(sharedViewSource).toContain('data-proof-basis-key={item.key}');
    expect(sharedViewSource).toContain('t("evidence.command.countsLabel")');
    expect(sharedViewSource).toContain('t("evidence.summary.included")');
    expect(sharedViewSource).toContain('t("evidence.summary.review")');
    expect(sharedViewSource).toContain('t("evidence.summary.corrections")');
    expect(sharedViewSource).toContain('t("evidence.summary.missing")');
    expect(sharedReportTrustSource).toContain("Leadership-ready");
    expect(sharedReportTrustSource).toContain("Leadership hold");
    expect(sharedViewSource).toContain("<SharedReportExecutiveCover");
    expect(sharedViewSource).toContain("leadershipGate={leadershipGate}");
    expect(sharedViewSource).toContain("proofBasis={sharedReportProofBasis}");
  });

  it("withholds performance sections on leadership-hold shared reports", () => {
    expect(sharedViewSource).toContain("function getSharedReportHoldTrustItems");
    expect(sharedViewSource).toContain("function buildSharedReportHoldCoverMetrics");
    expect(sharedViewSource).toContain("function SharedReportLeadershipHoldPanel");
    expect(sharedViewSource).toContain('data-testid="shared-report-leadership-hold-panel"');
    expect(sharedViewSource).toContain("sharedReportHoldPerformanceBlockIds");
    expect(sharedViewSource).toContain("const visibleSharedReportBlockOrder");
    expect(sharedViewSource).toContain('leadershipGate.state === "hold"');
    expect(sharedViewSource).toContain("!sharedReportHoldPerformanceBlockIds.has(blockId)");
    expect(sharedViewSource).toContain("buildSharedReportHoldCoverMetrics(data)");
    expect(sharedViewSource).toContain("<SharedReportLeadershipHoldPanel");
  });

  it("applies the campaign report goal to public shared reports", () => {
    expect(sharedReportDataSource).toContain("buildReportCompositionExportData");
    expect(sharedReportDataSource).toContain("function loadCampaignReportImage");
    expect(sharedReportDataSource).toContain("title, bucket_id, storage_path");
    expect(sharedReportDataSource).toContain("campaignImageAlt: campaignImage?.title ?? null");
    expect(sharedReportDataSource).toContain(".from(\"campaign_reporting_plans\")");
    expect(sharedReportDataSource).toContain(
      "report_template_id, report_preset_id, report_chart_mode_id, report_block_ids",
    );
    expect(sharedReportDataSource).toContain("buildReportCompositionExportData(baseReport");
    expect(sharedReportDataSource).toContain("buildReportLeadershipHandoff");
    expect(sharedReportDataSource).toContain("leadershipHandoff: buildReportLeadershipHandoff(baseReport)");
    expect(sharedReportDataSource).toContain("reportPlan?.report_block_ids");
    expect(sharedViewSource).toContain("hasExecutiveSummary");
    expect(sharedViewSource).toContain("hasReportTrust");
    expect(sharedViewSource).toContain("hasCreatorTable");
    expect(sharedViewSource).toContain("renderSharedReportBlock");
    expect(sharedViewSource).toContain("visibleSharedReportBlockOrder.map");
    expect(sharedViewSource).toContain('data-testid="shared-report-composition"');
    expect(sharedViewSource).toContain('t("share.composition")');
    expect(sharedViewSource).toContain('t("share.blocks")');
    expect(sharedViewSource).toContain("data.composition.presetTitle");
    expect(sharedViewSource).toContain("data.blocks.map");
  });

  it("shows public recipients when the shared report link expires", () => {
    expect(sharedViewSource).toContain("interface SharedReportViewProps");
    expect(sharedViewSource).toContain("share: SharedReportPayload[\"share\"]");
    expect(sharedViewSource).toContain('data-testid="shared-report-access-expiry"');
    expect(sharedViewSource).toContain('t("share.accessExpires"');
    expect(sharedReportDataSource).toContain("expiresAt: link.expires_at");
  });

  it("uses compact executive dates in the shared report header", () => {
    expect(sharedViewSource).toContain("formatReportCompactDate");
    expect(sharedViewSource).toContain(
      "date: formatReportCompactDate(data.generatedAt)",
    );
    expect(sharedViewSource).toContain(
      "date: formatSharedReportAccessDate(share.expiresAt)",
    );
    expect(sharedViewSource).not.toContain("toLocaleDateString(locale, {");
    expect(sharedViewSource).not.toContain('month: "short"');
  });

  it("renders public shared reports in the configured report block order", () => {
    expect(sharedViewSource).toContain("getSharedReportBlockOrder");
    expect(sharedViewSource).toContain("renderSharedReportBlock");
    expect(sharedViewSource).toContain('data-testid="shared-report-block-region"');
    expect(sharedViewSource).toContain("visibleSharedReportBlockOrder.map");
    expect(sharedViewSource).toContain('case "recommendations":');
    expect(sharedViewSource).toContain('case "creator_table":');
    expect(sharedViewSource).not.toContain("{hasExecutiveSummary && (");
    expect(sharedViewSource).not.toContain("{hasReportTrust && (");
    expect(sharedViewSource).not.toContain("{hasReportSections && (");
    expect(sharedViewSource).not.toContain("{hasCreatorTable && (");
  });

  it("renders the brand-selected report story on public shared reports", () => {
    expect(sharedViewSource).toContain("buildSharedReportStory");
    expect(sharedViewSource).toContain("function SharedReportStoryPanel");
    expect(sharedViewSource).toContain('data-testid="shared-report-story-panel"');
    expect(sharedViewSource).toContain('data-shared-report-story-mode={story.mode}');
    expect(sharedViewSource).toContain('data-testid="shared-report-story-decision"');
    expect(sharedViewSource).toContain('data-testid="shared-report-story-evidence"');
    expect(sharedViewSource).toContain('data-testid="shared-report-story-trend"');
    expect(sharedViewSource).toContain('data-testid="shared-report-story-comparison"');
    expect(sharedViewSource).toContain('data-testid="shared-report-story-comparison-row"');
    expect(sharedViewSource).toContain('data-testid="shared-report-story-proof"');
    expect(sharedViewSource).toContain('data-testid="shared-report-story-proof-item"');
    expect(sharedViewSource).toContain('story.proofItems.length ? t("builder.chartStory.proofSources")');
    expect(sharedViewSource).toContain("<SharedReportStoryPanel");
    expect(sharedViewSource).toContain("story={sharedReportStory}");
  });

  it("fills single-read shared report stories with a snapshot callout instead of blank chart space", () => {
    expect(sharedViewSource).toContain("const isSingleReadTrendStory =");
    expect(sharedViewSource).toContain("primaryMetric.pointCount < 2");
    expect(sharedViewSource).toContain('data-testid="shared-report-story-snapshot-callout"');
    expect(sharedViewSource).toContain('t("chart.snapshot.title")');
    expect(sharedViewSource).toContain('t("chart.snapshot.detail")');
    expect(sharedViewSource).not.toContain("sm:grid-cols-[minmax(0,0.42fr)_minmax(0,1fr)]");
  });

  it("uses brand-written executive report titles on public shared reports", () => {
    expect(sharedViewSource).toContain("getReportDisplayTitle");
    expect(sharedViewSource).toContain("const reportDisplayTitle = getReportDisplayTitle(data)");
    expect(sharedViewSource).toContain("{reportDisplayTitle}");
    expect(sharedViewSource).not.toContain('t("titleForCampaign", { title: data.campaignTitle })');
  });
});
