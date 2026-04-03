import type {
  CreatorTier,
  RateCard,
  SocialAccount,
} from "../../src/types/database";
import { supabase } from "./supabase";
import {
  buildCreatorProfileBasicsUpdates,
  buildCreatorProfileViewModel,
  calculateCreatorProfileCompleteness,
  normalizeCreatorProfileBasics,
  validateCreatorProfileBasics,
} from "./creator-profile";

type ProfileRow = {
  full_name: string;
  avatar_url: string | null;
  email: string;
};

type CreatorRow = {
  bio: string | null;
  primary_market: string | null;
  languages: string[] | null;
  niches: string[] | null;
  markets: string[] | null;
  rating: number | null;
  campaigns_completed: number | null;
  avg_response_time_hours: number | null;
  tier: CreatorTier | null;
  profile_completeness: number | null;
  rate_card: RateCard | null;
  rate_currency: string | null;
  tiktok: SocialAccount | null;
  instagram: SocialAccount | null;
  snapchat: SocialAccount | null;
  youtube: SocialAccount | null;
  facebook: SocialAccount | null;
};

export type LoadedCreatorProfile = {
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
    markets: string[];
    rating: number;
    campaignsCompleted: number;
    avgResponseTimeHours: number | null;
    tier: CreatorTier;
    profileCompleteness: number;
    rateCard: RateCard | null;
    rateCurrency: string;
    socialAccounts: {
      tiktok: { handle: string; followers: number } | null;
      instagram: { handle: string; followers: number } | null;
      snapchat: { handle: string; followers: number } | null;
      youtube: { handle: string; followers: number } | null;
      facebook: { handle: string; followers: number } | null;
    };
  };
  viewModel: ReturnType<typeof buildCreatorProfileViewModel>;
};

function mapSocialAccount(account: SocialAccount | null) {
  if (!account) {
    return null;
  }

  return {
    handle: account.handle,
    followers: account.followers,
  };
}

function getDefaultCreatorRow(): CreatorRow {
  return {
    bio: null,
    primary_market: null,
    languages: [],
    niches: [],
    markets: [],
    rating: 0,
    campaigns_completed: 0,
    avg_response_time_hours: null,
    tier: "new",
    profile_completeness: 0,
    rate_card: null,
    rate_currency: "USD",
    tiktok: null,
    instagram: null,
    snapchat: null,
    youtube: null,
    facebook: null,
  };
}

export async function loadCreatorProfileData(
  userId: string,
): Promise<LoadedCreatorProfile> {
  const [profileRes, creatorRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, avatar_url, email")
      .eq("id", userId)
      .single(),
    supabase
      .from("creator_profiles")
      .select(
        "bio, primary_market, languages, niches, markets, rating, campaigns_completed, avg_response_time_hours, tier, profile_completeness, rate_card, rate_currency, tiktok, instagram, snapchat, youtube, facebook",
      )
      .eq("profile_id", userId)
      .maybeSingle(),
  ]);

  if (profileRes.error) {
    throw profileRes.error;
  }

  if (creatorRes.error) {
    throw creatorRes.error;
  }

  const profileRow = profileRes.data as ProfileRow;
  const creatorRow = ((creatorRes.data as CreatorRow | null) ??
    getDefaultCreatorRow()) as CreatorRow;

  const profile = {
    fullName: profileRow.full_name,
    avatarUrl: profileRow.avatar_url,
    email: profileRow.email,
  };

  const creator = {
    bio: creatorRow.bio,
    primaryMarket: creatorRow.primary_market,
    languages: creatorRow.languages ?? [],
    niches: creatorRow.niches ?? [],
    markets: creatorRow.markets ?? [],
    rating: creatorRow.rating ?? 0,
    campaignsCompleted: creatorRow.campaigns_completed ?? 0,
    avgResponseTimeHours: creatorRow.avg_response_time_hours,
    tier: creatorRow.tier ?? "new",
    profileCompleteness: creatorRow.profile_completeness ?? 0,
    rateCard: creatorRow.rate_card,
    rateCurrency: creatorRow.rate_currency ?? "USD",
    socialAccounts: {
      tiktok: mapSocialAccount(creatorRow.tiktok),
      instagram: mapSocialAccount(creatorRow.instagram),
      snapchat: mapSocialAccount(creatorRow.snapchat),
      youtube: mapSocialAccount(creatorRow.youtube),
      facebook: mapSocialAccount(creatorRow.facebook),
    },
  };

  return {
    profile,
    creator,
    viewModel: buildCreatorProfileViewModel({
      profile,
      creator,
    }),
  };
}

export async function updateCreatorProfileBasicsMobile(
  userId: string,
  current: LoadedCreatorProfile["creator"],
  input: {
    full_name: string;
    bio: string;
    primary_market: string;
    languages: string[];
  },
) {
  const normalized = normalizeCreatorProfileBasics(input);
  const validation = validateCreatorProfileBasics(normalized);

  if (!validation.success) {
    throw new Error(validation.error.issues[0]?.message ?? "Invalid profile");
  }

  const { profileUpdate, creatorUpdate } =
    buildCreatorProfileBasicsUpdates(normalized);

  const profileCompleteness = calculateCreatorProfileCompleteness({
    bio: creatorUpdate.bio,
    niches: current.niches,
    markets: current.markets,
    languages: creatorUpdate.languages,
    primary_market: creatorUpdate.primary_market,
    rate_card: current.rateCard,
    tiktok: current.socialAccounts.tiktok,
    instagram: current.socialAccounts.instagram,
    snapchat: current.socialAccounts.snapchat,
    youtube: current.socialAccounts.youtube,
    facebook: current.socialAccounts.facebook,
  });

  const { error: profileError } = await supabase
    .from("profiles")
    .update(profileUpdate)
    .eq("id", userId);

  if (profileError) {
    throw profileError;
  }

  const { error: creatorError } = await supabase
    .from("creator_profiles")
    .update({
      ...creatorUpdate,
      profile_completeness: profileCompleteness,
    })
    .eq("profile_id", userId);

  if (creatorError) {
    throw creatorError;
  }
}
