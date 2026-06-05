import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();

describe("Next proxy convention", () => {
  it("uses proxy.ts instead of the deprecated middleware.ts convention", () => {
    const deprecatedMiddlewarePath = join(projectRoot, "src/middleware.ts");
    const proxyPath = join(projectRoot, "src/proxy.ts");

    expect(existsSync(deprecatedMiddlewarePath)).toBe(false);
    expect(existsSync(proxyPath)).toBe(true);

    const proxySource = readFileSync(proxyPath, "utf8");

    expect(proxySource).toContain("export async function proxy");
    expect(proxySource).not.toContain("export async function middleware");
    expect(proxySource).toContain("updateSession(request)");
  });
});
