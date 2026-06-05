import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = process.cwd();

function collectSourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) return collectSourceFiles(path);
    return path.endsWith(".ts") || path.endsWith(".tsx") ? [path] : [];
  });
}

describe("browser auth lock boundary", () => {
  it("serializes browser getUser calls through the shared client helper", () => {
    const clientSource = readFileSync(
      join(repoRoot, "src/lib/supabase/client.ts"),
      "utf8",
    );

    expect(clientSource).toContain("export function getBrowserUser");
    expect(clientSource).toContain("browserUserRequest");
    expect(clientSource).toContain("client.auth.getUser()");
  });

  it("keeps client components from calling auth.getUser directly", () => {
    const files = [
      ...collectSourceFiles(join(repoRoot, "src/app")),
      ...collectSourceFiles(join(repoRoot, "src/components")),
    ];

    const directBrowserCalls = files
      .map((file) => ({
        file,
        source: readFileSync(file, "utf8"),
      }))
      .filter(({ source }) => source.startsWith('"use client";'))
      .filter(({ source }) => source.includes(".auth.getUser()"))
      .map(({ file }) => file.replace(`${repoRoot}/`, ""));

    expect(directBrowserCalls).toEqual([]);
  });

  it("keeps smoke-critical creator routes off browser getUser during route churn", () => {
    const routeFiles = [
      "src/app/(site)/(app)/i/home/page.tsx",
      "src/app/(site)/(app)/i/campaigns/[id]/page.tsx",
    ];

    const browserUserCallers = routeFiles
      .filter((file) =>
        readFileSync(join(repoRoot, file), "utf8").includes("getBrowserUser"),
      );

    expect(browserUserCallers).toEqual([]);
  });
});
