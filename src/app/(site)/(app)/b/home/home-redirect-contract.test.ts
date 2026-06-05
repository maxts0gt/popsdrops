import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

describe("brand home canonical route", () => {
  it("removes the deprecated dashboard UI and sends brands to campaign operations", () => {
    expect(source).toContain('redirect("/b/campaigns")');
    expect(source).not.toContain("useEffect");
    expect(source).not.toContain("Card");
    expect(source).not.toContain("Dashboard");
  });
});
