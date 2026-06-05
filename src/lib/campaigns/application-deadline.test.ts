import { describe, expect, it } from "vitest";

import {
  getCampaignApplicationDeadlineDaysLeft,
  getCampaignApplicationClosedReason,
  isCampaignApplicationDeadlinePassed,
  isCampaignApplicationOpen,
} from "./application-deadline";

describe("campaign application deadline helpers", () => {
  const now = new Date("2026-05-29T12:00:00.000Z").getTime();

  it("treats null and future deadlines as open", () => {
    expect(isCampaignApplicationDeadlinePassed(null, now)).toBe(false);
    expect(isCampaignApplicationDeadlinePassed("2026-05-29T12:00:01.000Z", now)).toBe(false);
  });

  it("keeps date-only deadlines open through the named calendar day", () => {
    const sameDayNoon = new Date("2026-05-29T12:00:00.000Z").getTime();
    const nextDayStart = new Date("2026-05-30T00:00:00.000Z").getTime();

    expect(isCampaignApplicationDeadlinePassed("2026-05-29", sameDayNoon)).toBe(false);
    expect(isCampaignApplicationOpen(
      { status: "recruiting", application_deadline: "2026-05-29" },
      sameDayNoon,
    )).toBe(true);
    expect(isCampaignApplicationDeadlinePassed("2026-05-29", nextDayStart)).toBe(true);
  });

  it("labels date-only deadlines by calendar days instead of midnight drift", () => {
    const sameDayNoon = new Date("2026-05-29T12:00:00.000Z").getTime();
    const dayBeforeNoon = new Date("2026-05-28T12:00:00.000Z").getTime();
    const nextDayStart = new Date("2026-05-30T00:00:00.000Z").getTime();

    expect(getCampaignApplicationDeadlineDaysLeft("2026-05-29", sameDayNoon)).toBe(0);
    expect(getCampaignApplicationDeadlineDaysLeft("2026-05-29", dayBeforeNoon)).toBe(1);
    expect(getCampaignApplicationDeadlineDaysLeft("2026-05-29", nextDayStart)).toBe(0);
    expect(getCampaignApplicationDeadlineDaysLeft(null, sameDayNoon)).toBeNull();
  });

  it("treats past deadlines as closed", () => {
    expect(isCampaignApplicationDeadlinePassed("2026-05-29T11:59:59.000Z", now)).toBe(true);
  });

  it("closes explicit timestamp deadlines at the exact instant", () => {
    expect(isCampaignApplicationDeadlinePassed("2026-05-29T12:00:00.000Z", now)).toBe(true);
    expect(
      isCampaignApplicationOpen(
        { status: "recruiting", application_deadline: "2026-05-29T12:00:00.000Z" },
        now,
      ),
    ).toBe(false);
  });

  it("opens applications only while recruiting and before the deadline", () => {
    expect(
      isCampaignApplicationOpen(
        { status: "recruiting", application_deadline: "2026-05-29T12:00:01.000Z" },
        now,
      ),
    ).toBe(true);
    expect(
      isCampaignApplicationOpen(
        { status: "recruiting", application_deadline: "2026-05-29T11:59:59.000Z" },
        now,
      ),
    ).toBe(false);
    expect(
      isCampaignApplicationOpen(
        { status: "in_progress", application_deadline: "2026-05-29T12:00:01.000Z" },
        now,
      ),
    ).toBe(false);
  });

  it("names why applications are closed for every campaign stage", () => {
    expect(
      getCampaignApplicationClosedReason(
        { status: "recruiting", application_deadline: "2026-05-29T12:00:01.000Z" },
        now,
      ),
    ).toBeNull();
    expect(
      getCampaignApplicationClosedReason(
        { status: "recruiting", application_deadline: "2026-05-29T11:59:59.000Z" },
        now,
      ),
    ).toBe("deadline_passed");
    expect(
      getCampaignApplicationClosedReason(
        { status: "draft", application_deadline: "2026-05-29T12:00:01.000Z" },
        now,
      ),
    ).toBe("not_open");
    expect(
      getCampaignApplicationClosedReason(
        { status: "in_progress", application_deadline: "2026-05-29T12:00:01.000Z" },
        now,
      ),
    ).toBe("work_started");
    expect(
      getCampaignApplicationClosedReason(
        { status: "publishing", application_deadline: "2026-05-29T12:00:01.000Z" },
        now,
      ),
    ).toBe("work_started");
    expect(
      getCampaignApplicationClosedReason(
        { status: "monitoring", application_deadline: "2026-05-29T12:00:01.000Z" },
        now,
      ),
    ).toBe("work_started");
    expect(
      getCampaignApplicationClosedReason(
        { status: "paused", application_deadline: "2026-05-29T12:00:01.000Z" },
        now,
      ),
    ).toBe("paused");
    expect(
      getCampaignApplicationClosedReason(
        { status: "completed", application_deadline: "2026-05-29T12:00:01.000Z" },
        now,
      ),
    ).toBe("completed");
    expect(
      getCampaignApplicationClosedReason(
        { status: "cancelled", application_deadline: "2026-05-29T12:00:01.000Z" },
        now,
      ),
    ).toBe("cancelled");
  });
});
