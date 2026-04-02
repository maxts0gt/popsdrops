/**
 * OAuth configuration for each social platform.
 *
 * Client IDs and secrets come from environment variables.
 * Redirect URIs are built from NEXT_PUBLIC_SITE_URL.
 */

import type { PlatformType } from "@/types/database";
import type { OAuthPlatformConfig } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function env(key: string, fallback = ""): string {
  return process.env[key] || fallback;
}

export function getRedirectUri(platform: PlatformType): string {
  const base = env("NEXT_PUBLIC_SITE_URL", "http://localhost:3000");
  return `${base}/auth/social/callback/${platform}`;
}

/** Platforms that support OAuth connection (MVP — no Facebook) */
export const OAUTH_PLATFORMS: PlatformType[] = [
  "instagram",
  "tiktok",
  "youtube",
  "snapchat",
];

export function isOAuthPlatform(platform: string): platform is PlatformType {
  return OAUTH_PLATFORMS.includes(platform as PlatformType);
}

// ---------------------------------------------------------------------------
// Per-platform config
// ---------------------------------------------------------------------------

export function getOAuthConfig(platform: PlatformType): OAuthPlatformConfig {
  switch (platform) {
    case "instagram":
      return {
        platform: "instagram",
        clientId: env("INSTAGRAM_APP_ID"),
        clientSecret: env("INSTAGRAM_APP_SECRET"),
        // Instagram Login path (NOT Facebook Login) — api.instagram.com
        authorizeUrl: "https://api.instagram.com/oauth/authorize",
        tokenUrl: "https://api.instagram.com/oauth/access_token",
        scopes: [
          "instagram_business_basic",
          "instagram_business_manage_insights",
        ],
        usePkce: false,
      };

    case "tiktok":
      return {
        platform: "tiktok",
        clientId: env("TIKTOK_CLIENT_KEY"),
        clientSecret: env("TIKTOK_CLIENT_SECRET"),
        authorizeUrl: "https://www.tiktok.com/v2/auth/authorize/",
        tokenUrl: "https://open.tiktokapis.com/v2/oauth/token/",
        scopes: [
          "user.info.basic",
          "user.info.profile",
          "user.info.stats",
          "video.list",
        ],
        usePkce: true,
      };

    case "youtube":
      return {
        platform: "youtube",
        clientId: env("GOOGLE_YOUTUBE_CLIENT_ID"),
        clientSecret: env("GOOGLE_YOUTUBE_CLIENT_SECRET"),
        authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenUrl: "https://oauth2.googleapis.com/token",
        scopes: [
          "https://www.googleapis.com/auth/youtube.readonly",
          "https://www.googleapis.com/auth/yt-analytics.readonly",
        ],
        usePkce: false,
      };

    case "snapchat":
      return {
        platform: "snapchat",
        clientId: env("SNAPCHAT_CLIENT_ID"),
        clientSecret: env("SNAPCHAT_CLIENT_SECRET"),
        authorizeUrl: "https://accounts.snapchat.com/accounts/oauth2/auth",
        tokenUrl: "https://accounts.snapchat.com/accounts/oauth2/token",
        scopes: [
          "snapchat-marketing-api",
        ],
        usePkce: false,
      };

    default:
      throw new Error(`OAuth not supported for platform: ${platform}`);
  }
}

/** Whether we're in mock mode (dev without real API keys) */
export function isMockMode(): boolean {
  return env("SOCIAL_OAUTH_MOCK") === "true";
}
