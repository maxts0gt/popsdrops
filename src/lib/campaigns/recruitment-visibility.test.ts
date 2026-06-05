import { describe, expect, it } from "vitest";

import {
  getCampaignRecruitmentVisibility,
  isCampaignOpenForCreatorDiscovery,
  isCampaignOpenForPublicApply,
  isCampaignVisibleForPublicApply,
  requiresVerifiedInviteForApplication,
} from "./recruitment-visibility";

const FUTURE_DEADLINE = "2099-06-01";
const PAST_DEADLINE = "2020-06-01";

function campaign(overrides: Record<string, unknown> = {}) {
  return {
    status: "recruiting",
    application_deadline: FUTURE_DEADLINE,
    service_fee_cents: 14_900,
    service_fee_status: "paid",
    recruitment_visibility: "private_invite",
    ...overrides,
  };
}

describe("campaign recruitment visibility", () => {
  it("defaults unknown or missing visibility to private invite-only", () => {
    expect(getCampaignRecruitmentVisibility({})).toBe("private_invite");
    expect(
      getCampaignRecruitmentVisibility(campaign({ recruitment_visibility: "marketplace" })),
    ).toBe("private_invite");
  });

  it("only lists paid open-application campaigns in creator discovery", () => {
    expect(
      isCampaignOpenForCreatorDiscovery(
        campaign({ recruitment_visibility: "open_applications" }),
      ),
    ).toBe(true);

    expect(isCampaignOpenForCreatorDiscovery(campaign())).toBe(false);
    expect(
      isCampaignOpenForCreatorDiscovery(
        campaign({ recruitment_visibility: "shortlist_invite" }),
      ),
    ).toBe(false);
    expect(
      isCampaignOpenForCreatorDiscovery(
        campaign({
          recruitment_visibility: "open_applications",
          service_fee_status: "pending",
        }),
      ),
    ).toBe(false);
    expect(
      isCampaignOpenForCreatorDiscovery(
        campaign({
          recruitment_visibility: "open_applications",
          application_deadline: PAST_DEADLINE,
        }),
      ),
    ).toBe(false);
  });

  it("keeps private public-apply pages locked unless a private invite token is present", () => {
    expect(isCampaignOpenForPublicApply(campaign())).toBe(false);
    expect(isCampaignOpenForPublicApply(campaign(), { hasInviteToken: true })).toBe(
      true,
    );
    expect(
      isCampaignOpenForPublicApply(
        campaign({ recruitment_visibility: "open_applications" }),
      ),
    ).toBe(true);
    expect(
      isCampaignOpenForPublicApply(
        campaign({
          recruitment_visibility: "open_applications",
          service_fee_status: "pending",
        }),
        { hasInviteToken: true },
      ),
    ).toBe(false);
  });

  it("does not let invite tokens reopen closed campaign stages", () => {
    for (const status of [
      "in_progress",
      "publishing",
      "monitoring",
      "paused",
      "completed",
      "cancelled",
    ]) {
      expect(
        isCampaignOpenForPublicApply(campaign({ status }), { hasInviteToken: true }),
      ).toBe(false);
    }

    expect(
      isCampaignOpenForPublicApply(
        campaign({ application_deadline: PAST_DEADLINE }),
        { hasInviteToken: true },
      ),
    ).toBe(false);
  });

  it("keeps valid private invite links visible as closed audit pages", () => {
    expect(
      isCampaignVisibleForPublicApply(
        campaign({ status: "completed" }),
        { hasInviteToken: true },
      ),
    ).toBe(true);
    expect(
      isCampaignVisibleForPublicApply(
        campaign({ application_deadline: PAST_DEADLINE }),
        { hasInviteToken: true },
      ),
    ).toBe(true);
    expect(isCampaignVisibleForPublicApply(campaign({ status: "completed" }))).toBe(
      false,
    );
    expect(
      isCampaignVisibleForPublicApply(
        campaign({ status: "completed", service_fee_status: "pending" }),
        { hasInviteToken: true },
      ),
    ).toBe(false);
  });

  it("requires verified invites for private and shortlist applications", () => {
    expect(requiresVerifiedInviteForApplication(campaign())).toBe(true);
    expect(
      requiresVerifiedInviteForApplication(
        campaign({ recruitment_visibility: "shortlist_invite" }),
      ),
    ).toBe(true);
    expect(
      requiresVerifiedInviteForApplication(
        campaign({ recruitment_visibility: "open_applications" }),
      ),
    ).toBe(false);
  });
});
