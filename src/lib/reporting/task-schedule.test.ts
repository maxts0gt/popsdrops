import { describe, expect, it } from "vitest";
import {
  createExtraReportTaskDraft,
  createPerPostReportTaskDraft,
  generateReportTaskDrafts,
} from "./task-schedule";

const campaignId = "11111111-1111-1111-1111-111111111111";
const memberId = "22222222-2222-2222-2222-222222222222";

describe("generateReportTaskDrafts", () => {
  it("creates one final report task by default", () => {
    const tasks = generateReportTaskDrafts({
      campaignId,
      campaignMemberId: memberId,
      performanceDueDate: "2026-05-18T23:59:59.999Z",
      reportingPlan: {
        cadence: "final_only",
        gracePeriodHours: 24,
        customDueDates: [],
        startsAt: null,
        endsAt: null,
      },
    });

    expect(tasks).toEqual([
      {
        campaign_id: campaignId,
        campaign_member_id: memberId,
        task_key: "final",
        period_start: null,
        period_end: null,
        due_at: "2026-05-18T23:59:59.999Z",
        status: "pending",
      },
    ]);
  });

  it("creates weekly report tasks inside the reporting window", () => {
    const tasks = generateReportTaskDrafts({
      campaignId,
      campaignMemberId: memberId,
      performanceDueDate: "2026-05-31T23:59:59.999Z",
      reportingPlan: {
        cadence: "weekly",
        gracePeriodHours: 24,
        customDueDates: [],
        startsAt: "2026-05-01T00:00:00.000Z",
        endsAt: "2026-05-20T23:59:59.999Z",
      },
    });

    expect(tasks.map((task) => task.due_at)).toEqual([
      "2026-05-07T23:59:59.999Z",
      "2026-05-14T23:59:59.999Z",
      "2026-05-20T23:59:59.999Z",
    ]);
    expect(tasks[0].period_start).toBe("2026-05-01T00:00:00.000Z");
    expect(tasks[0].period_end).toBe("2026-05-07T23:59:59.999Z");
    expect(tasks.map((task) => task.task_key)).toEqual([
      "weekly:2026-05-01",
      "weekly:2026-05-08",
      "weekly:2026-05-15",
    ]);
  });

  it("creates daily launch-window tasks", () => {
    const tasks = generateReportTaskDrafts({
      campaignId,
      campaignMemberId: memberId,
      performanceDueDate: "2026-05-31T23:59:59.999Z",
      reportingPlan: {
        cadence: "daily_launch_window",
        gracePeriodHours: 24,
        customDueDates: [],
        startsAt: "2026-05-07T00:00:00.000Z",
        endsAt: "2026-05-09T23:59:59.999Z",
      },
    });

    expect(tasks.map((task) => task.due_at)).toEqual([
      "2026-05-07T23:59:59.999Z",
      "2026-05-08T23:59:59.999Z",
      "2026-05-09T23:59:59.999Z",
    ]);
    expect(tasks.map((task) => task.task_key)).toEqual([
      "daily:2026-05-07",
      "daily:2026-05-08",
      "daily:2026-05-09",
    ]);
  });

  it("creates custom report tasks in sorted order", () => {
    const tasks = generateReportTaskDrafts({
      campaignId,
      campaignMemberId: memberId,
      performanceDueDate: "2026-05-31T23:59:59.999Z",
      reportingPlan: {
        cadence: "custom",
        gracePeriodHours: 24,
        customDueDates: [
          "2026-05-20T23:59:59.999Z",
          "2026-05-10T23:59:59.999Z",
        ],
        startsAt: null,
        endsAt: null,
      },
    });

    expect(tasks.map((task) => task.due_at)).toEqual([
      "2026-05-10T23:59:59.999Z",
      "2026-05-20T23:59:59.999Z",
    ]);
    expect(tasks.map((task) => task.task_key)).toEqual([
      "custom:2026-05-10T23:59:59.999Z",
      "custom:2026-05-20T23:59:59.999Z",
    ]);
  });

  it("does not create member-level tasks for per-post cadence", () => {
    const tasks = generateReportTaskDrafts({
      campaignId,
      campaignMemberId: memberId,
      performanceDueDate: "2026-05-31T23:59:59.999Z",
      reportingPlan: {
        cadence: "per_post",
        gracePeriodHours: 24,
        customDueDates: [],
        startsAt: null,
        endsAt: null,
      },
    });

    expect(tasks).toEqual([]);
  });

  it("creates a stable per-post task key for published content", () => {
    expect(
      createPerPostReportTaskDraft({
        campaignId,
        campaignMemberId: memberId,
        submissionId: "33333333-3333-3333-3333-333333333333",
        dueAt: "2026-05-18T23:59:59.999Z",
      }),
    ).toEqual({
      campaign_id: campaignId,
      campaign_member_id: memberId,
      task_key: "post:33333333-3333-3333-3333-333333333333",
      period_start: null,
      period_end: null,
      due_at: "2026-05-18T23:59:59.999Z",
      status: "pending",
    });
  });

  it("creates an optional extra read without changing the required cadence", () => {
    expect(
      createExtraReportTaskDraft({
        campaignId,
        campaignMemberId: memberId,
        readId: "33333333-3333-3333-3333-333333333333",
        dueAt: "2026-05-19T12:30:00.000Z",
      }),
    ).toEqual({
      campaign_id: campaignId,
      campaign_member_id: memberId,
      task_key: "extra:33333333-3333-3333-3333-333333333333",
      period_start: null,
      period_end: null,
      due_at: "2026-05-19T12:30:00.000Z",
      status: "pending",
    });
  });
});
