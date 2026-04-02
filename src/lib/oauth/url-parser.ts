/**
 * Parse social media post URLs to extract platform and post ID.
 *
 * Used when a creator submits a published_url — we parse it to
 * identify the platform and post ID so we can auto-fetch metrics.
 */

import type { ParsedPostUrl } from "./types";

// ---------------------------------------------------------------------------
// Host allowlists
// ---------------------------------------------------------------------------

const PLATFORM_HOSTS: Record<ParsedPostUrl["platform"], readonly string[]> = {
  tiktok: ["tiktok.com", "www.tiktok.com", "m.tiktok.com", "vm.tiktok.com"],
  instagram: ["instagram.com", "www.instagram.com"],
  youtube: ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"],
  snapchat: [
    "snapchat.com",
    "www.snapchat.com",
    "story.snapchat.com",
    "t.snapchat.com",
  ],
  facebook: ["facebook.com", "www.facebook.com", "m.facebook.com", "fb.watch"],
};

const POST_ID_PATTERNS = {
  tiktokVideoId: /^\d+$/,
  instagramId: /^[\w-]+$/,
  youtubeId: /^[\w-]{11}$/,
  genericSlug: /^[\w-]+$/,
  facebookVideoId: /^\d+$/,
} as const;

function normalizeUrl(rawUrl: string): URL | null {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function getPathSegments(parsedUrl: URL): string[] {
  return parsedUrl.pathname
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean)
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    });
}

function detectPlatformFromHost(hostname: string): ParsedPostUrl["platform"] | null {
  const host = hostname.toLowerCase();

  for (const [platform, hosts] of Object.entries(PLATFORM_HOSTS) as Array<
    [ParsedPostUrl["platform"], readonly string[]]
  >) {
    if (hosts.includes(host)) {
      return platform;
    }
  }

  return null;
}

function parseTikTokUrl(parsedUrl: URL): string | null {
  const segments = getPathSegments(parsedUrl);

  if (parsedUrl.hostname === "vm.tiktok.com") {
    const shortId = segments[0];
    return shortId && POST_ID_PATTERNS.genericSlug.test(shortId) ? shortId : null;
  }

  const videoIndex = segments.indexOf("video");
  if (videoIndex === -1) return null;

  const videoId = segments[videoIndex + 1];
  return videoId && POST_ID_PATTERNS.tiktokVideoId.test(videoId) ? videoId : null;
}

function parseInstagramUrl(parsedUrl: URL): string | null {
  const segments = getPathSegments(parsedUrl);
  const resource = segments[0];

  if (resource === "p" || resource === "reel") {
    const postId = segments[1];
    return postId && POST_ID_PATTERNS.instagramId.test(postId) ? postId : null;
  }

  if (resource === "stories") {
    const storyId = segments[2];
    return storyId && POST_ID_PATTERNS.tiktokVideoId.test(storyId) ? storyId : null;
  }

  return null;
}

function parseYouTubeUrl(parsedUrl: URL): string | null {
  const segments = getPathSegments(parsedUrl);

  if (parsedUrl.hostname === "youtu.be") {
    const shortId = segments[0];
    return shortId && POST_ID_PATTERNS.youtubeId.test(shortId) ? shortId : null;
  }

  if (segments[0] === "watch") {
    const videoId = parsedUrl.searchParams.get("v");
    return videoId && POST_ID_PATTERNS.youtubeId.test(videoId) ? videoId : null;
  }

  if (segments[0] === "shorts") {
    const shortId = segments[1];
    return shortId && POST_ID_PATTERNS.youtubeId.test(shortId) ? shortId : null;
  }

  return null;
}

function parseSnapchatUrl(parsedUrl: URL): string | null {
  const segments = getPathSegments(parsedUrl);

  if (parsedUrl.hostname === "story.snapchat.com" && segments[0] === "s") {
    const storyId = segments[1];
    return storyId && POST_ID_PATTERNS.genericSlug.test(storyId) ? storyId : null;
  }

  if (parsedUrl.hostname === "t.snapchat.com") {
    const shortId = segments[0];
    return shortId && POST_ID_PATTERNS.genericSlug.test(shortId) ? shortId : null;
  }

  if (segments[0] === "spotlight") {
    const spotlightId = segments[1];
    return spotlightId && POST_ID_PATTERNS.genericSlug.test(spotlightId)
      ? spotlightId
      : null;
  }

  return null;
}

function parseFacebookUrl(parsedUrl: URL): string | null {
  const segments = getPathSegments(parsedUrl);

  if (parsedUrl.hostname === "fb.watch") {
    const watchId = segments[0];
    return watchId && POST_ID_PATTERNS.genericSlug.test(watchId) ? watchId : null;
  }

  if (segments[0] === "reel") {
    const reelId = segments[1];
    return reelId && POST_ID_PATTERNS.facebookVideoId.test(reelId) ? reelId : null;
  }

  const videosIndex = segments.indexOf("videos");
  if (videosIndex === -1) return null;

  const videoId = segments[videosIndex + 1];
  return videoId && POST_ID_PATTERNS.facebookVideoId.test(videoId) ? videoId : null;
}

function extractPostId(
  platform: ParsedPostUrl["platform"],
  parsedUrl: URL,
): string | null {
  switch (platform) {
    case "tiktok":
      return parseTikTokUrl(parsedUrl);
    case "instagram":
      return parseInstagramUrl(parsedUrl);
    case "youtube":
      return parseYouTubeUrl(parsedUrl);
    case "snapchat":
      return parseSnapchatUrl(parsedUrl);
    case "facebook":
      return parseFacebookUrl(parsedUrl);
  }
}

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/**
 * Parse a post URL and return the platform + post ID.
 * Returns null if the URL doesn't match any known pattern.
 */
export function parsePostUrl(url: string): ParsedPostUrl | null {
  if (!url) return null;

  const parsedUrl = normalizeUrl(url);
  if (!parsedUrl) return null;

  const platform = detectPlatformFromHost(parsedUrl.hostname);
  if (!platform) return null;

  const postId = extractPostId(platform, parsedUrl);
  if (!postId) return null;

  return { platform, postId };
}

/**
 * Detect which platform a URL belongs to (without needing a post ID).
 * Useful for validating profile URLs during onboarding.
 */
export function detectPlatformFromUrl(
  url: string
): ParsedPostUrl["platform"] | null {
  if (!url) return null;

  const parsedUrl = normalizeUrl(url);
  if (!parsedUrl) return null;

  return detectPlatformFromHost(parsedUrl.hostname);
}
