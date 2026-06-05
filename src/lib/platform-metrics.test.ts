import { describe, expect, it } from "vitest";

import { getPlatformMetricFields, PLATFORM_METRIC_NOTES } from "./platform-metrics";

describe("platform metric fields", () => {
  it("supports reporting-only X and Generic proof sources", () => {
    expect(getPlatformMetricFields("x", ["impressions", "bookmarks"])).toEqual([
      expect.objectContaining({ key: "impressions", required: true }),
      expect.objectContaining({ key: "bookmarks", required: true }),
    ]);
    expect(getPlatformMetricFields("generic", ["views", "custom_1"])).toEqual([
      expect.objectContaining({ key: "views", required: true }),
      expect.objectContaining({ key: "custom_1", required: true }),
    ]);
    expect(PLATFORM_METRIC_NOTES.x).toContain("X");
    expect(PLATFORM_METRIC_NOTES.generic).toContain("brand-defined");
  });

  it("keeps brand-defined generic proof fields as text inputs", () => {
    expect(getPlatformMetricFields("generic", ["custom_1"])).toEqual([
      expect.objectContaining({
        key: "custom_1",
        required: true,
        type: "text",
      }),
    ]);
  });
});
