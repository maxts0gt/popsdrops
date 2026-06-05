import { describe, expect, it } from "vitest";

import { getCompletedReportSubmissionCount } from "./report-task-completion";

describe("report task completion", () => {
  it("counts only the latest non-rejected performance read per published submission", () => {
    const count = getCompletedReportSubmissionCount([
      {
        submission_id: "submission-1",
        verification_status: "submitted",
        reported_at: "2026-05-10T10:00:00.000Z",
      },
      {
        submission_id: "submission-1",
        verification_status: "rejected",
        reported_at: "2026-05-11T10:00:00.000Z",
      },
      {
        submission_id: "submission-2",
        verification_status: "rejected",
        reported_at: "2026-05-10T10:00:00.000Z",
      },
      {
        submission_id: "submission-2",
        verification_status: "submitted",
        reported_at: "2026-05-12T10:00:00.000Z",
      },
      {
        submission_id: null,
        verification_status: "submitted",
        reported_at: "2026-05-12T10:00:00.000Z",
      },
    ]);

    expect(count).toBe(1);
  });
});
