import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const performanceFormSource = readFileSync(
  new URL("./performance-form.tsx", import.meta.url),
  "utf8",
);

describe("PerformanceForm brand-defined proof fields", () => {
  it("submits text metric fields as metricText instead of forcing numeric values", () => {
    expect(performanceFormSource).toContain('field.type === "text"');
    expect(performanceFormSource).toContain("metricText:");
    expect(performanceFormSource).toContain("inputMode={field.type === \"text\"");
  });
});
