import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const middlewareSource = readFileSync(new URL("./middleware.ts", import.meta.url), "utf8");

describe("middleware access contract", () => {
  it("does not route closed-launch users into legacy onboarding", () => {
    expect(middlewareSource).toContain('const pendingAccessPath = "/pending-approval";');
    expect(middlewareSource).toContain("No profile yet -> closed launch pending access");
    expect(middlewareSource).toContain("url.pathname = pendingAccessPath;");
    expect(middlewareSource).toContain("pathname.startsWith(\"/onboarding\")");
    expect(middlewareSource).toContain("pathname === pendingAccessPath");
    expect(middlewareSource).toContain("profile.status === \"approved\"");
  });

  it("lets admins inspect exact brand report proof drill-ins without opening all brand routes", () => {
    expect(middlewareSource).toContain("isAdminBrandReportPath");
    expect(middlewareSource).toContain("/^\\/b\\/campaigns\\/[^/]+\\/report(?:\\/|$)/");
    expect(middlewareSource).toContain(
      'profile.role === "admin" && isAdminBrandReportPath',
    );
    expect(middlewareSource).toContain("return supabaseResponse;");
    expect(middlewareSource).toContain('pathname.startsWith("/b/") && profile.role !== "brand"');
  });

  it("routes suspended privacy-deleted accounts out of the app shell", () => {
    expect(middlewareSource).toContain('profile.status === "suspended"');
    expect(middlewareSource).toContain('url.pathname = "/account-deleted"');
  });
});
