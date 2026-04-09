import { type Platform, PLATFORMS } from "./constants";
import type { SocialAccount, RateCard } from "@/types/database";

export interface CreatorSocialAccountInput {
  platform: Platform;
  value: string;
}

interface CreatorOnboardingSocialFields {
  platforms: Platform[];
  rate_card: RateCard | null;
  tiktok?: SocialAccount;
  instagram?: SocialAccount;
  snapchat?: SocialAccount;
  youtube?: SocialAccount;
  facebook?: SocialAccount;
}

interface NormalizedSocialAccount {
  handle: string;
  url: string;
}

const PLATFORM_HOSTS: Record<Platform, string[]> = {
  tiktok: ["tiktok.com", "www.tiktok.com"],
  instagram: ["instagram.com", "www.instagram.com"],
  snapchat: ["snapchat.com", "www.snapchat.com"],
  youtube: [
    "youtube.com",
    "www.youtube.com",
    "m.youtube.com",
    "youtu.be",
  ],
  facebook: ["facebook.com", "www.facebook.com"],
};

const PLATFORM_PROFILE_BASE: Record<Platform, string> = {
  tiktok: "https://tiktok.com",
  instagram: "https://instagram.com",
  snapchat: "https://snapchat.com/add",
  youtube: "https://youtube.com",
  facebook: "https://facebook.com",
};

function tryParseProfileUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    const looksLikeProfileUrl =
      value.includes("/") ||
      /(tiktok|instagram|snapchat|youtube|facebook)\.com/i.test(value) ||
      /youtu\.be/i.test(value);

    if (!looksLikeProfileUrl) {
      return null;
    }

    try {
      return new URL(`https://${value}`);
    } catch {
      return null;
    }
  }
}

function normalizeRawIdentifier(value: string) {
  return value
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^[^/]+\//, "")
    .replace(/^@/, "")
    .replace(/\/+$/, "")
    .split(/[/?#]/)[0]
    .trim();
}

function buildCanonicalProfileUrl(platform: Platform, identifier: string) {
  if (platform === "snapchat") {
    return `${PLATFORM_PROFILE_BASE[platform]}/${identifier}`;
  }

  if (platform === "youtube") {
    return `${PLATFORM_PROFILE_BASE[platform]}/@${identifier}`;
  }

  if (platform === "tiktok") {
    return `${PLATFORM_PROFILE_BASE[platform]}/@${identifier}`;
  }

  return `${PLATFORM_PROFILE_BASE[platform]}/${identifier}`;
}

function extractNormalizedFromUrl(
  platform: Platform,
  url: URL,
): NormalizedSocialAccount {
  const hostname = url.hostname.toLowerCase();

  if (!PLATFORM_HOSTS[platform].includes(hostname)) {
    throw new Error("Profile URL does not match the selected platform");
  }

  const segments = url.pathname
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (segments.length === 0) {
    throw new Error("Enter a valid social handle or profile link");
  }

  if (platform === "snapchat") {
    const identifier =
      segments[0]?.toLowerCase() === "add"
        ? segments[1]?.replace(/^@/, "") ?? ""
        : segments[0].replace(/^@/, "");

    if (segments[0]?.toLowerCase() === "add") {
      return {
        handle: `@${identifier}`,
        url: `${PLATFORM_PROFILE_BASE[platform]}/${identifier}`,
      };
    }

    return {
      handle: `@${identifier}`,
      url: buildCanonicalProfileUrl(platform, identifier),
    };
  }

  if (platform === "youtube") {
    const [first, second] = segments;
    const normalizedFirst = first?.toLowerCase() ?? "";

    if (first?.startsWith("@")) {
      const identifier = first.slice(1);
      return {
        handle: `@${identifier}`,
        url: `https://youtube.com/${first}`,
      };
    }

    if (["channel", "c", "user", "handle"].includes(normalizedFirst)) {
      const identifier = second?.replace(/^@/, "") ?? "";

      if (!identifier) {
        throw new Error("Enter a valid YouTube profile link");
      }

      return {
        handle: `@${identifier}`,
        url: `https://youtube.com/${normalizedFirst}/${identifier}`,
      };
    }

    throw new Error("Enter a valid YouTube profile link");
  }

  const identifier = segments[0]?.replace(/^@/, "") ?? "";

  return {
    handle: `@${identifier}`,
    url: buildCanonicalProfileUrl(platform, identifier),
  };
}

function sanitizeIdentifier(identifier: string) {
  return identifier
    .replace(/^@/, "")
    .replace(/^add\//i, "")
    .replace(/^channel\//i, "")
    .replace(/^c\//i, "")
    .replace(/^user\//i, "")
    .replace(/^handle\//i, "")
    .trim();
}

export function normalizeCreatorSocialAccount(
  input: CreatorSocialAccountInput,
): Pick<SocialAccount, "url" | "handle"> {
  const trimmed = input.value.trim();

  if (!trimmed) {
    throw new Error("Enter a social handle or profile link");
  }

  const parsed = tryParseProfileUrl(trimmed);
  const fromUrl = parsed ? extractNormalizedFromUrl(input.platform, parsed) : null;
  const identifier = sanitizeIdentifier(
    fromUrl?.handle || normalizeRawIdentifier(trimmed),
  );

  if (!identifier) {
    throw new Error(
      input.platform === "youtube"
        ? "Enter a valid YouTube profile link"
        : "Enter a valid social handle or profile link",
    );
  }

  return {
    handle: `@${identifier}`,
    url: fromUrl?.url || buildCanonicalProfileUrl(input.platform, identifier),
  };
}

export function buildCreatorOnboardingSocialFields(
  accounts: CreatorSocialAccountInput[],
  baseRate: number,
): CreatorOnboardingSocialFields {
  const fields: CreatorOnboardingSocialFields = {
    platforms: [],
    rate_card: baseRate > 0 ? {} : null,
  };

  for (const account of accounts) {
    const normalized = normalizeCreatorSocialAccount(account);
    const socialData: SocialAccount = {
      ...normalized,
      followers: 0,
      verified: false,
    };

    fields.platforms.push(account.platform);
    fields[account.platform] = socialData;

    if (fields.rate_card) {
      fields.rate_card[account.platform] = { post: baseRate };
    }
  }

  return fields;
}

export function hasDuplicatePlatforms(accounts: CreatorSocialAccountInput[]): boolean {
  const seen = new Set<Platform>();

  for (const account of accounts) {
    if (!PLATFORMS.includes(account.platform)) {
      continue;
    }

    if (seen.has(account.platform)) {
      return true;
    }

    seen.add(account.platform);
  }

  return false;
}
