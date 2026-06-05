import { existsSync, readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

describe("report export artifact smoke contract", () => {
  it("exposes a real Supabase artifact smoke for every durable export format", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
    const sourcePath = "scripts/smoke-report-export-artifacts.ts";

    expect(packageJson.scripts["smoke:report-export-artifacts"]).toBe(
      "NODE_OPTIONS='--conditions react-server' npm exec -- tsx scripts/smoke-report-export-artifacts.ts",
    );
    expect(packageJson.scripts["smoke:critical"]).not.toContain(
      "smoke:report-export-artifacts",
    );
    expect(existsSync(sourcePath)).toBe(true);

    const source = readFileSync(sourcePath, "utf8");

    expect(source).toContain("REPORT_EXPORT_ARTIFACT_FORMATS");
    expect(source).toContain("[\"html\", \"json\", \"csv\"]");
    expect(source).toContain("REPORT_EXPORT_ARTIFACT_CUSTOM_TITLE");
    expect(source).toContain("configureReportExportArtifactStory");
    expect(source).toContain("assertArtifactContainsConfiguredStory");
    expect(source).toContain("runContentReportManualSourceSmoke");
    expect(source).toContain("buildCampaignSharedReport");
    expect(source).toContain("/functions/v1/generate-report");
    expect(source).toContain("report_export_jobs");
    expect(source).toContain("report-exports");
    expect(source).toContain("Data source");
    expect(source).toContain("Brand-reviewed proof");
    expect(source).toContain("Creator evidence reviewed by brand");
    expect(source).toContain("Proof view");
    expect(source).toContain("Evidence audit");
    expect(source).toContain("Global Proof Room");
    expect(source).toContain("JSON report export does not preserve decision story.");
    expect(source).toContain("cleanupApplicationFlowSmokeData");
  });

  it("keeps the Edge report export helper aligned with the web story contract", () => {
    const edgeSource = readFileSync(
      "supabase/functions/_shared/report-export.ts",
      "utf8",
    );

    expect(edgeSource).toContain("export interface ReportExportStory");
    expect(edgeSource).toContain("story?: ReportExportStory");
    expect(edgeSource).toContain("story: buildReportExportStory(normalized)");
    expect(edgeSource).toContain("export function buildReportExportStory");
    expect(edgeSource).toContain(
      'const statusText = `${reportStatus?.label ?? ""} ${reportStatus?.value ?? ""}`.toLowerCase();',
    );
    expect(edgeSource).not.toContain(
      'const statusText = `${reportStatus?.label ?? ""} ${reportStatus?.value ?? ""} ${reportStatus?.detail ?? ""}`.toLowerCase();',
    );
  });
});
