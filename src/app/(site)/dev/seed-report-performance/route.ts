// DEV ONLY - seeds multiple performance reads for a campaign report chart.

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildDevReportSeedSchedule } from "@/lib/reporting/dev-seed-report-schedule";

const DEFAULT_CAMPAIGN_ID = "4707edb5-dcab-4b2d-b5eb-7e79f0e1f010";

const PLATFORM_SEEDS = [
  {
    platform: "tiktok",
    contentUrl: "https://www.tiktok.com/@popsdrops/video/7000000000000000000",
    caption: "Dev seeded TikTok performance report.",
    publishedUrl: "https://www.tiktok.com/@popsdrops/video/7000000000000000000",
    rows: [
      {
        measurement_type: "initial_48h",
        views: 6200,
        reach: 5600,
        impressions: 7100,
        likes: 410,
        comments: 32,
        shares: 24,
        saves: 90,
        clicks: 48,
        screenshot_url: "https://example.com/dev-tiktok-analytics-48h.png",
      },
      {
        measurement_type: "final_7d",
        views: 18400,
        reach: 16250,
        impressions: 21400,
        likes: 1240,
        comments: 96,
        shares: 88,
        saves: 310,
        clicks: 160,
        screenshot_url: "https://example.com/dev-tiktok-analytics-7d.png",
      },
      {
        measurement_type: "extended_30d",
        views: 30600,
        reach: 26800,
        impressions: 36200,
        likes: 2140,
        comments: 178,
        shares: 168,
        saves: 690,
        clicks: 318,
        screenshot_url: "https://example.com/dev-tiktok-analytics-30d.png",
      },
    ],
  },
  {
    platform: "instagram",
    contentUrl: "https://www.instagram.com/popsdrops/reel/dev-retail-launch/",
    caption: "Dev seeded Instagram Reel performance report.",
    publishedUrl: "https://www.instagram.com/popsdrops/reel/dev-retail-launch/",
    rows: [
      {
        measurement_type: "initial_48h",
        views: 4200,
        reach: 3900,
        impressions: 6100,
        likes: 520,
        comments: 44,
        shares: 30,
        saves: 128,
        clicks: 58,
        screenshot_url: "https://example.com/dev-instagram-analytics-48h.png",
      },
      {
        measurement_type: "final_7d",
        views: 11200,
        reach: 9700,
        impressions: 15600,
        likes: 1180,
        comments: 86,
        shares: 74,
        saves: 340,
        clicks: 132,
        screenshot_url: "https://example.com/dev-instagram-analytics-7d.png",
      },
      {
        measurement_type: "extended_30d",
        views: 16800,
        reach: 14200,
        impressions: 23800,
        likes: 1760,
        comments: 126,
        shares: 116,
        saves: 520,
        clicks: 210,
        screenshot_url: "https://example.com/dev-instagram-analytics-30d.png",
      },
    ],
  },
] as const;

type CampaignMemberRow = {
  id: string;
  campaign_id: string;
};

type CampaignTimelineRow = {
  id: string;
  posting_window_start: string | null;
  posting_window_end: string | null;
};

type SubmissionRow = {
  id: string;
  campaign_member_id: string;
  platform: string | null;
};

type ReportTaskRow = {
  id: string;
  campaign_member_id: string;
};

