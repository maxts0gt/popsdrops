import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const scriptPath = "scripts/smoke-admin-report-command-center.mjs";

describe("admin report command center smoke", () => {
  it("is wired into the release smoke gate", () => {
    expect(packageJson.scripts["smoke:admin-report-command-center"]).toBe(
      `node ${scriptPath}`,
    );
    expect(packageJson.scripts["smoke:release"]).toContain(
      "npm run smoke:admin-report-command-center",
    );
    expect(packageJson.scripts["smoke:web-release"]).toContain(
      "npm run smoke:admin-report-command-center",
    );
    expect(existsSync(scriptPath)).toBe(true);
  });

  it("proves the admin report page shows seeded proof-room exceptions", () => {
    const source = readFileSync(scriptPath, "utf8");

    expect(source).toContain("setupApplicationFlowSmokeData");
    expect(source).toContain("cleanupApplicationFlowSmokeData");
    expect(source).toContain("campaign_report_tasks");
    expect(source).toContain("content_performance_evidence");
    expect(source).toContain("report_export_jobs");
    expect(source).toContain("admin-report-priority-rail");
    expect(source).toContain("admin-report-priority-kind");
    expect(source).toContain("admin-report-priority-title");
    expect(source).toContain("admin-report-priority-impact");
    expect(source).toContain("admin-report-priority-share-gate-panel");
    expect(source).toContain("admin-report-priority-share-gate");
    expect(source).toContain("admin-report-priority-operations");
    expect(source).toContain("admin-report-priority-age");
    expect(source).toContain("admin-report-priority-next-step");
    expect(source).toContain("admin-report-priority-owner");
    expect(source).toContain("admin-report-priority-clearance");
    expect(source).toContain("priority intervention");
    expect(source).toContain("admin-report-command-summary");
    expect(source).toContain("admin-report-campaign-readiness");
    expect(source).toContain("admin-report-campaign-readiness-row");
    expect(source).toContain("admin-report-campaign-readiness-count");
    expect(source).toContain("admin-report-campaign-readiness-status");
    expect(source).toContain("admin-report-campaign-readiness-primary");
    expect(source).toContain("admin-report-campaign-readiness-share-gate");
    expect(source).toContain("admin-report-campaign-readiness-clearance");
    expect(source).toContain("Campaign leadership readiness");
    expect(source).toContain("Leadership hold");
    expect(source).toContain("top leadership gate");
    expect(source).toContain("admin-report-exception-row");
    expect(source).toContain("admin-report-exception-decision-grid");
    expect(source).toContain("admin-report-exception-impact");
    expect(source).toContain("admin-report-exception-share-gate");
    expect(source).toContain("admin-report-exception-operations-grid");
    expect(source).toContain("admin-report-exception-age");
    expect(source).toContain("admin-report-exception-next-step");
    expect(source).toContain("admin-report-exception-owner");
    expect(source).toContain("admin-report-exception-clearance");
    expect(source).toContain("admin-campaign-focus-panel");
    expect(source).toContain("admin-reporting-exception-row");
    expect(source).toContain("admin-reporting-evidence-review-row");
    expect(source).toContain("admin-reporting-proof-intervention-form");
    expect(source).toContain("admin-reporting-proof-intervention-note");
    expect(source).toContain("admin-reporting-proof-intervention-submit");
    expect(source).toContain("ADMIN_REPORT_PROOF_INTERVENTION_NOTE");
    expect(source).toContain("Record intervention");
    expect(source).toContain("Saved to admin audit. Does not verify proof");
    expect(source).toContain("Verify admin report command center proof intervention audit entry");
    expect(source).toContain("record_proof_review_intervention");
    expect(source).toContain("admin-reporting-excuse-reason");
    expect(source).toContain("ADMIN_REPORT_EXCUSE_REASON");
    expect(source).toContain("Verify admin report command center excused task");
    expect(source).toContain("Verify admin report command center audit entry");
    expect(source).toContain("admin-reporting-export-failure-row");
    expect(source).toContain("admin-reporting-export-retry-form");
    expect(source).toContain("Retry export");
    expect(source).toContain("Verify admin report command center retried export job");
    expect(source).toContain("Verify admin report command center export retry audit entry");
    expect(source).toContain("retry_report_export");
    expect(source).toContain("Retry report export");
    expect(source).toContain("Reporting intervention trace");
    expect(source).toContain("admin-reporting-intervention-trace");
    expect(source).toContain("admin-reporting-intervention-reason");
    expect(source).toContain("Review SLA breach");
    expect(source).toContain("Proof review older than 24h");
    expect(source).toContain("Ask the brand owner to review or intervene.");
    expect(source).toContain("admin-report-sla-breach-count");
    expect(source).toContain("admin-report-command-proof.png");
    expect(source).toContain("returnedTaskId");
    expect(source).toContain("returnedRejectedEvidenceId");
    expect(source).toContain("returnedSubmittedEvidenceId");
    expect(source).toContain("admin-report-command-returned-proof.png");
    expect(source).toContain("Correction returned");
    expect(source).toContain("Corrected proof awaiting brand review");
    expect(source).toContain("replaced a rejected proof");
    expect(source).toContain("Report command center");
    expect(source).toContain("Needs brand review");
    expect(source).toContain("Missed report");
    expect(source).toContain("Correction request");
    expect(source).toContain("Export failure");
    expect(source).toContain("Leadership impact");
    expect(source).toContain("Leadership share gate");
    expect(source).toContain("Next move");
    expect(source).toContain("Escalation owner");
    expect(source).toContain("Clears when");
    expect(source).toContain("Waiting");
    expect(source).toContain("waiting");
    expect(source).toContain("Brand owner");
    expect(source).toContain("PopsDrops ops");
    expect(source).toContain("Leadership hold until brand verifies submitted proof.");
    expect(source).toContain("Leadership hold until replacement artifact is generated.");
    expect(source).toContain("Leadership hold unless the missed read is excused with audit trail.");
    expect(source).toContain("Leadership hold until creator returns usable proof.");
    expect(source).toContain("Leadership hold until corrected proof is reviewed.");
    expect(source).toContain("Blocks report confidence until brand confirms proof.");
    expect(source).toContain("Open the campaign and push brand proof review.");
    expect(source).toContain("Brand reviews or requests correction on submitted proof.");
    expect(source).toContain("Blocks board-ready artifact delivery.");
    expect(source).toContain("Open the campaign and retry or inspect the failed export.");
    expect(source).toContain("Replacement export completes and old failure is traced.");
    expect(source).toContain("Blocks complete creator readout unless excused.");
    expect(source).toContain("Open the campaign and excuse only with a written audit reason.");
    expect(source).toContain("Creator submits proof or admin excuses with a written audit reason.");
    expect(source).toContain("?focus=reporting#admin-reporting-exceptions");
    expect(source).toContain("admin-report-command-center-smoke.png");
    expect(source).toContain("admin-report-command-center-drill-in-smoke.png");
    expect(source).toContain("process.exit(0);");
  });

  it("sets explicit evidence timestamps when seeding mixed proof rows", () => {
    const source = readFileSync(scriptPath, "utf8");
    const evidenceInsertSource = source.slice(
      source.indexOf("Create admin report command center evidence rows"),
      source.indexOf("Create admin report command center failed export"),
    );

    expect(evidenceInsertSource.split("created_at:").length - 1).toBe(4);
    expect(evidenceInsertSource).toContain("created_at: reviewSlaBreachIso");
    expect(evidenceInsertSource).toContain("created_at: nowIso");
    expect(evidenceInsertSource).toContain("created_at: returnedRejectedIso");
    expect(evidenceInsertSource).toContain("created_at: returnedSubmittedIso");
  });
});
