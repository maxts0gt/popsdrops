/**
 * Parse social media post URLs to extract platform and post ID.
 *
 * Used when a creator submits a published_url — we parse it to
 * identify the platform and post ID so we can auto-fetch metrics.
 */

import type { ParsedPostUrl } from "./types";

// ---------------------------------------------------------------------------
// Platform URL patterns
// ---------------------------------------------------------------------------

const PATTERNS: Array<{
  platform: ParsedPostUrl["platform"];
  patterns: RegExp[];
  extract: (match: RegExpMatchArray) => string;
}> = [
  {
    platform: "tiktok",
    patterns: [
      // https://www.tiktok.com/@user/video/7123456789012345678
      /tiktok\.com\/@[\w.]+\/video\/(\d+)/i,
      // https://vm.tiktok.com/ZMxxxxxxxxx/ (short URL — ID is in the redirect)
      /vm\.tiktok\.com\/(\w+)/i,
    ],
    extract: (m) => m[1],
  },
  {
    platform: "instagram",
    patterns: [
      // https://www.instagram.com/p/ABC123def/
      /instagram\.com\/p\/([\w-]+)/i,
      // https://www.instagram.com/reel/ABC123def/
      /instagram\.com\/reel\/([\w-]+)/i,
      // https://www.instagram.com/stories/user/1234567890/
      /instagram\.com\/stories\/[\w.]+\/(\d+)/i,
    ],
    extract: (m) => m[1],
  },
  {
    platform: "youtube",
    patterns: [
      // https://www.youtube.com/watch?v=dQw4w9WgXcQ
      /youtube\.com\/watch\?.*v=([\w-]{11})/i,
      // https://youtu.be/dQw4w9WgXcQ
      /youtu\.be\/([\w-]{11})/i,
      // https://www.youtube.com/shorts/dQw4w9WgXcQ
      /youtube\.com\/shorts\/([\w-]{11})/i,
    ],
    extract: (m) => m[1],
  },
  {
    platform: "snapchat",
    patterns: [
      // https://www.snapchat.com/spotlight/ABC123
      /snapchat\.com\/spotlight\/([\w-]+)/i,
      // https://story.snapchat.com/s/ABC123
      /story\.snapchat\.com\/s\/([\w-]+)/i,
      // https://t.snapchat.com/ABC123
      /t\.snapchat\.com\/([\w-]+)/i,
    ],
    extract: (m) => m[1],
  },
  {
    platform: "facebook",
    patterns: [
      // https://www.facebook.com/user/videos/1234567890/
      /facebook\.com\/[\w.]+\/videos\/(\d+)/i,
      // https://www.facebook.com/reel/1234567890
      /facebook\.com\/reel\/(\d+)/i,
      // https://fb.watch/abc123/
      /fb\.watch\/([\w-]+)/i,
    ],
    extract: (m) => m[1],
  },
];

// ---------------------------------------------------------------------------
// Parser
// ---------------------------------------------------------------------------

/**
 * Parse a post URL and return the platform + post ID.
 * Returns null if the URL doesn't match any known pattern.
 */
export function parsePostUrl(url: string): ParsedPostUrl | null {
  if (!url) return null;

  for (const { platform, patterns, extract } of PATTERNS) {
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return { platform, postId: extract(match) };
      }
    }
  }

  return null;
}

/**
 * Detect which platform a URL belongs to (without needing a post ID).
 * Useful for validating profile URLs during onboarding.
 */
export function detectPlatformFromUrl(
  url: string
): ParsedPostUrl["platform"] | null {
  if (!url) return null;
  const lower = url.toLowerCase();
  if (lower.includes("tiktok.com")) return "tiktok";
  if (lower.includes("instagram.com")) return "instagram";
  if (lower.includes("youtube.com") || lower.includes("youtu.be")) return "youtube";
  if (lower.includes("snapchat.com")) return "snapchat";
  if (lower.includes("facebook.com") || lower.includes("fb.watch")) return "facebook";
  return null;
}
