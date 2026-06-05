import { existsSync, readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const projectRoot = new URL("../../../", import.meta.url);
const migrationSources = readdirSync(new URL("supabase/migrations", projectRoot))
  .filter((fileName) => fileName.endsWith(".sql"))
  .map((fileName) =>
    readFileSync(new URL(`supabase/migrations/${fileName}`, projectRoot), "utf8"),
  )
  .join("\n");
const supabaseConfig = readFileSync(new URL("supabase/config.toml", projectRoot), "utf8");
const agentGuidance = readFileSync(new URL("AGENTS.md", projectRoot), "utf8");

describe("evidence-first reporting boundary", () => {
  it("does not keep social metric cron schedules in migrations", () => {
    expect(migrationSources).not.toContain("popsdrops-fetch-published-metrics");
    expect(migrationSources).not.toContain("popsdrops-refresh-social-tokens");
    expect(migrationSources).not.toContain("fetch_published_metrics");
    expect(migrationSources).not.toContain("refresh_social_tokens");
  });

  it("does not keep cron secrets in CI after removing cron routes", () => {
    const workflowSources = readdirSync(new URL(".github/workflows", projectRoot))
      .filter((fileName) => fileName.endsWith(".yml") || fileName.endsWith(".yaml"))
      .map((fileName) =>
        readFileSync(new URL(`.github/workflows/${fileName}`, projectRoot), "utf8"),
      )
      .join("\n");

    expect(workflowSources).not.toContain("CRON_SECRET");
  });

  it("does not keep legacy API cron routes for social reporting", () => {
    expect(existsSync(new URL("src/app/api/cron", projectRoot))).toBe(false);
  });

  it("does not keep dormant social API edge functions", () => {
    expect(existsSync(new URL("supabase/functions/fetch-published-metrics", projectRoot))).toBe(
      false,
    );
    expect(existsSync(new URL("supabase/functions/refresh-social-tokens", projectRoot))).toBe(
      false,
    );
    expect(existsSync(new URL("supabase/functions/_shared/oauth.ts", projectRoot))).toBe(false);
    expect(supabaseConfig).not.toContain("[functions.fetch-published-metrics]");
    expect(supabaseConfig).not.toContain("[functions.refresh-social-tokens]");
  });

  it("documents evidence submission as the core reporting path", () => {
    expect(agentGuidance).toContain("Creator reporting is evidence-first");
    expect(agentGuidance).toContain("Never promote dormant scaffolding into architecture");
    expect(agentGuidance).not.toContain("refresh-tokens");
    expect(agentGuidance).not.toContain("fetch-metrics");
  });
});
