import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const adminActionsSource = readFileSync(
  fileURLToPath(new URL("./admin.ts", import.meta.url)),
  "utf8",
);

describe("admin reporting actions", () => {
  it("lets admin excuse only missed report tasks with a required reason, audit, and full revalidation", () => {
    expect(adminActionsSource).toContain(
      "export async function excuseAdminReportTask",
    );
    expect(adminActionsSource).toContain(
      'idSchema.parse(formData.get("report_task_id"))',
    );
    expect(adminActionsSource).toContain(
      'reportTaskExcuseReasonSchema.parse(formData.get("excuse_reason"))',
    );
    expect(adminActionsSource).toContain('.from("campaign_report_tasks")');
    expect(adminActionsSource).toContain('task.status !== "missed"');
    expect(adminActionsSource).toContain('status: "excused"');
    expect(adminActionsSource).toContain("excused_at: excusedAt");
    expect(adminActionsSource).toContain("missed_at: null");
    expect(adminActionsSource).toContain(
      "review_note: `Excused by admin: ${excuseReason}`",
    );
    expect(adminActionsSource).not.toContain(
      'review_note: "Excused by admin"',
    );
    expect(adminActionsSource).toContain('action: "excuse_report_task"');
    expect(adminActionsSource).toContain(
      'target_type: "campaign_report_task"',
    );
    expect(adminActionsSource).toContain('previous_status: task.status');
    expect(adminActionsSource).toContain('new_status: "excused"');
    expect(adminActionsSource).toContain("reason: excuseReason");
    expect(adminActionsSource).toContain("const { error: auditError }");
    expect(adminActionsSource).toContain(
      'if (auditError) throw new Error(auditError.message)',
    );
    expect(adminActionsSource).toContain('revalidatePath("/admin/campaigns")');
    expect(adminActionsSource).toContain('revalidatePath("/admin/reports")');
    expect(adminActionsSource).toContain(
      "revalidatePath(`/admin/campaigns/${task.campaign_id}`)",
    );
    expect(adminActionsSource).toContain(
      "revalidatePath(`/b/campaigns/${task.campaign_id}`)",
    );
    expect(adminActionsSource).toContain(
      "revalidatePath(`/b/campaigns/${task.campaign_id}/report`)",
    );
    expect(adminActionsSource).toContain(
      "revalidatePath(`/i/campaigns/${task.campaign_id}`)",
    );
  });

  it("lets admin retry failed report exports with a new durable job and audit trail", () => {
    expect(adminActionsSource).toContain(
      "export async function retryAdminReportExportJob",
    );
    expect(adminActionsSource).toContain(
      'idSchema.parse(formData.get("report_export_job_id"))',
    );
    expect(adminActionsSource).toContain('.from("report_export_jobs")');
    expect(adminActionsSource).toContain('exportJob.status !== "failed"');
    expect(adminActionsSource).toContain("buildCampaignSharedReport");
    expect(adminActionsSource).toContain("buildReportCompositionExportData");
    expect(adminActionsSource).toContain("/functions/v1/generate-report");
    expect(adminActionsSource).toContain('action: "retry_report_export"');
    expect(adminActionsSource).toContain('target_type: "report_export_job"');
    expect(adminActionsSource).toContain('previous_status: exportJob.status');
    expect(adminActionsSource).toContain("new_job_id: payload.jobId");
    expect(adminActionsSource).toContain("format: exportJob.format");
    expect(adminActionsSource).toContain(
      'if (auditError) throw new Error(auditError.message)',
    );
    expect(adminActionsSource).toContain('revalidatePath("/admin/reports")');
    expect(adminActionsSource).toContain(
      "revalidatePath(`/admin/campaigns/${exportJob.campaign_id}`)",
    );
    expect(adminActionsSource).toContain(
      "revalidatePath(`/b/campaigns/${exportJob.campaign_id}/report`)",
    );
  });

  it("lets admin record proof review interventions without changing evidence truth", () => {
    expect(adminActionsSource).toContain(
      "export async function recordAdminProofReviewIntervention",
    );
    expect(adminActionsSource).toContain(
      'idSchema.parse(formData.get("evidence_id"))',
    );
    expect(adminActionsSource).toContain(
      'proofReviewInterventionNoteSchema.parse(',
    );
    expect(adminActionsSource).toContain(
      'formData.get("intervention_note")',
    );
    expect(adminActionsSource).toContain(
      '.from("content_performance_evidence")',
    );
    expect(adminActionsSource).toContain(
      'evidence.verification_status !== "submitted"',
    );
    expect(adminActionsSource).toContain(
      "Only submitted proof awaiting brand review can be intervened on",
    );
    expect(adminActionsSource).not.toContain(
      '.from("content_performance_evidence")\n    .update(',
    );
    expect(adminActionsSource).toContain(
      'action: "record_proof_review_intervention"',
    );
    expect(adminActionsSource).toContain(
      'target_type: "content_performance_evidence"',
    );
    expect(adminActionsSource).toContain(
      "verification_status: evidence.verification_status",
    );
    expect(adminActionsSource).toContain("reason: interventionNote");
    expect(adminActionsSource).toContain(
      'if (auditError) throw new Error(auditError.message)',
    );
    expect(adminActionsSource).toContain('revalidatePath("/admin/reports")');
    expect(adminActionsSource).toContain(
      "revalidatePath(`/admin/campaigns/${evidence.campaign_id}`)",
    );
    expect(adminActionsSource).toContain(
      "revalidatePath(`/b/campaigns/${evidence.campaign_id}/report`)",
    );
  });
});
