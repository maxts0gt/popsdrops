import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const permissionsUrl = new URL("./brand-permissions.ts", import.meta.url);
const permissionsSource = existsSync(permissionsUrl)
  ? readFileSync(permissionsUrl, "utf8")
  : "";

describe("brand role permissions", () => {
  it("defines one central permission map for brand workspace roles", () => {
    expect(permissionsSource).toContain("export type BrandWorkspacePermission");
    expect(permissionsSource).toContain("view_campaigns");
    expect(permissionsSource).toContain("create_campaigns");
    expect(permissionsSource).toContain("manage_campaigns");
    expect(permissionsSource).toContain("review_content");
    expect(permissionsSource).toContain("share_reports");
    expect(permissionsSource).toContain("manage_team");
    expect(permissionsSource).toContain("manage_billing");
    expect(permissionsSource).toContain("manage_profile");
    expect(permissionsSource).toContain("export function hasBrandWorkspacePermission");
  });

  it("keeps viewer read-only while managers can operate campaigns", () => {
    expect(permissionsSource).toContain("viewer: [\"view_campaigns\"]");
    const managerPermissions = permissionsSource.slice(
      permissionsSource.indexOf("manager:"),
      permissionsSource.indexOf("viewer:"),
    );
    expect(managerPermissions).toContain("view_campaigns");
    expect(managerPermissions).toContain("create_campaigns");
    expect(managerPermissions).toContain("manage_campaigns");
    expect(managerPermissions).toContain("review_content");
    expect(managerPermissions).toContain("share_reports");
    expect(permissionsSource).not.toContain("viewer: [\"view_campaigns\", \"create_campaigns\"");
    expect(permissionsSource).not.toContain("viewer: [\"view_campaigns\", \"manage_campaigns\"");
  });
});
