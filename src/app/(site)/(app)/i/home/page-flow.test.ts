import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

describe("creator home flow", () => {
  it("guards async home loading when smoke navigation leaves the page", () => {
    expect(source).toContain("let isMounted = true;");
    expect(source).toContain("if (!isMounted) return;");
    expect(source).toContain("isMounted = false;");
  });
});
