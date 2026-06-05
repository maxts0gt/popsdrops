import { describe, expect, it } from "vitest";

import { buildDevReportSeedSchedule } from "./dev-seed-report-schedule";

describe("dev report seed schedule", () => {
  it("anchors seeded performance reads to the campaign window", () => {
    const schedule = buildDevReportSeedSchedule({
      postingWindowStart: "2026-05-07T00:00:00.000Z",
      postingWindowEnd: "2026-05-15T00:00:00.000Z",
    });

    expect(schedule.contentPublishedAt).toBe("2026-05-07T00:00:00.000Z");
    expect(schedule.taskPeriodStart).toBe("2026-05-07T00:00:00.000Z");
    expect(schedule.taskPeriodEnd).toBe("2026-05-15T00:00:00.000Z");
    expect(schedule.readDates).toEqual({
      initial_48h: "2026-05-09T00:00:00.000Z",
      final_7d: "2026-05-14T00:00:00.000Z",
      extended_30d: "2026-05-18T00:00:00.000Z",
    });
  });

  it("never seeds the final campaign read before the posting window starts", () => {
    const schedule = buildDevReportSeedSchedule({
      postingWindowStart: "2026-05-07T00:00:00.000Z",
      postingWindowEnd: "2026-05-10T00:00:00.000Z",
    });

    expect(new Date(schedule.readDates.final_7d).getTime()).toBeGreaterThanOrEqual(
      new Date("2026-05-07T00:00:00.000Z").getTime(),
    );
    expect(new Date(schedule.readDates.final_7d).getTime()).toBeLessThanOrEqual(
      new Date("2026-05-10T00:00:00.000Z").getTime(),
    );
  });
});
