import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = join(process.cwd(), "src/app");
const projectRoot = process.cwd();

describe("app route layout contract", () => {
  it("keeps localized marketing routes inside a top-level route group", () => {
    expect(existsSync(join(appRoot, "(localized)", "[locale]", "layout.tsx"))).toBe(true);
    expect(existsSync(join(appRoot, "[locale]", "layout.tsx"))).toBe(false);
  });

  it("keeps localized marketing params static so app routes are not shadowed", () => {
    const localizedLayout = readFileSync(
      join(appRoot, "(localized)", "[locale]", "layout.tsx"),
      "utf8",
    );

    expect(localizedLayout).toContain("export const dynamicParams = false");
  });

  it("uses global not found because the app has multiple root layouts", () => {
    const nextConfig = readFileSync(join(projectRoot, "next.config.ts"), "utf8");
    const globalNotFound = readFileSync(
      join(appRoot, "global-not-found.tsx"),
      "utf8",
    );

    expect(existsSync(join(appRoot, "not-found.tsx"))).toBe(false);
    expect(existsSync(join(appRoot, "global-not-found.tsx"))).toBe(true);
    expect(nextConfig).toContain("globalNotFound: true");
    expect(nextConfig).toContain("turbopack: {}");
    expect(globalNotFound).toContain('import "./globals.css"');
    expect(globalNotFound).toContain("DocumentShell");
  });

  it("keeps local smoke screenshots free of framework dev chrome", () => {
    const nextConfig = readFileSync(join(projectRoot, "next.config.ts"), "utf8");

    expect(nextConfig).toContain("devIndicators: false");
  });
});
