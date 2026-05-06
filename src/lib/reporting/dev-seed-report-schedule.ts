interface DevReportSeedScheduleInput {
  postingWindowStart: string | null;
  postingWindowEnd: string | null;
  now?: Date;
}

interface DevReportSeedSchedule {
  taskPeriodStart: string;
  taskPeriodEnd: string;
  taskDueAt: string;
  submittedAt: string;
  contentSubmittedAt: string;
  contentReviewedAt: string;
  contentPublishedAt: string;
  readDates: {
    initial_48h: string;
    final_7d: string;
    extended_30d: string;
  };
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  ));
}

function parseCampaignDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : startOfUtcDay(date);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function minDate(first: Date, second: Date): Date {
  return first.getTime() <= second.getTime() ? first : second;
}

function toIso(date: Date): string {
  return date.toISOString();
}

export function buildDevReportSeedSchedule({
  postingWindowStart,
  postingWindowEnd,
  now = new Date(),
}: DevReportSeedScheduleInput): DevReportSeedSchedule {
  const start = parseCampaignDate(postingWindowStart) ?? startOfUtcDay(now);
  const parsedEnd = parseCampaignDate(postingWindowEnd);
  const end = parsedEnd && parsedEnd.getTime() >= start.getTime()
    ? parsedEnd
    : addDays(start, 8);
  const finalRead = minDate(addDays(start, 7), end);
  const dueAt = addDays(end, 3);

  return {
    taskPeriodStart: toIso(start),
    taskPeriodEnd: toIso(end),
    taskDueAt: toIso(dueAt),
    submittedAt: toIso(dueAt),
    contentSubmittedAt: toIso(addDays(start, -1)),
    contentReviewedAt: toIso(start),
    contentPublishedAt: toIso(start),
    readDates: {
      initial_48h: toIso(addDays(start, 2)),
      final_7d: toIso(finalRead),
      extended_30d: toIso(dueAt),
    },
  };
}
