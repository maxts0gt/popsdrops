import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./reporting-evidence.ts", import.meta.url),
  "utf8",
);

describe("reporting evidence actions", () => {
  it("keeps AI extraction separate until creator confirmation", () => {
    expect(source).toContain("content_performance_ai_extractions");
    expect(source).toContain("pending_confirmation");
    expect(source).toContain("creator_confirmed");
    expect(source).toContain("accepted_by_creator");
  });

  it("upserts confirmed values by performance and metric key", () => {
    expect(source).toContain(".from(\"content_performance_metric_values\")");
    expect(source).toContain("onConflict: \"performance_id,metric_key\"");
  });
});
