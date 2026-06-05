#!/usr/bin/env node

import { execFile } from "node:child_process";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import {
  createCdpPage,
  evaluate,
  ensureDevServer,
  findFreePort,
  launchChrome,
  loginForSmoke,
  navigate,
  stopDevServer,
  waitForExpression,
} from "./smoke-campaign-detail.mjs";
import {
  captureScreenshot,
  cleanupApplicationFlowSmokeData,
  createAdminClient,
  loadLocalEnv,
} from "./smoke-application-flow.mjs";
import {
  buildContentReportManualSourceSmokeTargets,
  runContentReportManualSourceSmoke,
} from "./smoke-content-report-manual-source.mjs";
import {
  clickButtonByText,
  verifyBrandReportEvidence,
} from "./smoke-content-report-workflow.mjs";

export const DEFAULT_REPORT_EXPORT_UI_CAMPAIGN_ID =
  "a0000000-0000-4000-8000-000000000112";

const EXPORT_FORMAT = "html";
const EXPORT_LABEL = "HTML report";
const CLIENT_DOWNLOAD_EXPORTS = [
  {
    extension: ".pdf",
    label: "PDF report",
    previewScreenshotPath: path.resolve(
      "output/playwright/report-export-ui-pdf-cover-smoke.png",
    ),
  },
  {
    extension: ".pptx",
    label: "PowerPoint deck",
    previewScreenshotPath: path.resolve(
      "output/playwright/report-export-ui-pptx-cover-smoke.png",
    ),
  },
] as const;
const execFileAsync = promisify(execFile);
const MIN_RENDERED_EXPORT_PREVIEW_BYTES = 12_000;
const REPORT_SMOKE_CREATOR_DISPLAY_NAME = "Mina Park";
const REPORT_CAMPAIGN_VISUAL_TITLE = "Maison Lumiere New York launch still";
const TEMPLATE_NAME_PREFIX = "Global proof leadership smoke";
const CUSTOM_REPORT_TITLE = "US market proof report";
const CUSTOM_EXECUTIVE_QUESTION =
  "Is the launch evidence strong enough to continue scaling in the United States?";
const CUSTOM_REPORT_FILE_SLUG = "us-market-proof-report";
const REPORT_EXPORT_STALE_SERVICE_ERROR =
  "Report export service is out of date. Deploy the generate-report Edge Function before exporting.";
const CUSTOM_REPORT_KPI_TILE_IDS = ["views", "engagements", "cpe"] as const;
const CUSTOM_REPORT_TRUST_TILE_IDS = [
  "evidence_backed_reads",
  "data_window",
  "data_source",
] as const;
const CUSTOM_REPORT_KPI_TILE_LABELS = {
  views: "Qualified reach",
  engagements: "Audience actions",
  cpe: "Efficiency signal",
} as const;
const CUSTOM_REPORT_TRUST_TILE_LABELS = {
  evidence_backed_reads: "Proof coverage",
  data_window: "Read window",
  data_source: "Metric origin",
} as const;
const CUSTOM_REPORT_SECTION_LABELS = {
  channel_story: "Channel evidence story",
  creator_table: "Creator decision table",
  executive_summary: "Board evidence scorecard",
  proof_sources: "Evidence source audit",
  recommendations: "Next market actions",
  report_trust: "Audit confidence",
} as const;
const CUSTOM_REPORT_SAVED_SECTION_LABELS = {
  executive_summary: CUSTOM_REPORT_SECTION_LABELS.executive_summary,
  channel_story: CUSTOM_REPORT_SECTION_LABELS.channel_story,
  report_trust: CUSTOM_REPORT_SECTION_LABELS.report_trust,
  recommendations: CUSTOM_REPORT_SECTION_LABELS.recommendations,
} as const;
const DEFAULT_MENU_SCREENSHOT_PATH =
  "output/playwright/report-export-ui-menu-smoke.png";
const DEFAULT_COVER_SCREENSHOT_PATH =
  "output/playwright/report-export-ui-cover-smoke.png";
const DEFAULT_PROOF_ROOM_COVER_SCREENSHOT_PATH =
  "output/playwright/report-export-ui-proof-room-cover-smoke.png";
const DEFAULT_BUILDER_SCREENSHOT_PATH =
  "output/playwright/report-export-ui-builder-smoke.png";
const DEFAULT_SHARED_REPORT_SCREENSHOT_PATH =
  "output/playwright/report-export-ui-shared-report-smoke.png";
const DEFAULT_SHARED_REPORT_HOLD_SCREENSHOT_PATH =
  "output/playwright/report-export-ui-shared-report-hold-smoke.png";

type ReportExportChartMode = "trend" | "comparison" | "proof";
type ReportExportChartMetric = "views" | "engagements" | "engagementRate" | "cpe";

interface ReportExportModeContract {
  chartMode: ReportExportChartMode;
  chartModeLabel: string;
  layoutTitle: string;
  layoutDetail: string;
  outputTitle: string;
  visualScreenshotPath: string;
  presetId?: string;
  expectedFirstBlockId?: string;
  chartMetric?: ReportExportChartMetric;
  chartMetricLabel?: string;
  includeReportFraming?: boolean;
  preserveCurrentSelection?: boolean;
  artifactChecks: string[];
  artifactAbsentChecks?: string[];
  sectionLabelChecks?: string[];
  tileLabelChecks?: string[];
}

const REPORT_EXPORT_MODE_CONTRACTS: ReportExportModeContract[] = [
  {
    chartMode: "trend",
    chartModeLabel: "Trend view",
    layoutTitle: "Timeline readout",
    layoutDetail: "Lead with movement over time, pacing, and the final decision signal.",
    outputTitle: "Custom report",
    visualScreenshotPath: path.resolve(
      "output/playwright/report-export-ui-trend-artifact-smoke.png",
    ),
    preserveCurrentSelection: true,
    includeReportFraming: true,
    expectedFirstBlockId: "recommendations",
    artifactChecks: [
      "data-report-chart-mode=\"trend\"",
      "report-story--trend",
      "Custom report",
      "Report composition",
      "composition-ledger",
      "composition-row",
      "data-composition-row=\"report-plan\"",
      "data-composition-row=\"executive-question\"",
      "data-composition-row=\"chart-mode\"",
      "data-composition-row=\"chart-layout\"",
      "Report plan",
      "Chart layout",
      "Report blocks",
      "block-ledger",
      "block-row",
      "data-report-block-row=\"recommendations\"",
      "data-report-block-row=\"channel_story\"",
      "Decision recipe",
      "data-chart-recipe=\"decision-recipe\"",
      "decision-recipe-rail",
      "decision-recipe-step",
      "decision-recipe-index",
      "Question, visual job, evidence gate, and action",
      "Question",
      "Visual job",
      "Evidence gate",
      "Action",
      "Compare first and latest reads before deciding.",
      "Lead metric",
      "Single read. Snapshot recipe selected automatically.",
      "Snapshot read",
      "One verified read; use a snapshot until there is enough history for a trend.",
      "recommendation-memo",
      "Recommended move",
      "Supporting evidence",
      "Top creator",
      "Cost per Engagement",
      "data-chart-recipe=\"single-read-ledger\"",
    ],
    sectionLabelChecks: [
      CUSTOM_REPORT_SECTION_LABELS.channel_story,
      CUSTOM_REPORT_SECTION_LABELS.executive_summary,
      CUSTOM_REPORT_SECTION_LABELS.recommendations,
      CUSTOM_REPORT_SECTION_LABELS.report_trust,
    ],
    tileLabelChecks: [
      ...Object.values(CUSTOM_REPORT_KPI_TILE_LABELS),
      ...Object.values(CUSTOM_REPORT_TRUST_TILE_LABELS),
    ],
    artifactAbsentChecks: [
      "data-summary-metric-key=\"views\"",
      "data-summary-metric-key=\"engagements\"",
      "composition-grid",
      "composition-card",
      "block-grid",
      "block-card",
      "Cover scorecard",
    ],
  },
  {
    chartMode: "comparison",
    chartModeLabel: "Comparison view",
    layoutTitle: "Ranked comparison",
    layoutDetail: "Lead with creator and channel contrast before detail rows.",
    outputTitle: "Creator performance",
    visualScreenshotPath: path.resolve(
      "output/playwright/report-export-ui-comparison-artifact-smoke.png",
    ),
    presetId: "creator_performance",
    chartMetric: "cpe",
    chartMetricLabel: CUSTOM_REPORT_KPI_TILE_LABELS.cpe,
    artifactChecks: [
      "data-report-chart-mode=\"comparison\"",
      "data-comparison-focus=\"cpe\"",
      "report-story--comparison",
      "Creator comparison by Efficiency signal",
      "Sorted by Efficiency signal. Lower CPE ranks first.",
      "comparison-rank",
      "Creator-level evidence",
      "Cost per Engagement",
      "data-chart-recipe=\"single-read-ledger\"",
      "metric-callout",
      "Leadership watchpoint",
      "data-summary-metric-key=\"cpe\"",
    ],
    sectionLabelChecks: [
      CUSTOM_REPORT_SECTION_LABELS.channel_story,
      CUSTOM_REPORT_SECTION_LABELS.creator_table,
      CUSTOM_REPORT_SECTION_LABELS.executive_summary,
      CUSTOM_REPORT_SECTION_LABELS.recommendations,
      CUSTOM_REPORT_SECTION_LABELS.report_trust,
    ],
    tileLabelChecks: [
      ...Object.values(CUSTOM_REPORT_KPI_TILE_LABELS),
      ...Object.values(CUSTOM_REPORT_TRUST_TILE_LABELS),
    ],
  },
  {
    chartMode: "proof",
    chartModeLabel: "Proof view",
    layoutTitle: "Evidence audit",
    layoutDetail:
      "Lead with source coverage, review state, and missing proof before performance detail.",
    outputTitle: "Proof audit",
    visualScreenshotPath: path.resolve(
      "output/playwright/report-export-ui-proof-artifact-smoke.png",
    ),
    presetId: "proof_audit",
    artifactChecks: [
      "data-report-chart-mode=\"proof\"",
      "report-story--proof",
      "Proof source summary",
      "Native analytics screenshots",
      "Proof coverage: 1/1",
      "Proof source readiness",
      "Proof operations",
      "data-proof-operations-scope",
      "data-proof-operations-state",
      "Verified coverage",
      "Attention queue",
      "Leadership impact",
      "What is included in leadership totals",
      'data-impact-key="included"',
      'data-impact-key="needs-review"',
      'data-impact-key="corrections"',
      'data-impact-key="missing-proof"',
    ],
    artifactAbsentChecks: [
      "<strong>None</strong>",
      "No additional proof-source lanes were included.",
    ],
    sectionLabelChecks: [
      CUSTOM_REPORT_SECTION_LABELS.creator_table,
      CUSTOM_REPORT_SECTION_LABELS.proof_sources,
      CUSTOM_REPORT_SECTION_LABELS.report_trust,
    ],
    tileLabelChecks: Object.values(CUSTOM_REPORT_TRUST_TILE_LABELS),
  },
];

interface ReportExportJobRow {
  id: string;
  campaign_id: string;
  format: string;
  status: string;
  storage_bucket: string | null;
  storage_path: string | null;
  file_name: string | null;
  mime_type: string | null;
  error_message: string | null;
  created_at: string;
}

interface SupabaseQueryResult<T> {
  data: T;
  error: Error | null;
}

type SmokeCdpPage = Awaited<ReturnType<typeof createCdpPage>>;

function assertNoCarelessReportCountLabels(text: string, label: string) {
  const carelessLabels = ["1 channels", "1 reports", "1 creators"];

  for (const carelessLabel of carelessLabels) {
    if (text.toLowerCase().includes(carelessLabel)) {
      throw new Error(`${label} still includes careless count label ${carelessLabel}.`);
    }
  }
}

function assertReviewedProofProvenance(text: string, label: string) {
  if (!/Reviewed \d{4}\/\d{2}\/\d{2}/.test(text)) {
    throw new Error(`${label} is missing reviewed proof provenance.`);
  }

  if (!text.includes("Reviewer recorded")) {
    throw new Error(`${label} is missing reviewer provenance detail.`);
  }
}

function assertReportExportUiArtifact(
  text: string,
  modeContract: ReportExportModeContract,
) {
  assertNoCarelessReportCountLabels(text, "UI-triggered report export artifact");

  const expectedEvidenceTrail = "Proof coverage: 1/1 / Brand-reviewed proof";
  const expectedHeroProofMetric = [
    'data-cover-metric-source="trust" data-cover-metric-key="evidence_backed_reads"',
    "<span>Proof coverage</span>",
    "<small>Native analytics screenshots</small>",
  ];
  const required = [
    modeContract.chartModeLabel,
    "Primary report story",
    modeContract.layoutTitle,
    modeContract.layoutDetail,
    "report-hero--visual-led",
    "<figure class=\"campaign-visual campaign-visual--hero\">",
    "<img src=",
    `alt="${REPORT_CAMPAIGN_VISUAL_TITLE}"`,
    `<figcaption>${REPORT_CAMPAIGN_VISUAL_TITLE}</figcaption>`,
    "object-fit: contain;",
    "padding: 18px 18px 58px;",
    ...(modeContract.tileLabelChecks ?? []),
    "Brand-reviewed proof",
    "Creator evidence reviewed by brand",
    "Proof review",
    "Report window",
    ...expectedHeroProofMetric,
    "Views",
    "Engagements",
    "Decision read",
    "Evidence trail",
    expectedEvidenceTrail,
    "Next action",
    "Trust decision",
    "Ready for leadership sharing.",
    "data-leadership-handoff-state=\"ready\"",
    "Leadership handoff",
    "Share with leadership",
    "Proof basis",
    'data-proof-basis-key="included"',
    'data-proof-basis-key="needs-review"',
    'data-proof-basis-key="corrections"',
    'data-proof-basis-key="missing-proof"',
    "data-report-cover-mode=\"campaign_visual\"",
    "data-report-typography=\"compact\"",
    "data-report-density=\"compact\"",
    "--value: #475569;",
    "font-size: 17px;",
    "decision-list",
    CUSTOM_REPORT_TITLE,
    CUSTOM_EXECUTIVE_QUESTION,
    modeContract.outputTitle,
    ...(modeContract.sectionLabelChecks ?? []),
    ...modeContract.artifactChecks,
  ];

  for (const label of required) {
    if (!text.includes(label)) {
      const metaIndex = text.indexOf("<aside class=\"report-meta\"");
      const metaSnippet = metaIndex >= 0
        ? text.slice(metaIndex, metaIndex + 900)
        : "No report-meta block found.";
      throw new Error(
        `Missing ${label} in UI-triggered report export artifact. Report meta: ${metaSnippet}`,
      );
    }
  }

  for (const label of modeContract.artifactAbsentChecks ?? []) {
    if (text.includes(label)) {
      throw new Error(`Unexpected ${label} in UI-triggered report export artifact.`);
    }
  }

  for (const label of ["Team template", TEMPLATE_NAME_PREFIX]) {
    if (text.includes(label)) {
      throw new Error(`Unexpected internal report plan label ${label} in UI-triggered report export artifact.`);
    }
  }

  for (const label of ["Report status", "Verified reads", "Reports received"]) {
    if (text.includes(label)) {
      throw new Error(`Unexpected removed report tile ${label} in UI-triggered report export artifact.`);
    }
  }

  if (text.includes("metric-card")) {
    throw new Error("UI-triggered report export artifact still uses boxed metric-card styling.");
  }

  if (text.includes("<span>Evidence status</span>")) {
    throw new Error("UI-triggered report export artifact still uses fixed cover evidence labels.");
  }

  if (text.includes("not reviewed") || text.includes("Not reviewed")) {
    throw new Error("HTML report artifact still says reviewed proof is not reviewed.");
  }

  assertReviewedProofProvenance(text, "UI-triggered report export artifact");

  if (modeContract.chartMode === "trend" && text.includes("Creator Performance")) {
    throw new Error("Creator Performance block should be absent after the leadership preset is selected.");
  }

  if (text.includes("Application Flow Smoke Campaign Report")) {
    throw new Error("UI-triggered report export artifact still used the default campaign report title.");
  }
}

