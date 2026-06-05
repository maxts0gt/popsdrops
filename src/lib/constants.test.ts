import { describe, expect, it } from "vitest";

import {
  formatBudgetPerCreatorRange,
  formatBudgetRange,
} from "./constants";

describe("budget formatting", () => {
  it("does not render a duplicated range when min and max match", () => {
    expect(formatBudgetRange(300, 300, "en", "USD")).toBe("$300");
  });

  it("formats campaign creator cash as per-creator compensation", () => {
    expect(formatBudgetPerCreatorRange(1500, 1500, 5, "en", "USD")).toBe(
      "$300",
    );
    expect(formatBudgetPerCreatorRange(1000, 1500, 5, "en", "USD")).toBe(
      "$200 - $300",
    );
  });
});
