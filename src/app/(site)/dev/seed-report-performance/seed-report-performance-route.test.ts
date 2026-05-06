import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const routeSource = readFileSync(new URL("./route.ts", import.meta.url), "utf8");

describe("dev report performance seed route", () => {
  it("is blocked in production and uses service-role seeded report data", () => {
    expect(routeSource).toContain('process.env.NODE_ENV === "production"');
    expect(routeSource).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(routeSource).toContain("content_performance");
  });

  it("seeds multiple measurement windows so report charts have a real time series", () => {
    expect(routeSource).toContain("initial_48h");
    expect(routeSource).toContain("final_7d");
    expect(routeSource).toContain("extended_30d");
    expect(routeSource).toContain('onConflict: "submission_id,measurement_type"');
    expect(routeSource).toContain("buildDevReportSeedSchedule");
    expect(routeSource).toContain("posting_window_start");
    expect(routeSource).toContain("posting_window_end");
  });

  it("seeds separate platform submissions so brand reports can switch platforms", () => {
    expect(routeSource).toContain("PLATFORM_SEEDS");
    expect(routeSource).toContain('platform: "tiktok"');
    expect(routeSource).toContain('platform: "instagram"');
    expect(routeSource).toContain('.eq("platform", platformSeed.platform)');
    expect(routeSource).toContain("platformsSeeded");
  });
});
