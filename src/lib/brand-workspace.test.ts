import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const sourceUrl = new URL("./brand-workspace.ts", import.meta.url);
const source = existsSync(sourceUrl) ? readFileSync(sourceUrl, "utf8") : "";

describe("brand workspace access helper", () => {
  it("resolves the active brand workspace from ownership or accepted team membership", () => {
    expect(source).toContain("server-only");
    expect(source).toContain("export async function getBrandWorkspaceForUser");
    expect(source).toContain(".from(\"brand_profiles\")");
    expect(source).toContain(".eq(\"profile_id\", userId)");
    expect(source).toContain(".from(\"brand_team_members\")");
    expect(source).toContain(".eq(\"user_id\", userId)");
    expect(source).toContain(".not(\"accepted_at\", \"is\", null)");
    expect(source).toContain("brandId: member.brand_id");
  });

  it("centralizes role checks so brand actions can allow managers without owner-only code", () => {
    expect(source).toContain("export async function assertBrandWorkspaceRole");
    expect(source).toContain("export async function assertBrandWorkspacePermission");
    expect(source).toContain("allowedRoles");
    expect(source).toContain("\"owner\"");
    expect(source).toContain("\"admin\"");
    expect(source).toContain("\"manager\"");
    expect(source).toContain("\"viewer\"");
    expect(source).toContain("hasBrandWorkspacePermission");
    expect(source).toContain("Brand workspace access required.");
    expect(source).toContain("Brand workspace permission required.");
  });
});
