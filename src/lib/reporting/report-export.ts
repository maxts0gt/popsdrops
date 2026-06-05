export interface ReportExportMetricPoint {
  date: string;
  label: string;
  value: number;
}

export interface ReportExportMetric {
  key?: string;
  label: string;
  value: string;
  detail: string;
  points: ReportExportMetricPoint[];
}

export interface ReportExportKpi {
  key?: string;
  label: string;
  value: string;
  detail?: string;
}

export interface ReportExportSection {
  title: string;
  detail: string;
  sourceGroup?: "campaign_channel" | "proof_source";
  metrics: ReportExportMetric[];
}

export interface ReportExportTrustItem {
  key?: string;
  label: string;
  value: string;
  detail: string;
}

export interface ReportExportRecommendation {
  title: string;
  value: string;
  detail: string;
}

export interface ReportExportProofReview {
  label: string;
  value: string;
  detail: string;
  reviewedAt: string;
  reviewerRecorded: boolean;
}

export interface ReportExportStory {
  decisionRead: string;
  evidenceTrail: string;
  trustDecision: string;
  nextAction: string;
  proofReview?: ReportExportProofReview;
}

export type ReportLeadershipHandoffState = "ready" | "hold";

export type ReportLeadershipProofBasisKey =
  | "included"
  | "needs-review"
  | "corrections"
  | "missing-proof";

export interface ReportLeadershipProofBasisItem {
  key: ReportLeadershipProofBasisKey;
  label: string;
  value: number;
}

export interface ReportLeadershipHandoff {
  state: ReportLeadershipHandoffState;
  label: string;
  decision: string;
  proofBasis: ReportLeadershipProofBasisItem[];
}

export type ReportProofOperationsScope = "single" | "scale";

export interface ReportProofOperations {
  scope: ReportProofOperationsScope;
  state: ReportLeadershipHandoffState;
  label: string;
  decision: string;
  verifiedCoverage: string;
  attentionCount: number;
  proofBasis: ReportLeadershipProofBasisItem[];
}

export interface ReportExportBlock {
  id: string;
  title: string;
  detail: string;
  executivePurpose?: string;
}

export interface ReportExportComposition {
  reportTitle?: string;
  presetId: string;
  presetTitle: string;
  presetDetail: string;
  bestFor?: string;
  executiveQuestion?: string;
  chartModeId: string;
  chartModeTitle: string;
  chartModeDetail: string;
  chartLayoutTitle: string;
  chartLayoutDetail: string;
  templateId?: string | null;
  templateName?: string | null;
  templateDescription?: string | null;
  presentation?: ReportExportPresentation;
}

export interface ReportExportPresentation {
  coverMode: "campaign_visual" | "proof_room";
  typography: "quiet" | "compact";
  density: "editorial" | "compact";
  chartMetricKey?: "views" | "engagements" | "engagementRate" | "cpe" | null;
  headline?: string | null;
  executiveQuestion?: string | null;
  kpiIds?: string[] | null;
  trustIds?: string[] | null;
  kpiLabels?: Record<string, string> | null;
  trustLabels?: Record<string, string> | null;
  sectionLabels?: Record<string, string> | null;
}

export interface ReportExportCreator {
  name: string;
  market: string;
  platform: string;
  views: string;
  engagements: string;
  er: string;
  cpe: string;
  spent: string;
  rating: string;
}

export interface ReportExportData {
  campaignTitle: string;
  dateRange: string;
  generatedAt: string;
  campaignImageAlt?: string | null;
  campaignImageUrl?: string | null;
  composition?: ReportExportComposition;
  blocks?: ReportExportBlock[];
  proofReview?: ReportExportProofReview | null;
  kpis: ReportExportKpi[];
  trust: ReportExportTrustItem[];
  story?: ReportExportStory;
  leadershipHandoff?: ReportLeadershipHandoff;
  proofOperations?: ReportProofOperations;
  recommendations: ReportExportRecommendation[];
  sections: ReportExportSection[];
  creators: ReportExportCreator[];
}

export type ReportHeroMetricSource = "kpi" | "trust";

const noSubmittedProofTrustDecision =
  "Keep in proof room until at least one proof read is submitted and reviewed.";

export interface ReportHeroMetric {
  key: string;
  label: string;
  value: string;
  detail?: string;
  source: ReportHeroMetricSource;
}

interface ReportDecisionRecipeRow {
  key: string;
  label: string;
  value: string;
  detail?: string;
}

export function buildSafeExportName(title: string): string {
  return title
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "campaign";
}

export function buildReportFilename(title: string, extension: string): string {
  return `popsdrops-report-${buildSafeExportName(title)}.${extension}`;
}

function isReportDataSourceTrustItem(item: ReportExportTrustItem): boolean {
  const key = item.key?.toLowerCase() ?? "";
  const label = item.label.toLowerCase();

  return key === "data_source" ||
    label.includes("data source") ||
    label.includes("metric origin");
}

function isLegacyManualSourceValue(value: string): boolean {
  return value.trim().toLowerCase() === "manual entry";
}

function isFullyVerifiedReportSource(data: ReportExportData): boolean {
  if (data.leadershipHandoff?.state === "ready") return true;

  const verifiedRatio = parseRatio(getVerifiedReadsItem(data)?.value ?? "");

  if (
    verifiedRatio &&
    verifiedRatio.denominator > 0 &&
    verifiedRatio.numerator >= verifiedRatio.denominator
  ) {
    return true;
  }

  return false;
}

function normalizeLegacySourceTrustItem(
  data: ReportExportData,
  item: ReportExportTrustItem,
): ReportExportTrustItem {
  if (!isReportDataSourceTrustItem(item) || !isLegacyManualSourceValue(item.value)) {
    return item;
  }

  if (isFullyVerifiedReportSource(data)) {
    return {
      ...item,
      value: "Brand-reviewed proof",
      detail: "Creator evidence reviewed by brand",
    };
  }

  return {
    ...item,
    value: "Creator-entered proof",
    detail: "Creator-submitted values awaiting brand review",
  };
}

export function normalizeReportExportData(data: ReportExportData): ReportExportData {
  const trust = data.trust.map((item) => normalizeLegacySourceTrustItem(data, item));

  return {
    ...data,
    trust,
  };
}

export function buildJsonContent(data: ReportExportData): string {
  const normalized = normalizeReportExportData(data);

  return JSON.stringify(
    {
      ...normalized,
      story: buildReportExportStory(normalized),
      leadershipHandoff: buildReportLeadershipHandoff(normalized),
      proofOperations: buildReportProofOperations(normalized),
    },
    null,
    2,
  );
}

