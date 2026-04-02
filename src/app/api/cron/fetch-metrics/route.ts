/**
 * Cron: Fetch latest performance metrics for published campaign content.
 *
 * Runs daily via Vercel Cron. Finds content submissions in active campaigns
 * (publishing/monitoring phase) that have a published_url and an active
 * social connection, then pulls fresh metrics from each platform API.
 *
 * Schedule: 0 6 * * * (daily at 6 AM UTC)
 */

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAdapter, decryptToken, parsePostUrl } from "@/lib/oauth";
import { getMeasurementTypeForPublishedAt } from "@/lib/performance";
import type { PlatformType } from "@/types/database";

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
    campaigns_checked: 0,
    submissions_checked: 0,
    metrics_fetched: 0,
    skipped: 0,
    failed: 0,
    errors: [] as { submissionId: string; platform: string; error: string }[],
  };

  try {
    // -----------------------------------------------------------------------
    // Find active campaigns in publishing or monitoring phase
    // -----------------------------------------------------------------------
    const { data: campaigns, error: campaignError } = await supabase
      .from("campaigns")
      .select("id")
      .in("status", ["publishing", "monitoring"]);

    if (campaignError) {
      throw new Error(`Failed to query campaigns: ${campaignError.message}`);
    }

    if (!campaigns || campaigns.length === 0) {
      return NextResponse.json({
        ...results,
        message: "No active campaigns in publishing/monitoring phase",
        duration_ms: Date.now() - startTime,
      });
    }

    results.campaigns_checked = campaigns.length;
    const campaignIds = campaigns.map((c) => c.id);

    // -----------------------------------------------------------------------
    // Find published submissions with URLs in those campaigns
    // -----------------------------------------------------------------------
    const { data: submissions, error: submissionError } = await supabase
      .from("content_submissions")
      .select(
        `id, published_at, published_url, platform, platform_post_id, submitted_at,
         campaign_members!inner ( id, campaign_id, creator_id )`
      )
      .in("campaign_members.campaign_id", campaignIds)
      .eq("status", "published")
      .not("published_url", "is", null);

    if (submissionError) {
      throw new Error(`Failed to query submissions: ${submissionError.message}`);
    }

    if (!submissions || submissions.length === 0) {
      return NextResponse.json({
        ...results,
        message: "No published submissions with URLs found",
        duration_ms: Date.now() - startTime,
      });
    }

    results.submissions_checked = submissions.length;

    // -----------------------------------------------------------------------
    // Process each submission independently
    // -----------------------------------------------------------------------
    for (const submission of submissions) {
      try {
        // Resolve platform + post ID from URL if not already stored
        let platform = submission.platform as PlatformType | null;
        let postId = submission.platform_post_id;

        if (!postId && submission.published_url) {
          const parsed = parsePostUrl(submission.published_url);
          if (!parsed) {
            results.skipped++;
            continue;
          }
          platform = parsed.platform;
          postId = parsed.postId;

          // Store parsed info for future runs
          await supabase
            .from("content_submissions")
            .update({ platform_post_id: postId, platform })
            .eq("id", submission.id);
        }

        if (!platform || !postId) {
          results.skipped++;
          continue;
        }

        // Find the creator's active social connection for this platform
        const member = submission.campaign_members as unknown as {
          id: string;
          campaign_id: string;
          creator_id: string;
        };

        const { data: connection } = await supabase
          .from("social_connections")
          .select("id, access_token_encrypted")
          .eq("profile_id", member.creator_id)
          .eq("platform", platform)
          .eq("status", "active")
          .single();

        if (!connection) {
          results.skipped++;
          continue;
        }

        // Decrypt token and fetch metrics
        const accessToken = decryptToken(connection.access_token_encrypted);
        const adapter = getAdapter(platform);
        const metrics = await adapter.getPostMetrics(accessToken, postId);

        const measurementType = getMeasurementTypeForPublishedAt(
          submission.published_at ?? submission.submitted_at,
        );

        // Upsert performance data
        const { error: upsertError } = await supabase
          .from("content_performance")
          .upsert(
            {
              submission_id: submission.id,
              measurement_type: measurementType,
              views: metrics.views ?? null,
              reach: metrics.reach ?? null,
              impressions: metrics.impressions ?? null,
              likes: metrics.likes ?? null,
              comments: metrics.comments ?? null,
              shares: metrics.shares ?? null,
              saves: metrics.saves ?? null,
              sends: metrics.sends ?? null,
              screenshots: metrics.screenshots ?? null,
              replies: metrics.replies ?? null,
              clicks: metrics.clicks ?? null,
              completion_rate: metrics.completionRate ?? null,
              avg_watch_time_seconds: metrics.avgWatchTimeSeconds ?? null,
              subscriber_gains: metrics.subscriberGains ?? null,
              data_source: "api",
              reported_at: new Date().toISOString(),
            },
            { onConflict: "submission_id,measurement_type" }
          );

        if (upsertError) {
          throw new Error(`Upsert failed: ${upsertError.message}`);
        }

        results.metrics_fetched++;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Unknown error";
        results.failed++;
        results.errors.push({
          submissionId: submission.id,
          platform: (submission.platform as string) ?? "unknown",
          error: errorMessage,
        });
      }
    }

    // -----------------------------------------------------------------------
    // Log execution
    // -----------------------------------------------------------------------
    const durationMs = Date.now() - startTime;

    await supabase.from("function_execution_log").insert({
      function_name: "cron/fetch-metrics",
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
      function_name: "cron/fetch-metrics",
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
