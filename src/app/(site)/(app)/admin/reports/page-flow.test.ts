import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./page.tsx", import.meta.url)),
  "utf8",
);
const modelSource = readFileSync(
  fileURLToPath(
    new URL("../../../../../lib/admin/report-command-center.ts", import.meta.url),
  ),
  "utf8",
);

describe("admin reports command center", () => {
  it("turns admin reports into a protected proof-room exception console", () => {
    expect(source).toContain('export const dynamic = "force-dynamic";');
    expect(source).toContain("async function assertAdmin");
    expect(source).toContain("await getUser()");
    expect(source).toContain("notFound()");
    expect(source).toContain("createAdminClient()");
    expect(source).toContain("async function fetchReportCommandCenter");

    expect(source).toContain('.from("campaign_report_tasks")');
    expect(source).toContain('.from("content_performance_evidence")');
    expect(source).toContain('.from("report_export_jobs")');
    expect(source).toContain('.from("campaigns")');
    expect(source).toContain('["submitted", "missed", "needs_revision"]');
    expect(source).toContain('["submitted", "rejected", "verified"]');
    expect(source).toContain('.eq("status", "failed")');
    expect(source).toContain("buildReportCommandCenter({");
    expect(modelSource).toContain("isReportCommandReviewSlaBreached");
    expect(modelSource).toContain("reviewSlaBreachCount");
  });

  it("shows proof-room labels and exact admin drill-ins instead of generic dispute handling", () => {
    expect(source).toContain("Report command center");
    expect(source).toContain("Proof room exceptions");
    expect(source).toContain("Needs brand review");
    expect(source).toContain("Missing proof");
    expect(source).toContain("Missed reports");
    expect(source).toContain("Correction requests");
    expect(source).toContain("SLA breaches");
    expect(modelSource).toContain("Review SLA breach");
    expect(modelSource).toContain("Proof review older than 24h");
    expect(source).toContain("Export failures");
    expect(modelSource).toContain('if (kind === "review_sla") return 5;');
    expect(modelSource).toContain('if (kind === "export_failure") return 4;');
    expect(modelSource).toContain(
      'if (kind === "missed" || kind === "missing_evidence") return 3;',
    );
    expect(source).toContain("Priority intervention");
    expect(source).toContain('data-testid="admin-report-priority-rail"');
    expect(source).toContain('data-testid="admin-report-priority-kind"');
    expect(source).toContain('data-testid="admin-report-priority-title"');
    expect(source).toContain('data-testid="admin-report-priority-impact"');
    expect(source).toContain('data-testid="admin-report-priority-share-gate-panel"');
    expect(source).toContain('data-testid="admin-report-priority-share-gate"');
    expect(source).toContain('data-testid="admin-report-priority-operations"');
    expect(source).toContain('data-testid="admin-report-priority-age"');
    expect(source).toContain('data-testid="admin-report-priority-next-step"');
    expect(source).toContain('data-testid="admin-report-priority-owner"');
    expect(source).toContain('data-testid="admin-report-priority-clearance"');
    expect(source).toContain("const priorityException = command.rows[0] ?? null");
    expect(source.indexOf('data-testid="admin-report-priority-rail"')).toBeLessThan(
      source.indexOf('data-testid="admin-report-command-summary"'),
    );
    expect(source.indexOf('data-testid="admin-report-priority-impact"')).toBeLessThan(
      source.indexOf('data-testid="admin-report-priority-share-gate-panel"'),
    );
    expect(source.indexOf('data-testid="admin-report-priority-share-gate-panel"')).toBeLessThan(
      source.indexOf('data-testid="admin-report-priority-next-step"'),
    );
    expect(source).toContain('data-testid="admin-report-command-summary"');
    expect(source).toContain('data-testid="admin-report-campaign-readiness"');
    expect(source).toContain('data-testid="admin-report-campaign-readiness-row"');
    expect(source).toContain('data-testid="admin-report-campaign-readiness-count"');
    expect(source).toContain('data-testid="admin-report-campaign-readiness-status"');
    expect(source).toContain('data-testid="admin-report-campaign-readiness-primary"');
    expect(source).toContain('data-testid="admin-report-campaign-readiness-share-gate"');
    expect(source).toContain('data-testid="admin-report-campaign-readiness-clearance"');
    expect(source.indexOf('data-testid="admin-report-campaign-readiness"')).toBeLessThan(
      source.indexOf('data-testid="admin-report-exception-row"'),
    );
    expect(source).toContain("campaignReadiness");
    expect(source).toContain("campaignHoldCount");
    expect(source).toContain("admin-report-sla-breach-count");
    expect(source).toContain("missingEvidenceCount");
    expect(source).toContain('data-testid="admin-report-exception-row"');
    expect(source).toContain('data-testid="admin-report-exception-decision-grid"');
    expect(source).toContain('data-testid="admin-report-exception-impact"');
    expect(source).toContain('data-testid="admin-report-exception-share-gate"');
    expect(source).toContain('data-testid="admin-report-exception-operations-grid"');
    expect(source).toContain('data-testid="admin-report-exception-age"');
    expect(source).toContain('data-testid="admin-report-exception-next-step"');
    expect(source).toContain('data-testid="admin-report-exception-owner"');
    expect(source).toContain('data-testid="admin-report-exception-clearance"');
    expect(source).toContain('data-testid="admin-report-empty-state"');
    expect(modelSource).toContain("?focus=reporting#admin-reporting-exceptions");
    expect(modelSource).toContain("Open campaign");
    expect(modelSource).toContain("function ownerForKind");
    expect(modelSource).toContain("function clearanceForKind");
    expect(modelSource).toContain("function shareGateForKind");
    expect(modelSource).toContain("Brand owner");
    expect(modelSource).toContain("PopsDrops ops");
    expect(source).toContain("Escalation owner");
    expect(source).toContain("Clears when");
    expect(source).toContain("Waiting");
    expect(modelSource).toContain("waitingLabel");
    expect(modelSource).toContain("formatReportCommandWaitingAge");
    expect(source).toContain("Leadership share gate");
    expect(modelSource).toContain("Leadership hold until brand verifies submitted proof.");
    expect(modelSource).toContain("Leadership hold until the submitted task has evidence attached.");
    expect(modelSource).toContain("Leadership hold until replacement artifact is generated.");
    expect(modelSource).toContain("Leadership hold unless the missed read is excused with audit trail.");
    expect(modelSource).toContain("Leadership hold until creator returns usable proof.");
    expect(modelSource).toContain("Leadership hold until corrected proof is reviewed.");
    expect(modelSource).toContain("Blocks report confidence until brand confirms proof.");
    expect(modelSource).toContain("Blocks report confidence because submitted metrics have no proof source.");
    expect(modelSource).toContain("Open the campaign and push brand proof review.");
    expect(modelSource).toContain("Open the campaign and ask the creator to attach proof before review.");
    expect(modelSource).toContain("Brand reviews or requests correction on submitted proof.");
    expect(modelSource).toContain("Creator attaches evidence or admin returns the report task with an audit note.");
    expect(modelSource).toContain("Blocks board-ready artifact delivery.");
    expect(modelSource).toContain("Open the campaign and retry or inspect the failed export.");
    expect(modelSource).toContain("Replacement export completes and old failure is traced.");
    expect(modelSource).toContain("Blocks complete creator readout unless excused.");
    expect(modelSource).toContain("Open the campaign and excuse only with a written audit reason.");
    expect(modelSource).toContain("Creator submits proof or admin excuses with a written audit reason.");

    expect(source).not.toContain('"use client"');
    expect(source).not.toContain("Reports & Disputes");
    expect(source).not.toContain("Low Reviews");
    expect(source).not.toContain("Suspend User");
    expect(source).not.toContain("mailto:");
    expect(source).not.toContain("createClient");
  });

  it("treats returned correction proof as the current admin review state", () => {
    expect(modelSource).toContain("function getCurrentAdminEvidenceReviewRows");
    expect(modelSource).toContain("currentEvidenceRows");
    expect(modelSource).toContain("hasReturnedCorrection");
    expect(modelSource).toContain("correction_returned");
    expect(modelSource).toContain("Correction returned");
    expect(modelSource).toContain("Corrected proof awaiting brand review");
    expect(modelSource).toContain("replaced a rejected proof");
    expect(modelSource).toContain("row.status === \"correction\"");
    expect(modelSource).toContain("row.status === \"correction_returned\"");
  });
});
