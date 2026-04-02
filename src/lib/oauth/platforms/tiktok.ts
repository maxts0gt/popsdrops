/**
 * TikTok OAuth adapter — uses TikTok Login Kit v2.
 *
 * Flow: PKCE OAuth → access token → read user info + video insights.
 * TikTok requires PKCE (code_verifier / code_challenge).
 *
 * Scopes: user.info.basic, user.info.profile, user.info.stats, video.list
 */

import { getOAuthConfig, getRedirectUri, isMockMode } from "../config";
import type {
  PlatformOAuthAdapter,
  OAuthTokens,
  PlatformUserProfile,
  PlatformMetrics,
  ParsedPostUrl,
  AudienceDemographics,
} from "../types";
import { parsePostUrl } from "../url-parser";

const config = () => getOAuthConfig("tiktok");

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const MOCK_PROFILE: PlatformUserProfile = {
  platformUserId: "7123456789012345678",
  username: "demo_creator",
  displayName: "Demo Creator",
  avatarUrl: "https://placehold.co/150x150/e2e8f0/64748b?text=TT",
  followersCount: 45200,
  profileUrl: "https://tiktok.com/@demo_creator",
};

function mockMetrics(): PlatformMetrics {
  return {
    views: 34500,
    likes: 2100,
    comments: 189,
    shares: 312,
    saves: 456,
    completionRate: 42.5,
    avgWatchTimeSeconds: 8.3,
  };
}

function mockDemographics(): AudienceDemographics {
  return {
    ageRanges: {
      "13-17": 0.08,
      "18-24": 0.38,
      "25-34": 0.25,
      "35-44": 0.15,
      "45-54": 0.09,
      "55+": 0.05,
    },
    genderSplit: {
      male: 0.42,
      female: 0.55,
      unknown: 0.03,
    },
    topCountries: {
      US: 0.30,
      GB: 0.10,
      ID: 0.08,
      BR: 0.07,
      MX: 0.05,
    },
    topCities: {
      "Jakarta, ID": 0.06,
      "Los Angeles, US": 0.05,
      "London, GB": 0.04,
      "Sao Paulo, BR": 0.03,
      "New York, US": 0.03,
    },
  };
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export const tiktokAdapter: PlatformOAuthAdapter = {
  platform: "tiktok",

  getAuthorizationUrl(state: string, codeVerifier?: string): string {
    const c = config();

    // TikTok requires PKCE — we need to hash the code_verifier
    let codeChallenge = "";
    if (codeVerifier) {
      // S256 challenge: base64url(sha256(code_verifier))
      const crypto = require("crypto");
      codeChallenge = crypto
        .createHash("sha256")
        .update(codeVerifier)
        .digest("base64url");
    }

    const params = new URLSearchParams({
      client_key: c.clientId,
      redirect_uri: getRedirectUri("tiktok"),
      state,
      scope: c.scopes.join(","),
      response_type: "code",
      ...(codeChallenge && {
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
      }),
    });
    return `${c.authorizeUrl}?${params.toString()}`;
  },

  async exchangeCode(
    code: string,
    redirectUri: string,
    codeVerifier?: string
  ): Promise<OAuthTokens> {
    if (isMockMode()) {
      return {
        accessToken: "mock_tt_access_token_" + Date.now(),
        refreshToken: "mock_tt_refresh_token_" + Date.now(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
        scopes: config().scopes,
      };
    }

    const c = config();
    const res = await fetch(c.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: c.clientId,
        client_secret: c.clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        ...(codeVerifier && { code_verifier: codeVerifier }),
      }),
    });

    const data = await res.json();
    // TikTok always includes error object — check code !== "ok"
    if (data.error?.code && data.error.code !== "ok") {
      throw new Error(
        `TikTok token exchange failed: ${data.error.message || data.error.code}`
      );
    }
    if (!data.access_token) {
      throw new Error("TikTok token exchange failed: no access_token in response");
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + (data.expires_in || 86400) * 1000),
      scopes: (data.scope || "").split(",").filter(Boolean),
    };
  },

  async refreshToken(refreshTokenValue: string): Promise<OAuthTokens> {
    if (isMockMode()) {
      return {
        accessToken: "mock_tt_refreshed_" + Date.now(),
        refreshToken: "mock_tt_refresh_new_" + Date.now(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        scopes: config().scopes,
      };
    }

    const c = config();
    const res = await fetch(c.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: c.clientId,
        client_secret: c.clientSecret,
        refresh_token: refreshTokenValue,
        grant_type: "refresh_token",
      }),
    });

    const data = await res.json();
    if (data.error?.code && data.error.code !== "ok") {
      throw new Error(
        `TikTok token refresh failed: ${data.error.message || data.error.code}`
      );
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + (data.expires_in || 86400) * 1000),
      scopes: (data.scope || "").split(",").filter(Boolean),
    };
  },

  async getUserProfile(accessToken: string): Promise<PlatformUserProfile> {
    if (isMockMode()) return MOCK_PROFILE;

    const res = await fetch(
      "https://open.tiktokapis.com/v2/user/info/?" +
        new URLSearchParams({
          fields: "open_id,union_id,display_name,avatar_url,follower_count,username,profile_deep_link",
        }),
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const data = await res.json();
    const user = data.data?.user;
    if (!user) {
      throw new Error("Failed to fetch TikTok user profile");
    }

    return {
      platformUserId: user.open_id || user.union_id,
      username: user.username || "",
      displayName: user.display_name || "",
      avatarUrl: user.avatar_url,
      followersCount: user.follower_count || 0,
      profileUrl: user.profile_deep_link || `https://tiktok.com/@${user.username}`,
    };
  },

  async getPostMetrics(accessToken: string, postId: string): Promise<PlatformMetrics> {
    if (isMockMode()) return mockMetrics();

    // Fetch video list and find the matching video
    const res = await fetch(
      "https://open.tiktokapis.com/v2/video/query/?" +
        new URLSearchParams({
          fields: "id,like_count,comment_count,share_count,view_count,duration",
        }),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filters: { video_ids: [postId] },
        }),
      }
    );

    const data = await res.json();
    const video = data.data?.videos?.[0];
    if (!video) {
      throw new Error(`TikTok video not found: ${postId}`);
    }

    return {
      views: video.view_count || 0,
      likes: video.like_count || 0,
      comments: video.comment_count || 0,
      shares: video.share_count || 0,
    };
  },

  parsePostUrl(url: string): ParsedPostUrl | null {
    return parsePostUrl(url);
  },

  async getAudienceDemographics(
    _accessToken: string
  ): Promise<AudienceDemographics> {
    if (isMockMode()) return mockDemographics();

    // TikTok Display API v2 does NOT provide audience demographics through
    // our scopes (user.info.basic, user.info.profile, user.info.stats, video.list).
    // This data requires the TikTok Content Posting API with additional audit
    // approval, or a Research API partnership agreement.
    throw new Error(
      "TikTok audience demographics are not available through the Display API. " +
        "This requires the Content Posting API (additional audit) or Research API partnership."
    );
  },
};
