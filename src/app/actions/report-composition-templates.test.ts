import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(fileURLToPath(new URL("../../../", import.meta.url)));
const actionPath = path.join(projectRoot, "src/app/actions/report-composition-templates.ts");
const exportActionPath = path.join(projectRoot, "src/app/actions/report-export-jobs.ts");
const reportPagePath = path.join(
  projectRoot,
  "src/app/(site)/(app)/b/campaigns/[id]/report/page.tsx",
);
const migrationDir = path.join(projectRoot, "supabase/migrations");

function findReportTemplateMigration() {
  return readdirSync(migrationDir)
    .filter((file) => file.endsWith(".sql"))
    .map((file) => path.join(migrationDir, file))
    .find((filePath) =>
      readFileSync(filePath, "utf8").includes("report_composition_templates"),
    );
}

function findReportPresentationMigration() {
  return readdirSync(migrationDir)
    .filter((file) => file.endsWith(".sql"))
    .map((file) => path.join(migrationDir, file))
    .find((filePath) => readFileSync(filePath, "utf8").includes("report_presentation"));
}

describe("report composition templates", () => {
  it("stores reusable report compositions as brand-workspace templates", () => {
    expect(existsSync(actionPath)).toBe(true);

    const migrationPath = findReportTemplateMigration();
    expect(migrationPath).toBeTruthy();

    const actionSource = readFileSync(actionPath, "utf8");
    const exportActionSource = readFileSync(exportActionPath, "utf8");
    const pageSource = readFileSync(reportPagePath, "utf8");
    const migrationSource = readFileSync(migrationPath!, "utf8");

    expect(actionSource).toContain("listReportCompositionTemplates");
    expect(actionSource).toContain("saveReportCompositionTemplate");
    expect(actionSource).toContain("normalizeReportCompositionTemplateInput");
    expect(actionSource).toContain("assertBrandWorkspacePermission");
    expect(actionSource).toContain("report_composition_templates");

    expect(exportActionSource).toContain("templateId?: string | null");
    expect(exportActionSource).toContain("loadReportCompositionTemplateForExport");
    expect(exportActionSource).toContain("template:");

    expect(pageSource).toContain("listReportCompositionTemplates");
    expect(pageSource).toContain("saveReportCompositionTemplate");
    expect(pageSource).toContain("selectedReportTemplateId");
    expect(pageSource).toContain("data-testid=\"report-builder-template\"");
    expect(pageSource).toContain("data-testid=\"report-builder-save-template\"");
    expect(pageSource).toContain("data-testid=\"report-builder-save-template-submit\"");
    const saveTemplateHandler = pageSource.slice(
      pageSource.indexOf("const saveReportTemplateFromBuilder"),
      pageSource.indexOf("const saveCampaignReportGoalFromBuilder"),
    );
    expect(saveTemplateHandler.indexOf("setSaveTemplateDialogOpen(false);"))
      .toBeLessThan(saveTemplateHandler.indexOf("setReportTemplates((current) => ["));

    expect(migrationSource).toContain("create table if not exists public.report_composition_templates");
    expect(migrationSource).toContain("alter table public.report_composition_templates enable row level security");
    expect(migrationSource).toContain("grant select, insert, update, delete on public.report_composition_templates to authenticated");
    expect(migrationSource).toContain("report_composition_templates_select_access");
    expect(migrationSource).toContain("report_composition_templates_write_access");
    expect(migrationSource).toContain("report_composition_templates_one_default");
    expect(migrationSource).toContain("block_ids @> array['report_trust']");
  });

  it("lets brands save the current report shape back to the campaign plan", () => {
    const actionSource = readFileSync(actionPath, "utf8");
    const pageSource = readFileSync(reportPagePath, "utf8");

    expect(actionSource).toContain("saveCampaignReportComposition");
    expect(actionSource).toContain("saveCampaignReportCompositionSchema");
    expect(actionSource).toContain('assertBrandWorkspacePermission');
    expect(actionSource).toContain('.from("campaign_reporting_plans")');
    expect(actionSource).toContain(".upsert({");
    expect(actionSource).toContain("report_template_id:");
    expect(actionSource).toContain("report_preset_id:");
    expect(actionSource).toContain("report_chart_mode_id:");
    expect(actionSource).toContain("report_block_ids:");
    expect(actionSource).toContain('onConflict: "campaign_id"');

    expect(pageSource).toContain("saveCampaignReportComposition");
    expect(pageSource).toContain("saveCampaignReportGoalFromBuilder");
    expect(pageSource).toContain("campaignReportGoalSaving");
    expect(pageSource).toContain("campaignReportGoalSaved");
    expect(pageSource).toContain('data-testid="report-builder-save-campaign-shape"');
    expect(pageSource).toContain('toast.success(t("builder.saveCampaign.saved"))');
  });

  it("persists presentation controls with reusable templates and campaign plans", () => {
    const presentationMigrationPath = findReportPresentationMigration();
    expect(presentationMigrationPath).toBeTruthy();

    const actionSource = readFileSync(actionPath, "utf8");
    const exportActionSource = readFileSync(exportActionPath, "utf8");
    const pageSource = readFileSync(reportPagePath, "utf8");
    const stringsSource = readFileSync(
      path.join(projectRoot, "src/lib/i18n/strings.ts"),
      "utf8",
    );
    const migrationSource = readFileSync(presentationMigrationPath!, "utf8");

    expect(actionSource).toContain("normalizeReportBuilderPresentation");
    expect(actionSource).toContain("reportPresentationSchema");
    expect(actionSource).toContain("report_presentation");
    expect(actionSource).toContain("presentation:");

    expect(exportActionSource).toContain("presentation?:");
    expect(exportActionSource).toContain("report_presentation");
    expect(exportActionSource).toContain("presentation: template?.presentation");

    expect(pageSource).toContain("selectedReportPresentation");
    expect(pageSource).toContain("setSelectedReportPresentation");
    expect(pageSource).toContain("data-testid=\"report-builder-presentation\"");
    expect(pageSource).toContain("data-testid=\"report-builder-presentation-option\"");
    expect(pageSource).toContain("data-testid=\"report-builder-tile-controls\"");
    expect(pageSource).toContain("data-testid=\"report-builder-kpi-tile\"");
    expect(pageSource).toContain("data-testid=\"report-builder-trust-tile\"");
    expect(stringsSource).toContain("builder.output.presentation");
    expect(stringsSource).toContain("builder.output.kpiTiles");
    expect(stringsSource).toContain("builder.output.proofTiles");

    expect(migrationSource).toContain("alter table public.report_composition_templates");
    expect(migrationSource).toContain("alter table public.campaign_reporting_plans");
    expect(migrationSource).toContain("report_presentation jsonb");
    expect(migrationSource).toContain("campaign_visual");
    expect(migrationSource).toContain("proof_room");
    expect(migrationSource).toContain("typography");
    expect(migrationSource).toContain("density");
    expect(actionSource).toContain("chartMetricKey: z.enum");
    expect(pageSource).toContain("report-builder-chart-focus");
    expect(pageSource).toContain("chartMetricKey: activePresentation.chartMetricKey ?? activeChartMetricKey");
  });

  it("persists executive KPI and proof tile choices with report presentation", () => {
    const actionSource = readFileSync(actionPath, "utf8");
    const pageSource = readFileSync(reportPagePath, "utf8");
    const stringsSource = readFileSync(
      path.join(projectRoot, "src/lib/i18n/strings.ts"),
      "utf8",
    );
    const smokeSource = readFileSync(
      path.join(projectRoot, "scripts/smoke-report-export-ui.ts"),
      "utf8",
    );

    expect(actionSource).toContain("kpiIds: z.array");
    expect(actionSource).toContain("trustIds: z.array");
    expect(actionSource).toContain("kpiLabels: z.record");
    expect(actionSource).toContain("trustLabels: z.record");
    expect(actionSource).toContain("sectionLabels: z.record");
    expect(pageSource).toContain("selectedReportPresentation.kpiIds");
    expect(pageSource).toContain("selectedReportPresentation.trustIds");
    expect(pageSource).toContain("selectedReportPresentation.kpiLabels");
    expect(pageSource).toContain("selectedReportPresentation.trustLabels");
    expect(pageSource).toContain("selectedReportPresentation.sectionLabels");
    expect(pageSource).toContain("metricTileOptions");
    expect(pageSource).toContain("trustTileOptions");
    expect(pageSource).toContain("visibleReportCards");
    expect(pageSource).toContain("visibleReportTrustItems");
    expect(pageSource).toContain('data-testid="report-builder-section-labels"');
    expect(pageSource).toContain('data-testid="report-builder-section-label"');
    expect(pageSource).toContain('data-testid="report-builder-kpi-tile-label"');
    expect(pageSource).toContain('data-testid="report-builder-trust-tile-label"');
    expect(stringsSource).toContain('"builder.tiles.title": "Executive tiles"');
    expect(stringsSource).toContain('"builder.tiles.kpis": "KPI tiles"');
    expect(stringsSource).toContain('"builder.tiles.labels": "Tile labels"');
    expect(stringsSource).toContain('"builder.sectionLabels.title": "Section labels"');
    expect(stringsSource).toContain('"builder.output.proofTiles": "Proof tiles"');
    expect(smokeSource).toContain("Saved report template did not persist the selected KPI tiles.");
    expect(smokeSource).toContain("Campaign report plan did not persist the selected proof tiles.");
    expect(smokeSource).toContain("Saved report template did not persist the custom KPI tile labels.");
  });

  it("exposes executive framing controls so brands can rewrite report titles and questions", () => {
    const actionSource = readFileSync(actionPath, "utf8");
    const pageSource = readFileSync(reportPagePath, "utf8");
    const stringsSource = readFileSync(
      path.join(projectRoot, "src/lib/i18n/strings.ts"),
      "utf8",
    );

    expect(actionSource).toContain("headline: z.string()");
    expect(actionSource).toContain("executiveQuestion: z.string()");
    expect(pageSource).toContain('data-testid="report-builder-framing"');
    expect(pageSource).toContain('data-testid="report-builder-headline"');
    expect(pageSource).toContain('data-testid="report-builder-executive-question"');
    expect(pageSource).toContain("selectedReportDisplayTitle");
    expect(pageSource).toContain("selectedReportPresentation.headline");
    expect(pageSource).toContain("selectedReportPresentation.executiveQuestion");
    expect(stringsSource).toContain('"builder.framing.title": "Executive framing"');
    expect(stringsSource).toContain('"builder.framing.headline": "Report title"');
    expect(stringsSource).toContain('"builder.framing.question": "Executive question"');
  });

  it("keeps the report builder organized around the executive story sequence", () => {
    const pageSource = readFileSync(reportPagePath, "utf8");
    const stringsSource = readFileSync(
      path.join(projectRoot, "src/lib/i18n/strings.ts"),
      "utf8",
    );

    expect(pageSource).toContain('data-testid="report-builder-layout"');
    expect(pageSource).toContain('data-testid="report-builder-control-panel"');
    expect(pageSource).toContain('data-testid="report-builder-preview-panel"');
    expect(pageSource).toContain('data-testid="report-builder-story-strip"');
    expect(pageSource).toContain('data-testid="report-builder-story-step"');
    expect(pageSource).toContain('data-testid="report-builder-template-strip"');
    expect(pageSource).toContain('data-testid="report-builder-template-more"');
    expect(pageSource).toContain('data-story-step="decision"');
    expect(pageSource).toContain('data-story-step="evidence"');
    expect(pageSource).toContain('data-story-step="presentation"');
    expect(pageSource).toContain('data-story-step="order"');
    expect(pageSource).toContain("visibleTemplates");
    expect(pageSource).toContain('builder.story.decision');
    expect(pageSource).toContain('builder.story.evidence');
    expect(pageSource).toContain('builder.story.presentation');
    expect(pageSource).toContain('builder.story.order');
    expect(pageSource).toContain('builder.story.previewTitle');
    expect(pageSource).toContain('builder.story.controlTitle');
    expect(pageSource).toContain('builder.story.trustLocked');
    expect(pageSource).toContain('builder.story.outputPreview');
    expect(pageSource).toContain('builder.templates.moreSaved');

    expect(stringsSource).toContain('"builder.story.title": "Executive story"');
    expect(stringsSource).toContain('"builder.story.previewTitle": "Preview spine"');
    expect(stringsSource).toContain('"builder.story.controlTitle": "Build the report"');
    expect(stringsSource).toContain('"builder.story.decision": "Decision story"');
    expect(stringsSource).toContain('"builder.story.evidence": "Evidence view"');
    expect(stringsSource).toContain('"builder.story.presentation": "Export style"');
    expect(stringsSource).toContain('"builder.story.order": "Story order"');
    expect(stringsSource).toContain('"builder.templates.moreSaved": "{count} more saved"');
  });
});
