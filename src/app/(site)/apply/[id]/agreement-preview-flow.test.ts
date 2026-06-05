import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const routeSource = readFileSync(
  new URL("../../../api/public/campaigns/[id]/route.ts", import.meta.url),
  "utf8",
);
const stringsSource = readFileSync(
  new URL("../../../../lib/i18n/strings.ts", import.meta.url),
  "utf8",
);

describe("public apply agreement preview", () => {
  it("returns only safe agreement preview fields from the public campaign route", () => {
    expect(routeSource).toContain("campaign_agreements");
    expect(routeSource).toContain("preview_enabled");
    expect(routeSource).toContain("preview_summary");
    expect(routeSource).not.toContain("agreement_body");
    expect(routeSource).not.toContain("file_path");
  });

  it("shows agreement requirements before creators apply", () => {
    expect(pageSource).toContain("agreement_preview");
    expect(pageSource).toContain('data-testid="apply-agreement-preview"');
    expect(pageSource).toContain('t("agreement.previewTitle")');
    expect(pageSource).toContain('t("agreement.signAfterAcceptance")');
  });

  it("adds all preview strings to i18n", () => {
    expect(stringsSource).toContain('"agreement.previewTitle"');
    expect(stringsSource).toContain('"agreement.signAfterAcceptance"');
  });
});
