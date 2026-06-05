import { describe, expect, it } from "vitest";

import {
  formatReportCompactDate,
  formatReportCompactDateRange,
} from "./report-date-format";

describe("report date formatting", () => {
  it("formats stored timestamp strings as compact executive dates", () => {
    expect(formatReportCompactDate("2026-05-29T00:00:00+00:00")).toBe(
      "2026/05/29",
    );
    expect(formatReportCompactDate("2026-06-07T00:00:00.000Z")).toBe(
      "2026/06/07",
    );
  });

  it("keeps valid campaign windows from falling back to pending", () => {
    expect(
      formatReportCompactDateRange({
        end: "2026-06-07T00:00:00+00:00",
        pendingLabel: "Window pending",
        start: "2026-05-29T00:00:00+00:00",
      }),
    ).toBe("2026/05/29 - 2026/06/07");
  });
});
