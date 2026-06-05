import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { isSmokeWaitlist } from "./smoke-brand-access-approval";

const scriptSource = readFileSync(
  fileURLToPath(new URL("./smoke-brand-access-approval.ts", import.meta.url)),
  "utf8",
);

describe("brand access approval smoke fixture", () => {
  it("sets up a unique pending brand access request for admin UI approval", () => {
    expect(scriptSource).toContain("setupBrandAccessApprovalFixture");
    expect(scriptSource).toContain("support+pdaccess");
    expect(scriptSource).toContain("tengrivertex.com");
    expect(scriptSource).toContain('type: "brand"');
    expect(scriptSource).toContain('industry: "beauty_skincare"');
    expect(scriptSource).toContain('markets: ["region:apac"]');
    expect(scriptSource).toContain("smoke-brand-access-approval");
  });

  it("can find a smoke access request by exact email for browser-created requests", () => {
    expect(scriptSource).toContain("findBrandAccessApprovalFixtureByEmail");
    expect(scriptSource).toContain("--find");
    expect(scriptSource).toContain("requireArg(\"--email\")");
    expect(scriptSource).toContain("Find smoke waitlist by email");
  });

  it("asserts the approved brand state across waitlist, profile, brand profile, queue, and audit", () => {
    expect(scriptSource).toContain("assertBrandAccessApprovalFixture");
    expect(scriptSource).toContain("waitlistStatus");
    expect(scriptSource).toContain("profileStatus");
    expect(scriptSource).toContain("brandProfile");
    expect(scriptSource).toContain("target_markets");
    expect(scriptSource).toContain("beauty_skincare");
    expect(scriptSource).toContain("25k_100k");
    expect(scriptSource).toContain("https://popsdrops.com");
    expect(scriptSource).toContain("account_approved");
    expect(scriptSource).toContain("approve_waitlist_request");
    expect(scriptSource).toContain("email_sent");
  });

  it("asserts against the delivered approval queue row when notification triggers add pending rows", () => {
    expect(scriptSource).toContain(
      'row.template === "account_approved" && row.status === "sent"',
    );
    expect(scriptSource).toContain("Expected sent approval email");
  });

  it("runs setup, approval assertion, and cleanup when called without manual handoff flags", () => {
    expect(scriptSource).toContain("runBrandAccessApprovalSmoke");
    expect(scriptSource).toContain("approveBrandAccessApprovalFixture");
    expect(scriptSource).toContain("const fixture = await setupBrandAccessApprovalFixture();");
    expect(scriptSource).toContain("await approveBrandAccessApprovalFixture(fixture.waitlistId);");
    expect(scriptSource).toContain("await assertBrandAccessApprovalFixture(fixture.waitlistId);");
    expect(scriptSource).toContain("await cleanupBrandAccessApprovalFixture(fixture.waitlistId);");
    expect(scriptSource).toContain("mode: \"self-contained\"");
  });

  it("does not make the release command depend on manual smoke flags", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
    );

    expect(packageJson.scripts["smoke:brand-access-approval"]).toBe(
      "npm exec -- tsx scripts/smoke-brand-access-approval.ts",
    );
    expect(packageJson.scripts["smoke:brand-access-approval"]).not.toContain(
      "--setup",
    );
    expect(packageJson.scripts["smoke:release"]).toContain(
      "npm run smoke:brand-access-approval",
    );
  });

  it("cleans up only rows belonging to the exact smoke email and waitlist id", () => {
    expect(scriptSource).toContain("cleanupBrandAccessApprovalFixture");
    expect(scriptSource).toContain("Refusing to clean a non-smoke waitlist row");
    expect(scriptSource).toContain("admin.auth.admin.deleteUser");
    expect(scriptSource).toContain("--waitlist-id");
  });

  it("treats only smoke-owned waitlist rows as cleanup-safe", () => {
    const baseRow = {
      id: "access-request",
      email: "founder@example.com",
      full_name: "Founder",
      company_name: "Real Brand",
      reason: "real applicant",
      status: "approved",
      reviewed_at: null,
      reviewed_by: null,
    };

    expect(isSmokeWaitlist(baseRow)).toBe(false);
    expect(
      isSmokeWaitlist({
        ...baseRow,
        reason: "smoke-brand-access-approval: browser approval smoke",
      }),
    ).toBe(true);
    expect(
      isSmokeWaitlist({
        ...baseRow,
        email: "support+pdaccess-1234@tengrivertex.com",
      }),
    ).toBe(true);
    expect(
      isSmokeWaitlist({
        ...baseRow,
        company_name: "PopsDrops Access Smoke",
      }),
    ).toBe(true);
  });

  it("exposes setup, assert, and cleanup through npm", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
    );

    expect(packageJson.scripts["smoke:brand-access-approval"]).toBe(
      "npm exec -- tsx scripts/smoke-brand-access-approval.ts",
    );
  });
});
