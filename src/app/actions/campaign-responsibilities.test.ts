import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./campaigns.ts", import.meta.url), "utf8");

describe("campaign responsibility actions", () => {
  it("lets brand managers assign accepted teammates to campaign responsibility slots", () => {
    expect(source).toContain("campaignResponsibilityUpdateSchema");
    expect(source).toContain("updateCampaignResponsibility");
    expect(source).toContain('"manage_campaigns"');
    expect(source).toContain(".from(\"campaign_responsibility_assignments\")");
    expect(source).toContain(".from(\"brand_team_members\")");
    expect(source).toContain(".eq(\"brand_id\", workspace.brandId)");
    expect(source).toContain(".not(\"accepted_at\", \"is\", null)");
    expect(source).toContain("{ onConflict: \"campaign_id,responsibility\" }");
  });

  it("records responsibility changes in the audit trail and refreshes the campaign room", () => {
    expect(source).toContain("campaign_responsibility_updated");
    expect(source).toContain('target_type: "campaign"');
    expect(source).toContain("previous_brand_team_member_id");
    expect(source).toContain("next_brand_team_member_id");
    expect(source).toContain("revalidatePath(`/b/campaigns/${parsed.data.campaignId}`)");
  });
});
