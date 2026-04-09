import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
  createClient: vi.fn(),
  getUser: vi.fn(),
  buildCreatorOnboardingSocialFields: vi.fn(),
  profileUpsert: vi.fn(),
  creatorProfilesUpsert: vi.fn(),
  brandProfilesUpsert: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

vi.mock("@/lib/creator-socials", () => ({
  buildCreatorOnboardingSocialFields: mocks.buildCreatorOnboardingSocialFields,
}));

vi.mock("./auth", () => ({
  getUser: mocks.getUser,
}));

import {
  submitBrandOnboarding,
  submitCreatorOnboarding,
} from "./onboarding";

describe("onboarding actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getUser.mockResolvedValue({
      id: "user-123",
      email: "max@popsdrops.com",
      user_metadata: {
        avatar_url: "https://example.com/avatar.png",
        full_name: "Max Tsogt",
      },
    });

    mocks.buildCreatorOnboardingSocialFields.mockReturnValue({
      platforms: ["tiktok"],
      rate_card: {
        tiktok: {
          post: 150,
        },
      },
      tiktok: {
        handle: "@max-tsogt",
        url: "https://tiktok.com/@max-tsogt",
        followers: 0,
        verified: false,
      },
      instagram: null,
      snapchat: null,
      youtube: null,
      facebook: null,
    });

    mocks.profileUpsert.mockResolvedValue({ error: null });
    mocks.creatorProfilesUpsert.mockResolvedValue({ error: null });
    mocks.brandProfilesUpsert.mockResolvedValue({ error: null });

    mocks.createClient.mockResolvedValue({
      from: (table: string) => {
        if (table === "profiles") {
          return { upsert: mocks.profileUpsert };
        }

        if (table === "creator_profiles") {
          return { upsert: mocks.creatorProfilesUpsert };
        }

        if (table === "brand_profiles") {
          return { upsert: mocks.brandProfilesUpsert };
        }

        throw new Error(`Unexpected table: ${table}`);
      },
    });
  });

  it("upserts creator onboarding by profile_id", async () => {
    await submitCreatorOnboarding({
      full_name: "Max Tsogt",
      primary_market: "south_korea",
      social_accounts: [{ platform: "tiktok", value: "max-tsogt" }],
      niches: ["tech"],
      base_rate: 150,
      slug: "max-tsogt",
    });

    expect(mocks.buildCreatorOnboardingSocialFields).toHaveBeenCalledWith(
      [{ platform: "tiktok", value: "max-tsogt" }],
      150,
    );
    expect(mocks.creatorProfilesUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        profile_id: "user-123",
        slug: "max-tsogt",
        primary_market: "south_korea",
        niches: ["tech"],
        markets: ["south_korea"],
        rate_currency: "USD",
        platforms: ["tiktok"],
        tiktok: expect.objectContaining({
          handle: "@max-tsogt",
          url: "https://tiktok.com/@max-tsogt",
        }),
      }),
      { onConflict: "profile_id" },
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("maps duplicate slug errors to SLUG_TAKEN", async () => {
    mocks.creatorProfilesUpsert.mockResolvedValue({
      error: {
        code: "23505",
        message: "duplicate key value violates unique constraint",
      },
    });

    await expect(
      submitCreatorOnboarding({
        full_name: "Max Tsogt",
        primary_market: "south_korea",
        social_accounts: [{ platform: "tiktok", value: "max-tsogt" }],
        niches: ["tech"],
        base_rate: 150,
        slug: "max-tsogt",
      }),
    ).rejects.toThrow("SLUG_TAKEN");
  });

  it("upserts brand onboarding by profile_id", async () => {
    await submitBrandOnboarding({
      company_name: "PopsDrops",
      industry: "fashion",
      primary_market: "south_korea",
      description: "Cross-border creator campaigns.",
      website: "https://www.popsdrops.com",
    });

    expect(mocks.brandProfilesUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        profile_id: "user-123",
        company_name: "PopsDrops",
        industry: "fashion",
        target_markets: ["south_korea"],
        description: "Cross-border creator campaigns.",
        website: "https://www.popsdrops.com",
        contact_name: "Max Tsogt",
        contact_email: "max@popsdrops.com",
      }),
      { onConflict: "profile_id" },
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/", "layout");
  });
});
