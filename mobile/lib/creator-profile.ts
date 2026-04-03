import { z } from "zod";
import { LANGUAGES, MARKETS, PLATFORMS, type Platform } from "../../shared/types";

const marketEnum = z.enum(MARKETS);
const languageEnum = z.enum(LANGUAGES);

const creatorProfileBasicsSchema = z.object({
  full_name: z.string().min(2).max(100),
  bio: z.string().max(500),
  primary_market: marketEnum,
  languages: z.array(languageEnum).min(1),
});

type SocialAccountSummary = {
  handle: string;
  followers: number;
} | null;

export type CreatorProfileViewInput = {
  profile: {
    fullName: string;
    avatarUrl: string | null;
    email: string;
  };
  creator: {
    bio: string | null;
    primaryMarket: string | null;
    languages: string[];
    niches: string[];
    rating: number;
    campaignsCompleted: number;
    avgResponseTimeHours: number | null;
    tier: string;
    profileCompleteness: number;
    rateCard: Record<string, Record<string, number>> | null;
    socialAccounts: Record<Platform, SocialAccountSummary>;
  };
};

export function buildCreatorProfileViewModel(
  input: CreatorProfileViewInput,
): {
  displayName: string;
  completenessPercent: number;
  connectedPlatforms: Platform[];
  unconnectedPlatforms: Platform[];
  hasRateCard: boolean;
  niches: string[];
  languages: string[];
} {
  const connectedPlatforms = PLATFORMS.filter(
    (platform) => input.creator.socialAccounts[platform],
  );

  return {
    displayName: input.profile.fullName.trim() || input.profile.email,
    completenessPercent: Math.round(
      Math.max(0, input.creator.profileCompleteness) * 100,
    ),
    connectedPlatforms,
    unconnectedPlatforms: PLATFORMS.filter(
      (platform) => !connectedPlatforms.includes(platform),
    ),
    hasRateCard:
      !!input.creator.rateCard &&
      Object.keys(input.creator.rateCard).length > 0,
    niches: input.creator.niches,
    languages: input.creator.languages,
  };
}

export function validateCreatorProfileBasics(input: unknown) {
  return creatorProfileBasicsSchema.safeParse(input);
}

export function normalizeCreatorProfileBasics(input: {
  full_name: string;
  bio: string;
  primary_market: string;
  languages: string[];
}) {
  return {
    full_name: input.full_name.trim(),
    bio: input.bio.trim(),
    primary_market: input.primary_market,
    languages: Array.from(new Set(input.languages)),
  };
}

export function buildCreatorProfileBasicsUpdates(input: {
  full_name: string;
  bio: string;
  primary_market: string;
  languages: string[];
}) {
  return {
    profileUpdate: {
      full_name: input.full_name,
    },
    creatorUpdate: {
      bio: input.bio,
      primary_market: input.primary_market,
      languages: input.languages,
    },
  };
}

export function calculateCreatorProfileCompleteness(profile: {
  bio: string | null;
  niches: string[];
  markets: string[];
  languages: string[];
  primary_market: string | null;
  rate_card: Record<string, Record<string, number>> | null;
  tiktok: SocialAccountSummary;
  instagram: SocialAccountSummary;
  snapchat: SocialAccountSummary;
  youtube: SocialAccountSummary;
  facebook: SocialAccountSummary;
}) {
  const socials = [
    profile.tiktok,
    profile.instagram,
    profile.snapchat,
    profile.youtube,
    profile.facebook,
  ];

  const checks = [
    !!profile.bio,
    socials.some(Boolean),
    socials.filter(Boolean).length >= 2,
    profile.niches.length > 0,
    !!profile.rate_card && Object.keys(profile.rate_card).length > 0,
    profile.markets.length > 0,
    profile.languages.length > 0,
    !!profile.primary_market,
  ];

  return Math.round((checks.filter(Boolean).length / checks.length) * 100) / 100;
}
