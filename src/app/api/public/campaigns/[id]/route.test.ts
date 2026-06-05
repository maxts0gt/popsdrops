import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./route.ts", import.meta.url), "utf8");

describe("public campaign API recruitment visibility", () => {
  it("requires open applications or a private invite token before exposing a public apply payload", () => {
    expect(source).toContain("recruitment_visibility");
    expect(source).toContain("campaign_creator_invites");
    expect(source).toContain("ACTIVE_CAMPAIGN_CREATOR_INVITE_STATUSES");
    expect(source).toContain(".in(\"status\", [...ACTIVE_CAMPAIGN_CREATOR_INVITE_STATUSES])");
    expect(source).not.toContain(".neq(\"status\", \"failed\")");
    expect(source).toContain("isCampaignVisibleForPublicApply");
    expect(source).toContain("hasInviteToken");
    expect(source).toContain('NextResponse.json({ error: "Not found" }, { status: 404 })');
  });
});
