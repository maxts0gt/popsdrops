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

  it("preserves supported YouTube profile URL shapes", () => {
    expect(
      normalizeCreatorSocialAccount({
        platform: "youtube",
        value: "https://youtube.com/@maxstudio",
      }),
    ).toEqual({
      handle: "@maxstudio",
      url: "https://youtube.com/@maxstudio",
    });

    expect(
      normalizeCreatorSocialAccount({
        platform: "youtube",
        value: "https://youtube.com/channel/UC123456789",
      }),
    ).toEqual({
      handle: "@UC123456789",
      url: "https://youtube.com/channel/UC123456789",
    });
  });

  it("rejects YouTube watch and video URLs", () => {
    expect(() =>
      normalizeCreatorSocialAccount({
        platform: "youtube",
        value: "https://youtube.com/watch?v=abc123",
      }),
    ).toThrow("Enter a valid YouTube profile link");

    expect(() =>
      normalizeCreatorSocialAccount({
        platform: "youtube",
        value: "https://youtu.be/abc123",
      }),
    ).toThrow("Enter a valid YouTube profile link");
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
      facebook: null,
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
      snapchat: null,
      tiktok: {
        followers: 0,
        handle: "@max-tsogt",
        url: "https://tiktok.com/@max-tsogt",
        verified: false,
      },
      youtube: null,
    });
  });

  it("clears unselected platforms when rebuilding onboarding socials", () => {
    expect(
      buildCreatorOnboardingSocialFields(
        [{ platform: "youtube", value: "@maxstudio" }],
        0,
      ),
    ).toEqual({
      facebook: null,
      instagram: null,
      platforms: ["youtube"],
      rate_card: null,
      snapchat: null,
      tiktok: null,
      youtube: {
        followers: 0,
        handle: "@maxstudio",
        url: "https://youtube.com/@maxstudio",
        verified: false,
      },
    });
  });
});
