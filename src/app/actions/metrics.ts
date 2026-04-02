"use server";

/**
 * Server Actions for auto-fetching performance metrics from social platforms.
 *
 * When a creator publishes content and provides a URL, we can automatically
 * pull metrics from the platform API instead of requiring manual entry.
 */

import { createClient } from "@/lib/supabase/server";
import { getAdapter, decryptToken, parsePostUrl } from "@/lib/oauth";
import { getMeasurementTypeForPublishedAt } from "@/lib/performance";
import type { PlatformType } from "@/types/database";

// ---------------------------------------------------------------------------
// fetchPostMetrics — auto-fetch metrics for a published submission
// ---------------------------------------------------------------------------

export async function fetchPostMetrics(submissionId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Get the submission with its published URL
  const { data: submission } = await supabase
    .from("content_submissions")
    .select(
      `id, published_at, published_url, platform, platform_post_id, status,
       campaign_members!inner ( creator_id )`
    )
    .eq("id", submissionId)
    .single();

  if (!submission) throw new Error("Submission not found");
  const submissionMember = Array.isArray(submission.campaign_members)
    ? submission.campaign_members[0]
    : submission.campaign_members;

  if (!submissionMember || submissionMember.creator_id !== user.id) {
    throw new Error("Not your submission");
  }
  if (submission.status !== "published") {
    throw new Error("Content must be published first");
  }
  if (!submission.published_url) {
    throw new Error("No published URL set");
  }

  // Parse the URL to get platform + post ID
  let platform = submission.platform as PlatformType | null;
  let postId = submission.platform_post_id;

  if (!postId) {
    const parsed = parsePostUrl(submission.published_url);
    if (!parsed) {
      throw new Error(
        "Could not parse post URL. Make sure it's a valid TikTok, Instagram, YouTube, or Snapchat link."
      );
    }
    platform = parsed.platform;
    postId = parsed.postId;

    // Store the parsed post ID for future fetches
    await supabase
      .from("content_submissions")
      .update({ platform_post_id: postId, platform: platform })
      .eq("id", submissionId);
  }

  if (!platform) throw new Error("Could not determine platform");

  // Get the creator's OAuth connection for this platform
  const { data: connection } = await supabase
    .from("social_connections")
    .select("*")
    .eq("profile_id", user.id)
    .eq("platform", platform)
    .eq("status", "active")
    .single();

  if (!connection) {
    throw new Error(
      `No active ${platform} connection. Connect your account in Profile settings first.`
    );
  }

  // Decrypt the access token
  const accessToken = decryptToken(connection.access_token_encrypted);

  // Fetch metrics from the platform API
  const adapter = getAdapter(platform);
  const metrics = await adapter.getPostMetrics(accessToken, postId);

  const measurementType = getMeasurementTypeForPublishedAt(
    submission.published_at,
  );

  // Upsert into content_performance
  const { error: insertError } = await supabase
    .from("content_performance")
    .upsert(
      {
        submission_id: submissionId,
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

  if (insertError) {
    throw new Error(`Failed to store metrics: ${insertError.message}`);
  }

  return {
    success: true,
    platform,
    measurementType,
    metrics,
  };
}

// ---------------------------------------------------------------------------
// getSocialConnections — get connection status for all platforms
// ---------------------------------------------------------------------------

export async function getSocialConnections() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabase
    .from("social_connections")
    .select(
      `id, platform, platform_username, platform_display_name,
       platform_avatar_url, status, followers_count,
       followers_updated_at, token_expires_at, error_message`
    )
    .eq("profile_id", user.id)
    .order("platform");

  return data || [];
}

// ---------------------------------------------------------------------------
// fetchAudienceDemographics — pull audience age/gender/location from platform
// ---------------------------------------------------------------------------

export async function fetchAudienceDemographics(platform: PlatformType) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Get the creator's OAuth connection for this platform
  const { data: connection } = await supabase
    .from("social_connections")
    .select("*")
    .eq("profile_id", user.id)
    .eq("platform", platform)
    .eq("status", "active")
    .single();

  if (!connection) {
    throw new Error(
      `No active ${platform} connection. Connect your account in Profile settings first.`
    );
  }

  // Check if adapter supports audience demographics
  const adapter = getAdapter(platform);
  if (!adapter.getAudienceDemographics) {
    throw new Error(
      `Audience demographics are not supported for ${platform}.`
    );
  }

  // Decrypt the access token and fetch demographics
  const accessToken = decryptToken(connection.access_token_encrypted);
  const demographics = await adapter.getAudienceDemographics(accessToken);

  // Store the result in the social_connections JSONB column
  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("social_connections")
    .update({
      audience_demographics: demographics,
      audience_demographics_updated_at: now,
    })
    .eq("id", connection.id);

  if (updateError) {
    throw new Error(
      `Failed to store audience demographics: ${updateError.message}`
    );
  }

  return {
    success: true,
    platform,
    demographics,
    updatedAt: now,
  };
}

// ---------------------------------------------------------------------------
// disconnectSocialAccount — revoke and remove a connection
// ---------------------------------------------------------------------------

export async function disconnectSocialAccount(platform: PlatformType) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Delete the connection
  const { error } = await supabase
    .from("social_connections")
    .delete()
    .eq("profile_id", user.id)
    .eq("platform", platform);

  if (error) throw new Error(`Failed to disconnect: ${error.message}`);

  // Update the creator_profiles JSONB column to mark as unverified
  await supabase
    .from("creator_profiles")
    .update({
      [platform]: null,
    })
    .eq("profile_id", user.id);

  return { success: true };
}
