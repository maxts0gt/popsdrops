import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readSource(...parts: string[]) {
  return readFileSync(path.join(process.cwd(), ...parts), "utf8");
}

describe("pending approval closed launch copy", () => {
  it("frames pending approval as closed launch access instead of marketplace onboarding", () => {
    const stringsSource = readSource("src", "lib", "i18n", "strings.ts");
    const pageSource = readSource(
      "src",
      "app",
      "(site)",
      "(auth)",
      "pending-approval",
      "page.tsx",
    );

    expect(stringsSource).toContain('"title": "Access is not open yet"');
    expect(stringsSource).toContain("PopsDrops is in closed launch");
    expect(stringsSource).toContain("Creator invite links open directly to the campaign");
    expect(stringsSource).not.toContain("Start exploring campaigns immediately");
    expect(stringsSource).not.toContain("Your Application is Under Review");
    expect(pageSource).toContain('href="/request-invite"');
    expect(pageSource).not.toContain('href="mailto:hello@popsdrops.com"');
  });
});
