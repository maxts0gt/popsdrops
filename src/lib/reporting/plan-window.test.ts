import { describe, expect, it } from "vitest";
import { getCampaignReportingPlanWindow } from "./plan-window";

describe("getCampaignReportingPlanWindow", () => {
  it("keeps final-only campaigns as one calm proof task", () => {
    expect(
      getCampaignReportingPlanWindow({
        cadence: "final_only",
        contentDueDate: "2026-05-10",
        postingWindowStart: "2026-05-07",
        postingWindowEnd: "2026-05-15",
        performanceDueDate: "2026-05-18",
      }),
    ).toEqual({
      startsAt: null,
      endsAt: null,
    });
  });

  it("uses the live campaign window for key reads", () => {
    expect(
      getCampaignReportingPlanWindow({
        cadence: "weekly",
        contentDueDate: "2026-05-10",
        postingWindowStart: "2026-05-07",
        postingWindowEnd: "2026-05-15",
        performanceDueDate: "2026-05-18",
      }),
    ).toEqual({
      startsAt: "2026-05-07",
      endsAt: "2026-05-18",
    });
  });

  it("limits daily reads to the performance monitoring window", () => {
    expect(
      getCampaignReportingPlanWindow({
        cadence: "daily_launch_window",
        contentDueDate: "2026-05-10",
        postingWindowStart: "2026-05-07",
        postingWindowEnd: "2026-05-15",
        performanceDueDate: "2026-05-18",
      }),
    ).toEqual({
      startsAt: "2026-05-15",
      endsAt: "2026-05-18",
    });
  });
});
