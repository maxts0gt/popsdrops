import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function readProjectFile(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("light-only MVP UI", () => {
  it("does not ship a runtime theme package in the web app", () => {
    const packageJson = JSON.parse(readProjectFile("package.json")) as {
      dependencies?: Record<string, string>;
    };

    expect(packageJson.dependencies).not.toHaveProperty("next-themes");
  });

  it("does not wrap the document shell in a theme provider", () => {
    const documentShell = readProjectFile("src/components/document-shell.tsx");

    expect(documentShell).not.toContain("next-themes");
    expect(documentShell).not.toContain("ThemeProvider");
  });

  it("does not expose theme toggles in platform navigation", () => {
    const platformLayouts = [
      "src/app/(site)/(app)/admin/layout.tsx",
      "src/app/(site)/(app)/b/layout.tsx",
      "src/app/(site)/(app)/i/layout.tsx",
    ];

    for (const layout of platformLayouts) {
      expect(readProjectFile(layout), layout).not.toContain("ThemeToggle");
    }
  });
});