function stableRecordJson(value: Record<string, unknown> | null | undefined): string {
  return JSON.stringify(
    Object.fromEntries(
      Object.entries(value ?? {}).sort(([first], [second]) =>
        first.localeCompare(second),
      ),
    ),
  );
}

async function cleanupReportCompositionTemplates({
  admin,
  templateIds,
}: {
  admin: ReturnType<typeof createAdminClient>;
  templateIds: string[];
}) {
  if (templateIds.length === 0) return;

  await admin.from("report_composition_templates").delete().in("id", templateIds);
}

async function createFreshReportShareUrl({
  brandReportUrl,
  client,
  expectedTrustDecision,
  expectedTrustState,
}: {
  brandReportUrl: string;
  client: SmokeCdpPage;
  expectedTrustDecision: string;
  expectedTrustState: "ready" | "hold";
}) {
  await navigate(client, brandReportUrl);
  await waitForExpression(
    client,
    'Boolean(document.querySelector(\'[data-testid="report-share-button"]\'))',
    "configured report share button",
    60000,
  );
  await evaluate(
    client,
    `(() => {
      const button = document.querySelector('[data-testid="report-share-button"]');
      if (!button) throw new Error("Missing report-share-button");
      button.click();
      return true;
    })()`,
  );
  await waitForExpression(
    client,
    `(() => {
      const expectedTrustDecision = ${JSON.stringify(expectedTrustDecision)};
      const expectedTrustState = ${JSON.stringify(expectedTrustState)};
      const gate = document.querySelector('[data-testid="report-share-trust-gate"]');
      const decision = document.querySelector('[data-testid="report-share-trust-decision"]');
      const detail = document.querySelector('[data-testid="report-share-trust-detail"]');
      const text = document.body.innerText || "";
      return text.includes("Create link")
        && Boolean(gate)
        && gate?.getAttribute("data-leadership-state") === expectedTrustState
        && decision?.textContent?.includes(expectedTrustDecision)
        && detail?.textContent?.includes("Shared links show this same trust decision before any leadership KPIs.");
    })()`,
    "configured report share dialog",
    60000,
  );
  await clickButtonByText(client, "Create link");
  await waitForExpression(
    client,
    'document.querySelector(\'[data-testid="report-share-url"]\')?.value.includes("/reports/share/pd_rpt_")',
    "configured report share URL",
    60000,
  );

  const sharedReportUrl = await evaluate(
    client,
    'document.querySelector(\'[data-testid="report-share-url"]\')?.value || ""',
  );
  const expectedOrigin = new URL(brandReportUrl).origin;
  if (!sharedReportUrl.startsWith(expectedOrigin)) {
    throw new Error(
      `Expected configured report share URL to use current app origin. Got: ${sharedReportUrl}`,
    );
  }

  return sharedReportUrl;
}

function collectReportSmokeConsoleErrors(
  client: SmokeCdpPage,
  consoleErrors: string[],
) {
  client.on("Runtime.consoleAPICalled", (event: {
    type: string;
    args?: Array<{ value?: string; description?: string }>;
  }) => {
    if (event.type === "error") {
      consoleErrors.push(
        event.args?.map((arg) => arg.value || arg.description || "").join(" ") ||
          "Console error",
      );
    }
  });
  client.on("Runtime.exceptionThrown", (event: {
    exceptionDetails?: { text?: string };
  }) => {
    consoleErrors.push(event.exceptionDetails?.text || "Runtime exception");
  });
}

async function withFreshSharedReportPage<T>({
  consoleErrors,
  debugPort,
  run,
}: {
  consoleErrors: string[];
  debugPort: number;
  run: (sharedReportClient: SmokeCdpPage) => Promise<T>;
}) {
  const sharedReportClient = await createCdpPage(debugPort);

  try {
    collectReportSmokeConsoleErrors(sharedReportClient, consoleErrors);
    await sharedReportClient.send("Page.enable");
    await sharedReportClient.send("Runtime.enable");

    return await run(sharedReportClient);
  } finally {
    sharedReportClient.close();
  }
}

