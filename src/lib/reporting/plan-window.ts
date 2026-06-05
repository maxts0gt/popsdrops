import type { CampaignReportingCadence } from "@/types/database";

type CampaignReportingPlanWindowInput = {
  cadence: CampaignReportingCadence;
  contentDueDate?: string | null;
  postingWindowStart?: string | null;
  postingWindowEnd?: string | null;
  performanceDueDate?: string | null;
};

export function getCampaignReportingPlanWindow(
  input: CampaignReportingPlanWindowInput,
): {
  startsAt: string | null;
  endsAt: string | null;
} {
  if (input.cadence === "final_only" || input.cadence === "per_post") {
    return {
      startsAt: null,
      endsAt: null,
    };
  }

  if (input.cadence === "daily_launch_window") {
    return {
      startsAt:
        firstPresent(input.postingWindowEnd, input.contentDueDate, input.postingWindowStart),
      endsAt: firstPresent(input.performanceDueDate, input.postingWindowEnd),
    };
  }

  if (input.cadence === "weekly") {
    return {
      startsAt: firstPresent(input.postingWindowStart, input.contentDueDate),
      endsAt: firstPresent(input.performanceDueDate, input.postingWindowEnd),
    };
  }

  return {
    startsAt: null,
    endsAt: null,
  };
}

function firstPresent(...values: Array<string | null | undefined>) {
  return values.find((value) => Boolean(value?.trim())) ?? null;
}