function escapeCsvCell(value: string): string {
  if (!/[",\n\r]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

function sectionSourceGroupLabel(section: ReportExportSection): string {
  return section.sourceGroup === "proof_source"
    ? "Proof source"
    : "Campaign channel";
}

function isReportBlockIncluded(data: ReportExportData, blockId: string): boolean {
  if (!data.blocks?.length) return true;

  return data.blocks.some((block) => block.id === blockId);
}

function getReportBlockTitle(
  data: ReportExportData,
  blockId: string,
  fallback: string,
): string {
  const title = data.blocks
    ?.find((block) => block.id === blockId)
    ?.title
    ?.trim();

  return title || fallback;
}

function getReportPresentation(data: ReportExportData): ReportExportPresentation {
  const presentation = data.composition?.presentation;

  return {
    coverMode: presentation?.coverMode === "proof_room"
      ? "proof_room"
      : "campaign_visual",
    typography: presentation?.typography === "compact" ? "compact" : "quiet",
    density: presentation?.density === "compact" ? "compact" : "editorial",
    ...(isReportChartMetricKey(presentation?.chartMetricKey)
      ? { chartMetricKey: presentation.chartMetricKey }
      : {}),
    ...(presentation?.headline ? { headline: presentation.headline } : {}),
    ...(presentation?.executiveQuestion
      ? { executiveQuestion: presentation.executiveQuestion }
      : {}),
    ...(presentation?.kpiIds?.length ? { kpiIds: presentation.kpiIds } : {}),
    ...(presentation?.trustIds?.length ? { trustIds: presentation.trustIds } : {}),
    ...(presentation?.kpiLabels && Object.keys(presentation.kpiLabels).length
      ? { kpiLabels: presentation.kpiLabels }
      : {}),
    ...(presentation?.trustLabels && Object.keys(presentation.trustLabels).length
      ? { trustLabels: presentation.trustLabels }
      : {}),
    ...(presentation?.sectionLabels && Object.keys(presentation.sectionLabels).length
      ? { sectionLabels: presentation.sectionLabels }
      : {}),
  };
}

export function getReportDisplayTitle(data: ReportExportData): string {
  return data.composition?.reportTitle?.trim() || `${data.campaignTitle} Report`;
}

function reportHeroMetricKey(
  metric: ReportExportKpi | ReportExportTrustItem,
  source: ReportHeroMetricSource,
  index: number,
): string {
  if (metric.key?.trim()) return metric.key.trim();

  const text = `${metric.label} ${metric.detail ?? ""}`.toLowerCase();

  if (source === "kpi") {
    if (text.includes("qualified reach") || text.includes("views")) return "views";
    if (text.includes("audience actions") || text.includes("engagements")) {
      return "engagements";
    }
    if (text.includes("engagement rate")) return "engagementRate";
    if (text.includes("efficiency signal") || text.includes("cost per engagement")) {
      return "cpe";
    }
  }

  if (text.includes("proof coverage") || text.includes("evidence-backed")) {
    return "evidence_backed_reads";
  }
  if (text.includes("verified reads") || text.includes("brand-reviewed proof")) {
    return "verified_reads";
  }
  if (text.includes("read window") || text.includes("data window")) return "data_window";
  if (text.includes("metric origin") || text.includes("data source")) return "data_source";
  if (text.includes("report status") || text.includes("submitted")) return "report_status";

  return `${source}-${index}`;
}

export function buildReportHeroMetrics(
  data: Pick<ReportExportData, "kpis" | "trust">,
): ReportHeroMetric[] {
  const kpiMetrics = data.kpis.slice(0, 2).map((metric, index) => ({
    key: reportHeroMetricKey(metric, "kpi", index),
    label: metric.label,
    value: metric.value,
    ...(metric.detail ? { detail: metric.detail } : {}),
    source: "kpi" as const,
  }));
  const trustMetrics = data.trust
    .slice(0, Math.max(0, 3 - kpiMetrics.length))
    .map((metric, index) => ({
      key: reportHeroMetricKey(metric, "trust", index),
      label: metric.label,
      value: metric.value,
      detail: metric.detail,
      source: "trust" as const,
    }));

  return [...kpiMetrics, ...trustMetrics].slice(0, 3);
}

export function getReportBodyKpis(
  data: Pick<ReportExportData, "kpis" | "trust">,
): ReportExportKpi[] {
  const coverKpiKeys = new Set(
    buildReportHeroMetrics(data)
      .filter((metric) => metric.source === "kpi")
      .map((metric) => metric.key),
  );

  return data.kpis.filter((metric, index) => {
    const key = reportHeroMetricKey(metric, "kpi", index);
    return !coverKpiKeys.has(key);
  });
}

function getReportCoverModeLabel(coverMode: ReportExportPresentation["coverMode"]): string {
  return coverMode === "proof_room" ? "Global Proof Room" : "Campaign visual";
}

function getReportTypographyLabel(
  typography: ReportExportPresentation["typography"],
): string {
  return typography === "compact" ? "Compact" : "Quiet";
}

function getReportDensityLabel(density: ReportExportPresentation["density"]): string {
  return density === "compact" ? "Compact" : "Editorial";
}

function getReportDecisionRecipeRows(
  data: ReportExportData,
): ReportDecisionRecipeRow[] {
  const composition = data.composition;
  const question = composition?.executiveQuestion?.trim() ||
    composition?.presentation?.executiveQuestion?.trim() ||
    composition?.chartLayoutTitle?.trim() ||
    "Confirm whether this campaign is ready for leadership.";
  const visualJob = composition?.chartLayoutTitle?.trim() ||
    composition?.chartModeTitle?.trim() ||
    "Selected report view";
  const visualJobDetail = composition?.chartLayoutDetail?.trim() ||
    composition?.chartModeDetail?.trim() ||
    "Selected evidence view.";

  return [
    {
      key: "question",
      label: "Question",
      value: question,
    },
    {
      key: "visual-job",
      label: "Visual job",
      value: visualJob,
      detail: visualJobDetail,
    },
    {
      key: "evidence-gate",
      label: "Evidence gate",
      value: getReportEvidenceTrail(data),
    },
    {
      key: "action",
      label: "Action",
      value: getHtmlStoryAction(data),
    },
  ];
}

function buildProofReviewCsvRows(data: ReportExportData): string[][] {
  if (!data.proofReview) return [];

  return [
    ["Proof Review"],
    ["Label", "Value", "Detail"],
    [
      data.proofReview.label,
      data.proofReview.value,
      data.proofReview.detail,
    ],
    [],
  ];
}

function buildLeadershipHandoffCsvRows(data: ReportExportData): string[][] {
  const handoff = buildReportLeadershipHandoff(data);

  return [
    ["Leadership Handoff"],
    ["Field", "Value"],
    ["State", handoff.state],
    ["Label", handoff.label],
    ["Decision", handoff.decision],
    ["Proof basis", "Label", "Value"],
    ...handoff.proofBasis.map((item) => [
      "Proof basis",
      item.label,
      String(item.value),
    ]),
    [],
  ];
}

function buildProofOperationsCsvRows(data: ReportExportData): string[][] {
  const operations = buildReportProofOperations(data);

  return [
    ["Proof Operations"],
    ["Field", "Value"],
    ["Scope", operations.scope],
    ["State", operations.state],
    ["Label", operations.label],
    ["Decision", operations.decision],
    ["Verified coverage", operations.verifiedCoverage],
    ["Attention count", String(operations.attentionCount)],
    ["Proof basis", "Label", "Value"],
    ...operations.proofBasis.map((item) => [
      "Proof basis",
      item.label,
      String(item.value),
    ]),
    [],
  ];
}

export function buildCsvContent(data: ReportExportData): string {
  data = normalizeReportExportData(data);

  const rows: string[][] = [
    ["Report Overview"],
    ["Field", "Value"],
    ["Report title", getReportDisplayTitle(data)],
    ["Campaign", data.campaignTitle],
    ["Generated", formatHtmlGeneratedDate(data.generatedAt)],
    ["Report window", formatHtmlDateText(data.dateRange)],
    [],
  ];

  if (data.composition) {
    const presentation = getReportPresentation(data);
    const decisionRecipeRows = getReportDecisionRecipeRows(data);

    rows.push(
      ["Report Composition"],
      ["Type", "Title", "Detail"],
      ["Report plan", data.composition.presetTitle, data.composition.presetDetail],
      ...(data.composition.bestFor
        ? [["Best for", data.composition.bestFor]]
        : []),
      ...(data.composition.executiveQuestion
        ? [["Executive question", data.composition.executiveQuestion]]
        : []),
      ["Chart", data.composition.chartModeTitle, data.composition.chartModeDetail],
      ["Chart layout", data.composition.chartLayoutTitle, data.composition.chartLayoutDetail],
      [],
      ["Report Decision Recipe"],
      ["Step", "Value", "Detail"],
      ...decisionRecipeRows.map((row) => [
        row.label,
        row.value,
        row.detail ?? "",
      ]),
      [],
      ["Report Presentation"],
      ["Field", "Value"],
      ["Cover", getReportCoverModeLabel(presentation.coverMode)],
      ["Typography", getReportTypographyLabel(presentation.typography)],
      ["Density", getReportDensityLabel(presentation.density)],
      [],
    );
  }

  if (data.blocks?.length) {
    rows.push(
      ["Report Blocks"],
      ["ID", "Title", "Detail", "Executive purpose"],
      ...data.blocks.map((block) => [
        block.id,
        block.title,
        block.detail,
        block.executivePurpose ?? "",
      ]),
      [],
    );
  }

  rows.push(
    ["Report Trust"],
    ["Label", "Value", "Detail"],
    ...data.trust.map((item) => [
      item.label,
      item.key === "data_window" || item.label.toLowerCase().includes("window")
        ? formatHtmlDateText(item.value)
        : item.value,
      item.detail,
    ]),
    [],
    ...buildLeadershipHandoffCsvRows(data),
    ...buildProofOperationsCsvRows(data),
    ...buildProofReviewCsvRows(data),
    ["Recommendations"],
    ["Title", "Value", "Detail"],
    ...(data.recommendations ?? []).map((item) => [
      item.title,
      item.value,
      item.detail,
    ]),
    [],
    ["Report Sections"],
    ["Section", "Group", "Metric", "Value", "Detail"],
    ...data.sections.flatMap((section) =>
      section.metrics.map((metric) => [
        section.title,
        sectionSourceGroupLabel(section),
        metric.label,
        metric.value,
        metric.detail,
      ]),
    ),
  );

  if (isReportBlockIncluded(data, "creator_table")) {
    rows.push(
      [],
      ["Creator Performance"],
      [
        "Creator",
        "Market",
        "Platform",
        "Views",
        "Engagements",
        "ER",
        "CPE",
        "Spent",
        "Rating",
      ],
      ...data.creators.map((creator) => [
        creator.name,
        creator.market,
        creator.platform,
        creator.views,
        creator.engagements,
        creator.er,
        creator.cpe,
        creator.spent,
        creator.rating,
      ]),
    );
  }

  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDateParts(year: number, month: number, day: number): string {
  return `${year}/${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}`;
}

function formatHtmlShortDate(value: string): string {
  const trimmed = value.trim();
  const structured = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(trimmed);
  if (structured) {
    return formatDateParts(
      Number(structured[1]),
      Number(structured[2]),
      Number(structured[3]),
    );
  }

  if (!/\b\d{4}\b/.test(trimmed)) return value;

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return value;

  return formatDateParts(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
  );
}

function formatHtmlDateText(value: string): string {
  const trimmed = value.trim();
  const parts = trimmed.split(/\s+(?:to|~|[-\u2013\u2014])\s+/i);

  if (parts.length === 2) {
    return `${formatHtmlShortDate(parts[0])} - ${formatHtmlShortDate(parts[1])}`;
  }

  return formatHtmlShortDate(value);
}

export function buildReportProofReviewProvenance({
  reviewedAt,
  reviewerRecorded,
}: {
  reviewedAt?: string | null;
  reviewerRecorded?: boolean;
}): ReportExportProofReview | null {
  if (!reviewedAt) return null;

  return {
    label: "Proof review",
    value: `Reviewed ${formatHtmlShortDate(reviewedAt)}`,
    detail: reviewerRecorded ? "Reviewer recorded" : "Reviewer not recorded",
    reviewedAt,
    reviewerRecorded: Boolean(reviewerRecorded),
  };
}

function formatHtmlGeneratedDate(value: string): string {
  return formatHtmlShortDate(value);
}

function formatHtmlPointDate(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;

  return `${String(date.getUTCMonth() + 1).padStart(2, "0")}/${String(
    date.getUTCDate(),
  ).padStart(2, "0")}`;
}

function formatHtmlPointLongDate(value: string): string {
  return formatHtmlShortDate(value);
}

function formatHtmlAxisValue(metric: ReportExportMetric, value: number): string {
  const sampleLabel = metric.points.find((point) => point.label)?.label ?? metric.value;

  if (sampleLabel.includes("$")) {
    return `$${value.toLocaleString("en-US", {
      maximumFractionDigits: value < 10 ? 2 : 0,
    })}`;
  }

  if (sampleLabel.includes("%")) {
    return `${value.toFixed(1)}%`;
  }

  if (sampleLabel.includes("K") && value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }

  return value.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

function buildHtmlMetricTile(metric: {
  key?: string;
  label: string;
  value: string;
  detail?: string;
}): string {
  const metricKey = metric.key?.trim() || buildSafeExportName(metric.label);

  return `<article class="metric-tile" data-summary-metric-key="${escapeHtml(metricKey)}">
    <p>${escapeHtml(metric.label)}</p>
    <strong>${escapeHtml(metric.value)}</strong>
    ${metric.detail ? `<span>${escapeHtml(metric.detail)}</span>` : ""}
  </article>`;
}

function buildHtmlMetricCallout(metric: ReportExportKpi, sectionLabel: string): string {
  const metricKey = metric.key?.trim() || buildSafeExportName(metric.label);

  return `<section class="metric-callout" aria-label="${escapeHtml(sectionLabel)}" data-section-label="${escapeHtml(sectionLabel)}" data-summary-metric-key="${escapeHtml(metricKey)}">
    <p>Leadership watchpoint</p>
    <div>
      <span class="metric-callout-section">${escapeHtml(sectionLabel)}</span>
      <strong>${escapeHtml(metric.label)}</strong>
      ${metric.detail ? `<span>${escapeHtml(metric.detail)}</span>` : ""}
    </div>
    <small>${escapeHtml(metric.value)}</small>
  </section>`;
}

function buildHtmlCampaignVisual(
  data: ReportExportData,
  presentation: ReportExportPresentation,
): string {
  const reportTitle = getReportDisplayTitle(data);
  const campaignImageAlt = data.campaignImageAlt?.trim() ||
    `${reportTitle} campaign visual`;

  if (presentation.coverMode !== "proof_room" && data.campaignImageUrl) {
    return `<figure class="campaign-visual campaign-visual--hero">
      <img src="${escapeHtml(data.campaignImageUrl)}" alt="${escapeHtml(campaignImageAlt)}">
      <figcaption>${escapeHtml(campaignImageAlt)}</figcaption>
    </figure>`;
  }

  return `<figure class="campaign-visual campaign-visual--hero campaign-visual--fallback${presentation.coverMode === "proof_room" ? " campaign-visual--proof-room" : ""}" aria-label="Campaign visual">
    <span>${presentation.coverMode === "proof_room" ? "Global Proof Room" : "Campaign visual"}</span>
    <strong>${escapeHtml(reportTitle)}</strong>
    <small>Private proof workspace</small>
  </figure>`;
}

function buildHtmlHeroMetrics(metrics: ReportHeroMetric[]): string {
  if (metrics.length === 0) return "";

  return `<aside class="report-meta report-evidence-strip" aria-label="Report summary">
              ${metrics.map((metric) => {
                const value = formatHtmlDateText(metric.value);

                return `<div class="report-evidence-item" data-cover-metric-source="${escapeHtml(metric.source)}" data-cover-metric-key="${escapeHtml(metric.key)}">
                <span>${escapeHtml(metric.label)}</span>
                <strong>${escapeHtml(value)}</strong>${metric.detail ? `
                <small>${escapeHtml(metric.detail)}</small>` : ""}
              </div>`;
              }).join("\n              ")}
            </aside>`;
}

function buildHtmlReportBlocks(data: ReportExportData): string {
  if (!data.blocks?.length || !isReportBlockIncluded(data, "report_framing")) {
    return "";
  }
  const visibleBlocks = data.blocks.filter((block) => block.id !== "report_framing");
  if (!visibleBlocks.length) return "";

  return `<section class="report-blocks">
    <div class="block-head">
      <p>Report blocks</p>
      <span>${escapeHtml(String(visibleBlocks.length))} selected</span>
    </div>
    <div class="block-ledger">
      ${visibleBlocks
        .map(
          (block, index) => `<article class="block-row" data-report-block-row="${escapeHtml(block.id)}">
            <span class="block-row-index">${String(index + 1).padStart(2, "0")}</span>
            <div>
              <p>${escapeHtml(block.title)}</p>
              <span>${escapeHtml(block.detail)}</span>
            </div>
            ${
              block.executivePurpose
                ? `<div class="block-row-purpose"><small>Executive purpose</small><strong>${escapeHtml(block.executivePurpose)}</strong></div>`
                : `<div class="block-row-purpose"><small>Executive purpose</small><strong>Selected report context.</strong></div>`
            }
          </article>`,
        )
        .join("")}
    </div>
  </section>`;
}

function buildHtmlDecisionRecipe(data: ReportExportData): string {
  if (!data.composition) return "";

  const rows = getReportDecisionRecipeRows(data);

  return `<div class="decision-recipe" data-chart-recipe="decision-recipe">
      <div class="decision-recipe-head">
        <p>Decision recipe</p>
        <span>Question, visual job, evidence gate, and action this report is built around.</span>
      </div>
      <div class="decision-recipe-rail">
        ${rows
          .map(
            (row, index) => `<article class="decision-recipe-step" data-recipe-step="${escapeHtml(row.key)}">
              <span class="decision-recipe-index">${String(index + 1).padStart(2, "0")}</span>
              <div>
              <p>${escapeHtml(row.label)}</p>
              <strong>${escapeHtml(row.value)}</strong>
              ${row.detail ? `<span>${escapeHtml(row.detail)}</span>` : ""}
              </div>
            </article>`,
          )
          .join("")}
      </div>
    </div>`;
}

function buildHtmlReportComposition(data: ReportExportData): string {
  if (!data.composition || !isReportBlockIncluded(data, "report_framing")) {
    return "";
  }

  const compositionRows = [
    {
      key: "report-plan",
      label: "Report plan",
      value: data.composition.presetTitle,
      detail: data.composition.presetDetail,
    },
    ...(data.composition.executiveQuestion
      ? [
          {
            key: "executive-question",
            label: "Executive question",
            value: data.composition.executiveQuestion,
            detail: data.composition.bestFor ?? "",
          },
        ]
      : []),
    {
      key: "chart-mode",
      label: "Chart mode",
      value: data.composition.chartModeTitle,
      detail: data.composition.chartModeDetail,
    },
    {
      key: "chart-layout",
      label: "Chart layout",
      value: data.composition.chartLayoutTitle,
      detail: data.composition.chartLayoutDetail,
    },
  ];

  return `<section class="report-composition">
    <div class="block-head">
      <p>Report composition</p>
      <span>${escapeHtml(data.composition.chartModeTitle)}</span>
    </div>
    ${buildHtmlDecisionRecipe(data)}
    <div class="composition-ledger">
      ${compositionRows
        .map(
          (row) => `<article class="composition-row" data-composition-row="${escapeHtml(row.key)}">
        <p>${escapeHtml(row.label)}</p>
        <div>
          <strong>${escapeHtml(row.value)}</strong>
          ${row.detail ? `<span>${escapeHtml(row.detail)}</span>` : ""}
        </div>
      </article>`,
        )
        .join("")}
    </div>
  </section>`;
}

function getPrimaryHtmlMetric(data: ReportExportData): ReportExportMetric | null {
  const campaignSection =
    data.sections.find((section) => section.sourceGroup !== "proof_source") ??
    data.sections[0];

  return campaignSection?.metrics[0] ?? null;
}

function buildHtmlMetricJourney(metric: ReportExportMetric | null): string {
  if (!metric) return "No metric reads yet.";
  if (metric.points.length < 2) return `${metric.label}: ${metric.value}`;

  const first = metric.points[0];
  const last = metric.points[metric.points.length - 1];

  return `${first.label} to ${last.label}`;
}

function getReportEvidenceTrail(data: ReportExportData): string {
  const evidence = data.trust.find((item) =>
    item.key === "evidence_backed_reads" ||
    item.label.toLowerCase().includes("evidence"),
  ) ?? data.trust.find((item) =>
    item.label.toLowerCase().includes("proof"),
  );
  const source = data.trust.find((item) =>
    item.key === "data_source" ||
    item.label.toLowerCase().includes("source"),
  ) ?? data.trust.find((item) =>
    item.label.toLowerCase().includes("origin"),
  );
  const evidenceLine = evidence
    ? `${evidence.label}: ${evidence.value}`
    : "Evidence-backed reads: not reviewed";

  if (!source) return evidenceLine;
  const trail = `${evidenceLine} / ${source.value}`;

  return data.proofReview ? `${trail} / ${data.proofReview.value}` : trail;
}

function getProofSourceSummary(data: ReportExportData): ReportExportTrustItem | null {
  const evidence = getEvidenceCoverageItem(data);
  const evidenceDetail = evidence?.detail.trim();

  if (!evidence || !evidenceDetail || evidenceDetail === "-") {
    return null;
  }

  return {
    label: "Proof source summary",
    value: evidenceDetail,
    detail: `${evidence.label}: ${evidence.value}`,
  };
}

function parseRatio(value: string): { numerator: number; denominator: number } | null {
  const match = value.trim().match(/^(\d+)\s*\/\s*(\d+)/);
  if (!match) return null;

  const numerator = Number(match[1]);
  const denominator = Number(match[2]);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return null;

  return { numerator, denominator };
}

function getReportStatusItem(data: ReportExportData): ReportExportTrustItem | undefined {
  return data.trust.find((item) =>
    item.key === "report_status" ||
    item.label.toLowerCase().includes("status"),
  );
}

function getEvidenceCoverageItem(data: ReportExportData): ReportExportTrustItem | undefined {
  return data.trust.find((item) =>
    item.key === "evidence_backed_reads" ||
    item.label.toLowerCase().includes("evidence") ||
    item.label.toLowerCase().includes("proof"),
  );
}

function getVerifiedReadsItem(data: ReportExportData): ReportExportTrustItem | undefined {
  return data.trust.find((item) =>
    item.key === "verified_reads" ||
    item.label.toLowerCase().includes("verified"),
  );
}

function isReportStatusHold(value: string): boolean {
  const status = value.toLowerCase();
  if (/\bready\b/.test(status)) return false;

  return /\b(awaiting|correction|incomplete|missed|missing|pending|rejected|revision|submitted|unreviewed)\b/.test(status);
}

function getReportEvidenceStatusSummary(data: ReportExportData): {
  label: string;
  value: string;
} {
  const reportStatus = getReportStatusItem(data);
  const evidence = getEvidenceCoverageItem(data);

  if (reportStatus && isReportStatusHold(reportStatus.value)) {
    return {
      label: reportStatus.label,
      value: reportStatus.value,
    };
  }

  if (evidence) {
    return {
      label: evidence.label,
      value: evidence.value,
    };
  }

  if (reportStatus) {
    return {
      label: reportStatus.label,
      value: reportStatus.value,
    };
  }

  return {
    label: "Evidence review",
    value: "Not reviewed",
  };
}

export function getReportEvidenceStatusValue(data: ReportExportData): string {
  return getReportEvidenceStatusSummary(data).value;
}

function deriveReportTrustDecision(data: ReportExportData): string {
  const reportStatus = getReportStatusItem(data);
  const statusValueText = `${reportStatus?.label ?? ""} ${reportStatus?.value ?? ""}`.toLowerCase();
  const statusText = `${statusValueText} ${reportStatus?.detail ?? ""}`.toLowerCase();

  if (/\bcorrection|revision|rejected\b/.test(statusText)) {
    return "Resolve correction requests before leadership sharing.";
  }

  if (getReportStatusMissingProofCount(data) > 0) {
    return "Keep in proof room until all required proof is present.";
  }

  if (/\bmissing|incomplete|pending|submitted|unreviewed|awaiting\b/.test(statusValueText)) {
    return "Keep in proof room until evidence is reviewed.";
  }

  const evidence = getEvidenceCoverageItem(data);
  const verified = data.trust.find((item) =>
    item.key === "verified_reads" ||
    item.label.toLowerCase().includes("verified"),
  );
  const evidenceRatio = evidence ? parseRatio(evidence.value) : null;
  const verifiedRatio = verified ? parseRatio(verified.value) : null;

  if (!evidenceRatio && !verifiedRatio) {
    return noSubmittedProofTrustDecision;
  }

  if (
    evidenceRatio?.denominator === 0 ||
    verifiedRatio?.denominator === 0
  ) {
    return noSubmittedProofTrustDecision;
  }

  if (
    evidenceRatio &&
    evidenceRatio.denominator > 0 &&
    evidenceRatio.numerator < evidenceRatio.denominator
  ) {
    return "Keep in proof room until all required proof is present.";
  }

  if (!verifiedRatio && evidenceRatio && evidenceRatio.denominator > 0) {
    return "Keep in proof room until evidence is reviewed.";
  }

  if (
    verifiedRatio &&
    verifiedRatio.denominator > 0 &&
    verifiedRatio.numerator < verifiedRatio.denominator
  ) {
    return "Keep in proof room until evidence is reviewed.";
  }

  return "Ready for leadership sharing.";
}

export function getReportTrustDecision(data: ReportExportData): string {
  return data.leadershipHandoff?.decision ?? deriveReportTrustDecision(data);
}

function getReportStatusCorrectionCount(data: ReportExportData): number {
  const reportStatus = getReportStatusItem(data);
  const statusText = `${reportStatus?.label ?? ""} ${reportStatus?.value ?? ""} ${reportStatus?.detail ?? ""}`.toLowerCase();

  if (!/\bcorrection|revision|rejected\b/.test(statusText)) return 0;

  const explicitCount = Number.parseInt(
    statusText.match(/\b(\d+)\b/)?.[1] ?? "",
    10,
  );

  return Number.isFinite(explicitCount) && explicitCount > 0
    ? explicitCount
    : 1;
}

function getReportStatusMissingProofCount(data: ReportExportData): number {
  const reportStatus = getReportStatusItem(data);
  const statusText = `${reportStatus?.label ?? ""} ${reportStatus?.value ?? ""} ${reportStatus?.detail ?? ""}`.toLowerCase();

  if (!/\bmissing proof\b/.test(statusText)) return 0;

  const explicitCount = Number.parseInt(
    statusText.match(/\b(\d+)\b/)?.[1] ?? "",
    10,
  );

  return Number.isFinite(explicitCount) ? explicitCount : 1;
}

function getReportLeadershipImpactSummary(data: ReportExportData): Array<{
  key: ReportLeadershipProofBasisKey;
  label: string;
  value: number;
}> {
  const evidenceRatio = parseRatio(getEvidenceCoverageItem(data)?.value ?? "");
  const verifiedRatio = parseRatio(getVerifiedReadsItem(data)?.value ?? "");
  const total = evidenceRatio?.denominator ?? verifiedRatio?.denominator ?? 0;
  const evidenced = evidenceRatio?.numerator ?? verifiedRatio?.numerator ?? 0;
  const included = verifiedRatio
    ? Math.min(verifiedRatio.numerator, Math.max(evidenced, verifiedRatio.numerator))
    : getReportTrustDecision(data) === "Ready for leadership sharing."
      ? evidenced
      : 0;
  const missingProof = total > 0
    ? Math.max(0, total - evidenced)
    : getReportStatusMissingProofCount(data);
  const unresolvedEvidence = Math.max(0, evidenced - included);
  const corrections = Math.min(
    getReportStatusCorrectionCount(data),
    unresolvedEvidence,
  );
  const needsReview = Math.max(0, unresolvedEvidence - corrections);

  return [
    { key: "included", label: "Included", value: included },
    { key: "needs-review", label: "Needs review", value: needsReview },
    { key: "corrections", label: "Corrections", value: corrections },
    { key: "missing-proof", label: "Missing proof", value: missingProof },
  ];
}

export function buildReportLeadershipHandoff(
  data: ReportExportData,
): ReportLeadershipHandoff {
  if (data.leadershipHandoff) return data.leadershipHandoff;

  const decision = deriveReportTrustDecision(data);
  const state: ReportLeadershipHandoffState =
    decision === "Ready for leadership sharing." ? "ready" : "hold";

  return {
    state,
    label: state === "ready" ? "Share with leadership" : "Keep in proof room",
    decision,
    proofBasis: getReportLeadershipImpactSummary(data),
  };
}

export function buildReportProofOperations(
  data: ReportExportData,
): ReportProofOperations {
  if (data.proofOperations) return data.proofOperations;

  const handoff = buildReportLeadershipHandoff(data);
  const included = handoff.proofBasis.find((item) => item.key === "included")?.value ?? 0;
  const total = handoff.proofBasis.reduce((sum, item) => sum + item.value, 0);
  const attentionCount = handoff.proofBasis
    .filter((item) => item.key !== "included")
    .reduce((sum, item) => sum + item.value, 0);
  const scope: ReportProofOperationsScope = total >= 50 ? "scale" : "single";

  return {
    scope,
    state: handoff.state,
    label: scope === "scale" ? "Scale proof room" : "Proof room",
    decision: handoff.decision,
    verifiedCoverage: `${included}/${total}`,
    attentionCount,
    proofBasis: handoff.proofBasis,
  };
}

function buildHtmlLeadershipImpactSummary(data: ReportExportData): string {
  const summaryItems = getReportLeadershipImpactSummary(data);

  return `<div class="leadership-impact" aria-label="Leadership impact">
    <div class="leadership-impact-head">
      <p>Leadership impact</p>
      <span>What is included in leadership totals, what is waiting, and what needs creator action.</span>
    </div>
    <div class="leadership-impact-grid">
      ${summaryItems
        .map(
          (item) => `<article data-impact-key="${escapeHtml(item.key)}">
            <strong>${item.value}</strong>
            <span>${escapeHtml(item.label)}</span>
          </article>`,
        )
        .join("")}
    </div>
  </div>`;
}

function buildHtmlProofOperations(data: ReportExportData): string {
  const operations = buildReportProofOperations(data);
  const attentionLabel =
    operations.attentionCount === 1
      ? "1 open proof action"
      : `${operations.attentionCount} open proof actions`;

  return `<div class="proof-operations" data-proof-operations-scope="${escapeHtml(operations.scope)}" data-proof-operations-state="${escapeHtml(operations.state)}" aria-label="Proof operations">
    <div class="proof-operations-head">
      <p>Proof operations</p>
      <strong>${escapeHtml(operations.label)}</strong>
      <span>${escapeHtml(operations.decision)}</span>
    </div>
    <div class="proof-operations-grid">
      <article>
        <p>Verified coverage</p>
        <strong>${escapeHtml(operations.verifiedCoverage)} verified</strong>
      </article>
      <article>
        <p>Attention queue</p>
        <strong>${escapeHtml(attentionLabel)}</strong>
      </article>
    </div>
    <div class="proof-operations-basis">
      <p>Proof basis</p>
      <div>
        ${operations.proofBasis
          .map(
            (item) => `<span data-proof-basis-key="${escapeHtml(item.key)}">
              <strong>${item.value}</strong>
              ${escapeHtml(item.label)}
            </span>`,
          )
          .join("")}
      </div>
    </div>
  </div>`;
}

function buildHtmlLeadershipHandoffGate(data: ReportExportData): string {
  const handoff = buildReportLeadershipHandoff(data);

  return `<div class="leadership-handoff" data-leadership-handoff-state="${escapeHtml(handoff.state)}" aria-label="Leadership handoff">
    <div class="leadership-handoff-decision">
      <p>Leadership handoff</p>
      <strong>${escapeHtml(handoff.label)}</strong>
      <span>${escapeHtml(handoff.decision)}</span>
    </div>
    <div class="leadership-handoff-basis">
      <p>Proof basis</p>
      <div>
        ${handoff.proofBasis
          .map(
            (item) => `<span data-proof-basis-key="${escapeHtml(item.key)}">
              <strong>${item.value}</strong>
              ${escapeHtml(item.label)}
            </span>`,
          )
          .join("")}
      </div>
    </div>
  </div>`;
}

function getHtmlStoryAction(data: ReportExportData): string {
  const chartModeId = data.composition?.chartModeId;

  if (chartModeId === "proof") {
    const trustDecision = getReportTrustDecision(data);
    return trustDecision === "Ready for leadership sharing."
      ? "Share the verified proof room with leadership."
      : trustDecision;
  }

  if (chartModeId === "comparison") {
    return "Rebook, correct, or pause creators based on reviewed proof.";
  }

  return "Compare first and latest reads before deciding.";
}

function getReportDecisionRead(data: ReportExportData): string {
  return data.composition?.executiveQuestion?.trim() ||
    data.composition?.presentation?.executiveQuestion?.trim() ||
    data.composition?.chartLayoutTitle?.trim() ||
    "Confirm whether the campaign is ready to share.";
}

export function buildReportExportStory(data: ReportExportData): ReportExportStory {
  return {
    decisionRead: getReportDecisionRead(data),
    evidenceTrail: getReportEvidenceTrail(data),
    trustDecision: getReportTrustDecision(data),
    nextAction: getHtmlStoryAction(data),
    ...(data.proofReview ? { proofReview: data.proofReview } : {}),
  };
}

function buildHtmlProofStoryRail(data: ReportExportData): string {
  const story = buildReportExportStory(data);
  const proofReview = story.proofReview
    ? `<article>
      <p>${escapeHtml(story.proofReview.label)}</p>
      <strong>${escapeHtml(story.proofReview.value)}</strong>
      <span>${escapeHtml(story.proofReview.detail)}</span>
    </article>`
    : "";

  return `<div class="proof-story-rail" aria-label="Decision, evidence, and next action">
    ${buildHtmlLeadershipHandoffGate(data)}
    <article>
      <p>Decision read</p>
      <strong>${escapeHtml(story.decisionRead)}</strong>
    </article>
    <article>
      <p>Evidence trail</p>
      <strong>${escapeHtml(story.evidenceTrail)}</strong>
    </article>
    <article>
      <p>Next action</p>
      <strong>${escapeHtml(story.nextAction)}</strong>
    </article>
    <article>
      <p>Trust decision</p>
      <strong>${escapeHtml(story.trustDecision)}</strong>
    </article>
    ${proofReview}
  </div>`;
}

function buildHtmlTrendChangeLabel(metric: ReportExportMetric): string {
  const first = metric.points[0];
  const last = metric.points[metric.points.length - 1];
  if (!first || !last) return "No movement";

  const delta = last.value - first.value;
  if (first.value === 0) {
    if (delta > 0) return "New activity";
    return "No change";
  }

  const change = Math.round((delta / Math.abs(first.value)) * 100);
  if (change === 0) return "0%";

  return `${change > 0 ? "+" : ""}${change}%`;
}

function buildHtmlTrendMovement(metric: ReportExportMetric): string {
  const first = metric.points[0];
  const last = metric.points[metric.points.length - 1];
  if (!first || !last) return "";

  return `<div class="trend-movement" data-chart-recipe="trend-movement">
    <article>
      <span>Start read</span>
      <strong>${escapeHtml(first.label)}</strong>
      <small>${escapeHtml(formatHtmlPointLongDate(first.date))}</small>
    </article>
    <article>
      <span>Latest read</span>
      <strong>${escapeHtml(last.label)}</strong>
      <small>${escapeHtml(formatHtmlPointLongDate(last.date))}</small>
    </article>
    <article>
      <span>Change</span>
      <strong>${escapeHtml(buildHtmlTrendChangeLabel(metric))}</strong>
      <small>Movement</small>
    </article>
  </div>`;
}

function parseHtmlNumber(value: string): number {
  const normalized = value.trim().toUpperCase();
  const multiplier = normalized.includes("B")
    ? 1_000_000_000
    : normalized.includes("M")
      ? 1_000_000
      : normalized.includes("K")
        ? 1_000
        : 1;
  const parsed = Number.parseFloat(normalized.replace(/[^0-9.-]/g, ""));

  return Number.isFinite(parsed) ? parsed * multiplier : 0;
}

function isReportChartMetricKey(
  value: unknown,
): value is NonNullable<ReportExportPresentation["chartMetricKey"]> {
  return (
    value === "views" ||
    value === "engagements" ||
    value === "engagementRate" ||
    value === "cpe"
  );
}

function getHtmlComparisonMetricLabel(
  data: ReportExportData,
  metricKey: NonNullable<ReportExportPresentation["chartMetricKey"]>,
): string {
  return data.kpis.find((item) => item.key === metricKey)?.label ??
    (metricKey === "engagementRate"
      ? "Engagement Rate"
      : metricKey === "engagements"
        ? "Engagements"
        : metricKey === "cpe"
          ? "Cost per Engagement"
          : "Views");
}

function getHtmlCreatorMetricValue(
  creator: ReportExportCreator,
  metricKey: NonNullable<ReportExportPresentation["chartMetricKey"]>,
): string {
  if (metricKey === "engagements") return creator.engagements;
  if (metricKey === "engagementRate") return creator.er;
  if (metricKey === "cpe") return creator.cpe;

  return creator.views;
}

function getHtmlCreatorMetricSortValue(
  creator: ReportExportCreator,
  metricKey: NonNullable<ReportExportPresentation["chartMetricKey"]>,
): number {
  return parseHtmlNumber(getHtmlCreatorMetricValue(creator, metricKey));
}

function getHtmlCreatorMetricBarValue(
  creator: ReportExportCreator,
  metricKey: NonNullable<ReportExportPresentation["chartMetricKey"]>,
): number {
  const value = getHtmlCreatorMetricSortValue(creator, metricKey);

  if (metricKey === "cpe") {
    return value > 0 ? 1 / value : 0;
  }

  return value;
}

function getHtmlComparisonSortDetail(
  metricLabel: string,
  metricKey: NonNullable<ReportExportPresentation["chartMetricKey"]>,
): string {
  if (metricKey === "cpe") {
    return `Sorted by ${metricLabel}. Lower CPE ranks first.`;
  }

  return `Sorted by ${metricLabel}. Platform definitions stay separate.`;
}

function buildHtmlComparisonStory(data: ReportExportData): string {
  const chartMetricKey = isReportChartMetricKey(
    data.composition?.presentation?.chartMetricKey,
  )
    ? data.composition.presentation.chartMetricKey
    : "views";
  const metricLabel = getHtmlComparisonMetricLabel(data, chartMetricKey);
  const viewsLabel = getHtmlComparisonMetricLabel(data, "views");
  const engagementsLabel = getHtmlComparisonMetricLabel(data, "engagements");
  const cpeLabel = getHtmlComparisonMetricLabel(data, "cpe");
  const rankedCreators = [...data.creators]
    .sort((first, second) => {
      const firstValue = getHtmlCreatorMetricSortValue(first, chartMetricKey);
      const secondValue = getHtmlCreatorMetricSortValue(second, chartMetricKey);

      return chartMetricKey === "cpe"
        ? firstValue - secondValue || parseHtmlNumber(second.views) - parseHtmlNumber(first.views)
        : secondValue - firstValue || parseHtmlNumber(second.views) - parseHtmlNumber(first.views);
    })
    .slice(0, 5);
  const maxMetricValue = Math.max(
    ...rankedCreators.map((creator) =>
      getHtmlCreatorMetricBarValue(creator, chartMetricKey),
    ),
    1,
  );

  if (rankedCreators.length === 0) {
    return `<div class="story-empty">No creator comparison rows yet.</div>`;
  }

  return `<div class="comparison-story" data-comparison-focus="${escapeHtml(chartMetricKey)}">
    <div class="story-subhead">
      <p>Creator comparison by ${escapeHtml(metricLabel)}</p>
      <span>${escapeHtml(getHtmlComparisonSortDetail(metricLabel, chartMetricKey))}</span>
    </div>
    <div class="comparison-list">
      ${rankedCreators
        .map((creator, index) => {
          const barValue = getHtmlCreatorMetricBarValue(creator, chartMetricKey);
          const width = Math.max(
            6,
            Math.round((barValue / maxMetricValue) * 100),
          );

          return `<article class="comparison-row">
            <div class="comparison-rank">${index + 1}</div>
            <div class="comparison-body">
              <div class="comparison-line">
                <strong>${escapeHtml(creator.name)}</strong>
                <span>${escapeHtml(creator.platform)} / ${escapeHtml(creator.market)}</span>
              </div>
              <div class="comparison-bar" aria-hidden="true">
                <span style="width: ${width}%"></span>
              </div>
              <div class="comparison-line comparison-line--meta">
                <span>${escapeHtml(metricLabel)} ${escapeHtml(getHtmlCreatorMetricValue(creator, chartMetricKey))}</span>
                <span>${escapeHtml(viewsLabel)} ${escapeHtml(creator.views)}</span>
                <span>${escapeHtml(engagementsLabel)} ${escapeHtml(creator.engagements)}</span>
                <span>${escapeHtml(cpeLabel)} ${escapeHtml(creator.cpe)}</span>
              </div>
            </div>
          </article>`;
        })
        .join("")}
    </div>
  </div>`;
}

function buildHtmlProofStory(data: ReportExportData): string {
  const proofSections = data.sections.filter(
    (section) => section.sourceGroup === "proof_source",
  );
  const proofSourceSummary = getProofSourceSummary(data);

  return `<div class="proof-story">
    <div class="story-subhead">
      <p>Proof source readiness</p>
      <span>Evidence source, creator confirmation, and brand review stay visible beside the numbers.</span>
    </div>
    ${buildHtmlLeadershipImpactSummary(data)}
    <div class="proof-grid">
      ${data.trust
        .map(
          (item) => `<article class="proof-card">
            <p>${escapeHtml(item.label)}</p>
            <strong>${escapeHtml(item.value)}</strong>
            <span>${escapeHtml(item.detail)}</span>
          </article>`,
        )
        .join("")}
      ${
        proofSections.length
          ? proofSections
              .map(
                (section) => `<article class="proof-card">
                  <p>${escapeHtml(section.title)}</p>
                  <strong>${escapeHtml(section.metrics[0]?.value ?? "Ready")}</strong>
                  <span>${escapeHtml(section.detail)}</span>
                </article>`,
              )
              .join("")
          : proofSourceSummary
            ? `<article class="proof-card">
                <p>${escapeHtml(proofSourceSummary.label)}</p>
                <strong>${escapeHtml(proofSourceSummary.value)}</strong>
                <span>${escapeHtml(proofSourceSummary.detail)}</span>
              </article>`
            : `<article class="proof-card">
                <p>Proof sources</p>
                <strong>Not included</strong>
                <span>No separate proof-source lanes were selected for this export.</span>
              </article>`
      }
    </div>
  </div>`;
}

function buildHtmlTrendStory(metric: ReportExportMetric | null): string {
  if (!metric) {
    return `<div class="story-empty">No timeline reads yet.</div>`;
  }

  const hasTrend = metric.points.length >= 2;

  return `<div class="trend-story">
    <div class="story-subhead">
      <p>Lead metric</p>
      <span>${escapeHtml(
        hasTrend
          ? `${metric.label} / ${metric.detail}`
          : "Single read. Snapshot recipe selected automatically.",
      )}</span>
    </div>
    ${hasTrend
        ? `<div class="trend-card">
          <div>
            <p>${escapeHtml(metric.label)}</p>
            <strong>${escapeHtml(metric.value)}</strong>
            <span>${escapeHtml(buildHtmlMetricJourney(metric))}</span>
          </div>
          ${buildHtmlTrendMovement(metric)}
          ${buildHtmlLineChart(metric)}
        </div>`
      : buildHtmlSnapshotCard(metric)}
  </div>`;
}

function buildHtmlPrimaryReportStory(data: ReportExportData): string {
  if (!data.composition) return "";

  const chartModeId = data.composition.chartModeId || "trend";
  const sectionTitle = getReportBlockTitle(
    data,
    chartModeId === "proof" ? "proof_sources" : "channel_story",
    "Primary report story",
  );
  const primaryMetric = getPrimaryHtmlMetric(data);
  const storySummary = chartModeId === "proof"
    ? getReportEvidenceTrail(data)
    : buildHtmlMetricJourney(primaryMetric);
  const modeBody = chartModeId === "proof"
    ? buildHtmlProofStory(data)
    : chartModeId === "comparison"
      ? buildHtmlComparisonStory(data)
      : buildHtmlTrendStory(primaryMetric);

  return `<section class="report-story report-story--${escapeHtml(chartModeId)}" data-report-chart-mode="${escapeHtml(chartModeId)}">
    <div class="story-head">
      <div>
        <p>Primary report story</p>
        <small>${escapeHtml(sectionTitle)}</small>
        <h2>${escapeHtml(data.composition.chartLayoutTitle)}</h2>
        <span>${escapeHtml(data.composition.chartLayoutDetail)}</span>
      </div>
      <aside>
        <p>${escapeHtml(data.composition.chartModeTitle)}</p>
        <strong>${escapeHtml(storySummary)}</strong>
        <span>${escapeHtml(data.composition.chartModeDetail)}</span>
      </aside>
    </div>
    ${modeBody}
    ${buildHtmlProofStoryRail(data)}
  </section>`;
}

function buildHtmlRecommendationCards(data: ReportExportData): string {
  if (!data.recommendations?.length) return "";
  const title = getReportBlockTitle(data, "recommendations", "Recommendations");
  const [primaryRecommendation, ...supportingRecommendations] = data.recommendations;
  const actionCount =
    data.recommendations.length === 1
      ? "1 action"
      : `${data.recommendations.length} actions`;
  const supportingEvidence = supportingRecommendations.length
    ? `<div class="decision-list">
      <small>Supporting evidence</small>
      ${supportingRecommendations
        .map(
          (item, index) => `<article class="decision-row">
            <span class="decision-index">${String(index + 2).padStart(2, "0")}</span>
            <div>
              <p>${escapeHtml(item.title)}</p>
              <strong>${escapeHtml(item.value)}</strong>
              <small>${escapeHtml(item.detail)}</small>
            </div>
          </article>`,
        )
        .join("")}
    </div>`
    : "";

  return `<section class="recommendations recommendation-memo">
    <div class="recommendation-head">
      <div>
        <p>Decision memo</p>
        <h2>${escapeHtml(title)}</h2>
      </div>
      <span>${escapeHtml(actionCount)}</span>
    </div>
    <div class="recommendation-primary">
      <p>Recommended move</p>
      <div>
        <span>${escapeHtml(primaryRecommendation.title)}</span>
        <strong>${escapeHtml(primaryRecommendation.value)}</strong>
        <small>${escapeHtml(primaryRecommendation.detail)}</small>
      </div>
    </div>
    ${supportingEvidence}
  </section>`;
}

function buildHtmlLineChart(metric: ReportExportMetric): string {
  const points = metric.points;
  if (points.length === 0) {
    return `<div class="chart-empty">No chart data yet.</div>`;
  }

  const width = 760;
  const height = 300;
  const left = 58;
  const right = 34;
  const top = 28;
  const bottom = 58;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const maxValue = Math.max(...points.map((point) => point.value), 1);
  const midValue = maxValue / 2;

  const positions = points.map((point, index) => {
    const x = points.length === 1
      ? left + chartWidth / 2
      : left + (index / (points.length - 1)) * chartWidth;
    const y = top + chartHeight - (point.value / maxValue) * chartHeight;

    return { point, x, y };
  });
  const linePath = positions
    .map((position, index) => `${index === 0 ? "M" : "L"} ${position.x.toFixed(1)} ${position.y.toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L ${positions[positions.length - 1].x.toFixed(1)} ${top + chartHeight} L ${positions[0].x.toFixed(1)} ${top + chartHeight} Z`;
  const circles = positions
    .map(
      ({ point, x, y }) => `<g>
        <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.5" />
        <title>${escapeHtml(`${metric.label}: ${point.label} on ${formatHtmlPointDate(point.date)}`)}</title>
      </g>`,
    )
    .join("");
  const xLabels = positions
    .map(
      ({ point, x }) => `<text x="${x.toFixed(1)}" y="${height - 22}" text-anchor="middle">${escapeHtml(
        formatHtmlPointDate(point.date),
      )}</text>`,
    )
    .join("");

  return `<svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(metric.label)} chart">
    <defs>
      <linearGradient id="chart-fill-${escapeHtml(metric.key ?? metric.label).replace(/[^a-z0-9]+/gi, "-")}" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="#0f172a" stop-opacity="0.12" />
        <stop offset="100%" stop-color="#0f172a" stop-opacity="0" />
      </linearGradient>
    </defs>
    <line class="grid-line" x1="${left}" y1="${top}" x2="${width - right}" y2="${top}" />
    <line class="grid-line" x1="${left}" y1="${top + chartHeight / 2}" x2="${width - right}" y2="${top + chartHeight / 2}" />
    <line class="axis-line" x1="${left}" y1="${top + chartHeight}" x2="${width - right}" y2="${top + chartHeight}" />
    <text class="axis-label" x="${left - 14}" y="${top + 4}" text-anchor="end">${escapeHtml(formatHtmlAxisValue(metric, maxValue))}</text>
    <text class="axis-label" x="${left - 14}" y="${top + chartHeight / 2 + 4}" text-anchor="end">${escapeHtml(formatHtmlAxisValue(metric, midValue))}</text>
    <text class="axis-label" x="${left - 14}" y="${top + chartHeight + 4}" text-anchor="end">0</text>
    <path class="chart-area" d="${areaPath}" fill="url(#chart-fill-${escapeHtml(metric.key ?? metric.label).replace(/[^a-z0-9]+/gi, "-")})" />
    <path class="chart-line" d="${linePath}" />
    <g class="chart-points">${circles}</g>
    <g class="chart-dates">${xLabels}</g>
  </svg>`;
}

function buildHtmlMetricVisual(metric: ReportExportMetric): string {
  if (metric.points.length < 2) return buildHtmlSnapshotCard(metric, "compact");

  return buildHtmlLineChart(metric);
}

function shouldRenderSectionAsMetricLedger(section: ReportExportSection): boolean {
  return (
    section.metrics.length > 1 &&
    section.metrics.every((metric) => metric.points.length < 2)
  );
}

function buildHtmlMetricLedger(section: ReportExportSection): string {
  return `<div class="metric-ledger" data-chart-recipe="single-read-ledger">
      ${section.metrics
        .map((metric) => {
          const point = metric.points[0];
          const readDate = point
            ? formatHtmlPointLongDate(point.date)
            : "No read date";

          return `<article class="metric-ledger-row">
            <div>
              <p>${escapeHtml(metric.label)}</p>
              <strong>${escapeHtml(point?.label ?? metric.value)}</strong>
            </div>
            <span>${escapeHtml(metric.detail)}</span>
            <small>Snapshot read</small>
            <span class="ledger-date">${escapeHtml(readDate)}</span>
          </article>`;
        })
        .join("")}
    </div>`;
}

function buildHtmlSnapshotCard(
  metric: ReportExportMetric,
  variant: "primary" | "compact" = "primary",
): string {
  const point = metric.points[0];
  const readDate = point ? formatHtmlPointLongDate(point.date) : "No read date";

  if (variant === "compact") {
    return `<div class="metric-readout" data-chart-recipe="snapshot">
      <div>
        <span>Snapshot read</span>
        <strong>${escapeHtml(point?.label ?? metric.value)}</strong>
        <p>${escapeHtml(metric.label)} / ${escapeHtml(metric.detail)}</p>
      </div>
      <div>
        <span>Read date</span>
        <small>${escapeHtml(readDate)}</small>
      </div>
    </div>`;
  }

  return `<div class="snapshot-card" data-chart-recipe="snapshot">
    <div>
      <p>Snapshot read</p>
      <strong>${escapeHtml(point?.label ?? metric.value)}</strong>
      <span>${escapeHtml(metric.label)} / ${escapeHtml(metric.detail)}</span>
    </div>
    <dl>
      <div>
        <dt>Read date</dt>
        <dd>${escapeHtml(readDate)}</dd>
      </div>
      <div>
        <dt>Decision use</dt>
        <dd>One verified read; use a snapshot until there is enough history for a trend.</dd>
      </div>
    </dl>
  </div>`;
}

function buildHtmlSection(section: ReportExportSection): string {
  const sourceGroupLabel = sectionSourceGroupLabel(section);
  const body = shouldRenderSectionAsMetricLedger(section)
    ? buildHtmlMetricLedger(section)
    : `<div class="chart-grid">
      ${section.metrics
        .map(
          (metric) => `<article class="chart-card">
            <div class="chart-card-head">
              <div>
                <p>${escapeHtml(metric.label)}</p>
                <strong>${escapeHtml(metric.value)}</strong>
              </div>
              <span>${escapeHtml(metric.detail)}</span>
            </div>
            ${buildHtmlMetricVisual(metric)}
          </article>`,
        )
        .join("")}
    </div>`;

  return `<section class="report-section">
    <div class="section-head">
      <div>
        <p>${escapeHtml(section.title)}</p>
        <h2>${escapeHtml(section.detail || section.title)}</h2>
      </div>
      <span class="section-badge">${escapeHtml(sourceGroupLabel)}</span>
    </div>
    ${body}
  </section>`;
}

function buildHtmlCreatorRows(data: ReportExportData): string {
  if (data.creators.length === 0) {
    return `<tr><td colspan="9">No creator rows yet.</td></tr>`;
  }

  return data.creators
    .map(
      (creator) => `<tr>
        <td><strong>${escapeHtml(creator.name)}</strong></td>
        <td>${escapeHtml(creator.market)}</td>
        <td>${escapeHtml(creator.platform)}</td>
        <td>${escapeHtml(creator.views)}</td>
        <td>${escapeHtml(creator.engagements)}</td>
        <td>${escapeHtml(creator.er)}</td>
        <td>${escapeHtml(creator.cpe)}</td>
        <td>${escapeHtml(creator.spent)}</td>
        <td>${escapeHtml(creator.rating)}</td>
      </tr>`,
    )
    .join("");
}

function buildHtmlCreatorTable(data: ReportExportData): string {
  if (!isReportBlockIncluded(data, "creator_table")) return "";
  const title = getReportBlockTitle(data, "creator_table", "Creator Performance");

  return `<section class="creator-table">
        <div class="creator-table-head">
          <div>
            <p>Creator-level evidence</p>
            <h2>${escapeHtml(title)}</h2>
          </div>
          <span>Exact rows for operator follow-up</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>Creator</th>
              <th>Market</th>
              <th>Platform</th>
              <th>Views</th>
              <th>Engagements</th>
              <th>ER</th>
              <th>CPE</th>
              <th>Spent</th>
              <th>Rating</th>
            </tr>
          </thead>
          <tbody>${buildHtmlCreatorRows(data)}</tbody>
        </table>
      </section>`;
}

function buildHtmlMetricGrid(data: ReportExportData): string {
  if (!data.kpis.length) return "";
  const title = getReportBlockTitle(data, "executive_summary", "Executive summary");
  const bodyKpis = getReportBodyKpis(data);

  if (bodyKpis.length === 0) return "";
  if (bodyKpis.length === 1) return buildHtmlMetricCallout(bodyKpis[0], title);

  return `<section class="metric-strip metric-strip--editorial" aria-label="${escapeHtml(title)}" data-section-label="${escapeHtml(title)}">${bodyKpis.map(buildHtmlMetricTile).join("")}</section>`;
}

function buildHtmlTrustGrid(data: ReportExportData): string {
  if (!data.trust.length) return "";
  const title = getReportBlockTitle(data, "report_trust", "Report trust");

  return `${buildHtmlProofOperations(data)}<section class="trust-grid" aria-label="${escapeHtml(title)}" data-section-label="${escapeHtml(title)}">
        ${data.trust
          .map(
            (item) => {
              const value = formatHtmlDateText(item.value);
              const dateClass = /\d{4}\/\d{2}\/\d{2}/.test(value) ? " trust-card--date" : "";

              return `<article class="trust-card${dateClass}">
              <p>${escapeHtml(item.label)}</p>
              <strong>${escapeHtml(value)}</strong>
              <span>${escapeHtml(item.detail)}</span>
            </article>`;
            },
          )
          .join("")}
      </section>`;
}

function buildHtmlSections(
  data: ReportExportData,
  sourceGroup: ReportExportSection["sourceGroup"],
): string {
  return data.sections
    .filter((section) => section.sourceGroup === sourceGroup)
    .map(buildHtmlSection)
    .join("");
}

function getHtmlReportBodyBlockIds(data: ReportExportData): string[] {
  if (data.blocks?.length) {
    return data.blocks.map((block) => block.id);
  }

  return [
    "executive_summary",
    "channel_story",
    "proof_sources",
    "report_trust",
    "recommendations",
    "creator_table",
  ];
}

function buildHtmlReportBody(data: ReportExportData): string {
  const seen = new Set<string>();
  const chartModeId = data.composition?.chartModeId ?? "trend";

  return getHtmlReportBodyBlockIds(data)
    .map((blockId) => {
      if (seen.has(blockId)) return "";
      seen.add(blockId);

      switch (blockId) {
        case "report_framing":
          return `${buildHtmlReportComposition(data)}${buildHtmlReportBlocks(data)}`;
        case "executive_summary":
          return buildHtmlMetricGrid(data);
        case "channel_story":
          return `${
            chartModeId === "proof" ? "" : buildHtmlPrimaryReportStory(data)
          }${buildHtmlSections(data, "campaign_channel")}`;
        case "proof_sources":
          return `${
            chartModeId === "proof" ? buildHtmlPrimaryReportStory(data) : ""
          }${buildHtmlSections(data, "proof_source")}`;
        case "report_trust":
          return buildHtmlTrustGrid(data);
        case "recommendations":
          return buildHtmlRecommendationCards(data);
        case "creator_table":
          return buildHtmlCreatorTable(data);
        default:
          return "";
      }
    })
    .join("");
}

export function buildHtmlDocument(data: ReportExportData): string {
  data = normalizeReportExportData(data);

  const presentation = getReportPresentation(data);
  const reportTitle = getReportDisplayTitle(data);
  const heroMetrics = buildReportHeroMetrics(data);
  const reportContext = data.composition
    ? `${data.composition.presetTitle} / ${data.composition.chartModeTitle}`
    : "";
  const bodyClass = [
    "report-document",
    `report-document--${presentation.typography}`,
    presentation.density === "compact"
      ? "report-document--dense"
      : "report-document--editorial",
  ].join(" ");
  const heroClass = [
    "report-hero",
    "report-hero--visual-led",
    presentation.coverMode === "proof_room" ? "report-hero--proof-room" : "",
  ].filter(Boolean).join(" ");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(reportTitle)}</title>
    <style>
      :root {
        color-scheme: light;
        --ink: #0f172a;
        --muted: #64748b;
        --line: #e2e8f0;
        --soft: #f8fafc;
        --card: #ffffff;
        --teal: #0d9488;
        --title: #172033;
        --value: #475569;
        --mono-font: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        --shadow: 0 18px 48px rgba(15, 23, 42, 0.07);
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: var(--soft);
        color: var(--ink);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      body.report-document--compact h1 { font-size: 22px; max-width: 600px; }
      body.report-document--compact .metric-tile strong,
      body.report-document--compact .metric-callout small,
      body.report-document--compact .proof-card strong,
      body.report-document--compact .chart-card-head strong,
      body.report-document--compact .trend-movement strong,
      body.report-document--compact .metric-ledger strong,
      body.report-document--compact .composition-row strong {
        font-size: 15px;
        font-weight: 560;
      }
      body.report-document--compact .trust-card strong,
      body.report-document--compact .block-row strong {
        font-size: 13px;
        font-weight: 560;
      }
      body.report-document--dense main { padding-block: 28px 48px; }
      body.report-document--dense .metric-strip,
      body.report-document--dense .trust-grid {
        grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      }
      body.report-document--dense .metric-tile,
      body.report-document--dense .metric-callout,
      body.report-document--dense .trust-card {
        min-height: 104px;
        padding: 14px;
      }
      body.report-document--dense .block-row {
        min-height: auto;
        padding: 12px 14px;
      }
      .topbar {
        background: var(--ink);
        color: #fff;
        padding: 24px 40px;
      }
      .topbar-inner {
        align-items: start;
        display: flex;
        justify-content: space-between;
        gap: 24px;
        margin: 0 auto;
        max-width: 1120px;
      }
      .brand { font-size: 20px; font-weight: 650; letter-spacing: 0; }
      .topbar-label { color: #cbd5e1; font-size: 13px; margin-top: 3px; }
      .generated { color: #e2e8f0; font-size: 13px; margin-top: 4px; text-align: end; }
      main { margin: 0 auto; max-width: 1120px; padding: 36px 32px 64px; }
      h1 {
        color: var(--title);
        font-size: 25px;
        font-weight: 610;
        line-height: 1.14;
        margin: 0;
        max-width: 680px;
      }
      .date-range {
        align-items: center;
        border: 1px solid var(--line);
        border-radius: 999px;
        color: var(--value);
        display: inline-flex;
        font-size: 11px;
        font-weight: 560;
        gap: 8px;
        letter-spacing: 0.01em;
        margin: 14px 0 0;
        padding: 6px 10px;
      }
      .date-range span {
        color: var(--muted);
        font-size: 10px;
        font-weight: 650;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .report-hero {
        background: var(--card);
        border: 1px solid var(--line);
        border-radius: 18px;
        box-shadow: var(--shadow);
        margin-bottom: 20px;
        overflow: hidden;
        padding: 0;
      }
      .report-hero--proof-room .campaign-visual {
        background:
          radial-gradient(circle at 24% 18%, rgba(13, 148, 136, 0.16), transparent 28%),
          radial-gradient(circle at 80% 78%, rgba(245, 158, 11, 0.12), transparent 30%),
          #0f172a;
      }
      .report-kicker {
        color: var(--muted);
        font-size: 11px;
        font-weight: 700;
        margin: 0 0 12px;
        text-transform: uppercase;
      }
      .report-context {
        color: var(--muted);
        font-size: 12px;
        font-weight: 580;
        line-height: 1.4;
        margin: 10px 0 0;
      }
      .decision-question {
        border-inline-start: 2px solid var(--ink);
        color: var(--value);
        font-size: 13px;
        font-weight: 520;
        line-height: 1.45;
        margin: 16px 0 0;
        max-width: 620px;
        padding-inline-start: 12px;
      }
      .decision-question span {
        color: var(--muted);
        display: block;
        font-size: 10px;
        font-weight: 700;
        line-height: 1;
        margin-bottom: 6px;
        text-transform: uppercase;
      }
      .report-hero-grid {
        align-items: stretch;
        display: grid;
        gap: 0;
        grid-template-columns: minmax(0, 1fr) 320px;
        min-height: 230px;
      }
      .report-title-stack {
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        min-height: 230px;
        padding: 26px 28px;
      }
      .campaign-visual {
        align-self: stretch;
        background: #0f172a;
        border: 0;
        border-inline-start: 1px solid var(--line);
        border-radius: 0;
        height: auto;
        margin: 0;
        min-height: 230px;
        overflow: hidden;
        position: relative;
      }
      .campaign-visual img {
        background: #020617;
        display: block;
        height: 100%;
        object-fit: contain;
        object-position: center;
        padding: 18px 18px 58px;
        width: 100%;
      }
      .campaign-visual figcaption {
        background: rgba(15, 23, 42, 0.74);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 12px;
        bottom: 16px;
        color: #fff;
        font-size: 12px;
        font-weight: 560;
        left: 16px;
        line-height: 1.35;
        max-width: calc(100% - 32px);
        padding: 10px 12px;
        position: absolute;
        right: 16px;
      }
      .campaign-visual--fallback {
        color: #fff;
        display: flex;
        flex-direction: column;
        justify-content: flex-end;
        padding: 18px;
      }
      .campaign-visual--fallback span,
      .campaign-visual--fallback small {
        color: #cbd5e1;
        display: block;
        font-size: 11px;
        font-weight: 650;
      }
      .campaign-visual--fallback strong {
        color: #fff;
        display: block;
        font-size: 17px;
        font-weight: 620;
        line-height: 1.2;
        margin: 7px 0;
      }
      .report-meta {
        display: grid;
        gap: 0;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        margin-top: 26px;
        max-width: 680px;
      }
      .report-evidence-strip {
        border-top: 1px solid var(--line);
        padding-top: 16px;
      }
      .report-meta div + div {
        border-inline-start: 1px solid var(--line);
        padding-inline-start: 14px;
      }
      .report-evidence-item + .report-evidence-item {
        margin-inline-start: 14px;
      }
      .report-meta span, .report-meta small {
        color: var(--muted);
        display: block;
        font-size: 11px;
        font-weight: 600;
      }
      .report-meta strong {
        color: var(--value);
        display: block;
        font-size: 14px;
        font-weight: 580;
        line-height: 1.25;
        margin-top: 5px;
      }
      .report-meta small { line-height: 1.4; margin-top: 5px; }
      .metric-strip, .trust-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      }
      .metric-strip--editorial {
        background: var(--card);
        border: 1px solid var(--line);
        border-radius: 16px;
        overflow: hidden;
      }
      .trust-grid {
        background: var(--card);
        border: 1px solid var(--line);
        border-radius: 16px;
        overflow: hidden;
      }
      .chart-card, .metric-ledger, .creator-table {
        background: var(--card);
        border: 1px solid var(--line);
        border-radius: 14px;
      }
      .metric-tile, .trust-card {
        background: transparent;
        border: 0;
        border-radius: 0;
      }
      .metric-tile { min-height: 112px; padding: 18px; }
      .metric-tile + .metric-tile {
        border-inline-start: 1px solid var(--line);
      }
      .trust-card + .trust-card {
        border-inline-start: 1px solid var(--line);
      }
      .metric-tile p, .trust-card p, .chart-card-head p, .section-head p {
        color: var(--muted);
        font-size: 12px;
        font-weight: 600;
        margin: 0;
      }
      .metric-tile strong {
        color: var(--value);
        display: block;
        font-family: var(--mono-font);
        font-size: 13px;
        font-weight: 500;
        font-variant-numeric: tabular-nums;
        line-height: 1.28;
        margin-top: 18px;
        overflow-wrap: anywhere;
      }
      .metric-tile span, .trust-card span, .chart-card-head span {
        color: var(--muted);
        display: block;
        font-size: 12px;
        margin-top: 10px;
      }
      .metric-callout {
        align-items: center;
        background: var(--card);
        border: 1px solid var(--line);
        border-radius: 16px;
        display: grid;
        gap: 18px;
        grid-template-columns: minmax(140px, 0.34fr) minmax(0, 1fr) auto;
        margin-top: 18px;
        padding: 15px 18px;
      }
      .metric-callout p {
        color: var(--muted);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.02em;
        margin: 0;
        text-transform: uppercase;
      }
      .metric-callout strong {
        color: var(--title);
        display: block;
        font-size: 14px;
        font-weight: 590;
        line-height: 1.25;
        margin-top: 4px;
      }
      .metric-callout .metric-callout-section {
        color: var(--muted);
        display: block;
        font-size: 11px;
        font-weight: 650;
        line-height: 1.3;
        margin: 0;
      }
      .metric-callout span {
        color: var(--muted);
        display: block;
        font-size: 12px;
        line-height: 1.45;
        margin-top: 4px;
      }
      .metric-callout small {
        color: var(--value);
        display: block;
        font-family: var(--mono-font);
        font-size: 15px;
        font-weight: 520;
        font-variant-numeric: tabular-nums;
        line-height: 1.1;
        text-align: end;
        white-space: nowrap;
       }
       .report-composition { margin: 18px 0; }
       .report-blocks { margin: 18px 0 0; }
       .decision-recipe {
         background: var(--card);
         border: 1px solid var(--line);
         border-radius: 16px;
         margin-bottom: 14px;
         overflow: hidden;
       }
       .decision-recipe-head {
         align-items: end;
         border-bottom: 1px solid var(--line);
         display: flex;
         gap: 16px;
         justify-content: space-between;
         padding: 15px 16px;
       }
       .decision-recipe-head p {
         color: var(--value);
         font-size: 13px;
         font-weight: 620;
         margin: 0;
       }
       .decision-recipe-head span {
         color: var(--muted);
         font-size: 11px;
         font-weight: 560;
         line-height: 1.35;
         max-width: 420px;
         text-align: end;
       }
      .decision-recipe-rail {
        display: grid;
        grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr);
      }
      .decision-recipe article {
        display: grid;
        gap: 10px;
        grid-template-columns: auto minmax(0, 1fr);
        min-height: 96px;
        padding: 15px 16px;
      }
      .decision-recipe-index {
        color: #94a3b8;
        display: block;
        font-family: var(--mono-font);
        font-size: 10px;
        font-weight: 560;
        line-height: 1.2;
        padding-top: 1px;
      }
      .decision-recipe article + article {
        border-inline-start: 1px solid var(--line);
      }
       .decision-recipe article p {
         color: var(--muted);
         font-size: 10px;
         font-weight: 700;
         letter-spacing: 0.04em;
         margin: 0;
         text-transform: uppercase;
       }
       .decision-recipe article strong {
         color: var(--value);
         display: block;
         font-size: 13px;
         font-weight: 560;
         line-height: 1.42;
         margin-top: 10px;
       }
       .decision-recipe article span {
         color: var(--muted);
         display: block;
         font-size: 11px;
         line-height: 1.45;
         margin-top: 8px;
       }
       .block-head {
         align-items: center;
         display: flex;
        justify-content: space-between;
        margin-bottom: 10px;
      }
      .block-head p {
        color: var(--value);
        font-size: 14px;
        font-weight: 600;
        margin: 0;
      }
      .block-head span {
        color: var(--muted);
        font-size: 12px;
        font-weight: 600;
      }
      .block-ledger {
        background: var(--card);
        border: 1px solid var(--line);
        border-radius: 16px;
        overflow: hidden;
      }
      .block-row {
        display: grid;
        gap: 16px;
        grid-template-columns: 34px minmax(150px, 0.36fr) minmax(0, 1fr);
        padding: 14px 16px;
      }
      .block-row + .block-row {
        border-top: 1px solid var(--line);
      }
      .block-row-index {
        color: #94a3b8;
        display: block;
        font-family: var(--mono-font);
        font-size: 10px;
        font-weight: 560;
        line-height: 1.4;
      }
      .block-row p {
        color: var(--value);
        font-size: 13px;
        font-weight: 600;
        margin: 0;
      }
      .block-row span {
        color: var(--muted);
        display: block;
        font-size: 12px;
        line-height: 1.45;
        margin-top: 5px;
      }
      .block-row small {
        color: var(--muted);
        display: block;
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.04em;
        line-height: 1.2;
        text-transform: uppercase;
      }
      .block-row strong {
        color: var(--value);
        display: block;
        font-size: 13px;
        font-weight: 560;
        line-height: 1.45;
        margin-top: 5px;
      }
      .composition-ledger {
        background: var(--card);
        border: 1px solid var(--line);
        border-radius: 16px;
        overflow: hidden;
      }
      .composition-row {
        display: grid;
        gap: 18px;
        grid-template-columns: minmax(130px, 0.28fr) minmax(0, 1fr);
        padding: 14px 16px;
      }
      .composition-row + .composition-row {
        border-top: 1px solid var(--line);
      }
      .composition-row p {
        color: var(--muted);
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.04em;
        margin: 0;
        text-transform: uppercase;
      }
      .composition-row strong {
        color: var(--value);
        display: block;
        font-size: 14px;
        font-weight: 580;
        line-height: 1.35;
      }
      .composition-row span {
        color: var(--muted);
        display: block;
        font-size: 12px;
        line-height: 1.45;
        margin-top: 5px;
      }
      .report-story {
        background: var(--card);
        border: 1px solid var(--line);
        border-radius: 16px;
        box-shadow: var(--shadow);
        margin-top: 18px;
        padding: 22px;
      }
      .report-story--trend .trend-card { background: #fff; }
      .report-story--comparison .comparison-list { background: #fff; }
      .report-story--proof .proof-card { background: var(--soft); }
      .story-head {
        align-items: stretch;
        display: grid;
        gap: 16px;
        grid-template-columns: minmax(0, 1fr) minmax(220px, 0.36fr);
      }
      .story-head p, .story-subhead p, .proof-card p, .trend-card p {
        color: var(--muted);
        font-size: 12px;
        font-weight: 600;
        margin: 0;
      }
      .story-head small {
        color: var(--value);
        display: block;
        font-size: 12px;
        font-weight: 600;
        margin-top: 6px;
      }
      .story-head h2 {
        color: var(--title);
        font-size: 19px;
        font-weight: 600;
        line-height: 1.16;
        margin: 7px 0 0;
      }
      .story-head span, .story-subhead span, .proof-card span, .trend-card span {
        color: var(--muted);
        display: block;
        font-size: 13px;
        line-height: 1.45;
        margin-top: 9px;
      }
      .story-head aside {
        background: var(--soft);
        border: 1px solid var(--line);
        border-radius: 14px;
        padding: 15px;
      }
      .story-head aside strong {
        color: var(--value);
        display: block;
        font-size: 15px;
        font-weight: 580;
        line-height: 1.3;
        margin-top: 10px;
      }
       .proof-story-rail {
         background: var(--soft);
         border: 1px solid var(--line);
         border-radius: 14px;
        display: grid;
        gap: 0;
        grid-template-columns: repeat(4, minmax(0, 1fr));
         margin-top: 18px;
         overflow: hidden;
       }
       .leadership-handoff {
         align-items: start;
         background: #fff;
         border-bottom: 1px solid var(--line);
         display: grid;
         gap: 16px;
         grid-column: 1 / -1;
         grid-template-columns: minmax(0, 0.85fr) minmax(260px, 1.15fr);
         padding: 15px;
       }
       .leadership-handoff p {
         color: var(--muted);
         font-size: 10px;
         font-weight: 700;
         letter-spacing: 0.05em;
         margin: 0;
         text-transform: uppercase;
       }
       .leadership-handoff strong {
         color: var(--title);
         display: block;
         font-size: 14px;
         font-weight: 610;
         line-height: 1.3;
         margin-top: 8px;
       }
       .leadership-handoff span {
         color: var(--muted);
         display: block;
         font-size: 11px;
         font-weight: 560;
         line-height: 1.45;
         margin-top: 7px;
       }
       .leadership-handoff-basis div {
         display: flex;
         flex-wrap: wrap;
         gap: 6px;
         margin-top: 8px;
       }
       .leadership-handoff-basis span {
         align-items: center;
         background: var(--soft);
         border: 1px solid var(--line);
         border-radius: 999px;
         color: var(--value);
         display: inline-flex;
         gap: 5px;
         margin: 0;
         padding: 4px 8px;
         white-space: nowrap;
       }
       .leadership-handoff-basis strong {
         color: var(--value);
         display: inline;
         font-family: var(--mono-font);
         font-size: 11px;
         font-weight: 560;
         margin: 0;
       }
       .proof-story-rail article {
         padding: 14px 15px;
       }
      .proof-story-rail article + article {
        border-inline-start: 1px solid var(--line);
      }
      .proof-story-rail p {
        color: var(--muted);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.02em;
        margin: 0;
      }
      .proof-story-rail strong {
        color: var(--value);
        display: block;
        font-size: 12px;
        font-weight: 560;
        line-height: 1.45;
        margin-top: 7px;
      }
      .trend-story, .comparison-story, .proof-story { margin-top: 18px; }
      .story-subhead {
        align-items: center;
        display: flex;
        justify-content: space-between;
        gap: 18px;
        margin-bottom: 12px;
      }
      .trend-card {
        border: 1px solid var(--line);
        border-radius: 16px;
        padding: 17px;
      }
      .trend-card strong {
        color: var(--value);
        display: block;
        font-size: 20px;
        font-weight: 600;
        margin-top: 8px;
      }
      .trend-movement {
        border: 1px solid var(--line);
        border-radius: 14px;
        display: grid;
        gap: 0;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        margin-top: 16px;
        overflow: hidden;
      }
      .trend-movement article {
        padding: 13px 14px;
      }
      .trend-movement article + article {
        border-inline-start: 1px solid var(--line);
      }
      .trend-movement span,
      .trend-movement small {
        color: var(--muted);
        display: block;
        font-size: 11px;
        font-weight: 650;
      }
      .trend-movement strong {
        color: var(--value);
        display: block;
        font-size: 16px;
        font-weight: 580;
        font-variant-numeric: tabular-nums;
        margin-top: 7px;
      }
      .trend-movement small {
        margin-top: 6px;
      }
      .snapshot-card {
        align-items: stretch;
        border: 1px solid var(--line);
        border-radius: 16px;
        display: grid;
        gap: 18px;
        grid-template-columns: minmax(0, 0.45fr) minmax(0, 1fr);
        padding: 17px;
      }
      .snapshot-card p {
        color: var(--muted);
        font-size: 12px;
        font-weight: 600;
        margin: 0;
      }
      .snapshot-card strong {
        color: var(--value);
        display: block;
        font-size: 20px;
        font-weight: 600;
        margin-top: 9px;
      }
      .snapshot-card span {
        color: var(--muted);
        display: block;
        font-size: 12px;
        line-height: 1.45;
        margin-top: 9px;
      }
      .snapshot-card dl {
        border-inline-start: 1px solid var(--line);
        display: grid;
        gap: 14px;
        margin: 0;
        padding-inline-start: 18px;
      }
      .snapshot-card dt {
        color: var(--muted);
        font-size: 11px;
        font-weight: 600;
        margin: 0;
        text-transform: uppercase;
      }
      .snapshot-card dd {
        color: var(--value);
        font-size: 13px;
        font-weight: 560;
        line-height: 1.45;
        margin: 4px 0 0;
      }
      .snapshot-card--compact {
        grid-template-columns: 1fr;
        margin-top: 14px;
      }
      .snapshot-card--compact dl {
        border-inline-start: 0;
        border-top: 1px solid var(--line);
        padding-inline-start: 0;
        padding-top: 14px;
      }
      .metric-readout {
        align-items: end;
        border-top: 1px solid var(--line);
        display: grid;
        gap: 16px;
        grid-template-columns: minmax(0, 1fr) auto;
        margin-top: 16px;
        padding-top: 14px;
      }
      .metric-readout strong {
        color: var(--value);
        display: block;
        font-size: 16px;
        font-weight: 580;
        margin-top: 6px;
      }
      .metric-readout p {
        color: var(--muted);
        font-size: 12px;
        font-weight: 600;
        margin: 7px 0 0;
      }
      .metric-readout small {
        color: var(--value);
        display: block;
        font-size: 12px;
        font-weight: 560;
        margin-top: 6px;
        text-align: end;
      }
      .comparison-list {
        border: 1px solid var(--line);
        border-radius: 16px;
        overflow: hidden;
      }
      .comparison-row {
        align-items: center;
        display: grid;
        gap: 14px;
        grid-template-columns: 34px minmax(0, 1fr);
        padding: 15px;
      }
      .comparison-row + .comparison-row { border-top: 1px solid var(--line); }
      .comparison-rank {
        align-items: center;
        background: var(--ink);
        border-radius: 999px;
        color: #fff;
        display: inline-flex;
        font-size: 12px;
        font-weight: 750;
        height: 28px;
        justify-content: center;
        width: 28px;
      }
      .comparison-line {
        align-items: center;
        display: flex;
        gap: 12px;
        justify-content: space-between;
      }
      .comparison-line strong { font-size: 15px; }
      .comparison-line span {
        color: var(--muted);
        font-size: 12px;
      }
      .comparison-line--meta {
        justify-content: flex-start;
        margin-top: 8px;
      }
      .comparison-bar {
        background: var(--soft);
        border-radius: 999px;
        height: 8px;
        margin-top: 10px;
        overflow: hidden;
      }
      .comparison-bar span {
        background: var(--ink);
        display: block;
        height: 100%;
        margin: 0;
      }
      .proof-grid {
        display: grid;
        gap: 14px;
        grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      }
      .leadership-impact {
        background: var(--soft);
        border: 1px solid var(--line);
        border-radius: 16px;
        margin-bottom: 14px;
        padding: 16px;
      }
      .leadership-impact-head p {
        color: var(--muted);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.04em;
        margin: 0;
        text-transform: uppercase;
      }
      .leadership-impact-head span {
        color: var(--value);
        display: block;
        font-size: 12px;
        line-height: 1.45;
        margin-top: 6px;
      }
      .leadership-impact-grid {
        display: grid;
        gap: 10px;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        margin-top: 14px;
      }
      .leadership-impact article {
        background: #fff;
        border: 1px solid var(--line);
        border-radius: 12px;
        min-height: 72px;
        padding: 12px;
      }
      .leadership-impact strong {
        color: var(--value);
        display: block;
        font-family: var(--mono-font);
        font-size: 16px;
        font-weight: 520;
        font-variant-numeric: tabular-nums;
      }
      .leadership-impact span {
        color: var(--muted);
        display: block;
        font-size: 11px;
        font-weight: 620;
        line-height: 1.25;
        margin-top: 8px;
      }
      .proof-operations {
        background: #fff;
        border: 1px solid var(--line);
        border-radius: 16px;
        display: grid;
        gap: 16px;
        grid-template-columns: minmax(0, 1.25fr) minmax(260px, 0.75fr);
        margin-bottom: 14px;
        padding: 16px;
      }
      .proof-operations-head p {
        color: var(--muted);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.04em;
        margin: 0;
        text-transform: uppercase;
      }
      .proof-operations-head strong {
        color: var(--value);
        display: block;
        font-size: 15px;
        font-weight: 580;
        margin-top: 7px;
      }
      .proof-operations-head span {
        color: var(--muted);
        display: block;
        font-size: 12px;
        line-height: 1.45;
        margin-top: 5px;
      }
      .proof-operations-grid {
        display: grid;
        gap: 10px;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .proof-operations-basis {
        border-top: 1px solid var(--line);
        grid-column: 1 / -1;
        padding-top: 12px;
      }
      .proof-operations-basis p {
        color: var(--muted);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.04em;
        margin: 0 0 8px;
        text-transform: uppercase;
      }
      .proof-operations-basis div {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
      }
      .proof-operations-basis span {
        align-items: center;
        background: var(--soft);
        border: 1px solid var(--line);
        border-radius: 999px;
        color: var(--muted);
        display: inline-flex;
        font-size: 11px;
        font-weight: 650;
        gap: 6px;
        padding: 6px 9px;
      }
      .proof-operations-basis strong {
        color: var(--value);
        font-family: var(--mono-font);
        font-size: 11px;
        font-weight: 560;
      }
      .proof-operations article {
        background: var(--soft);
        border: 1px solid var(--line);
        border-radius: 12px;
        padding: 12px;
      }
      .proof-operations article p {
        color: var(--muted);
        font-size: 11px;
        font-weight: 650;
        margin: 0;
      }
      .proof-operations article strong {
        color: var(--value);
        display: block;
        font-family: var(--mono-font);
        font-size: 13px;
        font-weight: 520;
        line-height: 1.45;
        margin-top: 7px;
      }
      .proof-card {
        border: 1px solid var(--line);
        border-radius: 16px;
        min-height: 118px;
        padding: 16px;
      }
      .proof-card strong {
        color: var(--value);
        display: block;
        font-family: var(--mono-font);
        font-size: 13px;
        font-weight: 500;
        line-height: 1.35;
        margin-top: 14px;
        overflow-wrap: anywhere;
      }
      .story-empty {
        align-items: center;
        border: 1px solid var(--line);
        border-radius: 16px;
        color: var(--muted);
        display: flex;
        min-height: 120px;
        padding: 16px;
      }
      .trust-grid { margin-top: 18px; }
      .trust-card { padding: 16px; }
      .trust-card strong {
        color: var(--value);
        display: block;
        font-family: var(--mono-font);
        font-size: 13px;
        font-weight: 500;
        font-variant-numeric: tabular-nums;
        line-height: 1.3;
        margin-top: 14px;
        overflow-wrap: anywhere;
      }
      .trust-card--date strong {
        font-size: 11px;
        font-weight: 540;
        letter-spacing: 0.01em;
        white-space: normal;
      }
      .recommendations { margin-top: 28px; }
      .recommendation-memo {
        background: var(--card);
        border: 1px solid var(--line);
        border-radius: 16px;
        overflow: hidden;
      }
      .recommendation-head {
        align-items: center;
        border-bottom: 1px solid var(--line);
        display: flex;
        gap: 18px;
        justify-content: space-between;
        padding: 16px 18px;
      }
      .recommendation-head p {
        color: var(--muted);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.05em;
        margin: 0;
        text-transform: uppercase;
      }
      .recommendation-head h2 {
        color: var(--title);
        font-size: 17px;
        font-weight: 600;
        line-height: 1.2;
        margin: 5px 0 0;
      }
      .recommendation-head span {
        border: 1px solid var(--line);
        border-radius: 999px;
        color: var(--muted);
        flex: 0 0 auto;
        font-size: 11px;
        font-weight: 700;
        padding: 6px 10px;
      }
      .recommendation-primary {
        display: grid;
        gap: 18px;
        grid-template-columns: minmax(120px, 0.28fr) minmax(0, 1fr);
        padding: 18px;
      }
      .recommendation-primary > p {
        color: var(--muted);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.05em;
        margin: 0;
        text-transform: uppercase;
      }
      .recommendation-primary span {
        color: var(--muted);
        display: block;
        font-size: 12px;
        font-weight: 650;
      }
      .recommendation-primary strong {
        color: var(--title);
        display: block;
        font-size: 18px;
        font-weight: 600;
        line-height: 1.2;
        margin-top: 6px;
      }
      .recommendation-primary small {
        color: var(--muted);
        display: block;
        font-size: 12px;
        line-height: 1.45;
        margin-top: 8px;
      }
      .recommendation-memo .decision-list {
        border-top: 1px solid var(--line);
        overflow: hidden;
      }
      .recommendation-memo .decision-list > small {
        background: var(--soft);
        color: var(--muted);
        display: block;
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.05em;
        padding: 10px 18px;
        text-transform: uppercase;
      }
      .decision-row {
        align-items: start;
        display: grid;
        gap: 14px;
        grid-template-columns: 34px minmax(0, 1fr);
        padding: 14px 18px;
      }
      .decision-row + .decision-row { border-top: 1px solid var(--line); }
      .decision-index {
        color: var(--muted);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.08em;
      }
      .decision-row p {
        color: var(--muted);
        font-size: 12px;
        font-weight: 600;
        margin: 0;
      }
      .decision-row strong {
        color: var(--value);
        display: block;
        font-size: 15px;
        font-weight: 580;
        margin-top: 6px;
      }
      .decision-row small {
        color: var(--muted);
        display: block;
        font-size: 12px;
        margin-top: 7px;
      }
      .report-section { margin-top: 28px; }
      .section-head {
        align-items: end;
        display: flex;
        justify-content: space-between;
        margin-bottom: 12px;
      }
      .section-head h2 {
        color: var(--title);
        font-size: 17px;
        font-weight: 600;
        line-height: 1.2;
        margin: 6px 0 0;
      }
      .section-badge {
        border: 1px solid var(--line);
        border-radius: 999px;
        color: var(--muted);
        flex: 0 0 auto;
        font-size: 11px;
        font-weight: 700;
        padding: 6px 10px;
      }
      .chart-grid {
        display: grid;
        gap: 14px;
        grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
      }
      .chart-card { overflow: hidden; padding: 18px; }
      .chart-card-head {
        align-items: start;
        display: flex;
        justify-content: space-between;
        gap: 18px;
      }
      .chart-card-head strong {
        color: var(--value);
        display: block;
        font-size: 17px;
        font-weight: 600;
        margin-top: 8px;
      }
      .metric-ledger {
        overflow: hidden;
      }
      .metric-ledger-row {
        align-items: center;
        display: grid;
        gap: 16px;
        grid-template-columns: minmax(120px, 0.8fr) minmax(90px, 0.35fr) minmax(130px, 1fr) minmax(92px, 0.35fr);
        padding: 14px 16px;
      }
      .metric-ledger-row + .metric-ledger-row {
        border-top: 1px solid var(--line);
      }
      .metric-ledger-row p {
        color: var(--muted);
        font-size: 12px;
        font-weight: 600;
        margin: 0;
      }
      .metric-ledger-row strong {
        color: var(--value);
        display: block;
        font-size: 16px;
        font-weight: 580;
        font-variant-numeric: tabular-nums;
        margin-top: 5px;
      }
      .metric-ledger-row span,
      .metric-ledger-row small {
        color: var(--muted);
        font-size: 12px;
        font-weight: 600;
      }
      .metric-ledger-row small {
        justify-self: end;
      }
      .metric-ledger-row .ledger-date {
        color: var(--value);
        font-variant-numeric: tabular-nums;
        justify-self: end;
      }
      .chart-svg { display: block; height: auto; margin-top: 10px; width: 100%; }
      .grid-line { stroke: #e8edf3; stroke-width: 1; }
      .axis-line { stroke: #d5dde8; stroke-width: 1; }
      .axis-label, .chart-dates text {
        fill: var(--muted);
        font-size: 12px;
        font-weight: 600;
      }
      .chart-line {
        fill: none;
        stroke: var(--ink);
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-width: 3;
      }
      .chart-points circle {
        fill: #fff;
        stroke: var(--ink);
        stroke-width: 3;
      }
      .chart-empty {
        align-items: center;
        color: var(--muted);
        display: flex;
        min-height: 180px;
      }
      .creator-table { margin-top: 28px; overflow: hidden; }
      .creator-table-head {
        align-items: end;
        display: flex;
        gap: 18px;
        justify-content: space-between;
        padding: 17px 18px 14px;
      }
      .creator-table-head p {
        color: var(--muted);
        font-size: 12px;
        font-weight: 600;
        margin: 0;
      }
      .creator-table h2 {
        color: var(--title);
        font-size: 17px;
        font-weight: 600;
        margin: 5px 0 0;
      }
      .creator-table-head span {
        color: var(--muted);
        font-size: 12px;
        font-weight: 600;
      }
      table { border-collapse: collapse; width: 100%; }
      th, td {
        border-top: 1px solid var(--line);
        font-size: 13px;
        padding: 13px 16px;
        text-align: start;
      }
      th {
        color: var(--muted);
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
      }
      .creator-table td strong {
        color: var(--value);
        font-weight: 580;
      }
      @media (max-width: 720px) {
        .topbar { padding: 24px; }
        .topbar-inner { display: block; }
        .generated { text-align: start; }
        main { padding: 24px 18px 40px; }
        h1 { font-size: 24px; }
        .report-hero { border-radius: 16px; padding: 0; }
        .report-hero-grid { grid-template-columns: 1fr; }
        .report-title-stack { min-height: auto; padding: 22px; }
        .date-range { align-items: flex-start; flex-direction: column; gap: 3px; }
        .campaign-visual {
          border-inline-start: 0;
          border-top: 1px solid var(--line);
          height: 160px;
          min-height: 160px;
        }
        .report-meta { grid-template-columns: 1fr; }
        .report-meta div + div {
          border-inline-start: 0;
          border-top: 1px solid var(--line);
          padding-inline-start: 0;
          padding-top: 10px;
        }
        .metric-strip,
        .trust-grid {
          grid-template-columns: 1fr;
        }
        .proof-operations { grid-template-columns: 1fr; }
         .metric-tile + .metric-tile {
           border-inline-start: 0;
           border-top: 1px solid var(--line);
         }
         .metric-callout {
           align-items: start;
           grid-template-columns: 1fr;
         }
        .metric-callout small {
          text-align: start;
          white-space: normal;
        }
        .block-row {
          grid-template-columns: 1fr;
        }
        .recommendation-head {
          align-items: start;
          flex-direction: column;
        }
        .recommendation-primary {
          grid-template-columns: 1fr;
        }
        .trust-card + .trust-card {
          border-inline-start: 0;
          border-top: 1px solid var(--line);
        }
        .story-head { grid-template-columns: 1fr; }
        .trend-movement { grid-template-columns: 1fr; }
        .trend-movement article + article {
          border-inline-start: 0;
          border-top: 1px solid var(--line);
        }
        .proof-story-rail { grid-template-columns: 1fr; }
         .proof-story-rail article + article {
           border-inline-start: 0;
           border-top: 1px solid var(--line);
         }
         .leadership-handoff {
           grid-template-columns: 1fr;
         }
         .decision-recipe-head {
           align-items: start;
           flex-direction: column;
         }
         .decision-recipe-head span {
           max-width: none;
           text-align: start;
         }
        .decision-recipe-rail { grid-template-columns: 1fr; }
        .decision-recipe article + article {
          border-inline-start: 0;
          border-top: 1px solid var(--line);
         }
         .snapshot-card { grid-template-columns: 1fr; }
         .snapshot-card dl {
           border-inline-start: 0;
          border-top: 1px solid var(--line);
          padding-inline-start: 0;
          padding-top: 14px;
        }
        .story-subhead { align-items: start; flex-direction: column; }
         .comparison-line { align-items: start; flex-direction: column; gap: 5px; }
         .leadership-impact-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
         .metric-readout { align-items: start; grid-template-columns: 1fr; }
        .metric-readout small { text-align: start; }
        .metric-ledger-row {
          align-items: start;
          grid-template-columns: 1fr;
        }
        .metric-ledger-row small,
        .metric-ledger-row .ledger-date {
          justify-self: start;
        }
        .creator-table-head { align-items: start; flex-direction: column; }
        .chart-grid { grid-template-columns: 1fr; }
        table { min-width: 760px; }
        .creator-table { overflow-x: auto; }
      }
    </style>
  </head>
  <body class="${escapeHtml(bodyClass)}" data-report-cover-mode="${escapeHtml(presentation.coverMode)}" data-report-typography="${escapeHtml(presentation.typography)}" data-report-density="${escapeHtml(presentation.density)}">
    <header class="topbar">
      <div class="topbar-inner">
        <div>
          <div class="brand">PopsDrops</div>
          <div class="topbar-label">Proof-backed campaign report</div>
        </div>
        <div class="generated">Generated ${escapeHtml(formatHtmlGeneratedDate(data.generatedAt))}</div>
      </div>
    </header>
    <main>
      <section class="${escapeHtml(heroClass)}">
         <div class="report-hero-grid">
          <div class="report-title-stack">
            <div>
              <p class="report-kicker">Global Proof Room</p>
              <h1>${escapeHtml(reportTitle)}</h1>
              <p class="date-range"><span>Report window</span>${escapeHtml(formatHtmlDateText(data.dateRange))}</p>
              ${
                data.composition?.executiveQuestion
                  ? `<p class="decision-question"><span>Executive question</span>${escapeHtml(data.composition.executiveQuestion)}</p>`
                  : ""
              }
              ${reportContext ? `<p class="report-context">${escapeHtml(reportContext)}</p>` : ""}
            </div>
            ${buildHtmlHeroMetrics(heroMetrics)}
          </div>
          ${buildHtmlCampaignVisual(data, presentation)}
        </div>
      </section>
      ${buildHtmlReportBody(data)}
    </main>
  </body>
</html>`;
}
