import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./reporting-evidence.ts", import.meta.url),
  "utf8",
);
const edgeFunctionUrl = new URL(
  "../../../supabase/functions/analyze-performance-evidence/index.ts",
  import.meta.url,
);
const edgeFunctionSource = existsSync(edgeFunctionUrl)
  ? readFileSync(edgeFunctionUrl, "utf8")
  : "";
const reportNotificationsSource = readFileSync(
  new URL("../../lib/reporting/report-notifications.ts", import.meta.url),
  "utf8",
);

describe("reporting evidence actions", () => {
  it("creates scoped upload metadata before the browser uploads to Storage", () => {
    expect(source).toContain("export async function createPerformanceEvidenceUpload");
    expect(source).toContain(".from(\"content_performance_evidence\")");
    expect(source).toContain("assertReportTaskAcceptsCreatorSubmission");
    expect(source).toContain("assertReportTaskAcceptsCreatorSubmission(task.status)");
    expect(source).toContain("buildEvidenceStoragePath");
    expect(source).toContain("bucket: EVIDENCE_BUCKET_ID");
    expect(source).toContain("storagePath");
  });

  it("delegates AI extraction to the Supabase Edge Function", () => {
    expect(source).toContain("export async function analyzePerformanceEvidence");
    expect(source).toContain('.functions.invoke("analyze-performance-evidence"');
    expect(source).toContain("assertReportTaskAcceptsCreatorSubmission(task.status)");
    expect(source).not.toContain("generativelanguage.googleapis.com");
    expect(source).not.toContain("process.env.GEMINI_API_KEY");
  });

  it("falls back to manual confirmation when AI extraction is unavailable", () => {
    expect(source).toContain("function buildManualExtractionFallback");
    expect(source).toContain('status: "manual_required"');
    expect(source).toContain("return buildManualExtractionFallback(user.id)");
    expect(source).toContain("Evidence extraction returned no data");
  });

  it("keeps Gemini, private Storage download, and extraction audit inside Supabase", () => {
    expect(edgeFunctionSource).toContain(
      "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$",
    );
    expect(edgeFunctionSource).toContain("Deno.env.get(\"GEMINI_API_KEY\")");
    expect(edgeFunctionSource).toContain(".storage.from(evidence.bucket_id)");
    expect(edgeFunctionSource).toContain(".download(evidence.storage_path)");
    expect(edgeFunctionSource).toContain("content_performance_ai_extractions");
    expect(edgeFunctionSource).toContain("pending_confirmation");
  });

  it("does not create an AI extraction row when Gemini finds no visible metrics", () => {
    const emptyExtractionGuardIndex = edgeFunctionSource.indexOf(
      "if (extraction.metricValues.length === 0)",
    );
    const extractionInsertIndex = edgeFunctionSource.indexOf(
      '.from("content_performance_ai_extractions")',
      emptyExtractionGuardIndex,
    );

    expect(emptyExtractionGuardIndex).toBeGreaterThan(-1);
    expect(extractionInsertIndex).toBeGreaterThan(-1);
    expect(emptyExtractionGuardIndex).toBeLessThan(extractionInsertIndex);
    expect(edgeFunctionSource).toContain('status: "manual_required"');
    expect(edgeFunctionSource).toContain(
      "Evidence extraction returned no visible metrics.",
    );
  });

  it("parses structured CSV exports before falling back to Gemini", () => {
    const csvParserIndex = edgeFunctionSource.indexOf(
      "parseStructuredCsvMetricPayload",
    );
    const apiKeyIndex = edgeFunctionSource.indexOf("Deno.env.get(\"GEMINI_API_KEY\")");
    const geminiFetchIndex = edgeFunctionSource.indexOf(
      "generativelanguage.googleapis.com",
    );

    expect(csvParserIndex).toBeGreaterThan(-1);
    expect(apiKeyIndex).toBeGreaterThan(-1);
    expect(geminiFetchIndex).toBeGreaterThan(-1);
    expect(csvParserIndex).toBeLessThan(apiKeyIndex);
    expect(csvParserIndex).toBeLessThan(geminiFetchIndex);
    expect(edgeFunctionSource).toContain('model: "structured-csv"');
  });

  it("keeps AI extraction separate until creator confirmation", () => {
    expect(source).toContain("content_performance_ai_extractions");
    expect(source).toContain("pending_confirmation");
    expect(source).toContain("creator_confirmed");
    expect(source).toContain("accepted_by_creator");
    expect(source).toContain("assertReportTaskAcceptsCreatorSubmission(task.status)");
  });

  it("validates the target performance row before confirming AI metrics", () => {
    const confirmActionSource = source.slice(
      source.indexOf("export async function confirmAiExtraction"),
      source.indexOf("export async function reviewPerformanceEvidence"),
    );

    expect(confirmActionSource).toContain('.from("content_performance")');
    expect(confirmActionSource).toContain(
      '.select("id, report_task_id, verification_status")',
    );
    expect(confirmActionSource).toContain(".eq(\"id\", input.performanceId)");
    expect(confirmActionSource).toContain(
      'performance.report_task_id !== input.reportTaskId',
    );
    expect(confirmActionSource).toContain(
      'throw new Error("Performance proof does not match this report task")',
    );
    expect(confirmActionSource).toContain(
      'throw new Error("Performance proof has already been reviewed")',
    );
  });

  it("lets performance submission atomically accept a pending AI extraction", () => {
    const contentActionSource = readFileSync(
      new URL("./content.ts", import.meta.url),
      "utf8",
    );

    expect(contentActionSource).toContain("ai_extraction_id");
    expect(contentActionSource).toContain("sourceType: aiExtractionId");
    expect(contentActionSource).toContain('sourceType: aiExtractionId ? "creator_confirmed" : "creator_manual"');
    expect(contentActionSource).toContain("confirmedByCreator: true");
    expect(contentActionSource).toContain("accepted_by_creator");
    expect(contentActionSource).toContain("content_performance_ai_extractions");
  });

  it("records whether the creator accepted or edited AI extracted metrics", () => {
    const contentActionSource = readFileSync(
      new URL("./content.ts", import.meta.url),
      "utf8",
    );

    expect(contentActionSource).toContain("ai_extraction_edited");
    expect(contentActionSource).toContain("const aiExtractionStatus");
    expect(contentActionSource).toContain("edited_by_creator");
    expect(contentActionSource).toContain("accepted_by_creator");
    expect(contentActionSource).toContain("status: aiExtractionStatus");
  });

  it("upserts confirmed values by performance, platform, and metric key", () => {
    expect(source).toContain(".from(\"content_performance_metric_values\")");
    expect(source).toContain("onConflict: \"performance_id,platform,metric_key\"");
  });

  it("upserts confirmed values by platform too so additional reporting channels are not collapsed", () => {
    expect(source).toContain('onConflict: "performance_id,platform,metric_key"');
    expect(source).not.toContain('onConflict: "performance_id,metric_key"');
  });

  it("lets brands verify evidence or request a corrected report", () => {
    expect(source).toContain("export async function reviewPerformanceEvidence");
    expect(source).toContain("reviewPerformanceEvidenceSchema");
    expect(source).toContain('z.enum(["verified", "needs_revision"])');
    expect(source).toContain("correctionNote:");
    expect(source).toContain("Correction reason is required");
    expect(source).toContain("Correction reason must be 280 characters or less");
    expect(source).toContain("const correctionNote = isVerified ? null : parsed.data.correctionNote?.trim()");
    expect(source).toContain("verification_status: evidenceStatus");
    expect(source).toContain("reviewed_by: user.id");
    expect(source).toContain("reviewed_at: reviewedAt");
    expect(source).toContain("verification_status: performanceStatus");
    expect(source).toContain("review_note: correctionNote");
    expect(source).toContain("correctionNote,");
    expect(source).toContain("getCurrentEvidenceReviewStatuses");
    expect(source).toContain("buildReportTaskReviewUpdate");
    expect(source).toContain("content_performance ( measurement_type )");
    expect(source).toContain("Evidence is not linked to a performance read");
    expect(source).toContain("createAdminClient");
    expect(source).toContain("revalidatePath(`/b/campaigns/${evidence.campaign_id}/report`)");
  });

  it("lets brands review mobile proof links without private storage evidence", () => {
    expect(source).toContain("export async function reviewPerformanceProofLink");
    expect(source).toContain("reviewPerformanceProofLinkSchema");
    expect(source).toContain("performanceId: uuidLike");
    expect(source).toContain("Proof link is required");
    expect(source).toContain(".from(\"content_performance\")");
    expect(source).toContain("screenshot_url");
    expect(source).toContain("verification_status: performanceStatus");
    expect(source).toContain("buildReportTaskReviewUpdate");
    expect(source).toContain("buildReportCorrectionNotification");
  });

  it("notifies the creator when brand proof review requests a report correction", () => {
    expect(source).toContain("buildReportCorrectionNotification");
    expect(source).toContain("createPrivilegedNotification");
    expect(source).toContain("campaign_members(creator_id)");
    expect(reportNotificationsSource).toContain("report_correction_requested");
    expect(source).toContain("correctionNote");
  });

  it("validates evidence linkage before changing review state", () => {
    const reviewActionSource = source.slice(
      source.indexOf("export async function reviewPerformanceEvidence"),
      source.indexOf("export async function markReportTaskExcused"),
    );
    const evidenceSelectIndex = reviewActionSource.indexOf(
      '.from("content_performance_evidence")\n    .select',
    );
    const evidenceUpdateIndex = reviewActionSource.indexOf(
      '.from("content_performance_evidence")\n    .update',
    );

    expect(evidenceSelectIndex).toBeGreaterThan(-1);
    expect(evidenceUpdateIndex).toBeGreaterThan(-1);
    expect(evidenceSelectIndex).toBeLessThan(evidenceUpdateIndex);
  });

  it("blocks repeat proof review transitions on already decided evidence", () => {
    const reviewActionSource = source.slice(
      source.indexOf("export async function reviewPerformanceEvidence"),
      source.indexOf("export async function markReportTaskExcused"),
    );
    const proofLinkActionSource = source.slice(
      source.indexOf("export async function reviewPerformanceProofLink"),
      source.indexOf("export async function markReportTaskExcused"),
    );
    const evidenceUpdateIndex = reviewActionSource.indexOf(
      '.from("content_performance_evidence")\n    .update',
    );
    const proofLinkUpdateIndex = proofLinkActionSource.indexOf(
      '.from("content_performance")\n    .update',
    );

    expect(source).toContain("function assertProofReviewIsPending");
    expect(reviewActionSource).toContain("verification_status");
    expect(reviewActionSource).toContain("content_performance");
    expect(reviewActionSource).toContain("assertProofReviewIsPending({");
    expect(reviewActionSource.indexOf("assertProofReviewIsPending({")).toBeLessThan(
      evidenceUpdateIndex,
    );
    expect(proofLinkActionSource).toContain("verification_status");
    expect(proofLinkActionSource).toContain("assertProofReviewIsPending({");
    expect(proofLinkActionSource.indexOf("assertProofReviewIsPending({")).toBeLessThan(
      proofLinkUpdateIndex,
    );
  });

  it("lets brands excuse a missed report task after verifying campaign ownership", () => {
    expect(source).toContain("markReportTaskExcusedSchema");
    expect(source).toContain("export async function markReportTaskExcused");
    expect(source).toContain(".select(\"id, campaign_id, status, campaigns(brand_id, status)\")");
    expect(source).toContain("assertBrandReportingWorkspace");
    expect(source).toContain("workspace.brandId");
    expect(source).toContain('status: "excused"');
    expect(source).toContain("excused_at");
    expect(source).toContain("revalidatePath(`/b/campaigns/${task.campaign_id}`)");
  });

  it("lets brands request creator follow-up for a missed report task", () => {
    expect(source).toContain("requestMissedReportFollowUpSchema");
    expect(source).toContain("export async function requestMissedReportFollowUp");
    expect(source).toContain(
      ".select(\"id, campaign_id, status, campaigns(brand_id, title, status), campaign_members(creator_id)\")",
    );
    expect(source).toContain("buildReportFollowUpNotification");
    expect(reportNotificationsSource).toContain("report_follow_up_requested");
    expect(source).toContain("revalidatePath(`/i/campaigns/${task.campaign_id}`)");
  });

  it("lets brands request follow-up for selected missed report tasks", () => {
    expect(source).toContain("requestMissedReportFollowUpBatchSchema");
    expect(source).toContain("export async function requestMissedReportFollowUpsBatch");
    expect(source).toContain("new Set(parsed.data.reportTaskIds)");
    expect(source).toContain("const campaignIds = new Set");
    expect(source).toContain("const brandIds = new Set");
    expect(source).toContain('task.status !== "missed"');
    expect(source).toContain("buildReportFollowUpNotification");
    expect(source).toContain("requestedCount: tasks.length");
    expect(source).toContain("revalidatePath(`/b/campaigns/${campaignId}`)");
  });

  it("lets creators add an optional extra proof read only after ownership checks", () => {
    expect(source).toContain("createExtraPerformanceReportTaskSchema");
    expect(source).toContain("export async function createExtraPerformanceReportTask");
    expect(source).toContain(".from(\"campaign_members\")");
    expect(source).toContain(".eq(\"id\", parsed.data.campaignMemberId)");
    expect(source).toContain("member.creator_id !== user.id");
    expect(source).toContain("assertCampaignMemberAgreementAccess(member.id)");
    expect(source).toContain("createExtraReportTaskDraft");
    expect(source).toContain("const readId = randomUUID();");
    expect(source).toContain(".from(\"campaign_report_tasks\")");
    expect(source).toContain("Campaign has no reporting schedule");
    expect(source).toContain("revalidatePath(`/i/campaigns/${member.campaign_id}`)");
    expect(source).toContain("revalidatePath(`/b/campaigns/${member.campaign_id}/report`)");
  });
});
