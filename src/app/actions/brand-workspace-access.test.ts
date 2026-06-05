import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const campaignsSource = readFileSync(new URL("./campaigns.ts", import.meta.url), "utf8");
const brandTeamSource = readFileSync(new URL("./brand-team.ts", import.meta.url), "utf8");
const profileSource = readFileSync(new URL("./profile.ts", import.meta.url), "utf8");
const applicationsSource = readFileSync(new URL("./applications.ts", import.meta.url), "utf8");
const contentSource = readFileSync(new URL("./content.ts", import.meta.url), "utf8");
const assetsSource = readFileSync(new URL("./campaign-assets.ts", import.meta.url), "utf8");
const agreementsSource = readFileSync(new URL("./campaign-agreements.ts", import.meta.url), "utf8");
const evidenceSource = readFileSync(new URL("./reporting-evidence.ts", import.meta.url), "utf8");
const updateBrandProfileSource = profileSource.slice(
  profileSource.indexOf("export async function updateBrandProfile"),
  profileSource.indexOf("export async function updateAvatar"),
);

describe("brand actions use workspace identity", () => {
  it("creates and updates campaigns through the resolved brand workspace", () => {
    expect(campaignsSource).toContain("assertBrandWorkspacePermission");
    expect(campaignsSource).toContain("const workspace = await assertBrandWorkspacePermission");
    expect(campaignsSource).toContain("brand_id: workspace.brandId");
    expect(campaignsSource).toContain(".eq(\"brand_id\", workspace.brandId)");
    expect(campaignsSource).not.toContain("brand_id: user.id");
    expect(campaignsSource).not.toContain(".eq(\"brand_id\", user.id)");
  });

  it("loads brand settings and team invites from the active workspace", () => {
    expect(brandTeamSource).toContain("getBrandWorkspaceForCurrentUser");
    expect(brandTeamSource).toContain("workspaceBrandId");
    expect(brandTeamSource).toContain(".eq(\"brand_id\", workspace.brandId)");
    expect(brandTeamSource).toContain("brand_id: workspace.brandId");
    expect(brandTeamSource).not.toContain(".eq(\"brand_id\", user.id)");
    expect(brandTeamSource).not.toContain("brand_id: user.id");

    expect(updateBrandProfileSource).toContain("assertBrandWorkspacePermission");
    expect(updateBrandProfileSource).toContain("\"manage_profile\"");
    expect(updateBrandProfileSource).toContain(".eq(\"profile_id\", workspace.brandId)");
    expect(updateBrandProfileSource).not.toContain(".eq(\"profile_id\", user.id);");
  });

  it("validates brand profile settings before updating the workspace record", () => {
    expect(profileSource).toContain("updateBrandProfileSchema");
    expect(updateBrandProfileSource).toContain(
      "const parsed = updateBrandProfileSchema.safeParse(input)",
    );
    expect(updateBrandProfileSource).toContain("if (!parsed.success)");
    expect(updateBrandProfileSource).toContain("Object.entries(parsed.data)");
    expect(updateBrandProfileSource).not.toContain("Object.entries(input)");
  });

  it("uses workspace access for brand review and proof actions", () => {
    for (const source of [
      applicationsSource,
      contentSource,
      assetsSource,
      agreementsSource,
      evidenceSource,
    ]) {
      expect(source).toMatch(
        /getBrandWorkspaceForCurrentUser|assertBrandWorkspacePermission/,
      );
      expect(source).toContain("workspace.brandId");
      expect(source).not.toContain("campaign.brand_id !== user.id");
      expect(source).not.toContain("member.campaigns.brand_id !== user.id");
      expect(source).not.toContain(".eq(\"brand_id\", user.id)");
    }
  });
});
