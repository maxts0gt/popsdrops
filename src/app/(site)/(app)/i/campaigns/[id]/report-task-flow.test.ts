import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const performanceFormSource = readFileSync(
  new URL("../../../../../../components/shared/performance-form.tsx", import.meta.url),
  "utf8",
);

describe("creator campaign report task flow", () => {
  it("shows a live URL publish control before performance reporting", () => {
    expect(source).toContain("import { publishContent }");
    expect(source).toContain("function PublishUrlForm");
    expect(source).toContain('s.status === "approved"');
    expect(source).toContain("await publishContent(submissionId, publishedUrl.trim())");
  });

  it("loads campaign report tasks for the accepted member", () => {
    expect(source).toContain("interface ReportTask");
    expect(source).toContain("const [reportTasks, setReportTasks]");
    expect(source).toContain(".from(\"campaign_report_tasks\")");
    expect(source).toContain(".eq(\"campaign_member_id\", member.id)");
  });

  it("passes the active report task into each performance form", () => {
    expect(source).toContain("const activeReportTask =");
    expect(source).toContain("reportTaskId={activeReportTask?.id}");
    expect(source).toContain("reportTaskDueAt={activeReportTask?.due_at}");
    expect(source).toContain("content_performance ( report_task_id )");
    expect(source).toContain("hasSubmissionReportForTask");
    expect(source).toContain("isSubmitted={hasSubmissionReportForTask");
    expect(performanceFormSource).toContain("reportTaskId?: string");
    expect(performanceFormSource).toContain("isSubmitted?: boolean");
    expect(performanceFormSource).toContain("report_task_id: reportTaskId");
  });
});
