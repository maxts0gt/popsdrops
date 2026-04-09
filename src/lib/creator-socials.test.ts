import { describe, expect, it } from "vitest";

import { creatorOnboardingStep1Schema } from "./validations";
import {
  buildCreatorOnboardingSocialFields,
  normalizeCreatorSocialAccount,
} from "./creator-socials";

describe("creator onboarding social accounts", () => {
  it("accepts multiple social accounts with bare handles", () => {
    const result = creatorOnboardingStep1Schema.safeParse({
      full_name: "Max Tsogt",
      primary_market: "south_korea",
      social_accounts: [
        { platform: "tiktok", value: "max-tsogt" },
        { platform: "instagram", value: "@max.tsogt" },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("rejects duplicate platforms", () => {
    const result = creatorOnboardingStep1Schema.safeParse({
      full_name: "Max Tsogt",
      primary_market: "south_korea",
      social_accounts: [
        { platform: "tiktok", value: "max-tsogt" },
        { platform: "tiktok", value: "another-max" },
      ],
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe(
      "Each platform can only be added once",
    );
  });

  it("normalizes bare handles into canonical profile URLs", () => {
    expect(
      normalizeCreatorSocialAccount({
        platform: "tiktok",
        value: "max-tsogt",
      }),
    ).toEqual({
      handle: "@max-tsogt",
      url: "https://tiktok.com/@max-tsogt",
    });

    expect(
      normalizeCreatorSocialAccount({
        platform: "instagram",
        value: "https://instagram.com/max.tsogt/",
      }),
    ).toEqual({
      handle: "@max.tsogt",
      url: "https://instagram.com/max.tsogt",
    });
  });

  it("builds creator profile fields for every selected platform", () => {
    expect(
      buildCreatorOnboardingSocialFields(
        [
          { platform: "tiktok", value: "max-tsogt" },
          { platform: "instagram", value: "@max.tsogt" },
        ],
        150,
      ),
    ).toEqual({
      instagram: {
        followers: 0,
        handle: "@max.tsogt",
        url: "https://instagram.com/max.tsogt",
        verified: false,
      },
      platforms: ["tiktok", "instagram"],
      rate_card: {
        instagram: {
          post: 150,
        },
        tiktok: {
          post: 150,
        },
      },
      tiktok: {
        followers: 0,
        handle: "@max-tsogt",
        url: "https://tiktok.com/@max-tsogt",
        verified: false,
      },
    });
  });
});
