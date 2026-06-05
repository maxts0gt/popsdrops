import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const actionPath = path.join(projectRoot, "src/app/actions/report-export-jobs.ts");
const reportPagePath = path.join(
  projectRoot,
  "src/app/(site)/(app)/b/campaigns/[id]/report/page.tsx",
);
const sharedReportPath = path.join(projectRoot, "src/lib/reporting/shared-report-data.ts");
const contractPath = path.join(projectRoot, "src/lib/reporting/report-export-contract.ts");
const servicePath = path.join(projectRoot, "src/lib/reporting/report-export-service.ts");
const edgeFunctionPath = path.join(projectRoot, "supabase/functions/generate-report/index.ts");
const edgeExportHelperPath = path.join(
  projectRoot,
  "supabase/functions/_shared/report-export.ts",
);
const edgeContractPath = path.join(
  projectRoot,
  "supabase/functions/_shared/report-export-contract.ts",
);
const adminActionPath = path.join(projectRoot, "src/app/actions/admin.ts");
const migrationPath = path.join(
  projectRoot,
  "supabase/migrations/20260507193000_report_export_jobs.sql",
);
const supabaseConfigPath = path.join(projectRoot, "supabase/config.toml");

describe("report export jobs", () => {
  it("routes durable data exports through Supabase", () => {
    expect(existsSync(actionPath)).toBe(true);
    expect(existsSync(edgeFunctionPath)).toBe(true);
    expect(existsSync(edgeExportHelperPath)).toBe(true);
    expect(existsSync(migrationPath)).toBe(true);

    const actionSource = readFileSync(actionPath, "utf8");
    const adminActionSource = readFileSync(adminActionPath, "utf8");
    const pageSource = readFileSync(reportPagePath, "utf8");
    const sharedReportSource = readFileSync(sharedReportPath, "utf8");
    const contractSource = readFileSync(contractPath, "utf8");
    const serviceSource = readFileSync(servicePath, "utf8");
    const edgeSource = readFileSync(edgeFunctionPath, "utf8");
    const edgeExportHelperSource = readFileSync(edgeExportHelperPath, "utf8");
    const edgeContractSource = readFileSync(edgeContractPath, "utf8");
    const migrationSource = readFileSync(migrationPath, "utf8");
    const supabaseConfig = readFileSync(supabaseConfigPath, "utf8");
    const contractVersion = contractSource.match(
      /REPORT_EXPORT_CONTRACT_VERSION = "([^"]+)"/,
    )?.[1];
    const edgeContractVersion = edgeContractSource.match(
      /REPORT_EXPORT_CONTRACT_VERSION = "([^"]+)"/,
    )?.[1];

    expect(sharedReportSource).toContain("export async function buildCampaignSharedReport");
    expect(sharedReportSource).toContain("buildReportProofOperations");
    expect(actionSource).toContain("requestReportExport");
    expect(actionSource).toContain("buildCampaignSharedReport");
    expect(actionSource).toContain("buildReportCompositionExportData");
    expect(actionSource).toContain("blockIds?: ReportBuilderBlockId[]");
    expect(actionSource).toContain("chartModeId?: ReportBuilderChartModeId");
    expect(actionSource).toContain("presentation?: ReportBuilderPresentation");
    expect(actionSource).toContain("presetId?: ReportBuilderPresetSelectionId");
    expect(actionSource).toContain("/functions/v1/generate-report");
    expect(contractVersion).toBeTruthy();
    expect(edgeContractVersion).toBe(contractVersion);
    expect(contractVersion).toBe("report-export-proof-next-actions-v10-2026-06-05");
    expect(actionSource).toContain("assertReportExportServiceReady()");
    expect(serviceSource).toContain('method: "GET"');
    expect(serviceSource).toContain("STALE_REPORT_EXPORT_SERVICE_ERROR");
    expect(actionSource).toContain("assertReportExportServiceContractVersion(payload)");
    expect(adminActionSource).toContain("assertReportExportServiceReady()");
    expect(adminActionSource).toContain("assertReportExportServiceContractVersion(responsePayload)");
    expect(edgeSource).toContain("requireServiceRole");
    expect(edgeSource).toContain('if (req.method === "GET")');
    expect(edgeSource).toContain("contractVersion: REPORT_EXPORT_CONTRACT_VERSION");
    expect(edgeSource).toContain("report-exports");
    expect(edgeSource).toContain("report_export_jobs");
    expect(edgeSource).toContain("createSignedUrl");
    expect(edgeSource).toContain("composition: z");
    expect(edgeSource).toContain("reportTitle: z.string()");
    expect(edgeSource).toContain("bestFor: z.string()");
    expect(edgeSource).toContain("executiveQuestion: z.string()");
    expect(edgeSource).toContain("chartLayoutTitle: z.string()");
    expect(edgeSource).toContain("chartLayoutDetail: z.string()");
    expect(edgeSource).toContain("campaignImageAlt: z.string()");
    expect(edgeSource).toContain("presentation: z");
    expect(edgeSource).toContain("headline: z.string()");
    expect(edgeSource).toContain("coverMode: z.enum");
    expect(edgeSource).toContain("chartMetricKey: z.enum");
    expect(edgeSource).toContain("const reportStorySchema = z.object");
    expect(edgeSource).toContain("const leadershipHandoffSchema = z.object");
    expect(edgeSource).toContain("const proofOperationsSchema = z.object");
    expect(edgeSource).toContain("story: reportStorySchema.optional()");
    expect(edgeSource).toContain("leadershipHandoff: leadershipHandoffSchema.optional()");
    expect(edgeSource).toContain("proofOperations: proofOperationsSchema.optional()");
    expect(edgeSource).toContain("proofBasis: z.array(leadershipProofBasisItemSchema)");
    expect(edgeSource).toContain("buildReportFilename(");
    expect(edgeSource).toContain("report.composition?.reportTitle ?? report.campaignTitle");
    expect(edgeSource).toContain("executivePurpose: z.string()");
    expect(edgeExportHelperSource).toContain("[\"Report Composition\"]");
    expect(edgeExportHelperSource).toContain(
      "[\"Report plan\", data.composition.presetTitle, data.composition.presetDetail]",
    );
    expect(edgeExportHelperSource).toContain('class="composition-ledger"');
    expect(edgeExportHelperSource).toContain('class="composition-row"');
    expect(edgeExportHelperSource).toContain('key: "report-plan"');
    expect(edgeExportHelperSource).toContain('data-composition-row="${escapeHtml(row.key)}"');
    expect(edgeExportHelperSource).toContain('class="block-ledger"');
    expect(edgeExportHelperSource).toContain('class="block-row"');
    expect(edgeExportHelperSource).toContain('data-report-block-row="${escapeHtml(block.id)}"');
    expect(edgeExportHelperSource).not.toContain('class="block-grid"');
    expect(edgeExportHelperSource).not.toContain('class="block-card"');
    expect(edgeExportHelperSource).not.toContain("<p>Team template</p>");
    expect(edgeExportHelperSource).toContain("[\"Best for\", data.composition.bestFor]");
    expect(edgeExportHelperSource).toContain("[\"Executive question\", data.composition.executiveQuestion]");
    expect(edgeExportHelperSource).toContain("[\"Chart layout\", data.composition.chartLayoutTitle, data.composition.chartLayoutDetail]");
    expect(edgeExportHelperSource).toContain("[\"Cover\", getReportCoverModeLabel(presentation.coverMode)]");
    expect(edgeExportHelperSource).toContain("[\"Typography\", getReportTypographyLabel(presentation.typography)]");
    expect(edgeExportHelperSource).toContain("[\"Density\", getReportDensityLabel(presentation.density)]");
    expect(edgeSource).toContain("recommendations: z");
    expect(edgeExportHelperSource).toContain("[\"ID\", \"Title\", \"Detail\", \"Executive purpose\"]");
    expect(edgeExportHelperSource).toContain("block.executivePurpose ?? \"\"");
    expect(edgeExportHelperSource).toContain("Executive purpose");
    expect(edgeExportHelperSource).toContain("buildHtmlPrimaryReportStory");
    expect(edgeExportHelperSource).toContain('class="proof-operations-basis"');
    expect(edgeExportHelperSource).toContain('data-proof-basis-key="${escapeHtml(item.key)}"');
    expect(edgeExportHelperSource).toContain("report-story--trend");
    expect(edgeExportHelperSource).toContain("report-story--comparison");
    expect(edgeExportHelperSource).toContain("report-story--proof");
    expect(edgeExportHelperSource).toContain("data-report-chart-mode");
    expect(edgeExportHelperSource).toContain("chartMetricKey?:");
    expect(edgeExportHelperSource).toContain("data-comparison-focus");
    expect(edgeExportHelperSource).toContain("Creator comparison by");
    expect(edgeExportHelperSource).toContain("Lower CPE ranks first");
    expect(edgeExportHelperSource).toContain("data-report-cover-mode");
    expect(edgeExportHelperSource).toContain("report-hero--proof-room");
    expect(edgeExportHelperSource).toContain("campaignImageAlt?: string | null;");
    expect(edgeExportHelperSource).toContain("data.campaignImageAlt?.trim()");
    expect(edgeExportHelperSource).toContain("<figcaption>${escapeHtml(campaignImageAlt)}</figcaption>");
    expect(edgeExportHelperSource).toContain("object-fit: contain;");
    expect(edgeExportHelperSource).toContain("padding: 18px 18px 58px;");
    expect(edgeExportHelperSource).not.toContain("object-fit: cover;");
    expect(edgeExportHelperSource).toContain("buildReportHeroMetrics");
    expect(edgeExportHelperSource).toContain("data-cover-metric-source");
    expect(edgeExportHelperSource).toContain("data-cover-metric-key");
    expect(edgeExportHelperSource).not.toContain("<span>Report type</span>");
    expect(edgeExportHelperSource).not.toContain("<span>Primary view</span>");
    expect(edgeExportHelperSource).not.toContain("<span>Evidence status</span>");
    expect(edgeExportHelperSource).toContain("[\"Report Trust\"]");
    expect(edgeExportHelperSource).toContain("...data.trust.map");
    expect(edgeExportHelperSource).toContain("[\"Recommendations\"]");
    expect(edgeExportHelperSource).toContain("data.recommendations ?? []");
    expect(sharedReportSource).toContain("buildRecommendations");
    expect(migrationSource).toContain("create table if not exists public.report_export_jobs");
    expect(migrationSource).toContain("report_export_jobs_select_brand");
    expect(migrationSource).toContain("'report-exports'");
    expect(supabaseConfig).toContain("[functions.generate-report]");
    expect(supabaseConfig).toContain("verify_jwt = true");

    expect(pageSource).toContain("requestReportExport");
    expect(pageSource).not.toContain("exportReportHTML(reportExportData)");
    expect(pageSource).not.toContain("exportReportJSON(reportExportData)");
    expect(pageSource).not.toContain("exportReportCSV(reportExportData)");
  });
});
