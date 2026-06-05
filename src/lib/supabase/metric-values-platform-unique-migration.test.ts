import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../../supabase/migrations/20260530090000_metric_values_platform_unique.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("metric values platform unique migration", () => {
  it("allows the same metric key on separate proof sources for one performance row", () => {
    expect(migration).toContain(
      "drop constraint if exists content_performance_metric_values_unique",
    );
    expect(migration).toContain(
      "unique (performance_id, platform, metric_key)",
    );
  });
});
