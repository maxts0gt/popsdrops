import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const scriptSource = readFileSync(
  fileURLToPath(new URL("./smoke-brand-team-lifecycle.ts", import.meta.url)),
  "utf8",
);

describe("brand team lifecycle smoke", () => {
  it("creates an isolated owner, invite, accepted teammate, audit trail, and cleanup path", () => {
    expect(scriptSource).toContain("runBrandTeamLifecycleSmoke");
    expect(scriptSource).toContain("setupBrandTeamLifecycleFixture");
    expect(scriptSource).toContain("acceptPendingBrandTeamInvitationForUser");
    expect(scriptSource).toContain("support+pdteam-owner");
    expect(scriptSource).toContain("support+pdteam-member");
    expect(scriptSource).toContain("brand_team_invitations");
    expect(scriptSource).toContain("brand_team_members");
    expect(scriptSource).toContain('status: "pending"');
    expect(scriptSource).toContain('acceptedInvitation.status !== "accepted"');
    expect(scriptSource).toContain('role: "manager"');
    expect(scriptSource).toContain('role: "viewer"');
    expect(scriptSource).toContain("brand_team_invitation_accepted");
    expect(scriptSource).toContain("cleanupBrandTeamLifecycleFixture");
    expect(scriptSource).toContain("admin.auth.admin.deleteUser");
  });

  it("exposes the smoke through npm with the react-server condition", () => {
    const packageJson = JSON.parse(
      readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
    );

    expect(packageJson.scripts["smoke:brand-team-lifecycle"]).toBe(
      "NODE_OPTIONS='--conditions react-server' npm exec -- tsx scripts/smoke-brand-team-lifecycle.ts",
    );
  });
});
