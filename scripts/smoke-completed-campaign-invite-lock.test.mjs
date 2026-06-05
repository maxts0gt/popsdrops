import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  CLOSED_CREATOR_INVITES_MESSAGE,
  CLOSED_INVITE_STRIP_MESSAGE,
  DEFAULT_COMPLETED_CAMPAIGN_INVITE_LOCK_CAMPAIGN_ID,
  buildCompletedCampaignInviteLockSmokeTargets,
  validateCompletedCampaignInviteLockSmoke,
} from "./smoke-completed-campaign-invite-lock.mjs";
import { SMOKE_CAMPAIGN_TITLE } from "./smoke-application-flow.mjs";

describe("completed campaign creator invite lock smoke contract", () => {
  it("targets a disposable completed campaign and the brand creators tab", () => {
    expect(buildCompletedCampaignInviteLockSmokeTargets({})).toEqual({
      baseUrl: "http://127.0.0.1:4000",
      campaignId: DEFAULT_COMPLETED_CAMPAIGN_INVITE_LOCK_CAMPAIGN_ID,
      brandLoginUrl: "http://127.0.0.1:4000/auth/dev-login?role=brand",
      brandCampaignUrl: `http://127.0.0.1:4000/b/campaigns/${DEFAULT_COMPLETED_CAMPAIGN_INVITE_LOCK_CAMPAIGN_ID}`,
      brandCampaignCreatorsUrl: `http://127.0.0.1:4000/b/campaigns/${DEFAULT_COMPLETED_CAMPAIGN_INVITE_LOCK_CAMPAIGN_ID}?tab=creators`,
    });
  });

  it("rejects a completed campaign page with active invite controls", () => {
    expect(() =>
      validateCompletedCampaignInviteLockSmoke({
        pageText:
          `${SMOKE_CAMPAIGN_TITLE} Creator invites Saved outreach`,
        nextActionText: "Invite creators Share the campaign link",
        textareaDisabled: false,
        submitDisabled: false,
        visibleEnabledSendButtonCount: 1,
        visibleRemoveButtonCount: 1,
        consoleErrors: [],
      }),
    ).toThrow(/closed stage message/i);
  });

  it("accepts a completed campaign page only when invite controls are locked", () => {
    expect(
      validateCompletedCampaignInviteLockSmoke({
        pageText: `${SMOKE_CAMPAIGN_TITLE} Creator invites ${CLOSED_CREATOR_INVITES_MESSAGE} Saved outreach creator@dev.popsdrops.com`,
        nextActionText:
          "Next action Campaign complete Creator invites and campaign work are closed.",
        textareaDisabled: true,
        submitDisabled: true,
        inviteStripText: CLOSED_INVITE_STRIP_MESSAGE,
        inviteStripHasActionButton: false,
        inviteStripUsesNeutralClosedStyle: true,
        visibleEnabledSendButtonCount: 0,
        visibleRemoveButtonCount: 0,
        consoleErrors: [],
      }),
    ).toEqual({ ok: true });
  });

  it("rejects missing completed campaign invite strip evidence with an actionable error", () => {
    expect(() =>
      validateCompletedCampaignInviteLockSmoke({
        pageText: `${SMOKE_CAMPAIGN_TITLE} Creator invites ${CLOSED_CREATOR_INVITES_MESSAGE} Saved outreach creator@dev.popsdrops.com`,
        nextActionText:
          "Next action Campaign complete Creator invites and campaign work are closed.",
        textareaDisabled: true,
        submitDisabled: true,
        inviteStripHasActionButton: false,
        inviteStripUsesNeutralClosedStyle: true,
        visibleEnabledSendButtonCount: 0,
        visibleRemoveButtonCount: 0,
        consoleErrors: [],
      }),
    ).toThrow(/invite strip/i);
  });

  it("updates the seeded campaign to completed before the browser smoke", () => {
    const source = readFileSync(
      new URL("./smoke-completed-campaign-invite-lock.mjs", import.meta.url),
      "utf8",
    );

    expect(source).toContain('status: "completed"');
    expect(source).toContain("completeSmokeCampaignForInviteLock");
    expect(source).toContain(CLOSED_CREATOR_INVITES_MESSAGE);
    expect(source).toContain("Campaign complete");
    expect(source).toContain("campaign-invite-import-textarea");
    expect(source).toContain("campaign-invite-import-submit");
    expect(source).toContain("campaign-invite-send");
    expect(source).toContain("campaign-invite-remove");
    expect(source).toContain("completed-campaign-invite-lock-smoke.png");
  });
});
