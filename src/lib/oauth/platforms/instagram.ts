/**
 * Instagram OAuth adapter — Instagram API with Instagram Login.
 *
 * Uses the NEW Instagram Login path (api.instagram.com + graph.instagram.com),
 * NOT the legacy Facebook Login path (graph.facebook.com).
 * No Facebook Page required. Simpler scopes, fewer permissions to review.
 *
 * Auth: api.instagram.com/oauth/authorize
 * Token: api.instagram.com/oauth/access_token
 * Graph: graph.instagram.com (profile, media, insights)
 *
 * Scopes: instagram_business_basic, instagram_business_manage_insights
 *
 * Docs: https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/
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

/** Instagram Graph API version — update when Meta releases new versions */
const API_VERSION = "v22.0";

const config = () => getOAuthConfig("instagram");

// ---------------------------------------------------------------------------
// Mock data for development
// ---------------------------------------------------------------------------

const MOCK_PROFILE: PlatformUserProfile = {
  platformUserId: "17841412345678",
  username: "demo.creator",
  displayName: "Demo Creator",
  avatarUrl: "https://placehold.co/150x150/e2e8f0/64748b?text=IG",
  followersCount: 28400,
  profileUrl: "https://instagram.com/demo.creator",
};

function mockMetrics(): PlatformMetrics {
  return {
    views: 18700,
    reach: 12400,
    likes: 890,
    comments: 67,
    shares: 42,
    saves: 156,
  };
}

