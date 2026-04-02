/**
 * GET /auth/social/callback/[platform]
 *
 * Handles the OAuth callback after the user authorizes on the platform.
 * Validates state, exchanges code for tokens, fetches profile,
 * stores encrypted tokens, and redirects back to the profile page.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  getAdapter,
  getRedirectUri,
  isOAuthPlatform,
  encryptToken,
} from "@/lib/oauth";
import type { PlatformType } from "@/types/database";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform } = await params;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  // Base redirect URL (profile page)
  const profileUrl = new URL("/i/profile", url.origin);

  // Handle OAuth errors (user denied, etc.)
  if (error) {
    profileUrl.searchParams.set("social_error", error);
    return NextResponse.redirect(profileUrl);
  }

  // Validate platform
  if (!isOAuthPlatform(platform)) {
    profileUrl.searchParams.set("social_error", "unsupported_platform");
    return NextResponse.redirect(profileUrl);
  }

  // Validate code and state
  if (!code || !state) {
    profileUrl.searchParams.set("social_error", "missing_params");
    return NextResponse.redirect(profileUrl);
  }

  // Validate state against cookie (CSRF check)
  const cookieStore = await cookies();
  const storedState = cookieStore.get(`oauth_state_${platform}`)?.value;
  if (!storedState || storedState !== state) {
    profileUrl.searchParams.set("social_error", "invalid_state");
    return NextResponse.redirect(profileUrl);
  }

  // Clean up state cookie
  cookieStore.delete(`oauth_state_${platform}`);

  // Get PKCE verifier if applicable
  const codeVerifier = cookieStore.get(`oauth_verifier_${platform}`)?.value;
  if (codeVerifier) {
    cookieStore.delete(`oauth_verifier_${platform}`);
  }

  // Verify user is authenticated
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", url.origin));
  }

  const typedPlatform = platform as PlatformType;
  const adapter = getAdapter(typedPlatform);

  try {
    // Step 1: Exchange code for tokens
    const redirectUri = getRedirectUri(typedPlatform);
    const tokens = await adapter.exchangeCode(code, redirectUri, codeVerifier);

    // Step 2: Fetch profile from platform API
    const profile = await adapter.getUserProfile(tokens.accessToken);

    // Step 3: Encrypt tokens
    const accessTokenEncrypted = encryptToken(tokens.accessToken);
    const refreshTokenEncrypted = tokens.refreshToken
      ? encryptToken(tokens.refreshToken)
      : null;

    // Step 4: Upsert social_connections (one per platform per user)
    const { error: upsertError } = await supabase
      .from("social_connections")
      .upsert(
        {
          profile_id: user.id,
          platform: typedPlatform,
          platform_user_id: profile.platformUserId,
          platform_username: profile.username,
          platform_display_name: profile.displayName,
          platform_avatar_url: profile.avatarUrl || null,
          access_token_encrypted: accessTokenEncrypted,
          refresh_token_encrypted: refreshTokenEncrypted,
          token_expires_at: tokens.expiresAt.toISOString(),
          scopes: tokens.scopes,
          status: "active",
          error_message: null,
          refresh_failures: 0,
          followers_count: profile.followersCount,
          followers_updated_at: new Date().toISOString(),
          last_refreshed_at: new Date().toISOString(),
        },
        { onConflict: "profile_id,platform" }
      );

    if (upsertError) {
      console.error("Failed to store social connection:", upsertError);
      profileUrl.searchParams.set("social_error", "storage_failed");
      return NextResponse.redirect(profileUrl);
    }

    // Step 5: Update creator_profiles JSONB column with verified data
    const { error: profileUpdateError } = await supabase
      .from("creator_profiles")
      .update({
        [typedPlatform]: {
          url: profile.profileUrl,
          handle: profile.username.startsWith("@")
            ? profile.username
            : `@${profile.username}`,
          followers: profile.followersCount,
          verified: true,
        },
      })
      .eq("profile_id", user.id);

    if (profileUpdateError) {
      console.error("Failed to update creator profile:", profileUpdateError);
      // Non-fatal — the connection still works
    }

    // Success — redirect with success flag
    profileUrl.searchParams.set("connected", platform);
    return NextResponse.redirect(profileUrl);
  } catch (err) {
    console.error(`OAuth callback error for ${platform}:`, err);
    profileUrl.searchParams.set(
      "social_error",
      err instanceof Error ? err.message : "unknown_error"
    );
    return NextResponse.redirect(profileUrl);
  }
}
