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
      ".select(\"id, platform, campaign_member_id, campaign_members(campaign_id, creator_id)\")",
    );
    expect(contentActionsSource).toContain("member.creator_id !== user.id");
    expect(contentActionsSource).toContain("throw new Error(\"Not authorized\")");
  });

  it("uses the parsed performance payload so platform-only metrics stay in metric values", () => {
    expect(contentActionsSource).toContain("parsed.data");
    expect(contentActionsSource).toContain("metric_values");
    expect(contentActionsSource).toContain("...metrics");
  });

  it("links submitted metrics to the report task and completes that task only when reporting is complete", () => {
    expect(contentActionsSource).toContain("report_task_id");
    expect(contentActionsSource).toContain(
      "markPrivilegedReportTaskSubmittedIfComplete",
    );
    expect(contentActionsSource).toContain("reportTask.campaign_member_id !== member.id");
    expect(privilegedSource).toContain(
      "export async function markPrivilegedReportTaskSubmittedIfComplete",
    );
    expect(privilegedSource).toContain('status", "published"');
    expect(privilegedSource).toContain("reportedSubmissionCount");
    expect(privilegedSource).toContain("submitted_late");
    expect(privilegedSource).toContain("submitted_at");
  });

  it("creates a per-post report task when content is published", () => {
    expect(contentActionsSource).toContain("createPrivilegedReportTaskForSubmission");
    expect(privilegedSource).toContain(
      "export async function createPrivilegedReportTaskForSubmission",
    );
    expect(privilegedSource).toContain(".select(\"cadence\")");
    expect(privilegedSource).toContain("reportingPlan?.cadence !== \"per_post\"");
  });
});
