import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const contentActionsSource = readFileSync(
  new URL("./content.ts", import.meta.url),
  "utf8",
);
const privilegedSource = readFileSync(
  new URL("../../lib/supabase/privileged.ts", import.meta.url),
  "utf8",
);
const validationsSource = readFileSync(
  new URL("../../lib/validations.ts", import.meta.url),
  "utf8",
);
const sharedValidationsSource = readFileSync(
  new URL("../../../shared/validations.ts", import.meta.url),
  "utf8",
);
const reportNotificationsSource = readFileSync(
  new URL("../../lib/reporting/report-notifications.ts", import.meta.url),
  "utf8",
);
const publishContentSource = contentActionsSource.slice(
  contentActionsSource.indexOf("export async function publishContent("),
  contentActionsSource.indexOf("export async function submitPerformance("),
);

describe("content performance report task loop", () => {
  it("accepts a report task id on performance submissions", () => {
    expect(validationsSource).toContain("report_task_id: uuidLike.optional()");
    expect(sharedValidationsSource).toContain("report_task_id: uuidLike.optional()");
  });

  it("accepts evidence ids and links uploaded evidence to the created performance row", () => {
    expect(validationsSource).toContain("evidence_id: uuidLike.optional()");
    expect(sharedValidationsSource).toContain("evidence_id: uuidLike.optional()");
    expect(contentActionsSource).toContain("evidence_id");
    expect(contentActionsSource).toContain(".from(\"content_performance_evidence\")");
    expect(contentActionsSource).toContain("performance_id: data.id");
  });

  it("verifies creator ownership before inserting performance metrics", () => {
    expect(contentActionsSource).toContain(
      ".select(\"id, status, platform, deliverable_id, campaign_member_id, campaign_members(campaign_id, creator_id, campaigns(status, platforms))\")",
    );
    expect(contentActionsSource).toContain("member.creator_id !== user.id");
    expect(contentActionsSource).toContain("throw new Error(\"Not authorized\")");
    expect(contentActionsSource).toContain("assertCampaignAllowsMetricSubmission({");
    expect(contentActionsSource).toContain("submissionStatus: submission.status");
  });

  it("uses the parsed performance payload so platform-only metrics stay in metric values", () => {
    expect(contentActionsSource).toContain("parsed.data");
    expect(contentActionsSource).toContain("metric_values");
    expect(contentActionsSource).toContain("primaryMetricValues");
    expect(contentActionsSource).toContain("metric.platform === submission.platform");
    expect(contentActionsSource).toContain("...metrics");
  });

  it("enforces brand-selected required metrics before accepting creator proof", () => {
    expect(contentActionsSource).toContain("getRequiredProofMetricGroupsForSubmission");
    expect(contentActionsSource).toContain(".from(\"campaign_reporting_requirements\")");
    expect(contentActionsSource).toContain("required_metric_keys");
    expect(contentActionsSource).toContain("assertRequiredMetricValuesSubmitted");
    expect(contentActionsSource).toContain("Submit all required proof metrics");
  });

  it("links submitted metrics to the report task and completes that task only when reporting is complete", () => {
    expect(contentActionsSource).toContain("report_task_id");
    expect(contentActionsSource).toContain("assertReportTaskAcceptsCreatorSubmission");
    expect(contentActionsSource).toContain("assertReportTaskAcceptsCreatorSubmission(reportTask.status)");
    expect(contentActionsSource).toContain(
      "markPrivilegedReportTaskSubmittedIfComplete",
    );
    expect(contentActionsSource).toContain("reportTask.campaign_member_id !== member.id");
    expect(privilegedSource).toContain(
      "export async function markPrivilegedReportTaskSubmittedIfComplete",
    );
    expect(privilegedSource).toContain('status", "published"');
    expect(privilegedSource).toContain("getCompletedReportSubmissionCount");
    expect(privilegedSource).toContain(
      '.select("submission_id, verification_status, reported_at")',
    );
    expect(privilegedSource).toContain("reportedSubmissionCount");
    expect(privilegedSource).toContain("submitted_late");
    expect(privilegedSource).toContain("submitted_at");
  });

  it("notifies the brand when creator report proof is ready for review", () => {
    expect(contentActionsSource).toContain("buildReportReadyForReviewNotification");
    expect(contentActionsSource).toContain("createPrivilegedNotification");
    expect(contentActionsSource).toContain("reportSubmission.completed === true");
    expect(privilegedSource).toContain("dispatchNotificationEmailByNotificationId");
    expect(reportNotificationsSource).toContain("report_ready_for_review");
  });

  it("uses a distinct brand notice when corrected report proof is resubmitted", () => {
    expect(contentActionsSource).toContain("buildReportCorrectionResubmittedNotification");
    expect(contentActionsSource).toContain('reportTaskStatusBeforeSubmit === "needs_revision"');
    expect(reportNotificationsSource).toContain("report_correction_resubmitted");
  });

  it("clears stale correction review state when a corrected report task is resubmitted", () => {
    const submitHelperSource = privilegedSource.slice(
      privilegedSource.indexOf("export async function markPrivilegedReportTaskSubmitted("),
      privilegedSource.indexOf("export async function markPrivilegedReportTaskSubmittedIfComplete"),
    );

    expect(submitHelperSource).toContain("review_note: null");
    expect(submitHelperSource).toContain("verified_at: null");
  });

  it("creates a per-post report task when content is published", () => {
    expect(contentActionsSource).toContain("createPrivilegedReportTaskForSubmission");
    expect(privilegedSource).toContain(
      "export async function createPrivilegedReportTaskForSubmission",
    );
    expect(privilegedSource).toContain(".select(\"cadence\")");
    expect(privilegedSource).toContain("reportingPlan?.cadence !== \"per_post\"");
  });

  it("only lets creators publish content after brand approval", () => {
    expect(publishContentSource).toContain(
      '.select("id, campaign_member_id, status, campaign_members(creator_id, campaign_id, campaigns(status))")',
    );
    expect(publishContentSource).toContain('submission.status !== "approved"');
    expect(publishContentSource).toContain(
      'throw new Error("Content must be approved before publishing")',
    );
  });

  it("refreshes both creator and brand campaign rooms after a live URL is saved", () => {
    expect(publishContentSource).toContain(
      "revalidatePath(`/i/campaigns/${member.campaign_id}`)",
    );
    expect(publishContentSource).toContain(
      "revalidatePath(`/b/campaigns/${member.campaign_id}`)",
    );
  });
});
