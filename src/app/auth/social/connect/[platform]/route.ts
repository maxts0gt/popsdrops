/**
 * GET /auth/social/connect/[platform]
 *
 * Initiates the OAuth flow for connecting a social account.
 * Generates a state param + optional PKCE verifier, stores in cookies,
 * and redirects the user to the platform's authorization page.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes, createHash } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { getAdapter, getOAuthConfig, isOAuthPlatform, isMockMode } from "@/lib/oauth";
import type { PlatformType } from "@/types/database";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ platform: string }> }
) {
  const { platform } = await params;

  // Validate platform
  if (!isOAuthPlatform(platform)) {
    return NextResponse.json(
      { error: `OAuth not supported for: ${platform}` },
      { status: 400 }
    );
  }

  // Verify user is authenticated
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", _request.url));
  }

  const typedPlatform = platform as PlatformType;
  const adapter = getAdapter(typedPlatform);
  const config = getOAuthConfig(typedPlatform);

  // Generate cryptographic state for CSRF protection
  const state = randomBytes(32).toString("hex");

  // Generate PKCE code_verifier if needed (TikTok)
  let codeVerifier: string | undefined;
  if (config.usePkce) {
    codeVerifier = randomBytes(32).toString("base64url");
  }

  // Store state + verifier in HTTP-only cookies (expires in 10 minutes)
  const cookieStore = await cookies();
  const cookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 600, // 10 minutes
    path: "/",
  };

  cookieStore.set(`oauth_state_${platform}`, state, cookieOptions);
  if (codeVerifier) {
    cookieStore.set(`oauth_verifier_${platform}`, codeVerifier, cookieOptions);
  }

  // Mock mode: skip the real redirect, simulate a successful callback
  if (isMockMode()) {
    const callbackUrl = new URL(
      `/auth/social/callback/${platform}`,
      _request.url
    );
    callbackUrl.searchParams.set("code", "mock_auth_code_" + Date.now());
    callbackUrl.searchParams.set("state", state);
    return NextResponse.redirect(callbackUrl);
  }

  // Build authorization URL and redirect
  const authUrl = adapter.getAuthorizationUrl(state, codeVerifier);
  return NextResponse.redirect(authUrl);
}