function mockDemographics(): AudienceDemographics {
  return {
    ageRanges: {
      "13-17": 0.04,
      "18-24": 0.32,
      "25-34": 0.28,
      "35-44": 0.18,
      "45-54": 0.11,
      "55-64": 0.05,
      "65+": 0.02,
    },
    genderSplit: {
      male: 0.45,
      female: 0.52,
      unknown: 0.03,
    },
    topCountries: {
      US: 0.35,
      GB: 0.12,
      FR: 0.08,
      DE: 0.07,
      BR: 0.06,
    },
    topCities: {
      "Los Angeles, US": 0.08,
      "London, GB": 0.05,
      "New York, US": 0.05,
      "Paris, FR": 0.04,
      "Berlin, DE": 0.03,
    },
  };
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

export const instagramAdapter: PlatformOAuthAdapter = {
  platform: "instagram",

  getAuthorizationUrl(state: string): string {
    const c = config();
    const params = new URLSearchParams({
      client_id: c.clientId,
      redirect_uri: getRedirectUri("instagram"),
      state,
      scope: c.scopes.join(","),
      response_type: "code",
    });
    return `${c.authorizeUrl}?${params.toString()}`;
  },

  async exchangeCode(code: string, redirectUri: string): Promise<OAuthTokens> {
    if (isMockMode()) {
      return {
        accessToken: "mock_ig_access_token_" + Date.now(),
        refreshToken: undefined,
        expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
        scopes: config().scopes,
      };
    }

    const c = config();

    // Step 1: Exchange code for short-lived token (1 hour)
    // POST api.instagram.com/oauth/access_token (form-urlencoded)
    const tokenRes = await fetch(c.tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: c.clientId,
        client_secret: c.clientSecret,
        redirect_uri: redirectUri,
        code: code.replace(/#_$/, ""), // Instagram appends #_ to the code
        grant_type: "authorization_code",
      }),
    });
    const tokenData = await tokenRes.json();

    // Response: { data: [{ access_token, user_id, permissions }] }
    const shortLivedToken =
      tokenData.data?.[0]?.access_token || tokenData.access_token;
    if (!shortLivedToken) {
      const errMsg =
        tokenData.error_message ||
        tokenData.error?.message ||
        JSON.stringify(tokenData);
      throw new Error(`Instagram token exchange failed: ${errMsg}`);
    }

    // Step 2: Exchange for long-lived token (60 days)
    // GET graph.instagram.com/access_token?grant_type=ig_exchange_token
    const longLivedRes = await fetch(
      `https://graph.instagram.com/access_token?` +
        new URLSearchParams({
          grant_type: "ig_exchange_token",
          client_secret: c.clientSecret,
          access_token: shortLivedToken,
        })
    );
    const longLivedData = await longLivedRes.json();

    return {
      accessToken: longLivedData.access_token || shortLivedToken,
      refreshToken: undefined, // IG long-lived tokens are refreshed, not via refresh_token
      expiresAt: new Date(
        Date.now() + (longLivedData.expires_in || 5184000) * 1000
      ),
      scopes: config().scopes,
    };
  },

  async refreshToken(currentToken: string): Promise<OAuthTokens> {
    if (isMockMode()) {
      return {
        accessToken: "mock_ig_refreshed_" + Date.now(),
        expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000),
        scopes: config().scopes,
      };
    }

    // GET graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token
    // Token must be at least 24h old and not yet expired.
    const res = await fetch(
      `https://graph.instagram.com/refresh_access_token?` +
        new URLSearchParams({
          grant_type: "ig_refresh_token",
          access_token: currentToken,
        })
    );
    const data = await res.json();
    if (data.error) {
      throw new Error(
        `Instagram token refresh failed: ${data.error.message || data.error}`
      );
    }

    return {
      accessToken: data.access_token,
      expiresAt: new Date(Date.now() + (data.expires_in || 5184000) * 1000),
      scopes: config().scopes,
    };
  },

  async getUserProfile(accessToken: string): Promise<PlatformUserProfile> {
    if (isMockMode()) return MOCK_PROFILE;

    // GET graph.instagram.com/v22.0/me?fields=...
    const res = await fetch(
      `https://graph.instagram.com/${API_VERSION}/me?` +
        new URLSearchParams({
          fields:
            "user_id,username,name,account_type,profile_picture_url,followers_count,follows_count,media_count",
          access_token: accessToken,
        })
    );
    const profile = await res.json();
    if (profile.error) {
      throw new Error(
        `Instagram profile fetch failed: ${profile.error.message}`
      );
    }

    return {
      platformUserId: profile.user_id || profile.id,
      username: profile.username || "",
      displayName: profile.name || profile.username || "",
      avatarUrl: profile.profile_picture_url,
      followersCount: profile.followers_count || 0,
      profileUrl: `https://instagram.com/${profile.username}`,
    };
  },

  async getPostMetrics(
    accessToken: string,
    postId: string
  ): Promise<PlatformMetrics> {
    if (isMockMode()) return mockMetrics();

    // GET graph.instagram.com/v22.0/{media_id}/insights?metric=...
    // Available: views, reach, likes, comments, shares, saved
    // Note: 'impressions' deprecated for media created after July 2, 2024
    const res = await fetch(
      `https://graph.instagram.com/${API_VERSION}/${postId}/insights?` +
        new URLSearchParams({
          metric: "views,reach,likes,comments,shares,saved",
          access_token: accessToken,
        })
    );
    const insightsData = await res.json();
    if (insightsData.error) {
      throw new Error(
        `Instagram insights fetch failed: ${insightsData.error.message}`
      );
    }

    const metrics: PlatformMetrics = {};
    for (const entry of insightsData.data || []) {
      // total_value.value is the recommended field; fall back to values[0].value
      const value =
        entry.total_value?.value ?? entry.values?.[0]?.value ?? 0;
      switch (entry.name) {
        case "views":
          metrics.views = value;
          break;
        case "reach":
          metrics.reach = value;
          break;
        case "likes":
          metrics.likes = value;
          break;
        case "comments":
          metrics.comments = value;
          break;
        case "shares":
          metrics.shares = value;
          break;
        case "saved":
          metrics.saves = value;
          break;
      }
    }

    return metrics;
  },

  parsePostUrl(url: string): ParsedPostUrl | null {
    return parsePostUrl(url);
  },

  async getAudienceDemographics(
    accessToken: string
  ): Promise<AudienceDemographics> {
    if (isMockMode()) return mockDemographics();

    // Instagram API with Instagram Login: follower_demographics insight
    // Requires 100+ followers. Each breakdown is a separate API call.
    // GET graph.instagram.com/v22.0/{user_id}/insights
    //   ?metric=follower_demographics&timeframe=last_30_days&breakdown=<type>

    // First, get the user ID
    const meRes = await fetch(
      `https://graph.instagram.com/${API_VERSION}/me?` +
        new URLSearchParams({
          fields: "user_id",
          access_token: accessToken,
        })
    );
    const meData = await meRes.json();
    if (meData.error) {
      throw new Error(
        `Instagram user fetch failed: ${meData.error.message}`
      );
    }
    const userId = meData.user_id || meData.id;

    const breakdowns = ["age", "gender", "country", "city"] as const;
    const results = await Promise.all(
      breakdowns.map(async (breakdown) => {
        const res = await fetch(
          `https://graph.instagram.com/${API_VERSION}/${userId}/insights?` +
            new URLSearchParams({
              metric: "follower_demographics",
              timeframe: "last_30_days",
              breakdown,
              access_token: accessToken,
            })
        );
        const data = await res.json();
        if (data.error) {
          // 100-follower minimum or insufficient permissions — return empty
          console.warn(
            `Instagram ${breakdown} demographics unavailable: ${data.error.message}`
          );
          return null;
        }
        return { breakdown, data: data.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? [] };
      })
    );

    const demographics: AudienceDemographics = {};

    for (const result of results) {
      if (!result) continue;

      // Each result entry: { dimension_values: [string], value: number }
      // Values are raw counts — we normalize to percentages
      const entries = result.data as Array<{
        dimension_values: string[];
        value: number;
      }>;
      const total = entries.reduce((sum, e) => sum + e.value, 0);
      if (total === 0) continue;

      const normalized: Record<string, number> = {};
      for (const entry of entries) {
        const key = entry.dimension_values[0];
        normalized[key] = Math.round((entry.value / total) * 10000) / 10000;
      }

      switch (result.breakdown) {
        case "age":
          demographics.ageRanges = normalized;
          break;
        case "gender":
          demographics.genderSplit = normalized;
          break;
        case "country":
          demographics.topCountries = normalized;
          break;
        case "city":
          demographics.topCities = normalized;
          break;
      }
    }

    return demographics;
  },
};
