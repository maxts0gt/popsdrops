import { describe, expect, it } from "vitest";

import { formatRelativeTime } from "./relative-time";

describe("formatRelativeTime", () => {
  const now = new Date("2026-04-04T12:00:00.000Z").getTime();

  it("uses locale-aware relative minutes and hours", () => {
    expect(
      formatRelativeTime("2026-04-04T11:55:00.000Z", {
        locale: "en",
        now,
      }),
    ).toBe("5 minutes ago");

    expect(
      formatRelativeTime("2026-04-04T10:00:00.000Z", {
        locale: "en",
        now,
      }),
    ).toBe("2 hours ago");
  });

  it("falls back to a locale date for older notifications", () => {
    expect(
      formatRelativeTime("2026-03-20T00:00:00.000Z", {
        locale: "en-US",
        now,
      }),
    ).toBe("3/20/2026");
  });
});
