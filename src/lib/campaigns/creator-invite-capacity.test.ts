import { describe, expect, it } from "vitest";

import {
  assertCampaignCreatorInviteSendCapacity,
  getCampaignCreatorInviteSendCapacityState,
} from "./creator-invite-capacity";

describe("campaign creator invite send capacity", () => {
  it("allows a saved invite when accepted creators plus reserved contacts fit paid capacity", () => {
    expect(
      getCampaignCreatorInviteSendCapacityState({
        acceptedCreatorCount: 49,
        capacity: 100,
        inviteNormalizedContact: "creator-50@example.com",
        savedInvites: [
          { normalizedContact: "creator-50@example.com", status: "manual" },
          { normalizedContact: "creator-51@example.com", status: "queued" },
          { normalizedContact: "already-used@example.com", status: "sent" },
        ],
      }),
    ).toEqual({
      acceptedCreatorCount: 49,
      capacity: 100,
      reservedInviteCount: 2,
      totalReservedCreatorCount: 51,
      remainingCreatorSlots: 49,
      isOverCapacity: false,
    });
  });

  it("blocks sending a saved invite when current paid capacity is already consumed", () => {
    expect(() =>
      assertCampaignCreatorInviteSendCapacity({
        acceptedCreatorCount: 100,
        capacity: 100,
        inviteNormalizedContact: "late-vip@example.com",
        savedInvites: [
          { normalizedContact: "late-vip@example.com", status: "manual" },
        ],
      }),
    ).toThrow(
      "This invite would exceed the paid creator capacity. Increase campaign capacity before sending more creator invites.",
    );
  });

  it("blocks queued outreach after capacity was reduced below saved invite reservations", () => {
    expect(() =>
      assertCampaignCreatorInviteSendCapacity({
        acceptedCreatorCount: 99,
        capacity: 100,
        inviteNormalizedContact: "second-reserved@example.com",
        savedInvites: [
          { normalizedContact: "first-reserved@example.com", status: "manual" },
          { normalizedContact: "second-reserved@example.com", status: "manual" },
        ],
      }),
    ).toThrow(
      "This invite would exceed the paid creator capacity. Increase campaign capacity before sending more creator invites.",
    );
  });
});
