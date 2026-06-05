import { describe, expect, it } from "vitest";

import {
  assertCampaignCreatorBatchCapacity,
  assertCampaignCreatorCapacity,
  getCampaignCreatorCapacityState,
} from "./creator-capacity";

describe("campaign creator capacity", () => {
  it("keeps accepted creators inside the paid campaign capacity", () => {
    expect(
      getCampaignCreatorCapacityState({
        maxCreators: 100,
        acceptedCreatorCount: 99,
      }),
    ).toEqual({
      maxCreators: 100,
      acceptedCreatorCount: 99,
      remainingCreatorSlots: 1,
      isFull: false,
    });
  });

  it("treats missing campaign capacity as one paid creator slot", () => {
    expect(
      getCampaignCreatorCapacityState({
        maxCreators: null,
        acceptedCreatorCount: null,
      }),
    ).toMatchObject({
      maxCreators: 1,
      acceptedCreatorCount: 0,
      remainingCreatorSlots: 1,
      isFull: false,
    });
  });

  it("throws a manager-readable error when the campaign is full", () => {
    expect(() =>
      assertCampaignCreatorCapacity({
        maxCreators: 100,
        acceptedCreatorCount: 100,
      }),
    ).toThrow(
      "This campaign has reached its paid creator capacity. Increase the campaign capacity before accepting more creators.",
    );
  });

  it("guards bulk applicant acceptance against the paid creator capacity", () => {
    expect(
      assertCampaignCreatorBatchCapacity({
        maxCreators: 100,
        acceptedCreatorCount: 50,
        requestedCreatorCount: 50,
      }),
    ).toMatchObject({
      maxCreators: 100,
      acceptedCreatorCount: 50,
      remainingCreatorSlots: 50,
      requestedCreatorCount: 50,
    });

    expect(() =>
      assertCampaignCreatorBatchCapacity({
        maxCreators: 100,
        acceptedCreatorCount: 99,
        requestedCreatorCount: 2,
      }),
    ).toThrow(
      "This campaign has 1 paid creator slot open. Select fewer creators or increase capacity.",
    );
  });
});
