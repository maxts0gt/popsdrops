import { describe, expect, it } from "vitest";

import {
  formatReportChannelCount,
  formatReportReadCount,
} from "./report-count-labels";

describe("report count labels", () => {
  it("keeps executive report channel counts grammatically clean", () => {
    expect(formatReportChannelCount(0)).toBe("0 channels");
    expect(formatReportChannelCount(1)).toBe("1 channel");
    expect(formatReportChannelCount(2)).toBe("2 channels");
  });

  it("keeps executive report read counts grammatically clean", () => {
    expect(formatReportReadCount(0)).toBe("0 reads");
    expect(formatReportReadCount(1)).toBe("1 read");
    expect(formatReportReadCount(3)).toBe("3 reads");
  });
});
