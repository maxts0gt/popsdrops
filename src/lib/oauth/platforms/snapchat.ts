/**
 * Snapchat OAuth adapter — uses Snap Login Kit.
 *
 * Snapchat's API is the most restricted of all platforms.
 * Post-level metrics are NOT available through their public API.
 * We can only get basic profile info + follower count.
 * Metrics will remain self-reported for Snapchat until we
 * secure an API partnership with Snap.
 *
 * Scopes: snapchat-marketing-api (basic profile access)
 */

import { getOAuthConfig, getRedirectUri, isMockMode } from "../config";
import type {
  PlatformOAuthAdapter,
  OAuthTokens,
  PlatformUserProfile,
  PlatformMetrics,
  ParsedPostUrl,
} from "../types";
import { parsePostUrl } from "../url-parser";

const config = () => getOAuthConfig("snapchat");

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_PROFILE: PlatformUserProfile = {
  platformUserId: "snap_demo_user_123",
  username: "democreator",
  displayName: "Demo Creator",
  avatarUrl: "https://placehold.co/150x150/e2e8f0/64748b?text=SC",
  followersCount: 6700,
  profileUrl: "https://snapchat.com/add/democreator",
};

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export const snapchatAdapter: PlatformOAuthAdapter = {
  platform: "snapchat",

  getAuthorizationUrl(state: string): string {
    const c = config();
    const params = new URLSearchParams({
      client_id: c.clientId,
      redirect_uri: getRedirectUri("snapchat"),
      state,
      scope: c.scopes.join(" "),
      response_type: "code",
    });
    return `${c.authorizeUrl}?${params.toString()}`;
  },

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    if (isMockMode()) {
      return {
        accessToken: "mock_snap_access_token_" + Date.now(),
        refreshToken: "mock_snap_refresh_token_" + Date.now(),
        expiresAt: new Date(Date.now() + 1800 * 1000), // 30 minutes
        scopes: config().scopes,
      };
    }

    const c = config();
    const res = await fetch(c.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${c.clientId}:${c.clientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });

    const data = await res.json();
    if (data.error) {
      throw new Error(`Snapchat token exchange failed: ${data.error_description || data.error}`);
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + (data.expires_in || 1800) * 1000),
      scopes: (data.scope || "").split(" ").filter(Boolean),
    };
  },

  async refreshToken(refreshTokenValue: string): Promise<OAuthTokens> {
    if (isMockMode()) {
      return {
        accessToken: "mock_snap_refreshed_" + Date.now(),
        refreshToken: "mock_snap_refresh_new_" + Date.now(),
        expiresAt: new Date(Date.now() + 1800 * 1000),
        scopes: config().scopes,
      };
    }

    const c = config();
    const res = await fetch(c.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${c.clientId}:${c.clientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({
        refresh_token: refreshTokenValue,
        grant_type: "refresh_token",
      }),
    });

    const data = await res.json();
    if (data.error) {
      throw new Error(`Snapchat token refresh failed: ${data.error_description || data.error}`);
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshTokenValue,
      expiresAt: new Date(Date.now() + (data.expires_in || 1800) * 1000),
      scopes: (data.scope || "").split(" ").filter(Boolean),
    };
  },

  async getUserProfile(accessToken: string): Promise<PlatformUserProfile> {
    if (isMockMode()) return MOCK_PROFILE;

    const res = await fetch("https://kit.snapchat.com/v1/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const data = await res.json();
    if (data.error) {
      throw new Error(`Snapchat profile fetch failed: ${data.error.message}`);
    }

    return {
      platformUserId: data.data?.me?.externalId || "",
      username: data.data?.me?.displayName || "",
      displayName: data.data?.me?.displayName || "",
      avatarUrl: data.data?.me?.bitmoji?.avatar,
      followersCount: 0, // Not available via public API
      profileUrl: `https://snapchat.com/add/${data.data?.me?.displayName || ""}`,
    };
  },

  async getPostMetrics(
    _accessToken: string,
    _postId: string
  ): Promise<PlatformMetrics> {
    // Snapchat does NOT provide post-level metrics through their public API.
    // This will remain self-reported until we have an API partnership with Snap.
    throw new Error(
      "Snapchat post metrics are not available via API. Metrics must be self-reported."
    );
  },

  parsePostUrl(url: string): ParsedPostUrl | null {
    return parsePostUrl(url);
  },
};
