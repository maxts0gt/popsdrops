/**
 * Social OAuth — adapter factory + re-exports.
 *
 * Usage:
 *   import { getAdapter } from "@/lib/oauth";
 *   const adapter = getAdapter("instagram");
 *   const url = adapter.getAuthorizationUrl(state);
 */

export { encryptToken, decryptToken } from "./crypto";
export { getOAuthConfig, getRedirectUri, OAUTH_PLATFORMS, isOAuthPlatform, isMockMode } from "./config";
export { parsePostUrl, detectPlatformFromUrl } from "./url-parser";
export type {
  PlatformOAuthAdapter,
  OAuthTokens,
  PlatformUserProfile,
  PlatformMetrics,
  ParsedPostUrl,
  AudienceDemographics,
} from "./types";

import type { PlatformType } from "@/types/database";
import type { PlatformOAuthAdapter } from "./types";
import { instagramAdapter } from "./platforms/instagram";
import { tiktokAdapter } from "./platforms/tiktok";
import { youtubeAdapter } from "./platforms/youtube";
import { snapchatAdapter } from "./platforms/snapchat";

const adapters: Partial<Record<PlatformType, PlatformOAuthAdapter>> = {
  instagram: instagramAdapter,
  tiktok: tiktokAdapter,
  youtube: youtubeAdapter,
  snapchat: snapchatAdapter,
};

/** Get the OAuth adapter for a platform. Throws if not supported. */
export function getAdapter(platform: PlatformType): PlatformOAuthAdapter {
  const adapter = adapters[platform];
  if (!adapter) {
    throw new Error(`OAuth not supported for platform: ${platform}`);
  }
  return adapter;
}
