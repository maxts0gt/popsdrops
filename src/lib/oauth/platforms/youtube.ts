/**
 * YouTube OAuth adapter — uses Google OAuth + YouTube Data API v3.
 *
 * Flow: Google OAuth → access token → read channel info + video stats.
 *
 * Scopes: youtube.readonly, yt-analytics.readonly
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

const config = () => getOAuthConfig("youtube");

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_PROFILE: PlatformUserProfile = {
  platformUserId: "UC_demo_channel_id",
  username: "DemoCreator",
  displayName: "Demo Creator",
  avatarUrl: "https://placehold.co/150x150/e2e8f0/64748b?text=YT",
  followersCount: 8900,
  profileUrl: "https://youtube.com/@DemoCreator",
};

function mockMetrics(): PlatformMetrics {
  return {
    views: 15600,
    likes: 780,
    comments: 124,
    shares: 45,
    subscriberGains: 23,
    avgWatchTimeSeconds: 145.2,
    completionRate: 38.5,
    impressions: 42000,
  };
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export const youtubeAdapter: PlatformOAuthAdapter = {
  platform: "youtube",

  getAuthorizationUrl(state: string): string {
    const c = config();
    const params = new URLSearchParams({
      client_id: c.clientId,
      redirect_uri: getRedirectUri("youtube"),
      state,
      scope: c.scopes.join(" "),
      response_type: "code",
      access_type: "offline", // Get refresh token
      prompt: "consent", // Always ask for consent to get refresh token
    });
    return `${c.authorizeUrl}?${params.toString()}`;
  },

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    if (isMockMode()) {
      return {
        accessToken: "mock_yt_access_token_" + Date.now(),
        refreshToken: "mock_yt_refresh_token_" + Date.now(),
        expiresAt: new Date(Date.now() + 3600 * 1000), // 1 hour
        scopes: config().scopes,
      };
    }

    const c = config();
    const res = await fetch(c.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: c.clientId,
        client_secret: c.clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
    });

    const data = await res.json();
    if (data.error) {
      throw new Error(`YouTube token exchange failed: ${data.error_description || data.error}`);
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + (data.expires_in || 3600) * 1000),
      scopes: (data.scope || "").split(" ").filter(Boolean),
    };
  },

  async refreshToken(refreshTokenValue: string): Promise<OAuthTokens> {
    if (isMockMode()) {
      return {
        accessToken: "mock_yt_refreshed_" + Date.now(),
        refreshToken: refreshTokenValue,
        expiresAt: new Date(Date.now() + 3600 * 1000),
        scopes: config().scopes,
      };
    }

    const c = config();
    const res = await fetch(c.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: c.clientId,
        client_secret: c.clientSecret,
        refresh_token: refreshTokenValue,
        grant_type: "refresh_token",
      }),
    });

    const data = await res.json();
    if (data.error) {
      throw new Error(`YouTube token refresh failed: ${data.error_description || data.error}`);
    }

    return {
      accessToken: data.access_token,
      refreshToken: refreshTokenValue, // Google reuses the refresh token
      expiresAt: new Date(Date.now() + (data.expires_in || 3600) * 1000),
      scopes: (data.scope || "").split(" ").filter(Boolean),
    };
  },

  async getUserProfile(accessToken: string): Promise<PlatformUserProfile> {
    if (isMockMode()) return MOCK_PROFILE;

    const res = await fetch(
      "https://www.googleapis.com/youtube/v3/channels?" +
        new URLSearchParams({
          part: "snippet,statistics",
          mine: "true",
        }),
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const data = await res.json();
    const channel = data.items?.[0];
    if (!channel) {
      throw new Error("No YouTube channel found for this account");
    }

    return {
      platformUserId: channel.id,
      username: channel.snippet.customUrl?.replace("@", "") || channel.snippet.title,
      displayName: channel.snippet.title,
      avatarUrl: channel.snippet.thumbnails?.default?.url,
      followersCount: parseInt(channel.statistics.subscriberCount || "0", 10),
      profileUrl: channel.snippet.customUrl
        ? `https://youtube.com/${channel.snippet.customUrl}`
        : `https://youtube.com/channel/${channel.id}`,
    };
  },

  async getPostMetrics(accessToken: string, postId: string): Promise<PlatformMetrics> {
    if (isMockMode()) return mockMetrics();

    // Fetch video statistics
    const res = await fetch(
      "https://www.googleapis.com/youtube/v3/videos?" +
        new URLSearchParams({
          part: "statistics",
          id: postId,
        }),
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const data = await res.json();
    const video = data.items?.[0];
    if (!video) {
      throw new Error(`YouTube video not found: ${postId}`);
    }

    const stats = video.statistics;
    return {
      views: parseInt(stats.viewCount || "0", 10),
      likes: parseInt(stats.likeCount || "0", 10),
      comments: parseInt(stats.commentCount || "0", 10),
    };
  },

  parsePostUrl(url: string): ParsedPostUrl | null {
    return parsePostUrl(url);
  },
};
