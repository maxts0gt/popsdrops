/**
 * Cron: Refresh expiring OAuth tokens for social connections.
 *
 * Runs daily via Vercel Cron. Finds tokens expiring within 7 days,
 * refreshes them via platform adapters, and updates the database.
 * After 3 consecutive failures, marks the connection as expired.
 *
 * Schedule: 0 4 * * * (daily at 4 AM UTC)
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdapter, encryptToken, decryptToken } from "@/lib/oauth";
import type { PlatformType } from "@/types/database";

const MAX_REFRESH_FAILURES = 3;

export async function GET(request: Request) {
  // -------------------------------------------------------------------------
  // Auth: Verify Vercel Cron secret
  // -------------------------------------------------------------------------
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  const supabase = createAdminClient();

  const results = {
    checked: 0,
    refreshed: 0,
    failed: 0,
    expired: 0,
    errors: [] as { connectionId: string; platform: string; error: string }[],
  };

  try {
    // -----------------------------------------------------------------------
    // Query connections with tokens expiring within 7 days
    // -----------------------------------------------------------------------
    const { data: connections, error: queryError } = await supabase
      .from("social_connections")
      .select("id, profile_id, platform, access_token_encrypted, refresh_token_encrypted, token_expires_at, refresh_failures")
      .eq("status", "active")
      .lt("token_expires_at", new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())
      .not("token_expires_at", "is", null);

    if (queryError) {
      throw new Error(`Failed to query connections: ${queryError.message}`);
    }

    if (!connections || connections.length === 0) {
      return NextResponse.json({
        ...results,
        message: "No tokens need refreshing",
        duration_ms: Date.now() - startTime,
      });
    }

    results.checked = connections.length;

    // -----------------------------------------------------------------------
    // Process each connection independently
    // -----------------------------------------------------------------------
    for (const connection of connections) {
      try {
        const platform = connection.platform as PlatformType;
        const adapter = getAdapter(platform);

        // Prefer refresh token, fall back to access token
        const tokenToUse = connection.refresh_token_encrypted
          ? decryptToken(connection.refresh_token_encrypted)
          : decryptToken(connection.access_token_encrypted);

        // Call the platform adapter to refresh
        const newTokens = await adapter.refreshToken(tokenToUse);

        // Encrypt new tokens for storage
        const encryptedAccess = encryptToken(newTokens.accessToken);
        const encryptedRefresh = newTokens.refreshToken
          ? encryptToken(newTokens.refreshToken)
          : connection.refresh_token_encrypted;

        // Update the connection with fresh tokens
        const { error: updateError } = await supabase
          .from("social_connections")
          .update({
            access_token_encrypted: encryptedAccess,
            refresh_token_encrypted: encryptedRefresh,
            token_expires_at: newTokens.expiresAt.toISOString(),
            scopes: newTokens.scopes,
            last_refreshed_at: new Date().toISOString(),
            refresh_failures: 0,
            error_message: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", connection.id);

        if (updateError) {
          throw new Error(`DB update failed: ${updateError.message}`);
        }

        results.refreshed++;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        results.failed++;

        const newFailures = (connection.refresh_failures ?? 0) + 1;
        const shouldExpire = newFailures >= MAX_REFRESH_FAILURES;

        if (shouldExpire) {
          results.expired++;
        }

        // Update failure count, expire if threshold reached
        await supabase
          .from("social_connections")
          .update({
            refresh_failures: newFailures,
            error_message: errorMessage,
            status: shouldExpire ? "expired" : "active",
            updated_at: new Date().toISOString(),
          })
          .eq("id", connection.id);

        results.errors.push({
          connectionId: connection.id,
          platform: connection.platform,
          error: errorMessage,
        });
      }
    }

    // -----------------------------------------------------------------------
    // Log execution
    // -----------------------------------------------------------------------
    const durationMs = Date.now() - startTime;

    await supabase.from("function_execution_log").insert({
      function_name: "cron/refresh-tokens",
      status: results.failed > 0 ? "error" : "success",
      duration_ms: durationMs,
      payload: results as unknown as Record<string, unknown>,
    });

    return NextResponse.json({
      ...results,
      duration_ms: durationMs,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    const durationMs = Date.now() - startTime;

    await supabase.from("function_execution_log").insert({
      function_name: "cron/refresh-tokens",
      status: "error",
      duration_ms: durationMs,
      error_message: errorMessage,
    });

    return NextResponse.json(
      { error: errorMessage, ...results, duration_ms: durationMs },
      { status: 500 }
    );
  }
}
