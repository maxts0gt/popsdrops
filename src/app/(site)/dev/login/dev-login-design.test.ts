import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

describe("dev login visual contract", () => {
  it("keeps the utility screen in the refined light web system", () => {
    expect(source).not.toMatch(/bg-(violet|blue|amber)-50/);
    expect(source).not.toContain("bg-muted/50");
    expect(source).toContain("ring-slate-900/[0.03]");
  });

  it("offers explicit brand team role smoke entries", () => {
    expect(source).toContain("Brand Owner");
    expect(source).toContain("Brand Admin");
    expect(source).toContain("Brand Manager");
    expect(source).toContain("Brand Viewer");
    expect(source).toContain("teamRole");
    expect(source).toContain("getDevBrandTeamEmail");
    expect(source).toContain("/auth/dev-login?role=brand&teamRole=");
  });
});
