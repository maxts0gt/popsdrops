// ---------------------------------------------------------------------------
// OAuth types shared between web and mobile
// Note: PlatformOAuthAdapter and OAuthPlatformConfig stay in the web app
// since they have server-only implementations.
// ---------------------------------------------------------------------------

import type { Platform } from "./types";

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
  platform: Platform;
  postId: string;
}
