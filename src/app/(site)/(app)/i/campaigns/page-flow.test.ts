import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

describe("creator campaign list flow", () => {
  it("surfaces each active campaign next action before the creator opens the room", () => {
    expect(source).toContain("CreatorCampaignListNextAction");
    expect(source).toContain("getCreatorRoomNextAction");
    expect(source).toContain('.from("content_submissions")');
    expect(source).toContain('.from("campaign_report_tasks")');
    expect(source).toContain('data-testid="creator-campaign-card-next-action"');
    expect(source).toContain('tRoom(`next.${c.nextAction.key}.title`)');
    expect(source).toContain('tRoom(`next.${c.nextAction.key}.action`)');
  });

  it("gives application and completed cards an explicit next useful action", () => {
    expect(source).toContain("getCreatorApplicationNextAction");
    expect(source).toContain("getCreatorCompletedCampaignNextAction");
    expect(source).toContain('data-testid="creator-application-card-next-action"');
    expect(source).toContain('data-testid="creator-completed-card-next-action"');
    expect(source).toContain("`/i/campaigns/${application.campaign_id}`");
    expect(source).toContain('href={`/i/campaigns/${c.id}`}');
    expect(source).toContain('t("status.completed")');
  });

  it("guards async campaign list loading when smoke navigation leaves the page", () => {
    expect(source).toContain("isMounted: () => boolean = () => true");
    expect(source).toContain("if (!isMounted()) return;");
    expect(source).toContain("let isMounted = true;");
    expect(source).toContain("isMounted = false;");
  });
});
