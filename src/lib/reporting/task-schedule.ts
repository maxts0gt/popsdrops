import type {
  CampaignReportingCadence,
  CampaignReportTaskStatus,
} from "@/types/database";

export type ReportingPlanInput = {
  cadence: CampaignReportingCadence;
  gracePeriodHours: number;
  customDueDates: string[];
  startsAt: string | null;
  endsAt: string | null;
};

export type ReportTaskDraft = {
  campaign_id: string;
  campaign_member_id: string;
  task_key: string;
  period_start: string | null;
  period_end: string | null;
  due_at: string;
  status: Extract<CampaignReportTaskStatus, "pending">;
};

export function generateReportTaskDrafts(input: {
  campaignId: string;
  campaignMemberId: string;
  performanceDueDate: string | null;
  reportingPlan: ReportingPlanInput | null;
}): ReportTaskDraft[] {
  const cadence = input.reportingPlan?.cadence ?? "final_only";

  if (cadence === "custom") {
    return uniqueSortedDates(input.reportingPlan?.customDueDates ?? []).map(
      (dueAt) => createDraft(input, `custom:${dueAt}`, null, null, dueAt),
    );
  }

  if (cadence === "weekly") {
    return buildWeeklyTasks(input);
  }

  if (cadence === "daily_launch_window") {
    return buildDailyTasks(input);
  }

  if (cadence === "per_post") {
    return [];
  }

  if (!input.performanceDueDate) return [];

  return [
    createDraft(
      input,
      "final",
      null,
      null,
      normalizeIso(input.performanceDueDate),
    ),
  ];
}

export function createPerPostReportTaskDraft(input: {
  campaignId: string;
  campaignMemberId: string;
  submissionId: string;
  dueAt: string;
}): ReportTaskDraft {
  return createDraft(
    {
      campaignId: input.campaignId,
      campaignMemberId: input.campaignMemberId,
    },
    `post:${input.submissionId}`,
    null,
    null,
    input.dueAt,
  );
}

export function createExtraReportTaskDraft(input: {
  campaignId: string;
  campaignMemberId: string;
  readId: string;
  dueAt: string;
}): ReportTaskDraft {
  return createDraft(
    {
      campaignId: input.campaignId,
      campaignMemberId: input.campaignMemberId,
    },
    `extra:${input.readId}`,
    null,
    null,
    input.dueAt,
  );
}

function buildWeeklyTasks(input: {
  campaignId: string;
  campaignMemberId: string;
  performanceDueDate: string | null;
  reportingPlan: ReportingPlanInput | null;
}): ReportTaskDraft[] {
  const startsAt = input.reportingPlan?.startsAt;
  const endsAt = input.reportingPlan?.endsAt;
  if (!startsAt || !endsAt) return [];

  const tasks: ReportTaskDraft[] = [];
  let periodStart = startOfUtcDay(new Date(startsAt));
  const finalEnd = endOfUtcDay(new Date(endsAt));

  while (periodStart.getTime() <= finalEnd.getTime()) {
    const periodEnd = endOfUtcDay(addDays(periodStart, 6));
    const cappedEnd =
      periodEnd.getTime() > finalEnd.getTime() ? finalEnd : periodEnd;

    tasks.push(
      createDraft(
        input,
        `weekly:${toUtcDateKey(periodStart)}`,
        periodStart.toISOString(),
        cappedEnd.toISOString(),
        cappedEnd.toISOString(),
      ),
    );

    periodStart = startOfUtcDay(addDays(cappedEnd, 1));
  }

  return tasks;
}

function buildDailyTasks(input: {
  campaignId: string;
  campaignMemberId: string;
  performanceDueDate: string | null;
  reportingPlan: ReportingPlanInput | null;
}): ReportTaskDraft[] {
  const startsAt = input.reportingPlan?.startsAt;
  const endsAt = input.reportingPlan?.endsAt;
  if (!startsAt || !endsAt) return [];

  const tasks: ReportTaskDraft[] = [];
  let day = startOfUtcDay(new Date(startsAt));
  const finalEnd = endOfUtcDay(new Date(endsAt));

  while (day.getTime() <= finalEnd.getTime()) {
    const dayEnd = endOfUtcDay(day);
    tasks.push(
      createDraft(
        input,
        `daily:${toUtcDateKey(day)}`,
        day.toISOString(),
        dayEnd.toISOString(),
        dayEnd.toISOString(),
      ),
    );
    day = startOfUtcDay(addDays(day, 1));
  }

  return tasks;
}

function createDraft(
  input: {
    campaignId: string;
    campaignMemberId: string;
  },
  taskKey: string,
  periodStart: string | null,
  periodEnd: string | null,
  dueAt: string,
): ReportTaskDraft {
  return {
    campaign_id: input.campaignId,
    campaign_member_id: input.campaignMemberId,
    task_key: taskKey,
    period_start: periodStart,
    period_end: periodEnd,
    due_at: normalizeIso(dueAt),
    status: "pending",
  };
}

function uniqueSortedDates(dates: string[]) {
  return [...new Set(dates.map(normalizeIso))].sort();
}

function normalizeIso(value: string) {
  return new Date(value).toISOString();
}

function startOfUtcDay(date: Date) {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function endOfUtcDay(date: Date) {
  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function toUtcDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}
