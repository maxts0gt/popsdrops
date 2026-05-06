import { describe, expect, it } from "vitest";
import {
  getReportTaskDisplayStatus,
  getReportTaskMutationForSubmission,
  shouldMarkReportTaskMissed,
} from "./report-task-status";

describe("report task status utilities", () => {
  it("marks a pending task missed after due date plus grace period", () => {
    expect(
      shouldMarkReportTaskMissed({
        status: "pending",
        dueAt: "2026-05-10T10:00:00.000Z",
        gracePeriodHours: 24,
        now: new Date("2026-05-11T10:00:01.000Z"),
      }),
    ).toBe(true);
  });

  it("does not mark submitted or verified tasks missed", () => {
    for (const status of ["submitted", "verified", "excused"] as const) {
      expect(
        shouldMarkReportTaskMissed({
          status,
          dueAt: "2026-05-10T10:00:00.000Z",
          gracePeriodHours: 24,
          now: new Date("2026-05-20T10:00:00.000Z"),
        }),
      ).toBe(false);
    }
  });

  it("shows due soon before due date", () => {
    expect(
      getReportTaskDisplayStatus({
        status: "pending",
        dueAt: "2026-05-10T10:00:00.000Z",
        now: new Date("2026-05-09T12:00:00.000Z"),
      }),
    ).toBe("due_soon");
  });

  it("shows overdue during grace period", () => {
    expect(
      getReportTaskDisplayStatus({
        status: "pending",
        dueAt: "2026-05-10T10:00:00.000Z",
        now: new Date("2026-05-10T10:01:00.000Z"),
      }),
    ).toBe("overdue");
  });

  it("turns missed submissions into submitted late", () => {
    expect(
      getReportTaskMutationForSubmission({
        status: "missed",
        now: new Date("2026-05-12T10:00:00.000Z"),
      }),
    ).toEqual({
      status: "submitted_late",
      submitted_at: "2026-05-12T10:00:00.000Z",
    });
  });
});
