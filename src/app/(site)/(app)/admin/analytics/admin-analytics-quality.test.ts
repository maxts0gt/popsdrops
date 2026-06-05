import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readPageSource() {
  return readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
}

describe("admin analytics quality contract", () => {
  it("uses real operational visuals instead of placeholder chart panels", () => {
    const source = readPageSource();

    expect(source).not.toContain("ChartPlaceholder");
    expect(source).not.toContain("Chart visualization coming soon");
    expect(source).not.toContain("Signup Trend Line");
    expect(source).not.toContain("Grouped Bar Chart");
    expect(source).not.toContain("Market Map Visualization");

    expect(source).toContain("function SignalBarList");
    expect(source).toContain("function RoleMixPanel");
    expect(source).toContain("function MarketBalancePanel");
    expect(source).toContain("function HealthSignalPanel");
  });
});
