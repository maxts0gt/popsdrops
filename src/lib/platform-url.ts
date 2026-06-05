import type { Platform } from "@/lib/constants";

const PLATFORM_POST_URL_PATTERNS: Record<
  Platform,
  { regex: RegExp; example: string }
> = {
  tiktok: {
    regex: /^https?:\/\/(www\.|vm\.)?tiktok\.com\/.+/i,
    example: "https://www.tiktok.com/@username/video/123",
  },
  instagram: {
    regex: /^https?:\/\/(www\.)?instagram\.com\/(p|reel|stories)\/.+/i,
    example: "https://www.instagram.com/reel/ABC123",
  },
  youtube: {
    regex:
      /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/).+/i,
    example: "https://www.youtube.com/shorts/ABC123",
  },
  snapchat: {
    regex: /^https?:\/\/(www\.|story\.)?snapchat\.com\/.+/i,
    example: "https://story.snapchat.com/...",
  },
  facebook: {
    regex: /^https?:\/\/(www\.|m\.)?facebook\.com\/.+/i,
    example: "https://www.facebook.com/username/posts/123",
  },
};

export function getPlatformPostUrlExample(platform: Platform | null): string {
  return platform ? PLATFORM_POST_URL_PATTERNS[platform].example : "https://...";
}

export function isPlatformPostUrl(platform: Platform, value: string): boolean {
  return PLATFORM_POST_URL_PATTERNS[platform].regex.test(value.trim());
}