async function smokeSharedReportLeadershipGate({
  brandReportUrl,
  client,
  description,
  expectedDetail,
  expectedLabel,
  expectedState,
  sharedReportScreenshotPath,
  viewerClient,
}: {
  brandReportUrl: string;
  client: SmokeCdpPage;
  description: string;
  expectedDetail: string;
  expectedLabel: string;
  expectedState: "ready" | "hold";
  sharedReportScreenshotPath?: string;
  viewerClient?: SmokeCdpPage;
}) {
  const sharedReportUrl = await createFreshReportShareUrl({
    brandReportUrl,
    client,
    expectedTrustDecision: expectedDetail,
    expectedTrustState: expectedState,
  });
  const sharedReportClient = viewerClient ?? client;

  await navigate(sharedReportClient, sharedReportUrl);
  const leadershipGateExpression = `(() => {
      const expectedState = ${JSON.stringify(expectedState)};
      const gate = document.querySelector('[data-testid="shared-report-leadership-gate"]');
      const cover = document.querySelector('[data-testid="shared-report-executive-cover"]');
      const coverTrustDecision = cover?.querySelector('[data-testid="shared-report-executive-cover-trust-decision"]');
      const coverMetrics = [...(cover?.querySelectorAll('[data-testid="shared-report-executive-cover-metric"]') ?? [])];
      const gateText = gate?.textContent || "";
      const coverTrustText = coverTrustDecision?.textContent || "";
      const proofBasis = gate?.querySelector('[data-testid="shared-report-proof-basis"]');
      const proofBasisText = proofBasis?.textContent || "";
      const proofBasisItems = [...(proofBasis?.querySelectorAll('[data-testid="shared-report-proof-basis-item"]') ?? [])];
      const text = document.body.textContent || "";
      const holdPanel = document.querySelector('[data-testid="shared-report-leadership-hold-panel"]');
      const holdPanelText = holdPanel?.textContent || "";
      const holdProofItems = [...(holdPanel?.querySelectorAll('[data-testid="shared-report-hold-proof-item"]') ?? [])];
      const proofBasisReady = Boolean(proofBasis)
        && proofBasisText.includes("Proof basis")
        && proofBasisItems.some((item) => item.getAttribute("data-proof-basis-key") === "included")
        && proofBasisItems.some((item) => item.getAttribute("data-proof-basis-key") === "needs-review")
        && proofBasisItems.some((item) => item.getAttribute("data-proof-basis-key") === "corrections")
        && proofBasisItems.some((item) => item.getAttribute("data-proof-basis-key") === "missing-proof");
      const holdStateIsProofOnly = expectedState !== "hold" || (
        Boolean(holdPanel)
        && holdPanelText.includes("Performance detail held for evidence review")
        && holdProofItems.length >= 3
        && coverMetrics.length > 0
        && coverMetrics.every((metric) => metric.getAttribute("data-cover-metric-source") === "trust")
        && coverMetrics.some((metric) => metric.getAttribute("data-cover-metric-key") === "evidence_backed_reads")
        && !document.querySelector('[data-testid="shared-report-kpi-card"]')
        && !document.querySelector('[data-testid="shared-report-kpi-watchpoint"]')
        && !document.querySelector('[data-testid="shared-report-recommendations"]')
        && !document.querySelector('[data-testid="shared-report-selected-metric-value"]')
        && !text.includes("Creator Performance")
        && !text.includes("No chart data yet")
      );
      return document.readyState === "complete"
        && Boolean(cover)
        && gate?.getAttribute("data-leadership-state") === expectedState
        && coverTrustDecision?.getAttribute("data-cover-trust-state") === expectedState
        && coverTrustText.includes("Trust decision")
        && gateText.includes(${JSON.stringify(expectedLabel)})
        && gateText.includes(${JSON.stringify(expectedDetail)})
        && proofBasisReady
        && coverTrustText.includes(${JSON.stringify(expectedLabel)})
        && coverTrustText.includes(${JSON.stringify(expectedDetail)})
        && holdStateIsProofOnly
        && ${expectedState === "hold" ? "!gateText.includes(\"Leadership-ready\")" : "true"};
    })()`;
  try {
     await waitForExpression(
       sharedReportClient,
       leadershipGateExpression,
       description,
       90000,
     );
     const sharedReportText = await evaluate(
       sharedReportClient,
       "document.body.innerText || document.body.textContent || ''",
     );
     assertNoCarelessReportCountLabels(sharedReportText, description);
   } catch (error) {
    const diagnostics = await evaluate(
      sharedReportClient,
      `(() => {
        const text = document.body.textContent || "";
        const gate = document.querySelector('[data-testid="shared-report-leadership-gate"]');
        const cover = document.querySelector('[data-testid="shared-report-executive-cover"]');
        const coverTrustDecision = cover?.querySelector('[data-testid="shared-report-executive-cover-trust-decision"]');
        const proofBasis = gate?.querySelector('[data-testid="shared-report-proof-basis"]');
        const proofBasisItems = [...(proofBasis?.querySelectorAll('[data-testid="shared-report-proof-basis-item"]') ?? [])];
        const coverMetrics = [...(cover?.querySelectorAll('[data-testid="shared-report-executive-cover-metric"]') ?? [])];
        const holdPanel = document.querySelector('[data-testid="shared-report-leadership-hold-panel"]');
        const kpiCards = [...document.querySelectorAll('[data-testid="shared-report-kpi-card"]')].map((card) => ({
          label: card.querySelector('[data-testid="shared-report-kpi-label"]')?.textContent,
          value: card.querySelector('[data-testid="shared-report-kpi-value"]')?.textContent,
          detail: card.querySelector('[data-testid="shared-report-kpi-detail"]')?.textContent,
        }));
        const trustRows = [...document.querySelectorAll('[data-testid="shared-report-trust-label"]')].map((label) => {
          const row = label.closest("article");
          return {
            label: label.textContent,
            value: row?.querySelector('[data-testid="shared-report-trust-value"]')?.textContent,
            detail: row?.querySelector('[data-testid="shared-report-trust-detail"]')?.textContent,
          };
        });
        return JSON.stringify({
          href: location.href,
          expectedState: ${JSON.stringify(expectedState)},
          expectedLabel: ${JSON.stringify(expectedLabel)},
          expectedDetail: ${JSON.stringify(expectedDetail)},
          readyState: document.readyState,
          hasCover: Boolean(cover),
          coverMode: cover?.getAttribute("data-cover-mode") ?? null,
          leadershipState: gate?.getAttribute("data-leadership-state") ?? null,
          gateText: (gate?.textContent || "").replace(/\\s+/g, " ").slice(0, 600),
          proofBasisText: (proofBasis?.textContent || "").replace(/\\s+/g, " ").slice(0, 400),
          proofBasisItems: proofBasisItems.map((item) => ({
            key: item.getAttribute("data-proof-basis-key"),
            text: (item.textContent || "").replace(/\\s+/g, " ").slice(0, 120),
          })),
          coverTrustState: coverTrustDecision?.getAttribute("data-cover-trust-state") ?? null,
          coverTrustText: (coverTrustDecision?.textContent || "").replace(/\\s+/g, " ").slice(0, 600),
          holdPanelText: (holdPanel?.textContent || "").replace(/\\s+/g, " ").slice(0, 600),
          coverMetrics: coverMetrics.map((metric) => ({
            source: metric.getAttribute("data-cover-metric-source"),
            key: metric.getAttribute("data-cover-metric-key"),
            text: (metric.textContent || "").replace(/\\s+/g, " ").slice(0, 240),
          })),
          kpiCards,
          trustRows,
          hasExecutiveSummary: text.includes("Executive summary"),
          hasChannelStory: text.includes("Channel story"),
          hasCreatorPerformance: text.includes("Creator Performance"),
          hasNoChartData: text.includes("No chart data yet"),
        });
      })()`,
    ).catch((diagnosticError) => `diagnostic unavailable: ${diagnosticError.message}`);
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}\nShared report leadership gate diagnostics: ${diagnostics}`,
    );
  }

  if (sharedReportScreenshotPath) {
    await captureScreenshot(sharedReportClient, sharedReportScreenshotPath, {
      captureBeyondViewport: true,
    });
  }

  return sharedReportUrl;
}

function validateReportExportUiSmoke({
  job,
  artifactText,
  consoleErrors,
  modeContract,
}: {
  job: ReportExportJobRow;
  artifactText: string;
  consoleErrors: string[];
  modeContract: ReportExportModeContract;
}) {
  if (job.format !== EXPORT_FORMAT) {
    throw new Error(`Expected ${EXPORT_FORMAT} export job, received ${job.format}.`);
  }

  if (job.status !== "completed") {
    throw new Error(`Expected completed export job, received ${job.status}.`);
  }

  if (job.storage_bucket !== "report-exports" || !job.storage_path) {
    throw new Error("UI-triggered export did not persist a report-exports artifact.");
  }

  if (!job.file_name?.includes(CUSTOM_REPORT_FILE_SLUG)) {
    throw new Error(
      `UI-triggered export file name did not use the custom report title: ${job.file_name ?? "missing file name"}.`,
    );
  }

  assertReportExportUiArtifact(artifactText, modeContract);

  if (consoleErrors.length > 0) {
    throw new Error(`Console errors found: ${consoleErrors.join(" | ")}`);
  }

  return { ok: true };
}

async function renderReportExportArtifact({
  artifactText,
  client,
  modeContract,
}: {
  artifactText: string;
  client: Awaited<ReturnType<typeof createCdpPage>>;
  modeContract: ReportExportModeContract;
}) {
  await navigate(
    client,
    `data:text/html;charset=utf-8,${encodeURIComponent(artifactText)}`,
  );
  await waitForExpression(
    client,
    `(() => {
      const story = document.querySelector('.report-story[data-report-chart-mode="${modeContract.chartMode}"]');
      const header = document.querySelector(".topbar");
      const campaignVisualImage = document.querySelector(".campaign-visual img");
      const main = document.querySelector("main");
      if (!story || !header || !main) return false;

      const storyRect = story.getBoundingClientRect();
      const headerRect = header.getBoundingClientRect();
      const mainRect = main.getBoundingClientRect();
      const imageStyle = campaignVisualImage ? getComputedStyle(campaignVisualImage) : null;
      const text = document.body.textContent || "";

      return document.readyState === "complete"
        && headerRect.width >= 700
        && headerRect.height >= 48
        && mainRect.width >= 700
        && mainRect.height >= 420
        && storyRect.width >= 600
        && storyRect.height >= 160
        && imageStyle?.objectFit === "contain"
        && imageStyle?.paddingBottom === "58px"
        && document.body.scrollHeight >= 760
        && text.includes("PopsDrops")
        && text.includes(${JSON.stringify(CUSTOM_REPORT_TITLE)})
        && text.includes(${JSON.stringify(REPORT_CAMPAIGN_VISUAL_TITLE)})
        && text.includes(${JSON.stringify(CUSTOM_EXECUTIVE_QUESTION)})
        && text.includes(${JSON.stringify(modeContract.outputTitle)})
        && text.includes(${JSON.stringify(modeContract.layoutTitle)})
        && text.includes(${JSON.stringify(modeContract.chartModeLabel)});
    })()`,
    `${modeContract.chartMode} rendered report export artifact`,
  );
  const renderedArtifactText = await evaluate(
    client,
    "document.body.innerText || document.body.textContent || ''",
  );
  assertNoCarelessReportCountLabels(
    renderedArtifactText,
    `${modeContract.chartMode} rendered report export artifact`,
  );
  await captureScreenshot(client, modeContract.visualScreenshotPath, {
    captureBeyondViewport: true,
  });

  return modeContract.visualScreenshotPath;
}

async function smokeConfiguredReportShareLink({
  brandReportUrl,
  client,
  consoleErrors,
  debugPort,
  sharedReportScreenshotPath,
}: {
  brandReportUrl: string;
  client: SmokeCdpPage;
  consoleErrors: string[];
  debugPort: number;
  sharedReportScreenshotPath: string;
}) {
  const expectedLabels = [
    CUSTOM_REPORT_TITLE,
    REPORT_CAMPAIGN_VISUAL_TITLE,
    CUSTOM_EXECUTIVE_QUESTION,
    ...Object.values(CUSTOM_REPORT_KPI_TILE_LABELS),
    CUSTOM_REPORT_SAVED_SECTION_LABELS.executive_summary,
    CUSTOM_REPORT_SAVED_SECTION_LABELS.channel_story,
    CUSTOM_REPORT_SAVED_SECTION_LABELS.recommendations,
    "Decision memo",
    "Recommended move",
    "Supporting evidence",
    "Shared campaign report",
    "Access expires",
  ];

  return withFreshSharedReportPage({
    consoleErrors,
    debugPort,
    run: async (sharedReportClient) => {
      const sharedReportUrl = await smokeSharedReportLeadershipGate({
        brandReportUrl,
        client,
        description: "configured shared campaign report leadership gate",
        expectedDetail: "Ready for leadership sharing.",
        expectedLabel: "Leadership-ready",
        expectedState: "ready",
        viewerClient: sharedReportClient,
      });
      const configuredCoverExpression = `(() => {
      const text = document.body.textContent || "";
      const cover = document.querySelector('[data-testid="shared-report-executive-cover"]');
      const coverText = cover?.textContent || "";
      const visual = cover?.querySelector('[data-testid="shared-report-executive-cover-visual"]');
      const image = cover?.querySelector('[data-testid="shared-report-executive-cover-image"]');
      const leadershipGate = cover?.querySelector('[data-testid="shared-report-leadership-gate"]');
      const coverTrustDecision = cover?.querySelector('[data-testid="shared-report-executive-cover-trust-decision"]');
      const coverTrustText = coverTrustDecision?.textContent || "";
      const expectedLabels = ${JSON.stringify(expectedLabels)};
      const defaultTitle = "Application Flow Smoke Campaign Report";
      const coverMetrics = [...(cover?.querySelectorAll('[data-testid="shared-report-executive-cover-metric"]') ?? [])];
      const checks = {
        readyComplete: document.readyState === "complete",
        hasBlockRegion: Boolean(document.querySelector('[data-testid="shared-report-block-region"]')),
        hasCover: Boolean(cover),
        coverMode: cover?.getAttribute("data-cover-mode") === "campaign_visual",
        typography: cover?.getAttribute("data-typography") === "compact",
        density: cover?.getAttribute("data-density") === "compact",
        metricCount: coverMetrics.length === 3,
        hasViewsMetric: coverMetrics.some((metric) => metric.getAttribute("data-cover-metric-source") === "kpi" && metric.getAttribute("data-cover-metric-key") === "views"),
        hasEngagementsMetric: coverMetrics.some((metric) => metric.getAttribute("data-cover-metric-source") === "kpi" && metric.getAttribute("data-cover-metric-key") === "engagements"),
        hasEvidenceMetric: coverMetrics.some((metric) => metric.getAttribute("data-cover-metric-source") === "trust" && metric.getAttribute("data-cover-metric-key") === "evidence_backed_reads"),
        visualIsCampaignImage: visual?.getAttribute("data-cover-source") === "campaign-image",
        imageLoaded: Boolean(image?.complete && image.naturalWidth > 0),
        imageAlt: image?.getAttribute("alt") === ${JSON.stringify(REPORT_CAMPAIGN_VISUAL_TITLE)},
        hasExecutiveQuestion: Boolean(cover?.querySelector('[data-testid="shared-report-executive-question"]')),
        leadershipReady: leadershipGate?.getAttribute("data-leadership-state") === "ready",
        leadershipLabel: (leadershipGate?.textContent || "").includes("Leadership-ready"),
        coverTrustReady: coverTrustDecision?.getAttribute("data-cover-trust-state") === "ready",
        trustDecisionText: coverTrustText.includes("Trust decision"),
        trustReadyLabel: coverTrustText.includes("Leadership-ready"),
        trustReadyDetail: coverTrustText.includes("Ready for leadership sharing."),
        hasKicker: coverText.includes("Global proof room"),
        hasWindow: coverText.includes("Report window"),
        hasQualifiedReach: coverText.includes("Qualified reach"),
        hasAudienceActions: coverText.includes("Audience actions"),
        hasProofCoverage: coverText.includes("Proof coverage"),
        noEvidenceStatus: !coverText.includes("Evidence status"),
        expectedLabels: expectedLabels.every((label) => text.includes(label)),
        defaultTitleAbsent: !text.includes(defaultTitle),
      };
      return Object.values(checks).every(Boolean);
    })()`;
      try {
        await waitForExpression(
          sharedReportClient,
          configuredCoverExpression,
          "configured shared campaign report executive cover",
          90000,
        );
      } catch (error) {
        const diagnostics = await evaluate(
          sharedReportClient,
          `(() => {
        const text = document.body.textContent || "";
        const visibleText = document.body.innerText || "";
        const cover = document.querySelector('[data-testid="shared-report-executive-cover"]');
        const coverText = cover?.textContent || "";
        const visual = cover?.querySelector('[data-testid="shared-report-executive-cover-visual"]');
        const image = cover?.querySelector('[data-testid="shared-report-executive-cover-image"]');
        const leadershipGate = cover?.querySelector('[data-testid="shared-report-leadership-gate"]');
        const coverTrustDecision = cover?.querySelector('[data-testid="shared-report-executive-cover-trust-decision"]');
        const expectedLabels = ${JSON.stringify(expectedLabels)};
        const defaultTitle = "Application Flow Smoke Campaign Report";
        const coverMetrics = [...(cover?.querySelectorAll('[data-testid="shared-report-executive-cover-metric"]') ?? [])];
        const checks = {
          readyComplete: document.readyState === "complete",
          hasBlockRegion: Boolean(document.querySelector('[data-testid="shared-report-block-region"]')),
          hasCover: Boolean(cover),
          coverMode: cover?.getAttribute("data-cover-mode") === "campaign_visual",
          typography: cover?.getAttribute("data-typography") === "compact",
          density: cover?.getAttribute("data-density") === "compact",
          metricCount: coverMetrics.length === 3,
          hasViewsMetric: coverMetrics.some((metric) => metric.getAttribute("data-cover-metric-source") === "kpi" && metric.getAttribute("data-cover-metric-key") === "views"),
          hasEngagementsMetric: coverMetrics.some((metric) => metric.getAttribute("data-cover-metric-source") === "kpi" && metric.getAttribute("data-cover-metric-key") === "engagements"),
          hasEvidenceMetric: coverMetrics.some((metric) => metric.getAttribute("data-cover-metric-source") === "trust" && metric.getAttribute("data-cover-metric-key") === "evidence_backed_reads"),
          visualIsCampaignImage: visual?.getAttribute("data-cover-source") === "campaign-image",
          imageLoaded: Boolean(image?.complete && image.naturalWidth > 0),
          imageAlt: image?.getAttribute("alt") === ${JSON.stringify(REPORT_CAMPAIGN_VISUAL_TITLE)},
          hasExecutiveQuestion: Boolean(cover?.querySelector('[data-testid="shared-report-executive-question"]')),
          leadershipReady: leadershipGate?.getAttribute("data-leadership-state") === "ready",
          leadershipLabel: (leadershipGate?.textContent || "").includes("Leadership-ready"),
          coverTrustReady: coverTrustDecision?.getAttribute("data-cover-trust-state") === "ready",
          trustDecisionText: (coverTrustDecision?.textContent || "").includes("Trust decision"),
          trustReadyLabel: (coverTrustDecision?.textContent || "").includes("Leadership-ready"),
          trustReadyDetail: (coverTrustDecision?.textContent || "").includes("Ready for leadership sharing."),
          hasKicker: coverText.includes("Global proof room"),
          hasWindow: coverText.includes("Report window"),
          hasQualifiedReach: coverText.includes("Qualified reach"),
          hasAudienceActions: coverText.includes("Audience actions"),
          hasProofCoverage: coverText.includes("Proof coverage"),
          noEvidenceStatus: !coverText.includes("Evidence status"),
          expectedLabels: expectedLabels.every((label) => text.includes(label)),
          defaultTitleAbsent: !text.includes(defaultTitle),
        };
        return JSON.stringify({
          href: location.href,
          readyState: document.readyState,
          hasBlockRegion: Boolean(document.querySelector('[data-testid="shared-report-block-region"]')),
          hasCover: Boolean(cover),
          coverMode: cover?.getAttribute("data-cover-mode") ?? null,
          typography: cover?.getAttribute("data-typography") ?? null,
          density: cover?.getAttribute("data-density") ?? null,
          coverText: coverText.replace(/\\s+/g, " ").slice(0, 1200),
          missingLabels: expectedLabels.filter((label) => !text.includes(label)),
          visibleMissingLabels: expectedLabels.filter((label) => !visibleText.includes(label)),
          failedChecks: Object.entries(checks).filter(([, passed]) => !passed).map(([key]) => key),
          checks,
          metricCount: coverMetrics.length,
          metrics: coverMetrics.map((metric) => ({
            source: metric.getAttribute("data-cover-metric-source"),
            key: metric.getAttribute("data-cover-metric-key"),
            text: (metric.textContent || "").replace(/\\s+/g, " ").slice(0, 240),
          })),
          visualSource: visual?.getAttribute("data-cover-source") ?? null,
          image: image ? {
            alt: image.getAttribute("alt"),
            complete: image.complete,
            naturalWidth: image.naturalWidth,
            naturalHeight: image.naturalHeight,
            src: image.getAttribute("src"),
          } : null,
          leadershipState: leadershipGate?.getAttribute("data-leadership-state") ?? null,
          leadershipText: (leadershipGate?.textContent || "").replace(/\\s+/g, " ").slice(0, 600),
          coverTrustState: coverTrustDecision?.getAttribute("data-cover-trust-state") ?? null,
          defaultTitlePresent: text.includes("Application Flow Smoke Campaign Report"),
        });
      })()`,
        ).catch((diagnosticError) => `diagnostic unavailable: ${diagnosticError.message}`);
        throw new Error(
          `${error instanceof Error ? error.message : String(error)}\nShared report cover diagnostics: ${diagnostics}`,
        );
      }
      await waitForExpression(
        sharedReportClient,
        `(() => {
      const gate = document.querySelector('[data-testid="shared-report-leadership-gate"]');
      return gate?.getAttribute("data-leadership-state") === "ready"
        && (gate?.textContent || "").includes("Leadership-ready");
    })()`,
        "configured shared campaign report leadership gate",
        90000,
      );
      await waitForExpression(
        sharedReportClient,
        `(() => {
      const story = document.querySelector('[data-testid="shared-report-story-panel"][data-shared-report-story-mode="trend"]');
      const callout = story?.querySelector('[data-testid="shared-report-story-snapshot-callout"]');
      const text = callout?.textContent || "";
      return Boolean(callout)
        && text.includes("Snapshot read")
        && text.includes("12.0K")
        && text.includes("One verified read; use a snapshot until there is enough history for a trend.");
    })()`,
        "configured shared campaign report story snapshot",
        90000,
      );
      await captureScreenshot(sharedReportClient, sharedReportScreenshotPath, {
        captureBeyondViewport: true,
      });

      return sharedReportUrl;
    },
  });
}

async function checkedQuery<T>(
  label: string,
  query: PromiseLike<SupabaseQueryResult<T>>,
) {
  const { data, error } = await query;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

async function listExistingReportExportJobIds(
  admin: ReturnType<typeof createAdminClient>,
  campaignId: string,
) {
  const rows = await checkedQuery(
    "List existing report export jobs",
    admin.from("report_export_jobs").select("id").eq("campaign_id", campaignId),
  );

  return new Set((rows ?? []).map((row: { id: string }) => row.id));
}

async function waitForCompletedReportExportJob({
  admin,
  campaignId,
  client,
  excludedJobIds,
  timeoutMs = 90000,
}: {
  admin: ReturnType<typeof createAdminClient>;
  campaignId: string;
  client: SmokeCdpPage;
  excludedJobIds: Set<string>;
  timeoutMs?: number;
}) {
  const startedAt = Date.now();
  let lastRows: ReportExportJobRow[] = [];

  while (Date.now() - startedAt < timeoutMs) {
    const rows = await checkedQuery(
      "Find UI-triggered report export job",
      admin
        .from("report_export_jobs")
        .select(
          "id, campaign_id, format, status, storage_bucket, storage_path, file_name, mime_type, error_message, created_at",
        )
        .eq("campaign_id", campaignId)
        .eq("format", EXPORT_FORMAT)
        .order("created_at", { ascending: false })
        .limit(5),
    );
    lastRows = rows ?? [];

    const job = lastRows.find((row) => !excludedJobIds.has(row.id));
    if (job?.status === "completed") return job;
    if (job?.status === "failed") {
      throw new Error(job.error_message || "UI-triggered report export job failed.");
    }

    await assertNoVisibleStaleReportExportServiceError(client);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(
    `Timed out waiting for UI-triggered report export job. Last rows: ${JSON.stringify(lastRows)}`,
  );
}

async function assertNoVisibleStaleReportExportServiceError(client: SmokeCdpPage) {
  const bodyText = await evaluate(
    client,
    "document.body.innerText || document.body.textContent || ''",
  );

  if (bodyText.includes(REPORT_EXPORT_STALE_SERVICE_ERROR)) {
    throw new Error(
      `${REPORT_EXPORT_STALE_SERVICE_ERROR} The UI blocked the stale export path before download; deploy Supabase generate-report and rerun this smoke.`,
    );
  }
}

async function downloadReportExportArtifact({
  admin,
  job,
}: {
  admin: ReturnType<typeof createAdminClient>;
  job: ReportExportJobRow;
}) {
  if (!job.storage_path) {
    throw new Error("UI-triggered report export job is missing a storage path.");
  }

  const { data, error } = await admin.storage
    .from("report-exports")
    .download(job.storage_path);
  if (error || !data) {
    throw new Error(
      `Download UI-triggered report export artifact: ${error?.message ?? "missing file"}`,
    );
  }

  return data.text();
}

function isEnabledHtmlReportExportItem(label = EXPORT_LABEL) {
  return `(() => {
    const item = [...document.querySelectorAll('[role="menuitem"]')]
      .find((item) => item.textContent?.includes(${JSON.stringify(label)})
        && !item.hasAttribute("data-disabled")
        && item.getAttribute("aria-disabled") !== "true");
    return Boolean(item);
  })()`;
}

async function clickHtmlReportExport(client: Awaited<ReturnType<typeof createCdpPage>>) {
  await waitForExpression(
    client,
    'Boolean(document.querySelector(\'[data-testid="report-export-menu"]\'))',
    "report export menu button",
  );
  await evaluate(
    client,
    `(() => {
      const trigger = document.querySelector('[data-testid="report-export-menu"]');
      if (!trigger) throw new Error("Missing report export menu");
      trigger.click();
      return true;
    })()`,
  );
  await waitForExpression(
    client,
    isEnabledHtmlReportExportItem(),
    "enabled HTML report export menu item",
  );
  await evaluate(
    client,
    `(() => {
      const item = [...document.querySelectorAll('[role="menuitem"]')]
        .find((item) => item.textContent?.includes(${JSON.stringify(EXPORT_LABEL)})
          && !item.hasAttribute("data-disabled")
          && item.getAttribute("aria-disabled") !== "true");
      if (!item) throw new Error("Missing enabled ${EXPORT_LABEL}");
      item.click();
      return true;
    })()`,
  );
}

async function enableReportDownloads({
  client,
  downloadDir,
}: {
  client: Awaited<ReturnType<typeof createCdpPage>>;
  downloadDir: string;
}) {
  try {
    await client.send("Browser.setDownloadBehavior", {
      behavior: "allow",
      downloadPath: downloadDir,
    });
  } catch {
    await client.send("Page.setDownloadBehavior", {
      behavior: "allow",
      downloadPath: downloadDir,
    });
  }
}

async function clickReportExportMenuItem({
  client,
  label,
}: {
  client: Awaited<ReturnType<typeof createCdpPage>>;
  label: string;
}) {
  await waitForExpression(
    client,
    'Boolean(document.querySelector(\'[data-testid="report-export-menu"]\'))',
    "report export menu button",
  );
  await evaluate(
    client,
    `(() => {
      const trigger = document.querySelector('[data-testid="report-export-menu"]');
      if (!trigger) throw new Error("Missing report export menu");
      trigger.scrollIntoView({ block: "center", inline: "center" });
      trigger.click();
      return true;
    })()`,
  );
  await waitForExpression(
    client,
    isEnabledHtmlReportExportItem(label),
    `enabled ${label} report export menu item`,
  );
  await evaluate(
    client,
    `(() => {
      const item = [...document.querySelectorAll('[role="menuitem"]')]
        .find((item) => item.textContent?.includes(${JSON.stringify(label)})
          && !item.hasAttribute("data-disabled")
          && item.getAttribute("aria-disabled") !== "true");
      if (!item) throw new Error("Missing enabled ${label}");
      item.click();
      return true;
    })()`,
  );
}

async function waitForDownloadedReport({
  description,
  downloadDir,
  extension,
  timeoutMs = 90000,
}: {
  description: string;
  downloadDir: string;
  extension: string;
  timeoutMs?: number;
}) {
  const startedAt = Date.now();
  const normalizedExtension = extension.toLowerCase();
  let lastFiles: string[] = [];

  while (Date.now() - startedAt < timeoutMs) {
    lastFiles = await readdir(downloadDir);
    const matchingFile = lastFiles.find((file) => {
      const lower = file.toLowerCase();
      return lower.endsWith(normalizedExtension) && !lower.endsWith(".crdownload");
    });

    if (matchingFile) {
      const filePath = path.join(downloadDir, matchingFile);
      const fileStat = await stat(filePath);
      if (fileStat.size > 1024) {
        return {
          bytes: fileStat.size,
          fileName: matchingFile,
          filePath,
        };
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  throw new Error(
    `Timed out waiting for ${description} download (${extension}). Last files: ${lastFiles.join(", ") || "none"}`,
  );
}

async function assertClientDownloadHasEmbeddedCampaignVisual({
  extension,
  filePath,
  label,
}: {
  extension: string;
  filePath: string;
  label: string;
}) {
  const file = await readFile(filePath);
  const binaryText = file.toString("latin1");

  if (extension === ".pdf" && !binaryText.includes("/Subtype /Image")) {
    throw new Error(`${label} download did not embed a campaign visual image.`);
  }

  if (extension === ".pptx" && !binaryText.includes("ppt/media/image")) {
    throw new Error(`${label} download did not embed a campaign visual image.`);
  }
}

async function readPowerPointSlideText(filePath: string): Promise<string> {
  const slideXmlPath = "ppt/slides/slide*.xml";
  const { stdout } = await execFileAsync("unzip", [
    "-p",
    filePath,
    slideXmlPath,
  ], {
    maxBuffer: 12 * 1024 * 1024,
  });

  return String(stdout);
}

async function assertPowerPointBodySlidesCarryProofStory({
  filePath,
  label,
}: {
  filePath: string;
  label: string;
}) {
  const slideText = await readPowerPointSlideText(filePath);
  const requiredBodyStory = [
    CUSTOM_REPORT_TITLE,
    CUSTOM_EXECUTIVE_QUESTION,
    "Decision read",
    "Evidence trail",
    "Next action",
    "Trust decision",
    "Ready for leadership sharing.",
  ];

  for (const phrase of requiredBodyStory) {
    if (!slideText.includes(phrase)) {
      throw new Error(`${label} body slides are missing ${phrase}.`);
    }
  }

  assertDownloadTextCarriesCustomReportLabels(slideText, label);
}

function describeCommandError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function resolvePdfTextPythonCandidates(): string[] {
  const bundledCodexPython = path.resolve(
    path.dirname(process.execPath),
    "..",
    "..",
    "python",
    "bin",
    "python3",
  );
  const candidates = [
    process.env.POPSDROPS_PDF_TEXT_PYTHON,
    process.env.PYTHON,
    bundledCodexPython,
    "python3",
  ].filter((candidate): candidate is string => Boolean(candidate));

  return [...new Set(candidates)];
}

async function readPdfTextWithPythonFallback(filePath: string): Promise<string> {
  const pythonExtractor = `
import sys

try:
    from pypdf import PdfReader
except Exception as exc:
    raise SystemExit(f"pypdf unavailable: {exc}")

reader = PdfReader(sys.argv[1])
pages = []
for page in reader.pages:
    pages.append(page.extract_text() or "")

sys.stdout.write("\\n".join(pages))
`;
  const errors: string[] = [];

  for (const pythonCandidate of resolvePdfTextPythonCandidates()) {
    try {
      const { stdout } = await execFileAsync(pythonCandidate, [
        "-c",
        pythonExtractor,
        filePath,
      ], {
        maxBuffer: 12 * 1024 * 1024,
      });
      const text = String(stdout);
      if (text.trim()) return text;
      errors.push(`${pythonCandidate}: extracted no text`);
    } catch (error) {
      errors.push(`${pythonCandidate}: ${describeCommandError(error)}`);
    }
  }

  throw new Error(
    `Unable to extract PDF text with Python fallback. ${errors.join(" | ")}`,
  );
}

async function readPdfTextWithStringsFallback(filePath: string): Promise<string> {
  const { stdout } = await execFileAsync("strings", [filePath], {
    maxBuffer: 12 * 1024 * 1024,
  });
  const text = String(stdout);
  if (text.trim()) return text;

  throw new Error("strings extracted no PDF text.");
}

async function readPdfText(filePath: string): Promise<string> {
  const errors: string[] = [];

  try {
    const { stdout } = await execFileAsync("pdftotext", [
      "-layout",
      filePath,
      "-",
    ], {
      maxBuffer: 12 * 1024 * 1024,
    });
    const text = String(stdout);
    if (text.trim()) return text;
    errors.push("pdftotext extracted no text");
  } catch (error) {
    errors.push(`pdftotext: ${describeCommandError(error)}`);
  }

  try {
    return await readPdfTextWithPythonFallback(filePath);
  } catch (error) {
    errors.push(`python fallback: ${describeCommandError(error)}`);
  }

  try {
    return await readPdfTextWithStringsFallback(filePath);
  } catch (error) {
    errors.push(`strings fallback: ${describeCommandError(error)}`);
  }

  throw new Error(`Unable to extract PDF text. ${errors.join(" | ")}`);
}

async function assertPdfDownloadCarriesProofStory({
  filePath,
  label,
}: {
  filePath: string;
  label: string;
}) {
  const pdfText = await readPdfText(filePath);
  const requiredBodyStory = [
    CUSTOM_REPORT_TITLE,
    CUSTOM_EXECUTIVE_QUESTION,
    "Decision read",
    "Evidence trail",
    "Next action",
    "Trust decision",
    "Ready for leadership sharing.",
  ];

  for (const phrase of requiredBodyStory) {
    if (!pdfText.includes(phrase)) {
      throw new Error(`${label} body pages are missing ${phrase}.`);
    }
  }

  assertDownloadTextCarriesCustomReportLabels(pdfText, label);
}

function assertDownloadTextCarriesCustomReportLabels(text: string, label: string) {
  assertNoCarelessReportCountLabels(text, label);

  if (!text.includes(REPORT_CAMPAIGN_VISUAL_TITLE)) {
    throw new Error(`${label} downloaded report is missing campaign image caption.`);
  }

  for (const customLabel of Object.values(CUSTOM_REPORT_KPI_TILE_LABELS)) {
    if (!text.includes(customLabel)) {
      throw new Error(`${label} downloaded report is missing custom KPI label ${customLabel}.`);
    }
  }

  for (const customLabel of Object.values(CUSTOM_REPORT_TRUST_TILE_LABELS)) {
    if (!text.includes(customLabel)) {
      throw new Error(`${label} downloaded report is missing custom trust label ${customLabel}.`);
    }
  }

  for (const legacyLabel of ["Report status", "Verified reads", "Reports received"]) {
    if (text.includes(legacyLabel)) {
      throw new Error(`${label} downloaded report still includes legacy trust label ${legacyLabel}.`);
    }
  }

  for (const internalLabel of ["Team template", TEMPLATE_NAME_PREFIX]) {
    if (text.includes(internalLabel)) {
      throw new Error(`${label} downloaded report still includes internal report plan label ${internalLabel}.`);
    }
  }

  if (text.includes("not reviewed") || text.includes("Not reviewed")) {
    throw new Error(`${label} downloaded report still says reviewed proof is not reviewed.`);
  }
}

async function assertRenderedDownloadPreview({
  label,
  previewScreenshotPath,
}: {
  label: string;
  previewScreenshotPath: string;
}) {
  const preview = await stat(previewScreenshotPath);
  if (preview.size < MIN_RENDERED_EXPORT_PREVIEW_BYTES) {
    throw new Error(
      `${label} preview render is too small to be useful: ${preview.size} bytes.`,
    );
  }
}

async function renderDownloadPreviewWithQuickLook({
  filePath,
  label,
  previewScreenshotPath,
  tempPrefix,
}: {
  filePath: string;
  label: string;
  previewScreenshotPath: string;
  tempPrefix: string;
}) {
  const quickLookDir = await mkdtemp(path.join(tmpdir(), tempPrefix));

  try {
    await execFileAsync("qlmanage", [
      "-t",
      "-s",
      "1600",
      "-o",
      quickLookDir,
      filePath,
    ]);
    const generatedPreviewPath = path.join(
      quickLookDir,
      `${path.basename(filePath)}.png`,
    );
    await copyFile(generatedPreviewPath, previewScreenshotPath);
    await assertRenderedDownloadPreview({ label, previewScreenshotPath });
    return previewScreenshotPath;
  } finally {
    await rm(quickLookDir, {
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 100,
    });
  }
}

async function renderPdfDownloadPreview({
  filePath,
  label,
  previewScreenshotPath,
}: {
  filePath: string;
  label: string;
  previewScreenshotPath: string;
}) {
  const errors: string[] = [];
  const outputPrefix = previewScreenshotPath.replace(/\.png$/i, "");

  try {
    await execFileAsync("pdftoppm", [
      "-f",
      "1",
      "-singlefile",
      "-png",
      "-r",
      "144",
      filePath,
      outputPrefix,
    ]);
    await assertRenderedDownloadPreview({ label, previewScreenshotPath });
    return previewScreenshotPath;
  } catch (error) {
    errors.push(`pdftoppm: ${describeCommandError(error)}`);
  }

  try {
    return await renderDownloadPreviewWithQuickLook({
      filePath,
      label,
      previewScreenshotPath,
      tempPrefix: "popsdrops-report-pdf-preview-",
    });
  } catch (error) {
    errors.push(`qlmanage: ${describeCommandError(error)}`);
  }

  throw new Error(`Unable to render ${label} preview. ${errors.join(" | ")}`);
}

async function renderClientDownloadPreview({
  extension,
  filePath,
  label,
  previewScreenshotPath,
}: {
  extension: string;
  filePath: string;
  label: string;
  previewScreenshotPath: string;
}) {
  await mkdir(path.dirname(previewScreenshotPath), { recursive: true });
  await rm(previewScreenshotPath, { force: true });

  if (extension === ".pdf") {
    return renderPdfDownloadPreview({
      filePath,
      label,
      previewScreenshotPath,
    });
  }

  if (extension === ".pptx") {
    return renderDownloadPreviewWithQuickLook({
      filePath,
      label,
      previewScreenshotPath,
      tempPrefix: "popsdrops-report-pptx-preview-",
    });
  }

  throw new Error(`No report preview renderer configured for ${extension}.`);
}

async function smokeClientDownloadExport({
  client,
  downloadDir,
  extension,
  label,
  previewScreenshotPath,
}: {
  client: Awaited<ReturnType<typeof createCdpPage>>;
  downloadDir: string;
  extension: string;
  label: string;
  previewScreenshotPath: string;
}) {
  await clickReportExportMenuItem({ client, label });
  const download = await waitForDownloadedReport({
    description: label,
    downloadDir,
    extension,
  });
  if (!download.fileName.includes(CUSTOM_REPORT_FILE_SLUG)) {
    throw new Error(
      `${label} download file name did not use the custom report title: ${download.fileName}.`,
    );
  }
  await assertClientDownloadHasEmbeddedCampaignVisual({
    extension,
    filePath: download.filePath,
    label,
  });
  if (extension === ".pdf") {
    await assertPdfDownloadCarriesProofStory({
      filePath: download.filePath,
      label,
    });
  }
  if (extension === ".pptx") {
    await assertPowerPointBodySlidesCarryProofStory({
      filePath: download.filePath,
      label,
    });
  }
  const renderedPreviewPath = await renderClientDownloadPreview({
    extension,
    filePath: download.filePath,
    label,
    previewScreenshotPath,
  });

  return {
    ...download,
    extension,
    label,
    previewScreenshotPath: renderedPreviewPath,
  };
}

async function assertReportBuilderExecutiveFraming({
  client,
}: {
  client: Awaited<ReturnType<typeof createCdpPage>>;
}) {
      await waitForExpression(
        client,
    `Boolean(document.querySelector('[data-testid="report-builder-framing"]'))`,
    "report builder executive framing controls",
  );
  await evaluate(
    client,
    `(() => {
      const setControlValue = (node, value) => {
        const proto = node instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
        setter?.call(node, value);
        node.dispatchEvent(new Event("input", { bubbles: true }));
        node.dispatchEvent(new Event("change", { bubbles: true }));
      };
      const headline = document.querySelector('[data-testid="report-builder-headline"]');
      const question = document.querySelector('[data-testid="report-builder-executive-question"]');
      if (!headline || !question) throw new Error("Missing report builder executive framing inputs");
      headline.scrollIntoView({ block: "center", inline: "center" });
      setControlValue(headline, ${JSON.stringify(CUSTOM_REPORT_TITLE)});
      setControlValue(question, ${JSON.stringify(CUSTOM_EXECUTIVE_QUESTION)});
      return true;
    })()`,
  );
  await waitForExpression(
    client,
    `(() => {
      const headline = document.querySelector('[data-testid="report-builder-headline"]');
      const question = document.querySelector('[data-testid="report-builder-executive-question"]');
      const strip = document.querySelector('[data-testid="report-builder-story-strip"]');
      const cover = document.querySelector('[data-testid="report-executive-cover"]');
      const stripText = strip?.textContent || "";
      const coverText = cover?.textContent || "";

      return headline?.value === ${JSON.stringify(CUSTOM_REPORT_TITLE)}
        && question?.value === ${JSON.stringify(CUSTOM_EXECUTIVE_QUESTION)}
        && stripText.includes(${JSON.stringify(CUSTOM_REPORT_TITLE)})
        && stripText.includes(${JSON.stringify(CUSTOM_EXECUTIVE_QUESTION)})
        && coverText.includes(${JSON.stringify(CUSTOM_REPORT_TITLE)})
        && !coverText.includes("Application Flow Smoke Campaign Report");
    })()`,
    "report builder executive framing preview",
  );
}

async function selectReportBuilderTileSet({
  client,
  expectedIds,
  tileTestId,
}: {
  client: Awaited<ReturnType<typeof createCdpPage>>;
  expectedIds: readonly string[];
  tileTestId: "report-builder-kpi-tile" | "report-builder-trust-tile";
}) {
  await waitForExpression(
    client,
    `Boolean(document.querySelector('[data-testid="report-builder-tile-controls"]'))`,
    "report builder executive tile controls",
  );

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const nextMismatch = await evaluate(
      client,
      `(() => {
        const expected = new Set(${JSON.stringify(expectedIds)});
        const buttons = [...document.querySelectorAll('[data-testid="${tileTestId}"]')];
        if (buttons.length === 0) throw new Error("Missing ${tileTestId} controls");
        buttons[0]?.scrollIntoView({ block: "center", inline: "center" });
        const mismatch = buttons.find((button) => {
          const tileId = button.getAttribute("data-tile-id");
          const selected = button.getAttribute("aria-pressed") === "true";
          return selected !== Boolean(tileId && expected.has(tileId));
        });
        return mismatch?.getAttribute("data-tile-id") ?? null;
      })()`,
    );

    if (!nextMismatch) break;

    await evaluate(
      client,
      `(() => {
        const button = document.querySelector('[data-testid="${tileTestId}"][data-tile-id=${JSON.stringify(nextMismatch)}]');
        if (!button) throw new Error("Missing ${tileTestId} ${nextMismatch}");
        button.scrollIntoView({ block: "center", inline: "center" });
        button.click();
        return true;
      })()`,
    );
    await waitForExpression(
      client,
      `(() => {
        const expected = new Set(${JSON.stringify(expectedIds)});
        const button = document.querySelector('[data-testid="${tileTestId}"][data-tile-id=${JSON.stringify(nextMismatch)}]');
        const selected = button?.getAttribute("aria-pressed") === "true";
        return selected === expected.has(${JSON.stringify(nextMismatch)});
      })()`,
      `${tileTestId} ${nextMismatch} selected state`,
    );
  }

  await waitForExpression(
    client,
    `(() => {
      const expected = new Set(${JSON.stringify(expectedIds)});
      const buttons = [...document.querySelectorAll('[data-testid="${tileTestId}"]')];
      if (buttons.length === 0) return false;
      return buttons.every((button) => {
        const tileId = button.getAttribute("data-tile-id");
        const selected = button.getAttribute("aria-pressed") === "true";
        return selected === Boolean(tileId && expected.has(tileId));
      });
    })()`,
    `${tileTestId} selected tile state`,
  );
}

async function assertReportBuilderTilePreview({
  client,
}: {
  client: Awaited<ReturnType<typeof createCdpPage>>;
}) {
  await waitForExpression(
    client,
    `(() => {
      const contract = document.querySelector('[data-testid="report-output-contract"]');
      const metricStrip = document.querySelector('[data-testid="report-metric-strip"]');
      const trustStrip = document.querySelector('[data-testid="report-trust-strip"]');
      const cover = document.querySelector('[data-testid="report-executive-cover"]');
      const contractText = contract?.textContent || "";
      const metricText = metricStrip?.textContent || "";
      const trustText = trustStrip?.textContent || "";
      const coverText = cover?.textContent || "";
      const coverMetrics = [...(cover?.querySelectorAll('[data-testid="report-executive-cover-metric"]') ?? [])];

      return contractText.includes("KPI tiles")
        && contractText.includes("Proof tiles")
        && contractText.includes("Efficiency signal")
        && contractText.includes("Metric origin")
        && metricText.includes("Qualified reach")
        && metricText.includes("Audience actions")
        && metricText.includes("Efficiency signal")
        && !metricText.includes("Reports received")
        && trustText.includes("Proof coverage")
        && trustText.includes("Read window")
        && trustText.includes("Metric origin")
        && !trustText.includes("Report status")
        && !trustText.includes("Verified reads")
        && coverText.includes("Qualified reach")
        && coverText.includes("Audience actions")
        && coverText.includes("Proof coverage")
        && !coverText.includes("Evidence status")
        && coverMetrics.some((metric) => metric.getAttribute("data-cover-metric-source") === "kpi" && metric.getAttribute("data-cover-metric-key") === "views")
        && coverMetrics.some((metric) => metric.getAttribute("data-cover-metric-source") === "kpi" && metric.getAttribute("data-cover-metric-key") === "engagements")
        && coverMetrics.some((metric) => metric.getAttribute("data-cover-metric-source") === "trust" && metric.getAttribute("data-cover-metric-key") === "evidence_backed_reads");
    })()`,
    "report builder selected tile preview",
  );
}

async function selectReportBuilderTileLabels({
  client,
}: {
  client: Awaited<ReturnType<typeof createCdpPage>>;
}) {
  await waitForExpression(
    client,
    `Boolean(document.querySelector('[data-testid="report-builder-kpi-tile-label"]')) && Boolean(document.querySelector('[data-testid="report-builder-trust-tile-label"]'))`,
    "report builder tile label controls",
  );
  await evaluate(
    client,
    `(() => {
      const kpiLabels = ${JSON.stringify(CUSTOM_REPORT_KPI_TILE_LABELS)};
      const trustLabels = ${JSON.stringify(CUSTOM_REPORT_TRUST_TILE_LABELS)};
      const setControlValue = (node, value) => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        setter?.call(node, value);
        node.dispatchEvent(new Event("input", { bubbles: true }));
        node.dispatchEvent(new Event("change", { bubbles: true }));
      };
      const applyLabels = (testId, labels) => {
        const inputs = [...document.querySelectorAll('[data-testid="' + testId + '"]')];
        if (inputs.length === 0) throw new Error("Missing " + testId + " inputs");
        inputs[0]?.scrollIntoView({ block: "center", inline: "center" });
        for (const input of inputs) {
          const tileId = input.getAttribute("data-tile-id");
          const label = tileId ? labels[tileId] : null;
          if (label) setControlValue(input, label);
        }
      };
      applyLabels("report-builder-kpi-tile-label", kpiLabels);
      applyLabels("report-builder-trust-tile-label", trustLabels);
      return true;
    })()`,
  );
  await waitForExpression(
    client,
    `(() => {
      const kpiLabels = ${JSON.stringify(CUSTOM_REPORT_KPI_TILE_LABELS)};
      const trustLabels = ${JSON.stringify(CUSTOM_REPORT_TRUST_TILE_LABELS)};
      const metricStrip = document.querySelector('[data-testid="report-metric-strip"]');
      const trustStrip = document.querySelector('[data-testid="report-trust-strip"]');
      const metricText = metricStrip?.textContent || "";
      const trustText = trustStrip?.textContent || "";
      const contractText = document.querySelector('[data-testid="report-output-contract"]')?.textContent || "";
      const allInputsMatch = (testId, labels) => [...document.querySelectorAll('[data-testid="' + testId + '"]')].every((input) => {
        const tileId = input.getAttribute("data-tile-id");
        const expected = tileId ? labels[tileId] : null;
        return !expected || input.value === expected;
      });

      return allInputsMatch("report-builder-kpi-tile-label", kpiLabels)
        && allInputsMatch("report-builder-trust-tile-label", trustLabels)
        && Object.values(kpiLabels).every((label) => contractText.includes(label) && (!metricStrip || metricText.includes(label)))
        && Object.values(trustLabels).every((label) => contractText.includes(label) && (!trustStrip || trustText.includes(label)));
    })()`,
    "report builder tile label preview",
  );
}

async function selectReportBuilderSectionLabels({
  client,
}: {
  client: Awaited<ReturnType<typeof createCdpPage>>;
}) {
  await waitForExpression(
    client,
    `Boolean(document.querySelector('[data-testid="report-builder-section-labels"]'))`,
    "report builder section label controls",
  );
  await evaluate(
    client,
    `(() => {
      const labels = ${JSON.stringify(CUSTOM_REPORT_SECTION_LABELS)};
      const setControlValue = (node, value) => {
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        setter?.call(node, value);
        node.dispatchEvent(new Event("input", { bubbles: true }));
        node.dispatchEvent(new Event("change", { bubbles: true }));
      };
      const inputs = [...document.querySelectorAll('[data-testid="report-builder-section-label"]')];
      if (inputs.length === 0) throw new Error("Missing report builder section label inputs");
      inputs[0]?.scrollIntoView({ block: "center", inline: "center" });
      for (const input of inputs) {
        const blockId = input.getAttribute("data-block-id");
        const label = blockId ? labels[blockId] : null;
        if (label) setControlValue(input, label);
      }
      return true;
    })()`,
  );
  await waitForExpression(
    client,
    `(() => {
      const labels = ${JSON.stringify(CUSTOM_REPORT_SECTION_LABELS)};
      const inputs = [...document.querySelectorAll('[data-testid="report-builder-section-label"]')];
      const orderText = document.querySelector('[data-testid="report-builder-block-order"]')?.textContent || "";
      const contractText = document.querySelector('[data-testid="report-output-contract"]')?.textContent || "";
      return inputs.length > 0 && inputs.every((input) => {
        const blockId = input.getAttribute("data-block-id");
        const expected = blockId ? labels[blockId] : null;
        return !expected || input.value === expected;
      }) && inputs.every((input) => {
        const blockId = input.getAttribute("data-block-id");
        const expected = blockId ? labels[blockId] : null;
        return !expected || (orderText.includes(expected) && contractText.includes(expected));
      });
    })()`,
    "report builder section label preview",
  );
}

async function assertReportBuilderStoryStrip({
  client,
}: {
  client: Awaited<ReturnType<typeof createCdpPage>>;
}) {
  const storyInspection = `
      const layout = document.querySelector('[data-testid="report-builder-layout"]');
      const controls = document.querySelector('[data-testid="report-builder-control-panel"]');
      const preview = document.querySelector('[data-testid="report-builder-preview-panel"]');
      const templateStrip = document.querySelector('[data-testid="report-builder-template-strip"]');
      const promise = document.querySelector('[data-testid="report-builder-reader-promise"]');
      const strip = document.querySelector('[data-testid="report-builder-story-strip"]');
      const contract = strip?.querySelector('[data-testid="report-builder-export-contract"]');
      const text = strip.textContent || "";
      const promiseText = promise?.textContent || "";
      const controlText = controls?.textContent || "";
      const previewText = preview?.textContent || "";
      const promiseItems = [...(promise?.querySelectorAll('[data-testid="report-builder-reader-promise-item"]') ?? [])];
      const promiseItemKeys = promiseItems.map((item) => item.getAttribute("data-promise-item"));
      const steps = [...(strip?.querySelectorAll('[data-testid="report-builder-story-step"]') ?? [])];
      const contractItems = [...(contract?.querySelectorAll('[data-testid="report-builder-contract-item"]') ?? [])];
      const stepIds = steps.map((step) => step.getAttribute("data-story-step"));
      const contractItemKeys = contractItems.map((item) => item.getAttribute("data-contract-item"));
      const contractText = contract?.textContent || "";

      const checks = {
        hasLayout: Boolean(layout),
        hasControls: Boolean(controls),
        hasPreview: Boolean(preview),
        hasTemplateStrip: Boolean(templateStrip),
        hasPromise: Boolean(promise),
        hasStrip: Boolean(strip),
        promiseItemCount: promiseItems.length === 3,
        hasStoryPromise: promiseItemKeys.includes("story"),
        hasProofPromise: promiseItemKeys.includes("proof"),
        hasArtifactPromise: promiseItemKeys.includes("artifact"),
        stepCount: steps.length === 4,
        hasDecisionStep: stepIds.includes("decision"),
        hasEvidenceStep: stepIds.includes("evidence"),
        hasPresentationStep: stepIds.includes("presentation"),
        hasOrderStep: stepIds.includes("order"),
        hasContract: Boolean(contract),
        contractItemCount: contractItems.length === 4,
        hasLeadMetricContract: contractItemKeys.includes("lead-metric"),
        hasTrustGateContract: contractItemKeys.includes("trust-gate"),
        hasBlockSequenceContract: contractItemKeys.includes("block-sequence"),
        hasLeadershipHandoffContract: contractItemKeys.includes("leadership-handoff"),
        controlBuildReport: controlText.includes("Build the report"),
        promiseReader: promiseText.includes("Reader promise"),
        promiseLeadershipStory: promiseText.includes("Leadership story"),
        promiseProofGate: promiseText.includes("Proof gate"),
        promiseExportArtifact: promiseText.includes("Export artifact"),
        promiseLeadershipReady: promiseText.includes("Ready for leadership sharing."),
        promiseCampaignVisual: promiseText.includes("Campaign visual"),
        previewSpine: previewText.includes("Preview spine"),
        stripExecutiveStory: text.includes("Executive story"),
        stripDecisionStory: text.includes("Decision story"),
        stripEvidenceView: text.includes("Evidence view"),
        stripExportStyle: text.includes("Export style"),
        stripStoryOrder: text.includes("Story order"),
        stripPreviewUpdates: text.includes("Output preview updates immediately."),
        stripTrustLocked: text.includes("Trust block locked"),
        contractLeadMetric: contractText.includes("Lead metric"),
        contractViews: contractText.includes("Views"),
        contractTrustDecision: contractText.includes("Trust decision"),
        contractLeadershipReady: contractText.includes("Ready for leadership sharing."),
        contractBlocks: contractText.includes("Blocks"),
        contractReportTrust: contractText.includes("Report trust") || contractText.includes(${JSON.stringify(CUSTOM_REPORT_SECTION_LABELS.report_trust)}),
        contractLeadershipHandoff: contractText.includes("Leadership handoff"),
        contractSaveShape: contractText.includes("Save the report shape, then exports and shared links carry this trust gate."),
      };
  `;
  const storyExpression = `(() => {
      ${storyInspection}
      return Object.values(checks).every(Boolean);
    })()`;

  try {
    await waitForExpression(
      client,
      storyExpression,
      "report builder executive story strip",
    );
  } catch (error) {
    const diagnostics = await evaluate(
      client,
      `(() => {
        ${storyInspection}
        return JSON.stringify({
          failedChecks: Object.entries(checks).filter(([, passed]) => !passed).map(([key]) => key),
          checks,
          promiseItemKeys,
          stepIds,
          contractItemKeys,
          controlText: controlText.replace(/\\s+/g, " ").slice(0, 500),
          promiseText: promiseText.replace(/\\s+/g, " ").slice(0, 500),
          previewText: previewText.replace(/\\s+/g, " ").slice(0, 500),
          stripText: text.replace(/\\s+/g, " ").slice(0, 900),
          contractText: contractText.replace(/\\s+/g, " ").slice(0, 700),
        });
      })()`,
    ).catch((diagnosticError) => `diagnostic unavailable: ${diagnosticError.message}`);
    throw new Error(
      `${error instanceof Error ? error.message : String(error)}\nReport builder story diagnostics: ${diagnostics}`,
    );
  }
}

async function selectReportBuilderPreset({
  presetId,
  client,
}: {
  presetId: string;
  client: Awaited<ReturnType<typeof createCdpPage>>;
}) {
  await waitForExpression(
    client,
    `Boolean(document.querySelector('[data-testid="report-builder"]'))`,
    "report builder",
  );
  await waitForExpression(
    client,
    `Boolean(document.querySelector('[data-testid="report-builder-preset"][data-preset-id="${presetId}"]'))`,
    `${presetId} report builder preset`,
  );
  await evaluate(
    client,
    `(() => {
      const preset = document.querySelector('[data-testid="report-builder-preset"][data-preset-id="${presetId}"]');
      if (!preset) throw new Error("Missing ${presetId} report builder preset");
      preset.scrollIntoView({ block: "center", inline: "center" });
      preset.click();
      return preset.getAttribute("aria-pressed");
    })()`,
  );
  await waitForExpression(
    client,
    `document.querySelector('[data-testid="report-builder-preset"][data-preset-id="${presetId}"]')?.getAttribute("aria-pressed") === "true"`,
    `${presetId} report builder preset active state`,
  );
}

async function selectReportBuilderChartMode({
  chartMode,
  client,
}: {
  chartMode: ReportExportChartMode;
  client: Awaited<ReturnType<typeof createCdpPage>>;
}) {
  await waitForExpression(
    client,
    `Boolean(document.querySelector('[data-testid="report-builder-chart-mode"][data-chart-mode="${chartMode}"]'))`,
    `${chartMode} report builder chart mode`,
  );
  await evaluate(
    client,
    `(() => {
      const mode = document.querySelector('[data-testid="report-builder-chart-mode"][data-chart-mode="${chartMode}"]');
      if (!mode) throw new Error("Missing ${chartMode} report builder chart mode");
      mode.scrollIntoView({ block: "center", inline: "center" });
      mode.click();
      return mode.getAttribute("aria-pressed");
    })()`,
  );
  await waitForExpression(
    client,
    `document.querySelector('[data-testid="report-builder-chart-mode"][data-chart-mode="${chartMode}"]')?.getAttribute("aria-pressed") === "true"`,
    `${chartMode} report builder chart mode active state`,
  );
}

async function selectReportBuilderChartFocus({
  chartMetric,
  client,
}: {
  chartMetric: ReportExportChartMetric;
  client: Awaited<ReturnType<typeof createCdpPage>>;
}) {
  await waitForExpression(
    client,
    `Boolean(document.querySelector('[data-testid="report-builder-chart-focus-option"][data-chart-metric="${chartMetric}"]'))`,
    `${chartMetric} report builder chart focus`,
  );
  await evaluate(
    client,
    `(() => {
      const metric = document.querySelector('[data-testid="report-builder-chart-focus-option"][data-chart-metric="${chartMetric}"]');
      if (!metric) throw new Error("Missing ${chartMetric} report builder chart focus");
      metric.scrollIntoView({ block: "center", inline: "center" });
      metric.click();
      return metric.getAttribute("aria-pressed");
    })()`,
  );
  await waitForExpression(
    client,
    `document.querySelector('[data-testid="report-builder-chart-focus-option"][data-chart-metric="${chartMetric}"]')?.getAttribute("aria-pressed") === "true"`,
    `${chartMetric} report builder chart focus active state`,
  );
}

async function selectReportBuilderPresentation({
  client,
  field,
  value,
}: {
  client: Awaited<ReturnType<typeof createCdpPage>>;
  field: "coverMode" | "typography" | "density";
  value: string;
}) {
  await waitForExpression(
    client,
    `Boolean(document.querySelector('[data-testid="report-builder-presentation"]'))`,
    "report builder presentation controls",
  );
  await waitForExpression(
    client,
    `Boolean(document.querySelector('[data-testid="report-builder-presentation-option"][data-presentation-field="${field}"][data-presentation-value="${value}"]'))`,
    `${field} ${value} report builder presentation option`,
  );
  await evaluate(
    client,
    `(() => {
      const option = document.querySelector('[data-testid="report-builder-presentation-option"][data-presentation-field="${field}"][data-presentation-value="${value}"]');
      if (!option) throw new Error("Missing ${field} ${value} report builder presentation option");
      option.scrollIntoView({ block: "center", inline: "center" });
      option.click();
      return option.getAttribute("aria-pressed");
    })()`,
  );
  await waitForExpression(
    client,
    `document.querySelector('[data-testid="report-builder-presentation-option"][data-presentation-field="${field}"][data-presentation-value="${value}"]')?.getAttribute("aria-pressed") === "true"`,
    `${field} ${value} report builder presentation active state`,
  );
}

async function moveReportBuilderBlockEarlier({
  blockId,
  client,
  times = 1,
}: {
  blockId: string;
  client: Awaited<ReturnType<typeof createCdpPage>>;
  times?: number;
}) {
  await waitForExpression(
    client,
    `Boolean(document.querySelector('[data-testid="report-builder-block-order"]'))`,
    "report builder block order controls",
  );

  for (let moveIndex = 0; moveIndex < times; moveIndex += 1) {
    const beforeIndex = await evaluate(
      client,
      `(() => {
        const items = [...document.querySelectorAll('[data-testid="report-builder-block-order-item"]')];
        return items.findIndex((item) => item.getAttribute("data-block-id") === ${JSON.stringify(blockId)});
      })()`,
    );
    if (typeof beforeIndex !== "number" || beforeIndex <= 0) return;

    await evaluate(
      client,
      `(() => {
        const button = document.querySelector('[data-testid="report-builder-block-move-earlier"][data-block-id=${JSON.stringify(blockId)}]');
        if (!button) throw new Error("Missing report-builder-block-move-earlier");
        button.scrollIntoView({ block: "center", inline: "center" });
        button.click();
        return true;
      })()`,
    );
    await waitForExpression(
      client,
      `(() => {
        const items = [...document.querySelectorAll('[data-testid="report-builder-block-order-item"]')];
        return items.findIndex((item) => item.getAttribute("data-block-id") === ${JSON.stringify(blockId)}) === ${beforeIndex - 1};
      })()`,
      `${blockId} report builder block moved earlier`,
    );
  }
}

async function ensureReportBuilderBlockSelected({
  blockId,
  client,
}: {
  blockId: string;
  client: Awaited<ReturnType<typeof createCdpPage>>;
}) {
  await waitForExpression(
    client,
    `(() => {
      return [...document.querySelectorAll('[data-testid="report-builder-block"][data-block-id=${JSON.stringify(blockId)}]')]
        .some((block) => {
          const rect = block.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        });
    })()`,
    `${blockId} report builder block`,
  );

  const wasAlreadySelected = await evaluate(
    client,
    `(() => {
      return [...document.querySelectorAll('[data-testid="report-builder-block"][data-block-id=${JSON.stringify(blockId)}]')]
        .some((block) => {
          const rect = block.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && block.getAttribute("aria-pressed") === "true";
        });
    })()`,
  );
  if (wasAlreadySelected) {
    await waitForExpression(
      client,
      `Boolean(document.querySelector('[data-testid="report-builder-block-order-item"][data-block-id=${JSON.stringify(blockId)}]'))`,
      `${blockId} report builder block order selected`,
    );
    return;
  }

  await evaluate(
    client,
    `(() => {
      const block = [...document.querySelectorAll('[data-testid="report-builder-block"][data-block-id=${JSON.stringify(blockId)}]')]
        .find((candidate) => {
          const rect = candidate.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        });
      if (!block) throw new Error("Missing report-builder-block");
      block.scrollIntoView({ block: "center", inline: "center" });
      block.click();
      return true;
    })()`,
  );
  await waitForExpression(
    client,
    `(() => {
      const selected = [...document.querySelectorAll('[data-testid="report-builder-block"][data-block-id=${JSON.stringify(blockId)}]')]
        .some((block) => {
          const rect = block.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0 && block.getAttribute("aria-pressed") === "true";
        });
      const inOrder = Boolean(document.querySelector('[data-testid="report-builder-block-order-item"][data-block-id=${JSON.stringify(blockId)}]'));
      return selected && inOrder;
    })()`,
    `${blockId} report builder block selected`,
  );
}

async function waitForVisibleReportMode({
  client,
  modeContract,
}: {
  client: Awaited<ReturnType<typeof createCdpPage>>;
  modeContract: ReportExportModeContract;
}) {
  const outputContractExpression = `(() => {
    const contract = document.querySelector('[data-testid="report-output-contract"]');
    if (!contract) return false;
    const executiveRead = contract.querySelector('[data-testid="report-output-executive-read"]');
    const executiveReadText = executiveRead?.textContent || "";
    const recipe = contract.querySelector('[data-testid="report-output-decision-recipe"]');
    const recipeSteps = [...(recipe?.querySelectorAll('[data-testid="report-output-decision-recipe-item"]') ?? [])]
      .map((step) => step.getAttribute("data-recipe-step"));
    const text = contract.textContent || "";
    const expectedOutputTitle = ${JSON.stringify(modeContract.outputTitle)};
    const sectionLabels = ${JSON.stringify(modeContract.sectionLabelChecks ?? [])};
    const readinessSteps = [...contract.querySelectorAll('[data-testid="report-output-readiness-step"]')]
      .map((step) => step.getAttribute("data-readiness-step"));
    return text.includes("Leadership readiness")
      && executiveRead?.getAttribute("data-executive-read-state") === "ready"
      && executiveReadText.includes("Leadership readiness")
      && executiveReadText.includes("Ready for leadership sharing.")
      && executiveReadText.includes("Next action")
      && text.includes(expectedOutputTitle)
      && text.includes("Presentation plan")
      && recipe?.getAttribute("data-chart-mode") === ${JSON.stringify(modeContract.chartMode)}
      && recipeSteps.includes("question")
      && recipeSteps.includes("visual-job")
      && recipeSteps.includes("evidence-gate")
      && recipeSteps.includes("next-action")
      && text.includes("Decision recipe")
      && text.includes("Visual job")
      && text.includes("Evidence gate")
      && text.includes("Next action")
      && text.includes("Ready for leadership sharing.")
      && readinessSteps.includes("decision")
      && readinessSteps.includes("evidence")
      && readinessSteps.includes("export")
      && text.includes("Executive question")
      && text.includes(${JSON.stringify(modeContract.chartModeLabel)})
      && text.includes(${JSON.stringify(modeContract.layoutTitle)})
      && text.includes(${JSON.stringify(modeContract.layoutDetail)})
      && ${modeContract.chartMetricLabel ? `text.includes("Lead metric") && text.includes(${JSON.stringify(modeContract.chartMetricLabel)})` : "true"}
      && sectionLabels.every((label) => text.includes(label))
      && text.includes("Exports and shared links follow this saved presentation plan.");
  })()`;

  try {
    await waitForExpression(
      client,
      outputContractExpression,
      `${modeContract.chartMode} visible report output contract`,
    );
  } catch (error) {
    const diagnostics = await evaluate(
      client,
      `(() => {
        const contract = document.querySelector('[data-testid="report-output-contract"]');
        const executiveRead = contract?.querySelector('[data-testid="report-output-executive-read"]');
        const executiveReadText = executiveRead?.textContent || "";
        const recipe = contract?.querySelector('[data-testid="report-output-decision-recipe"]');
        const text = contract?.textContent || "";
        const expectedOutputTitle = ${JSON.stringify(modeContract.outputTitle)};
        const sectionLabels = ${JSON.stringify(modeContract.sectionLabelChecks ?? [])};
        const recipeSteps = [...(recipe?.querySelectorAll('[data-testid="report-output-decision-recipe-item"]') ?? [])]
          .map((step) => step.getAttribute("data-recipe-step"));
        const readinessSteps = [...(contract?.querySelectorAll('[data-testid="report-output-readiness-step"]') ?? [])]
          .map((step) => step.getAttribute("data-readiness-step"));
        return {
          hasContract: Boolean(contract),
          hasDecisionRecipe: Boolean(recipe),
          recipeChartMode: recipe?.getAttribute("data-chart-mode") ?? null,
          recipeSteps,
          readinessSteps,
          missing: {
            leadership: !text.includes("Leadership readiness"),
            outputTitle: !text.includes(expectedOutputTitle),
            presentationPlan: !text.includes("Presentation plan"),
            recipeChartMode: recipe?.getAttribute("data-chart-mode") !== ${JSON.stringify(modeContract.chartMode)},
            recipeQuestion: !recipeSteps.includes("question"),
            recipeVisualJob: !recipeSteps.includes("visual-job"),
            recipeEvidenceGate: !recipeSteps.includes("evidence-gate"),
            recipeNextAction: !recipeSteps.includes("next-action"),
            recipeTitle: !text.includes("Decision recipe"),
            visualJobText: !text.includes("Visual job"),
            evidenceGateText: !text.includes("Evidence gate"),
            nextActionText: !text.includes("Next action"),
            readyDecisionText: !text.includes("Ready for leadership sharing."),
            decisionStep: !readinessSteps.includes("decision"),
            evidenceStep: !readinessSteps.includes("evidence"),
            exportStep: !readinessSteps.includes("export"),
            executiveQuestion: !text.includes("Executive question"),
            chartMode: !text.includes(${JSON.stringify(modeContract.chartModeLabel)}),
            layoutTitle: !text.includes(${JSON.stringify(modeContract.layoutTitle)}),
            layoutDetail: !text.includes(${JSON.stringify(modeContract.layoutDetail)}),
            chartMetric: ${modeContract.chartMetricLabel ? `!(text.includes("Lead metric") && text.includes(${JSON.stringify(modeContract.chartMetricLabel)}))` : "false"},
            sectionLabels: sectionLabels.filter((label) => !text.includes(label)),
            detail: !text.includes("Exports and shared links follow this saved presentation plan."),
            executiveRead: !executiveRead,
            executiveReadReady: executiveRead?.getAttribute("data-executive-read-state") !== "ready",
            executiveReadLabel: !executiveReadText.includes("Leadership readiness"),
            executiveReadTrust: !executiveReadText.includes("Ready for leadership sharing."),
            executiveReadAction: !executiveReadText.includes("Next action"),
          },
          executiveReadText: executiveReadText.slice(0, 700),
          text: text.slice(0, 1400),
        };
      })()`,
    );
    throw new Error(
      `${modeContract.chartMode} visible report output contract diagnostics: ${JSON.stringify(diagnostics, null, 2)}`,
      { cause: error },
    );
  }
  await waitForExpression(
    client,
    `(() => {
      const proofOps = document.querySelector('[data-testid="proof-room-scale-readiness"]');
      const text = proofOps?.textContent || "";
      return proofOps?.getAttribute("data-proof-readiness-action") === "share"
        && text.includes("Proof operations")
        && text.includes("Ready for leadership sharing")
        && text.includes("1/1 verified reads")
        && text.includes("No open proof lanes");
    })()`,
    `${modeContract.chartMode} proof operations readiness`,
  );

  await waitForExpression(
    client,
    `(() => {
      const story = document.querySelector('[data-testid="report-chart-layout-story"]');
      if (!story) return false;
      const text = story.textContent || "";
      const stepNodes = [...story.querySelectorAll('[data-testid="report-story-decision-step"]')];
      const storySteps = stepNodes.map((step) => step.getAttribute("data-story-step"));
      const decisionSteps = stepNodes.map((step) => step.getAttribute("data-decision-step"));
      return story.getAttribute("data-chart-mode") === ${JSON.stringify(modeContract.chartMode)}
        && text.includes("Primary report story")
        && text.includes(${JSON.stringify(modeContract.layoutTitle)})
        && storySteps.includes("question")
        && storySteps.includes("visual")
        && storySteps.includes("evidence")
        && storySteps.includes("action")
        && decisionSteps.includes("question")
        && decisionSteps.includes("visual")
        && decisionSteps.includes("evidence")
        && decisionSteps.includes("action")
        && text.includes("01")
        && text.includes("02")
        && text.includes("03")
        && text.includes("04")
        && text.includes("Question")
        && text.includes("Visual job")
        && text.includes("Evidence gate")
        && text.includes("Next action")
        && text.includes("Ready for leadership sharing.");
    })()`,
    `${modeContract.chartMode} visible report chart layout story`,
  );

  if (modeContract.chartMode === "trend") {
    await waitForExpression(
      client,
      `(() => {
        const snapshot = document.querySelector('[data-testid="report-story-snapshot"][data-chart-recipe="snapshot"]');
        const snapshotText = snapshot?.textContent || "";
        const trendChart = document.querySelector('[data-testid="report-story-chart"][data-chart-recipe="trend"]');
        return Boolean(snapshot)
          && snapshotText.includes("Snapshot read")
          && snapshotText.includes("One verified read; use a snapshot until there is enough history for a trend.")
          && snapshotText.includes("Report window")
          && !trendChart;
      })()`,
      "live report single-read snapshot recipe",
    );
  }
}

async function exportHtmlReportForMode({
  admin,
  campaignId,
  client,
  consoleErrors,
  excludedJobIds,
  modeContract,
}: {
  admin: ReturnType<typeof createAdminClient>;
  campaignId: string;
  client: Awaited<ReturnType<typeof createCdpPage>>;
  consoleErrors: string[];
  excludedJobIds: Set<string>;
  modeContract: ReportExportModeContract;
}) {
  if (modeContract.presetId) {
    await selectReportBuilderPreset({
      presetId: modeContract.presetId,
      client,
    });
  }
  if (!modeContract.preserveCurrentSelection) {
    await selectReportBuilderChartMode({
      chartMode: modeContract.chartMode,
      client,
    });
  }
  if (modeContract.chartMetric) {
    await selectReportBuilderChartFocus({
      chartMetric: modeContract.chartMetric,
      client,
    });
  }
  if (modeContract.includeReportFraming) {
    await ensureReportBuilderBlockSelected({ blockId: "report_framing", client });
  }
  await selectReportBuilderTileLabels({ client });
  await selectReportBuilderSectionLabels({ client });
  await waitForVisibleReportMode({
    client,
    modeContract,
  });
  await clickHtmlReportExport(client);
  const job = await waitForCompletedReportExportJob({
    admin,
    campaignId,
    client,
    excludedJobIds,
  });
  excludedJobIds.add(job.id);
  const artifactText = await downloadReportExportArtifact({ admin, job });

  validateReportExportUiSmoke({ job, artifactText, consoleErrors, modeContract });

  return {
    artifactText,
    mode: modeContract.chartMode,
    jobId: job.id,
    fileName: job.file_name,
    mimeType: job.mime_type,
    storagePath: job.storage_path,
    artifactBytes: artifactText.length,
  };
}

async function saveReportTemplateFromBuilder({
  client,
  templateDescription,
  templateName,
}: {
  client: Awaited<ReturnType<typeof createCdpPage>>;
  templateDescription: string;
  templateName: string;
}) {
  await waitForExpression(
    client,
    `Boolean(document.querySelector('[data-testid="report-builder-save-template"]'))`,
    "save report template button",
  );
  await evaluate(
    client,
    `(() => {
      const button = document.querySelector('[data-testid="report-builder-save-template"]');
      if (!button) throw new Error("Missing report-builder-save-template");
      button.click();
      return true;
    })()`,
  );
  await waitForExpression(
    client,
    `Boolean(document.querySelector('[data-testid="report-builder-save-template-name"]'))`,
    "save report template dialog",
  );
  await evaluate(
    client,
    `(() => {
      const setControlValue = (node, value) => {
        const proto = node instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
        setter?.call(node, value);
        node.dispatchEvent(new Event("input", { bubbles: true }));
      };
      const name = document.querySelector('[data-testid="report-builder-save-template-name"]');
      const description = document.querySelector('[data-testid="report-builder-save-template-description"]');
      if (!name || !description) throw new Error("Missing report template inputs");
      setControlValue(name, ${JSON.stringify(templateName)});
      setControlValue(description, ${JSON.stringify(templateDescription)});
      const checkbox = document.querySelector('input[type="checkbox"]');
      if (checkbox && !checkbox.checked) checkbox.click();
      return true;
    })()`,
  );
  await evaluate(
    client,
    `(() => {
      const submit = document.querySelector('[data-testid="report-builder-save-template-submit"]');
      if (!submit) throw new Error("Missing report-builder-save-template-submit");
      submit.click();
      return true;
    })()`,
  );

  const templateId = await waitForExpression(
    client,
    `(() => {
      const template = [...document.querySelectorAll('[data-testid="report-builder-template"]')]
        .find((node) => node.textContent?.includes(${JSON.stringify(templateName)}));
      if (!template) return null;
      if (template.getAttribute("aria-pressed") !== "true") return null;
      return template.getAttribute("data-template-id");
    })()`,
    "saved report builder template",
  );
  await waitForExpression(
    client,
    `!document.querySelector('[data-testid="report-builder-save-template-dialog"][data-open]')`,
    "closed report template dialog",
  );

  return templateId;
}

async function saveCampaignReportShapeFromBuilder({
  admin,
  brandReportUrl,
  campaignId,
  client,
  expectedFirstBlockId,
  modeContract,
  templateId,
}: {
  admin: ReturnType<typeof createAdminClient>;
  brandReportUrl: string;
  campaignId: string;
  client: Awaited<ReturnType<typeof createCdpPage>>;
  expectedFirstBlockId?: string;
  modeContract: ReportExportModeContract;
  templateId: string;
}) {
  await waitForExpression(
    client,
    `Boolean(document.querySelector('[data-testid="report-builder-save-campaign-shape"]'))`,
    "save campaign report shape button",
  );
  await evaluate(
    client,
    `(() => {
      const button = document.querySelector('[data-testid="report-builder-save-campaign-shape"]');
      if (!button) throw new Error("Missing report-builder-save-campaign-shape");
      button.scrollIntoView({ block: "center", inline: "center" });
      button.click();
      return true;
    })()`,
  );
  await waitForExpression(
    client,
    `document.querySelector('[data-testid="report-output-contract"]')?.textContent?.includes("Saved to this campaign.")`,
    "saved campaign report shape UI state",
  );

  const template = await checkedQuery(
    "Find saved report composition template",
    admin
      .from("report_composition_templates")
      .select("id, preset_id, chart_mode_id, block_ids, report_presentation")
      .eq("id", templateId)
      .single(),
  );
  const plan = await checkedQuery(
    "Find saved campaign report plan",
    admin
      .from("campaign_reporting_plans")
      .select("campaign_id, report_template_id, report_preset_id, report_chart_mode_id, report_block_ids, report_presentation")
      .eq("campaign_id", campaignId)
      .single(),
  );

  if (plan.report_template_id !== templateId) {
    throw new Error("Campaign report plan did not persist the selected template.");
  }
  if (plan.report_preset_id !== template.preset_id) {
    throw new Error("Campaign report plan preset does not match the saved template.");
  }
  if (plan.report_chart_mode_id !== template.chart_mode_id) {
    throw new Error("Campaign report plan chart mode does not match the saved template.");
  }
  if (JSON.stringify(plan.report_block_ids ?? []) !== JSON.stringify(template.block_ids ?? [])) {
    throw new Error("Campaign report plan blocks do not match the saved template.");
  }
  if (JSON.stringify(plan.report_presentation ?? {}) !== JSON.stringify(template.report_presentation ?? {})) {
    throw new Error("Campaign report plan presentation does not match the saved template.");
  }
  if (template.report_presentation?.headline !== CUSTOM_REPORT_TITLE) {
    throw new Error("Saved report template did not persist the custom report title.");
  }
  if (template.report_presentation?.executiveQuestion !== CUSTOM_EXECUTIVE_QUESTION) {
    throw new Error("Saved report template did not persist the custom executive question.");
  }
  if (plan.report_presentation?.headline !== CUSTOM_REPORT_TITLE) {
    throw new Error("Campaign report plan did not persist the custom report title.");
  }
  if (plan.report_presentation?.executiveQuestion !== CUSTOM_EXECUTIVE_QUESTION) {
    throw new Error("Campaign report plan did not persist the custom executive question.");
  }
  if (
    JSON.stringify(template.report_presentation?.kpiIds ?? []) !==
    JSON.stringify(CUSTOM_REPORT_KPI_TILE_IDS)
  ) {
    throw new Error("Saved report template did not persist the selected KPI tiles.");
  }
  if (
    JSON.stringify(template.report_presentation?.trustIds ?? []) !==
    JSON.stringify(CUSTOM_REPORT_TRUST_TILE_IDS)
  ) {
    throw new Error("Saved report template did not persist the selected proof tiles.");
  }
  if (
    stableRecordJson(template.report_presentation?.kpiLabels) !==
    stableRecordJson(CUSTOM_REPORT_KPI_TILE_LABELS)
  ) {
    throw new Error("Saved report template did not persist the custom KPI tile labels.");
  }
  if (
    stableRecordJson(template.report_presentation?.trustLabels) !==
    stableRecordJson(CUSTOM_REPORT_TRUST_TILE_LABELS)
  ) {
    throw new Error("Saved report template did not persist the custom proof tile labels.");
  }
  if (
    JSON.stringify(plan.report_presentation?.kpiIds ?? []) !==
    JSON.stringify(CUSTOM_REPORT_KPI_TILE_IDS)
  ) {
    throw new Error("Campaign report plan did not persist the selected KPI tiles.");
  }
  if (
    JSON.stringify(plan.report_presentation?.trustIds ?? []) !==
    JSON.stringify(CUSTOM_REPORT_TRUST_TILE_IDS)
  ) {
    throw new Error("Campaign report plan did not persist the selected proof tiles.");
  }
  if (
    stableRecordJson(plan.report_presentation?.kpiLabels) !==
    stableRecordJson(CUSTOM_REPORT_KPI_TILE_LABELS)
  ) {
    throw new Error("Campaign report plan did not persist the custom KPI tile labels.");
  }
  if (
    stableRecordJson(plan.report_presentation?.trustLabels) !==
    stableRecordJson(CUSTOM_REPORT_TRUST_TILE_LABELS)
  ) {
    throw new Error("Campaign report plan did not persist the custom proof tile labels.");
  }
  if (
    stableRecordJson(template.report_presentation?.sectionLabels) !==
    stableRecordJson(CUSTOM_REPORT_SAVED_SECTION_LABELS)
  ) {
    throw new Error("Saved report template did not persist the custom section labels.");
  }
  if (
    stableRecordJson(plan.report_presentation?.sectionLabels) !==
    stableRecordJson(CUSTOM_REPORT_SAVED_SECTION_LABELS)
  ) {
    throw new Error("Campaign report plan did not persist the custom section labels.");
  }
  if (
    expectedFirstBlockId &&
    (plan.report_block_ids ?? [])[0] !== expectedFirstBlockId
  ) {
    throw new Error(
      `Campaign report plan did not preserve the moved first report block. Expected ${expectedFirstBlockId}.`,
    );
  }

  await navigate(client, brandReportUrl);
  await waitForVisibleReportMode({
    client,
    modeContract,
  });
  await waitForExpression(
    client,
    `document.querySelector('[data-testid="report-builder-template"][data-template-id="${templateId}"]')?.getAttribute("aria-pressed") === "true"`,
    "reloaded campaign report plan template active state",
  );
  await waitForExpression(
    client,
    `(() => {
      const headline = document.querySelector('[data-testid="report-builder-headline"]');
      const question = document.querySelector('[data-testid="report-builder-executive-question"]');
      const kpiLabels = ${JSON.stringify(CUSTOM_REPORT_KPI_TILE_LABELS)};
      const trustLabels = ${JSON.stringify(CUSTOM_REPORT_TRUST_TILE_LABELS)};
      const sectionLabels = ${JSON.stringify(CUSTOM_REPORT_SAVED_SECTION_LABELS)};
      const kpiInputs = [...document.querySelectorAll('[data-testid="report-builder-kpi-tile-label"]')];
      const trustInputs = [...document.querySelectorAll('[data-testid="report-builder-trust-tile-label"]')];
      const sectionInputs = [...document.querySelectorAll('[data-testid="report-builder-section-label"]')];
      const cover = document.querySelector('[data-testid="report-executive-cover"]');
      const story = document.querySelector('[data-testid="report-builder-story-strip"]');
      const order = document.querySelector('[data-testid="report-builder-block-order"]');
      const combinedText = [cover?.textContent || "", story?.textContent || ""].join(" ");

      return headline?.value === ${JSON.stringify(CUSTOM_REPORT_TITLE)}
        && question?.value === ${JSON.stringify(CUSTOM_EXECUTIVE_QUESTION)}
        && kpiInputs.every((input) => {
          const tileId = input.getAttribute("data-tile-id");
          const expected = tileId ? kpiLabels[tileId] : null;
          return !expected || input.value === expected;
        })
        && trustInputs.every((input) => {
          const tileId = input.getAttribute("data-tile-id");
          const expected = tileId ? trustLabels[tileId] : null;
          return !expected || input.value === expected;
        })
        && sectionInputs.every((input) => {
          const blockId = input.getAttribute("data-block-id");
          const expected = blockId ? sectionLabels[blockId] : null;
          return !expected || input.value === expected;
        })
        && Object.values(sectionLabels).every((label) => (order?.textContent || "").includes(label))
        && combinedText.includes(${JSON.stringify(CUSTOM_REPORT_TITLE)})
        && combinedText.includes(${JSON.stringify(CUSTOM_EXECUTIVE_QUESTION)});
    })()`,
    "reloaded campaign report executive framing",
  );
  await assertReportBuilderTilePreview({ client });

  return {
    blockIds: plan.report_block_ids ?? [],
    chartModeId: plan.report_chart_mode_id,
    presentation: plan.report_presentation,
    presetId: plan.report_preset_id,
    templateId: plan.report_template_id,
  };
}

export async function runReportExportUiSmoke() {
  await loadLocalEnv();

  const campaignId =
    process.env.SMOKE_REPORT_EXPORT_UI_CAMPAIGN_ID ||
    DEFAULT_REPORT_EXPORT_UI_CAMPAIGN_ID;
  const targets = buildContentReportManualSourceSmokeTargets({ campaignId });
  const menuScreenshotPath = path.resolve(
    process.env.SMOKE_REPORT_EXPORT_UI_SCREENSHOT_PATH ||
      DEFAULT_MENU_SCREENSHOT_PATH,
  );
  const coverScreenshotPath = path.resolve(
    process.env.SMOKE_REPORT_EXPORT_UI_COVER_SCREENSHOT_PATH ||
      DEFAULT_COVER_SCREENSHOT_PATH,
  );
  const proofRoomCoverScreenshotPath = path.resolve(
    process.env.SMOKE_REPORT_EXPORT_UI_PROOF_ROOM_COVER_SCREENSHOT_PATH ||
      DEFAULT_PROOF_ROOM_COVER_SCREENSHOT_PATH,
  );
  const builderScreenshotPath = path.resolve(
    process.env.SMOKE_REPORT_EXPORT_UI_BUILDER_SCREENSHOT_PATH ||
      DEFAULT_BUILDER_SCREENSHOT_PATH,
  );
  const sharedReportScreenshotPath = path.resolve(
    process.env.SMOKE_REPORT_EXPORT_UI_SHARED_SCREENSHOT_PATH ||
      DEFAULT_SHARED_REPORT_SCREENSHOT_PATH,
  );
  const sharedReportHoldScreenshotPath = path.resolve(
    process.env.SMOKE_REPORT_EXPORT_UI_SHARED_HOLD_SCREENSHOT_PATH ||
      DEFAULT_SHARED_REPORT_HOLD_SCREENSHOT_PATH,
  );
  const admin = createAdminClient();
  const callerWantedKeepData = process.env.SMOKE_KEEP_DATA === "1";
  const previousKeepData = process.env.SMOKE_KEEP_DATA;
  const previousManualSourceCampaignId =
    process.env.SMOKE_CONTENT_REPORT_MANUAL_SOURCE_CAMPAIGN_ID;
  const previousCreatorDisplayName = process.env.SMOKE_CREATOR_DISPLAY_NAME;
  const debugPort = await findFreePort();
  const userDataDir = await mkdtemp(
    path.join(tmpdir(), "popsdrops-report-export-ui-smoke-"),
  );
  const downloadDir = await mkdtemp(
    path.join(tmpdir(), "popsdrops-report-export-downloads-"),
  );

  process.env.SMOKE_KEEP_DATA = "1";
  process.env.SMOKE_CONTENT_REPORT_MANUAL_SOURCE_CAMPAIGN_ID = campaignId;
  process.env.SMOKE_CREATOR_DISPLAY_NAME = REPORT_SMOKE_CREATOR_DISPLAY_NAME;

  const devServer = await ensureDevServer(targets.baseUrl);
  let chrome: Awaited<ReturnType<typeof launchChrome>> | undefined;
  let client: Awaited<ReturnType<typeof createCdpPage>> | undefined;
  const consoleErrors: string[] = [];
  const reportTemplateIdsToClean: string[] = [];
  const templateName = `${TEMPLATE_NAME_PREFIX} ${Date.now()}`;

  try {
    const manualSourceSmoke = await runContentReportManualSourceSmoke({
      skipBrandReview: true,
    });
    const existingJobIds = await listExistingReportExportJobIds(admin, campaignId);
    const exportedReportArtifacts: Awaited<
      ReturnType<typeof exportHtmlReportForMode>
    >[] = [];

    chrome = await launchChrome({ debugPort, userDataDir });
    client = await createCdpPage(debugPort);
    collectReportSmokeConsoleErrors(client, consoleErrors);

    await client.send("Page.enable");
    await client.send("Runtime.enable");
    await enableReportDownloads({ client, downloadDir });

    await loginForSmoke(client, {
      loginUrl: `${targets.baseUrl}/auth/dev-login?role=brand`,
      expectedUrlPrefix: `${targets.baseUrl}/b/campaigns`,
      description: "brand dev login for report export UI smoke",
    });
    const pendingSharedReportUrl = await withFreshSharedReportPage({
      consoleErrors,
      debugPort,
      run: (sharedReportClient) =>
        smokeSharedReportLeadershipGate({
          brandReportUrl: targets.brandReportUrl,
          client,
          description: "configured shared campaign report leadership hold",
          expectedDetail: "Keep in proof room until evidence is reviewed.",
          expectedLabel: "Leadership hold",
          expectedState: "hold",
          sharedReportScreenshotPath: sharedReportHoldScreenshotPath,
          viewerClient: sharedReportClient,
        }),
    });
    await verifyBrandReportEvidence(client, targets);
    await navigate(client, targets.brandReportUrl);
    const brandReportSurfaceExpression = `(() => {
        const cover = document.querySelector('[data-testid="report-executive-cover"]');
        const coverText = cover?.textContent || "";
        const coverMetrics = [...(cover?.querySelectorAll('[data-testid="report-executive-cover-metric"]') ?? [])];
        return document.body.innerText.includes("Export")
          && document.body.innerText.includes("Brand-reviewed proof")
          && document.body.innerText.includes("Report plan")
          && coverText.includes("Global proof room")
          && coverText.includes("Report window")
          && (coverText.includes("Views") || coverText.includes(${JSON.stringify(CUSTOM_REPORT_KPI_TILE_LABELS.views)}))
          && (coverText.includes("Engagements") || coverText.includes(${JSON.stringify(CUSTOM_REPORT_KPI_TILE_LABELS.engagements)}))
          && (coverText.includes("Evidence-backed reads") || coverText.includes(${JSON.stringify(CUSTOM_REPORT_TRUST_TILE_LABELS.evidence_backed_reads)}))
          && !coverText.includes("Evidence status")
          && coverMetrics.length === 3
          && coverMetrics.some((metric) => metric.getAttribute("data-cover-metric-source") === "kpi" && metric.getAttribute("data-cover-metric-key") === "views")
          && coverMetrics.some((metric) => metric.getAttribute("data-cover-metric-source") === "kpi" && metric.getAttribute("data-cover-metric-key") === "engagements")
          && coverMetrics.some((metric) => metric.getAttribute("data-cover-metric-source") === "trust" && metric.getAttribute("data-cover-metric-key") === "evidence_backed_reads")
          && Boolean(cover?.querySelector('[data-testid="report-executive-cover-visual"][data-cover-source="campaign-image"]'))
          && (() => {
             const image = cover?.querySelector(\`img[alt="${REPORT_CAMPAIGN_VISUAL_TITLE}"][data-testid="report-executive-cover-image"]\`);
            return Boolean(image?.complete && image.naturalWidth > 0);
          })();
       })()`;
    try {
      await waitForExpression(
        client,
        brandReportSurfaceExpression,
        "brand report export surface",
      );
    } catch (error) {
      const diagnostics = await evaluate(
        client,
        `(() => {
          const bodyText = document.body.innerText || "";
          const cover = document.querySelector('[data-testid="report-executive-cover"]');
          const coverText = cover?.textContent || "";
          const visual = cover?.querySelector('[data-testid="report-executive-cover-visual"]');
          const image = cover?.querySelector(\`img[alt="${REPORT_CAMPAIGN_VISUAL_TITLE}"][data-testid="report-executive-cover-image"]\`);
          const coverMetrics = [...(cover?.querySelectorAll('[data-testid="report-executive-cover-metric"]') ?? [])];
          const checks = {
            hasExport: bodyText.includes("Export"),
            hasReviewedProof: bodyText.includes("Brand-reviewed proof"),
            hasReportPlan: bodyText.includes("Report plan"),
            hasCover: Boolean(cover),
            hasGlobalProofRoom: coverText.includes("Global proof room"),
            hasReportWindow: coverText.includes("Report window"),
            hasViewsOrQualifiedReach: coverText.includes("Views") || coverText.includes(${JSON.stringify(CUSTOM_REPORT_KPI_TILE_LABELS.views)}),
            hasEngagementsOrAudienceActions: coverText.includes("Engagements") || coverText.includes(${JSON.stringify(CUSTOM_REPORT_KPI_TILE_LABELS.engagements)}),
            hasEvidenceBackedReadsOrProofCoverage: coverText.includes("Evidence-backed reads") || coverText.includes(${JSON.stringify(CUSTOM_REPORT_TRUST_TILE_LABELS.evidence_backed_reads)}),
            noEvidenceStatus: !coverText.includes("Evidence status"),
            metricCount: coverMetrics.length === 3,
            hasViewsMetric: coverMetrics.some((metric) => metric.getAttribute("data-cover-metric-source") === "kpi" && metric.getAttribute("data-cover-metric-key") === "views"),
            hasEngagementsMetric: coverMetrics.some((metric) => metric.getAttribute("data-cover-metric-source") === "kpi" && metric.getAttribute("data-cover-metric-key") === "engagements"),
            hasEvidenceMetric: coverMetrics.some((metric) => metric.getAttribute("data-cover-metric-source") === "trust" && metric.getAttribute("data-cover-metric-key") === "evidence_backed_reads"),
            visualIsCampaignImage: visual?.getAttribute("data-cover-source") === "campaign-image",
            imageLoaded: Boolean(image?.complete && image.naturalWidth > 0),
          };

          return JSON.stringify({
            href: location.href,
            readyState: document.readyState,
            failedChecks: Object.entries(checks).filter(([, passed]) => !passed).map(([key]) => key),
            checks,
            coverText: coverText.replace(/\\s+/g, " ").slice(0, 1000),
            bodyText: bodyText.replace(/\\s+/g, " ").slice(0, 1000),
            visualSource: visual?.getAttribute("data-cover-source") ?? null,
            image: image ? {
              alt: image.getAttribute("alt"),
              complete: image.complete,
              naturalWidth: image.naturalWidth,
              naturalHeight: image.naturalHeight,
              src: image.getAttribute("src"),
            } : null,
            metrics: coverMetrics.map((metric) => ({
              source: metric.getAttribute("data-cover-metric-source"),
              key: metric.getAttribute("data-cover-metric-key"),
              text: (metric.textContent || "").replace(/\\s+/g, " ").slice(0, 240),
            })),
          });
        })()`,
      ).catch((diagnosticError) => `diagnostic unavailable: ${diagnosticError.message}`);
      throw new Error(
        `${error instanceof Error ? error.message : String(error)}\nBrand report surface diagnostics: ${diagnostics}`,
      );
    }
      const liveReportText = await evaluate(
        client,
        "document.body.innerText || document.body.textContent || ''",
      );
      assertNoCarelessReportCountLabels(liveReportText, "brand report export surface");
      await assertReportBuilderStoryStrip({ client });
     await evaluate(
       client,
       `(() => {
        const cover = document.querySelector('[data-testid="report-executive-cover"]');
        if (!cover) throw new Error("Missing report-executive-cover");
        const top = cover.getBoundingClientRect().top + window.scrollY - 24;
        window.scrollTo({ top: Math.max(0, top), behavior: "instant" });
        return true;
      })()`,
    );
    await captureScreenshot(client, coverScreenshotPath);
    await selectReportBuilderPreset({ presetId: "proof_audit", client });
    await selectReportBuilderPreset({ presetId: "leadership", client });
    await selectReportBuilderChartMode({
      chartMode: REPORT_EXPORT_MODE_CONTRACTS[0]!.chartMode,
      client,
    });
    await selectReportBuilderPresentation({
      client,
      field: "coverMode",
      value: "proof_room",
    });
    await waitForExpression(
      client,
      `(() => {
        const cover = document.querySelector('[data-testid="report-executive-cover"]');
        const visual = cover?.querySelector('[data-testid="report-executive-cover-visual"]');
        const fallback = visual?.querySelector('[data-testid="report-executive-cover-fallback"]');
        const signals = [...(fallback?.querySelectorAll('[data-testid="report-executive-cover-fallback-signal"]') ?? [])];
        const fallbackText = fallback?.textContent || "";
        return cover?.getAttribute("data-cover-mode") === "proof_room"
          && visual?.getAttribute("data-cover-source") === "proof-room"
          && Boolean(fallback)
          && signals.length === 3
          && fallbackText.includes("Proof visual")
          && fallbackText.includes("Built from the report question, evidence state, and selected metrics.")
          && (fallbackText.includes("Views") || fallbackText.includes(${JSON.stringify(CUSTOM_REPORT_KPI_TILE_LABELS.views)}))
          && (fallbackText.includes("Engagements") || fallbackText.includes(${JSON.stringify(CUSTOM_REPORT_KPI_TILE_LABELS.engagements)}))
          && (fallbackText.includes("Evidence-backed reads") || fallbackText.includes(${JSON.stringify(CUSTOM_REPORT_TRUST_TILE_LABELS.evidence_backed_reads)}))
          && !fallbackText.includes("PopsDrops");
      })()`,
      "live report proof visual fallback follows proof room presentation",
    );
    await evaluate(
      client,
      `(() => {
        const cover = document.querySelector('[data-testid="report-executive-cover"]');
        if (!cover) throw new Error("Missing report-executive-cover");
        const top = cover.getBoundingClientRect().top + window.scrollY - 24;
        window.scrollTo({ top: Math.max(0, top), behavior: "instant" });
        return true;
      })()`,
    );
    await captureScreenshot(client, proofRoomCoverScreenshotPath);
    await selectReportBuilderPresentation({
      client,
      field: "coverMode",
      value: "campaign_visual",
    });
    await selectReportBuilderPresentation({
      client,
      field: "typography",
      value: "compact",
    });
    await selectReportBuilderPresentation({
      client,
      field: "density",
      value: "compact",
    });
    await waitForExpression(
      client,
      `(() => {
        const cover = document.querySelector('[data-testid="report-executive-cover"]');
        const visual = cover?.querySelector('[data-testid="report-executive-cover-visual"]');
        const strip = document.querySelector('[data-testid="report-metric-strip"]');
        return cover?.getAttribute("data-cover-mode") === "campaign_visual"
          && cover?.getAttribute("data-typography") === "compact"
          && cover?.getAttribute("data-density") === "compact"
          && visual?.getAttribute("data-cover-source") === "campaign-image"
          && strip?.getAttribute("data-report-typography") === "compact"
          && strip?.getAttribute("data-report-density") === "compact";
      })()`,
      "live report presentation follows builder controls",
    );
    await assertReportBuilderExecutiveFraming({ client });
    await selectReportBuilderTileSet({
      client,
      expectedIds: CUSTOM_REPORT_KPI_TILE_IDS,
      tileTestId: "report-builder-kpi-tile",
    });
    await selectReportBuilderTileSet({
      client,
      expectedIds: CUSTOM_REPORT_TRUST_TILE_IDS,
      tileTestId: "report-builder-trust-tile",
    });
    await selectReportBuilderTileLabels({ client });
    await assertReportBuilderTilePreview({ client });
    await selectReportBuilderSectionLabels({ client });
    await ensureReportBuilderBlockSelected({ blockId: "report_trust", client });
    await ensureReportBuilderBlockSelected({ blockId: "report_framing", client });
    await moveReportBuilderBlockEarlier({
      blockId: REPORT_EXPORT_MODE_CONTRACTS[0]!.expectedFirstBlockId!,
      client,
      times: 3,
    });
    const templateId = await saveReportTemplateFromBuilder({
      client,
      templateDescription: "Saved during the report export UI smoke.",
      templateName,
    });
    reportTemplateIdsToClean.push(templateId);
    await waitForVisibleReportMode({
      client,
      modeContract: REPORT_EXPORT_MODE_CONTRACTS[0]!,
    });
    const savedCampaignReportShape = await saveCampaignReportShapeFromBuilder({
      admin,
      brandReportUrl: targets.brandReportUrl,
      campaignId,
      client,
      expectedFirstBlockId: REPORT_EXPORT_MODE_CONTRACTS[0]!.expectedFirstBlockId,
      modeContract: REPORT_EXPORT_MODE_CONTRACTS[0]!,
      templateId,
    });
    await evaluate(
      client,
      `(() => {
        const contract = document.querySelector('[data-testid="report-output-contract"]');
        if (!contract) throw new Error("Missing report-output-contract");
        const top = contract.getBoundingClientRect().top + window.scrollY - 24;
        window.scrollTo({ top: Math.max(0, top), behavior: "instant" });
        return true;
      })()`,
    );
    await waitForExpression(
      client,
      `(() => {
        const top = document.querySelector('[data-testid="report-output-contract"]')?.getBoundingClientRect().top;
        return typeof top === "number" && top >= 0 && top <= 160;
      })()`,
      "report output contract screenshot position",
    );
    await captureScreenshot(client, builderScreenshotPath);

    await evaluate(
      client,
      `(() => {
        const trigger = document.querySelector('[data-testid="report-export-menu"]');
        if (!trigger) throw new Error("Missing report export menu");
        trigger.scrollIntoView({ block: "center", inline: "center" });
        trigger.click();
        return true;
      })()`,
    );
    await waitForExpression(
      client,
      `([...document.querySelectorAll('[role="menuitem"]')]
        .some((node) => node.textContent?.includes(${JSON.stringify(EXPORT_LABEL)})))`,
      "HTML report export menu screenshot state",
    );
    await captureScreenshot(client, menuScreenshotPath);
    await evaluate(
      client,
      `(() => {
        const trigger = document.querySelector('[data-testid="report-export-menu"]');
        trigger?.click();
        return true;
      })()`,
    );

    const clientDownloadExports = [];
    for (const downloadExport of CLIENT_DOWNLOAD_EXPORTS) {
      clientDownloadExports.push(
        await smokeClientDownloadExport({
          client,
          downloadDir,
          extension: downloadExport.extension,
          label: downloadExport.label,
          previewScreenshotPath: downloadExport.previewScreenshotPath,
        }),
      );
    }

    for (const modeContract of REPORT_EXPORT_MODE_CONTRACTS) {
      const result = await exportHtmlReportForMode({
        admin,
        campaignId,
        client,
        consoleErrors,
        excludedJobIds: existingJobIds,
        modeContract,
      });
      exportedReportArtifacts.push(result);
    }

    const exportedReportModes = [];
    for (const artifact of exportedReportArtifacts) {
      const modeContract = REPORT_EXPORT_MODE_CONTRACTS.find(
        (contract) => contract.chartMode === artifact.mode,
      );
      if (!modeContract) {
        throw new Error(`Missing report export visual contract for ${artifact.mode}.`);
      }
      const visualScreenshotPath = await renderReportExportArtifact({
        artifactText: artifact.artifactText,
        client,
        modeContract,
      });
      const result = {
        artifactBytes: artifact.artifactBytes,
        fileName: artifact.fileName,
        jobId: artifact.jobId,
        mimeType: artifact.mimeType,
        mode: artifact.mode,
        storagePath: artifact.storagePath,
      };
      exportedReportModes.push({
        ...result,
        visualScreenshotPath,
      });
    }

    const primaryExport = exportedReportModes[0];
    if (!primaryExport) {
      throw new Error("Report export UI smoke did not export any report modes.");
    }

     const sharedReportUrl = await smokeConfiguredReportShareLink({
       brandReportUrl: targets.brandReportUrl,
       client,
       consoleErrors,
       debugPort,
       sharedReportScreenshotPath,
     });

    return {
      ok: true,
      baseUrl: targets.baseUrl,
      campaignId,
      brandReportUrl: targets.brandReportUrl,
      format: EXPORT_FORMAT,
      jobId: primaryExport.jobId,
      fileName: primaryExport.fileName,
      mimeType: primaryExport.mimeType,
      storagePath: primaryExport.storagePath,
      artifactBytes: primaryExport.artifactBytes,
      clientDownloadExports,
      exportedReportModes,
      source: "Brand-reviewed proof",
      trust: "Data source",
      templateName,
      reportTitle: CUSTOM_REPORT_TITLE,
      executiveQuestion: CUSTOM_EXECUTIVE_QUESTION,
      savedCampaignReportShape,
      coverScreenshotPath,
      proofRoomCoverScreenshotPath,
      builderScreenshotPath,
      menuScreenshotPath,
      sharedReportHoldScreenshotPath,
      pendingSharedReportUrl,
      sharedReportScreenshotPath,
      sharedReportUrl,
      keptSmokeData: callerWantedKeepData,
      manualSourceSmoke,
      devServerStarted: Boolean(devServer),
    };
  } finally {
    client?.close();
    chrome?.kill();

    if (previousKeepData === undefined) {
      delete process.env.SMOKE_KEEP_DATA;
    } else {
      process.env.SMOKE_KEEP_DATA = previousKeepData;
    }

    if (previousManualSourceCampaignId === undefined) {
      delete process.env.SMOKE_CONTENT_REPORT_MANUAL_SOURCE_CAMPAIGN_ID;
    } else {
      process.env.SMOKE_CONTENT_REPORT_MANUAL_SOURCE_CAMPAIGN_ID =
        previousManualSourceCampaignId;
    }

    if (previousCreatorDisplayName === undefined) {
      delete process.env.SMOKE_CREATOR_DISPLAY_NAME;
    } else {
      process.env.SMOKE_CREATOR_DISPLAY_NAME = previousCreatorDisplayName;
    }

    if (!callerWantedKeepData) {
      await cleanupReportCompositionTemplates({
        admin,
        templateIds: reportTemplateIdsToClean,
      });
      await cleanupApplicationFlowSmokeData(admin, campaignId);
    }

    await stopDevServer(devServer);
    await rm(userDataDir, {
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 100,
    });
    await rm(downloadDir, {
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 100,
    });
  }
}

if (process.argv[1]?.endsWith("smoke-report-export-ui.ts")) {
  runReportExportUiSmoke()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
