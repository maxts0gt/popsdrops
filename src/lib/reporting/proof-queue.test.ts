import { describe, expect, it } from "vitest";

import {
  getCurrentPerformanceRowsForTask,
  getProofQueueState,
} from "./proof-queue";

describe("brand proof queue state", () => {
  it("shows mobile metric submissions without evidence as metrics only", () => {
    expect(
      getProofQueueState({
        taskStatus: "submitted",
        currentPerformanceStatus: "submitted",
      }),
    ).toBe("metrics_only");
  });

  it("shows mobile metric submissions with a proof link as reviewable", () => {
    expect(
      getProofQueueState({
        taskStatus: "submitted",
        currentPerformanceStatus: "submitted",
        currentPerformanceHasProof: true,
      }),
    ).toBe("review");
  });

  it("does not treat a submitted task as reviewable until evidence exists", () => {
    expect(
      getProofQueueState({
        taskStatus: "submitted",
      }),
    ).toBe("pending");
  });

  it("keeps corrected proof in review when a rejected evidence row is replaced", () => {
    expect(
      getProofQueueState({
        taskStatus: "submitted",
        currentEvidenceStatus: "submitted",
        currentPerformanceStatus: "submitted",
        hasReturnedCorrection: true,
      }),
    ).toBe("correction_returned");
  });

  it("uses the latest mobile performance read per submission and measurement", () => {
    const rows = getCurrentPerformanceRowsForTask(
      [
        {
          id: "old",
          report_task_id: "task-1",
          submission_id: "submission-1",
          measurement_type: "final_7d",
          reported_at: "2026-05-18T09:00:00.000Z",
        },
        {
          id: "new",
          report_task_id: "task-1",
          submission_id: "submission-1",
          measurement_type: "final_7d",
          reported_at: "2026-05-18T10:00:00.000Z",
        },
        {
          id: "other",
          report_task_id: "task-2",
          submission_id: "submission-1",
          measurement_type: "final_7d",
          reported_at: "2026-05-18T11:00:00.000Z",
        },
      ],
      "task-1",
    );

    expect(rows.map((row) => row.id)).toEqual(["new"]);
  });
});
