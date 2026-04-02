/**
 * Shared types for social platform OAuth adapters.
 */

import type { PlatformType } from "@/types/database";

// ---------------------------------------------------------------------------
// OAuth tokens returned after code exchange or refresh
// ---------------------------------------------------------------------------

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  scopes: string[];
}

// ---------------------------------------------------------------------------
// Platform user profile fetched from API
// ---------------------------------------------------------------------------

export interface PlatformUserProfile {
  platformUserId: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  followersCount: number;
  profileUrl: string;
}

// ---------------------------------------------------------------------------
// Post/video metrics fetched from API
// ---------------------------------------------------------------------------

export interface PlatformMetrics {
  views?: number;
  reach?: number;
  impressions?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;
  sends?: number;
  screenshots?: number;
  replies?: number;
  clicks?: number;
  completionRate?: number;
  avgWatchTimeSeconds?: number;
  subscriberGains?: number;
}

// ---------------------------------------------------------------------------
// Audience demographics fetched from platform API
// ---------------------------------------------------------------------------

export interface AudienceDemographics {
  /** Age breakdown, e.g. { "18-24": 0.32, "25-34": 0.28, ... } */
  ageRanges?: Record<string, number>;
  /** Gender breakdown, e.g. { "male": 0.45, "female": 0.52, "unknown": 0.03 } */
  genderSplit?: Record<string, number>;
  /** Top countries, e.g. { "US": 0.35, "GB": 0.12, ... } */
  topCountries?: Record<string, number>;
  /** Top cities, e.g. { "Los Angeles, US": 0.08, "London, GB": 0.05, ... } */
  topCities?: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Parsed post URL
// ---------------------------------------------------------------------------

export interface ParsedPostUrl {
  platform: PlatformType;
  postId: string;
}

// ---------------------------------------------------------------------------
// Platform OAuth adapter interface
// ---------------------------------------------------------------------------

export interface PlatformOAuthAdapter {
  /** Platform identifier */
  platform: PlatformType;

  /** Build the authorization URL to redirect the user to. */
  getAuthorizationUrl(state: string, codeVerifier?: string): string;

  /** Exchange the authorization code for tokens. */
  exchangeCode(code: string, redirectUri: string, codeVerifier?: string): Promise<OAuthTokens>;

  /** Refresh an expired access token. */
  refreshToken(refreshToken: string): Promise<OAuthTokens>;

  /** Fetch the authenticated user's profile from the platform. */
  getUserProfile(accessToken: string): Promise<PlatformUserProfile>;

  /** Fetch metrics for a specific post/video. */
  getPostMetrics(accessToken: string, postId: string): Promise<PlatformMetrics>;

  /** Parse a post URL to extract the platform-specific ID. Returns null if URL doesn't match. */
  parsePostUrl(url: string): ParsedPostUrl | null;

  /** Fetch audience demographics (age, gender, location). Not all platforms support this. */
  getAudienceDemographics?(accessToken: string): Promise<AudienceDemographics>;
}

// ---------------------------------------------------------------------------
// OAuth config per platform
// ---------------------------------------------------------------------------

export interface OAuthPlatformConfig {
  platform: PlatformType;
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  scopes: string[];
  /** Whether this platform requires PKCE (TikTok does) */
  usePkce: boolean;
}
