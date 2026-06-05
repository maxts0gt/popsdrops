import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const projectRoot = new URL("../../../", import.meta.url);
const profilePageSource = readFileSync(
  new URL("src/app/(site)/(app)/i/profile/page.tsx", projectRoot),
  "utf8",
);
const stringsSource = readFileSync(new URL("src/lib/i18n/strings.ts", projectRoot), "utf8");
const englishBundleSource = readFileSync(
  new URL("src/lib/i18n/generated/platform-bundles/en.json", projectRoot),
  "utf8",
);
const migrationFile = readdirSync(new URL("supabase/migrations", projectRoot)).find((file) =>
  file.endsWith("_remove_social_oauth.sql"),
);
const migrationUrl = new URL(
  migrationFile
    ? `supabase/migrations/${migrationFile}`
    : "supabase/migrations/missing_remove_social_oauth.sql",
  projectRoot,
);

describe("evidence-first reporting has no social OAuth surface", () => {
  it("removes current OAuth routes and token helper code", () => {
    expect(existsSync(new URL("src/app/auth/social", projectRoot))).toBe(false);
    expect(existsSync(new URL("src/app/actions/metrics.ts", projectRoot))).toBe(false);
    expect(existsSync(new URL("src/lib/oauth", projectRoot))).toBe(false);
    expect(existsSync(new URL("src/app/api/cron/fetch-metrics", projectRoot))).toBe(false);
    expect(existsSync(new URL("src/app/api/cron/refresh-tokens", projectRoot))).toBe(false);
  });

  it("keeps creator profile social accounts manual and evidence-first", () => {
    expect(profilePageSource).not.toContain("getSocialConnections");
    expect(profilePageSource).not.toContain("disconnectSocialAccount");
    expect(profilePageSource).not.toContain("/auth/social/connect");
    expect(profilePageSource).not.toContain("isOAuthSupported");
    expect(profilePageSource).toContain("setConnectPlatform(platform)");
    expect(profilePageSource).toContain("social.addManually");
  });

  it("removes auto-metric promises from product copy", () => {
    for (const source of [stringsSource, englishBundleSource]) {
      expect(source).not.toContain("auto metrics");
      expect(source).not.toContain("metrics can be fetched automatically");
      expect(source).not.toContain("Auto-verify");
      expect(source).not.toContain("fetch metrics");
    }
  });

  it("drops social OAuth token storage from the active database schema", () => {
    expect(existsSync(migrationUrl)).toBe(true);
    const migrationSource = readFileSync(migrationUrl, "utf8");

    expect(migrationSource).toContain("drop table if exists public.social_connections");
    expect(migrationSource).toContain("drop type if exists public.social_connection_status");
    expect(migrationSource).toContain("drop column if exists platform_post_id");
  });
});
