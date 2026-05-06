import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const sharedViewSource = readFileSync(
  new URL("../../../../../components/reports/shared-report-view.tsx", import.meta.url),
  "utf8",
);

describe("public shared report route", () => {
  it("loads reports by token without requiring a brand session", () => {
    expect(pageSource).toContain('export const dynamic = "force-dynamic"');
    expect(pageSource).toContain('export const fetchCache = "force-no-store"');
    expect(pageSource).toContain("export const revalidate = 0");
    expect(pageSource).toContain("getSharedReportByToken");
    expect(pageSource).toContain("SharedReportView");
    expect(pageSource).not.toContain("getUser");
    expect(pageSource).not.toContain("createClient");
  });

  it("keeps the public report interactive and read-only", () => {
    expect(sharedViewSource).toContain("selectedSectionIndex");
    expect(sharedViewSource).toContain("hoveredPoint");
    expect(sharedViewSource).toContain("data-testid=\"shared-report-view\"");
    expect(sharedViewSource).toContain("data-testid=\"shared-report-point\"");
    expect(sharedViewSource).not.toContain("exportReportPDF");
    expect(sharedViewSource).not.toContain("revokeReportShareLink");
  });
});
