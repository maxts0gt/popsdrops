import { describe, expect, it } from "vitest";
import {
  buildCreatorProfileViewModel,
  calculateCreatorProfileCompleteness,
  buildCreatorProfileBasicsUpdates,
  normalizeCreatorProfileBasics,
  validateCreatorProfileBasics,
} from "./creator-profile";

describe("buildCreatorProfileViewModel", () => {
  it("builds a truthful creator profile state from profile and creator records", () => {
    const viewModel = buildCreatorProfileViewModel({
      profile: {
        fullName: "Lina Moreau",
        avatarUrl: null,
        email: "lina@example.com",
      },
      creator: {
        bio: "Luxury beauty creator across Paris and Dubai.",
        primaryMarket: "france",
        languages: ["english", "french"],
        niches: ["beauty", "lifestyle"],
        rating: 4.8,
        campaignsCompleted: 12,
        avgResponseTimeHours: 6,
        tier: "rising",
        profileCompleteness: 0.88,
        rateCard: {
          instagram: { reel: 900 },
          tiktok: { short_video: 1100 },
        },
        socialAccounts: {
          instagram: { handle: "@lina", followers: 230000 },
          tiktok: null,
          snapchat: null,
          youtube: null,
          facebook: null,
        },
      },
    });

    expect(viewModel.displayName).toBe("Lina Moreau");
    expect(viewModel.completenessPercent).toBe(88);
    expect(viewModel.connectedPlatforms).toEqual(["instagram"]);
    expect(viewModel.unconnectedPlatforms).toContain("tiktok");
    expect(viewModel.hasRateCard).toBe(true);
    expect(viewModel.niches).toEqual(["beauty", "lifestyle"]);
    expect(viewModel.languages).toEqual(["english", "french"]);
  });

  it("falls back safely when creator profile is sparse", () => {
    const viewModel = buildCreatorProfileViewModel({
      profile: {
        fullName: "",
        avatarUrl: null,
        email: "creator@example.com",
      },
      creator: {
        bio: null,
        primaryMarket: null,
        languages: [],
        niches: [],
        rating: 0,
        campaignsCompleted: 0,
        avgResponseTimeHours: null,
        tier: "new",
        profileCompleteness: 0,
        rateCard: null,
        socialAccounts: {
          instagram: null,
          tiktok: null,
          snapchat: null,
          youtube: null,
          facebook: null,
        },
      },
    });

    expect(viewModel.displayName).toBe("creator@example.com");
    expect(viewModel.completenessPercent).toBe(0);
    expect(viewModel.connectedPlatforms).toEqual([]);
    expect(viewModel.hasRateCard).toBe(false);
  });
});

describe("validateCreatorProfileBasics", () => {
  it("accepts a valid basics payload", () => {
    const result = validateCreatorProfileBasics({
      full_name: "Lina Moreau",
      bio: "Luxury beauty creator across Paris and Dubai.",
      primary_market: "france",
      languages: ["english", "french"],
    });

    expect(result.success).toBe(true);
  });

  it("rejects invalid basics payloads", () => {
    const result = validateCreatorProfileBasics({
        full_name: "L",
        bio: "x".repeat(501),
        primary_market: "mars",
        languages: [],
    });

    expect(result.success).toBe(false);
  });
});

describe("normalizeCreatorProfileBasics", () => {
  it("trims strings and removes duplicate languages", () => {
    expect(
      normalizeCreatorProfileBasics({
        full_name: "  Lina Moreau  ",
        bio: "  Luxury beauty creator  ",
        primary_market: "france",
        languages: ["english", "french", "english"],
      }),
    ).toEqual({
      full_name: "Lina Moreau",
      bio: "Luxury beauty creator",
      primary_market: "france",
      languages: ["english", "french"],
    });
  });
});

describe("buildCreatorProfileBasicsUpdates", () => {
  it("splits the basics form into profile and creator-profile updates", () => {
    expect(
      buildCreatorProfileBasicsUpdates({
        full_name: "Lina Moreau",
        bio: "Luxury beauty creator",
        primary_market: "france",
        languages: ["english", "french"],
      }),
    ).toEqual({
      profileUpdate: {
        full_name: "Lina Moreau",
      },
      creatorUpdate: {
        bio: "Luxury beauty creator",
        primary_market: "france",
        languages: ["english", "french"],
      },
    });
  });
});

describe("calculateCreatorProfileCompleteness", () => {
  it("matches the shared completeness rules for a fully built creator profile", () => {
    expect(
      calculateCreatorProfileCompleteness({
        bio: "Luxury beauty creator",
        niches: ["beauty"],
        markets: ["france"],
        languages: ["english", "french"],
        primary_market: "france",
        rate_card: { instagram: { reel: 900 } },
        tiktok: { handle: "@lina", followers: 1000 },
        instagram: { handle: "@lina", followers: 1000 },
        snapchat: null,
        youtube: null,
        facebook: null,
      }),
    ).toBe(1);
  });

  it("returns fractional completeness for partial profiles", () => {
    expect(
      calculateCreatorProfileCompleteness({
        bio: "Luxury beauty creator",
        niches: [],
        markets: [],
        languages: ["english"],
        primary_market: null,
        rate_card: null,
        tiktok: { handle: "@lina", followers: 1000 },
        instagram: null,
        snapchat: null,
        youtube: null,
        facebook: null,
      }),
    ).toBe(0.38);
  });
});