type PlatformSeed = (typeof PLATFORM_SEEDS)[number];

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const url = new URL(request.url);
  const campaignId = url.searchParams.get("campaignId") || DEFAULT_CAMPAIGN_ID;

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("id, posting_window_start, posting_window_end")
    .eq("id", campaignId)
    .single();

  if (campaignError) {
    return NextResponse.json({ error: campaignError.message }, { status: 500 });
  }

  const campaignTimeline = campaign as CampaignTimelineRow | null;
  if (!campaignTimeline) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const schedule = buildDevReportSeedSchedule({
    postingWindowStart: campaignTimeline.posting_window_start,
    postingWindowEnd: campaignTimeline.posting_window_end,
  });

  const { data: members, error: memberError } = await supabase
    .from("campaign_members")
    .select("id, campaign_id")
    .eq("campaign_id", campaignId)
    .order("joined_at", { ascending: true })
    .limit(1);

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  const member = (members?.[0] || null) as CampaignMemberRow | null;
  if (!member) {
    return NextResponse.json(
      { error: "No campaign member found for this campaign" },
      { status: 404 },
    );
  }

  const { data: existingTasks, error: tasksError } = await supabase
    .from("campaign_report_tasks")
    .select("id, campaign_member_id")
    .eq("campaign_id", campaignId)
    .eq("campaign_member_id", member.id)
    .order("due_at", { ascending: true })
    .limit(1);

  if (tasksError) {
    return NextResponse.json({ error: tasksError.message }, { status: 500 });
  }

  let reportTask = (existingTasks?.[0] || null) as ReportTaskRow | null;

  if (!reportTask) {
    const { data: createdTask, error: createTaskError } = await supabase
      .from("campaign_report_tasks")
        .insert({
          campaign_id: campaignId,
          campaign_member_id: member.id,
          task_key: "dev-seeded-final",
          period_start: schedule.taskPeriodStart,
          period_end: schedule.taskPeriodEnd,
          due_at: schedule.taskDueAt,
          status: "pending",
        })
      .select("id, campaign_member_id")
      .single();

    if (createTaskError) {
      return NextResponse.json({ error: createTaskError.message }, { status: 500 });
    }

    reportTask = createdTask as ReportTaskRow;
  }

  const platformsSeeded: Array<{
    platform: PlatformSeed["platform"];
    submissionId: string;
    readsSeeded: number;
  }> = [];
  const submittedAt = schedule.submittedAt;

  for (const platformSeed of PLATFORM_SEEDS) {
    const { data: existingSubmissions, error: submissionsError } = await supabase
      .from("content_submissions")
      .select("id, campaign_member_id, platform")
      .eq("campaign_member_id", member.id)
      .eq("platform", platformSeed.platform)
      .order("created_at", { ascending: true })
      .limit(1);

    if (submissionsError) {
      return NextResponse.json({ error: submissionsError.message }, { status: 500 });
    }

    let submission = (existingSubmissions?.[0] || null) as SubmissionRow | null;

    if (!submission) {
      const { data: createdSubmission, error: createSubmissionError } = await supabase
        .from("content_submissions")
        .insert({
          campaign_member_id: member.id,
          content_url: platformSeed.contentUrl,
          caption: platformSeed.caption,
          platform: platformSeed.platform,
          status: "published",
          published_url: platformSeed.publishedUrl,
          submitted_at: schedule.contentSubmittedAt,
          reviewed_at: schedule.contentReviewedAt,
          published_at: schedule.contentPublishedAt,
        })
        .select("id, campaign_member_id, platform")
        .single();

      if (createSubmissionError) {
        return NextResponse.json(
          { error: createSubmissionError.message },
          { status: 500 },
        );
      }

      submission = createdSubmission as SubmissionRow;
    } else {
      const { error: updateSubmissionError } = await supabase
        .from("content_submissions")
        .update({
          content_url: platformSeed.contentUrl,
          caption: platformSeed.caption,
          status: "published",
          published_url: platformSeed.publishedUrl,
          submitted_at: schedule.contentSubmittedAt,
          reviewed_at: schedule.contentReviewedAt,
          published_at: schedule.contentPublishedAt,
        })
        .eq("id", submission.id);

      if (updateSubmissionError) {
        return NextResponse.json({ error: updateSubmissionError.message }, { status: 500 });
      }
    }

    const performanceRows = platformSeed.rows.map((row) => ({
      submission_id: submission.id,
      report_task_id: reportTask.id,
      measurement_type: row.measurement_type,
      views: row.views,
      reach: row.reach,
      impressions: row.impressions,
      likes: row.likes,
      comments: row.comments,
      shares: row.shares,
      saves: row.saves,
      clicks: row.clicks,
      screenshot_url: row.screenshot_url,
      verification_status: "screenshot_verified",
      reported_at: schedule.readDates[row.measurement_type],
    }));

    const { error: performanceError } = await supabase
      .from("content_performance")
      .upsert(performanceRows, { onConflict: "submission_id,measurement_type" });

    if (performanceError) {
      return NextResponse.json({ error: performanceError.message }, { status: 500 });
    }

    platformsSeeded.push({
      platform: platformSeed.platform,
      submissionId: submission.id,
      readsSeeded: performanceRows.length,
    });
  }

  const { error: taskUpdateError } = await supabase
    .from("campaign_report_tasks")
    .update({
      status: "submitted",
      submitted_at: submittedAt,
      period_start: schedule.taskPeriodStart,
      period_end: schedule.taskPeriodEnd,
      due_at: schedule.taskDueAt,
    })
    .eq("id", reportTask.id);

  if (taskUpdateError) {
    return NextResponse.json({ error: taskUpdateError.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    campaignId,
    memberId: member.id,
    reportTaskId: reportTask.id,
    readsSeeded: platformsSeeded.reduce((total, platform) => total + platform.readsSeeded, 0),
    platformsSeeded,
  });
}
