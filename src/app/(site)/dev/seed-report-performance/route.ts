// DEV ONLY - seeds multiple performance reads for a campaign report chart.

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  buildDefaultAgreementRules,
  hashAgreementContent,
} from "@/lib/agreements/campaign-agreement";
import { buildDevReportSeedSchedule } from "@/lib/reporting/dev-seed-report-schedule";
import {
  EVIDENCE_BUCKET_ID,
  buildEvidenceStoragePath,
  getEvidenceStorageUri,
} from "@/lib/reporting/evidence-upload";

const DEFAULT_CAMPAIGN_ID = "4707edb5-dcab-4b2d-b5eb-7e79f0e1f010";
const DEV_EVIDENCE_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=",
  "base64",
);

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
  creator_id: string;
};

type CampaignTimelineRow = {
  id: string;
  brand_id: string;
  title: string;
  platforms: string[] | null;
  application_deadline: string | null;
  content_due_date: string | null;
  performance_due_date: string | null;
  posting_window_start: string | null;
  posting_window_end: string | null;
  usage_rights_duration: string | null;
  usage_rights_territory: string | null;
  usage_rights_paid_ads: boolean | null;
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

type CampaignAgreementRow = {
  id: string;
  version: number;
};

type PlatformSeed = (typeof PLATFORM_SEEDS)[number];
type PlatformSeedRow = PlatformSeed["rows"][number];
type DevReportSeedScenario =
  | "verified"
  | "operations-alerts"
  | "agreement-gate"
  | "handoff-blockers";

function getDevReportSeedScenario(value: string | null): DevReportSeedScenario {
  const scenario = value || "verified";
  if (scenario === "agreement-gate") return "agreement-gate";
  if (scenario === "handoff-blockers") return "handoff-blockers";
  return scenario === "operations-alerts" ? "operations-alerts" : "verified";
}

function buildDevEvidenceDraft(input: {
  campaignId: string;
  campaignMemberId: string;
  reportTaskId: string;
  platform: PlatformSeed["platform"];
  row: PlatformSeedRow;
}) {
  const evidenceId = randomUUID();
  const fileName = `dev-${input.platform}-${input.row.measurement_type}-analytics.png`;
  const storagePath = buildEvidenceStoragePath({
    campaignId: input.campaignId,
    campaignMemberId: input.campaignMemberId,
    reportTaskId: input.reportTaskId,
    evidenceId,
    fileName,
  });

  return {
    id: evidenceId,
    fileName,
    storagePath,
    storageUri: getEvidenceStorageUri(storagePath),
    measurementType: input.row.measurement_type,
  };
}

async function seedAgreementGate(input: {
  supabase: SupabaseClient;
  campaign: CampaignTimelineRow;
  members: CampaignMemberRow[];
}) {
  const memberIds = input.members.map((member) => member.id);

  const { error: acceptanceDeleteError } = await input.supabase
    .from("campaign_agreement_acceptances")
    .delete()
    .eq("campaign_id", input.campaign.id)
    .in("campaign_member_id", memberIds);

  if (acceptanceDeleteError) {
    return { error: acceptanceDeleteError.message };
  }

  const { data: existingAgreements, error: agreementLookupError } = await input.supabase
    .from("campaign_agreements")
    .select("id, version")
    .eq("campaign_id", input.campaign.id)
    .order("version", { ascending: false });

  if (agreementLookupError) {
    return { error: agreementLookupError.message };
  }

  const existingAgreementRows = (existingAgreements || []) as CampaignAgreementRow[];
  const nextVersion = (existingAgreementRows[0]?.version || 0) + 1;

  if (existingAgreementRows.length > 0) {
    const { error: archiveError } = await input.supabase
      .from("campaign_agreements")
      .update({ status: "archived" })
      .eq("campaign_id", input.campaign.id);

    if (archiveError) {
      return { error: archiveError.message };
    }
  }

  const rules = buildDefaultAgreementRules({
    campaignTitle: input.campaign.title,
    platforms: input.campaign.platforms || [],
    usageRightsDuration: input.campaign.usage_rights_duration,
    usageRightsTerritory: input.campaign.usage_rights_territory,
    usageRightsPaidAds: Boolean(input.campaign.usage_rights_paid_ads),
    applicationDeadline: input.campaign.application_deadline,
    contentDueDate: input.campaign.content_due_date,
    postingWindowStart: input.campaign.posting_window_start,
    postingWindowEnd: input.campaign.posting_window_end,
    performanceDueDate: input.campaign.performance_due_date,
    requiredEvidence: ["public_url", "screenshot", "manual_metrics"],
  });
  const agreementBody =
    "Creator confirms campaign rules, disclosure requirements, private material handling, usage rights, and reporting evidence obligations.";
  const gateMode = "rules_and_brand_agreement" as const;
  const content_hash = hashAgreementContent({
    campaignId: input.campaign.id,
    version: nextVersion,
    gateMode,
    title: "Campaign Rules",
    rules,
    agreementBody,
    fileSha256: null,
  });

  const { data: agreement, error: agreementInsertError } = await input.supabase
    .from("campaign_agreements")
    .insert({
      campaign_id: input.campaign.id,
      created_by: input.campaign.brand_id,
      version: nextVersion,
      status: "published",
      gate_mode: gateMode,
      title: "Campaign Rules",
      rules,
      agreement_body: agreementBody,
      preview_enabled: true,
      preview_summary: {
        disclosure: "Clear sponsorship disclosure required.",
        reporting: "Submit URL, screenshot proof, and confirmed metrics.",
        usage: "Brand usage rights follow the campaign brief.",
      },
      content_hash,
      requires_typed_name: true,
      requires_reacceptance: false,
      published_at: new Date().toISOString(),
    })
    .select("id, version")
    .single();

  if (agreementInsertError) {
    return { error: agreementInsertError.message };
  }

  return {
    agreementId: (agreement as CampaignAgreementRow).id,
    agreementVersion: (agreement as CampaignAgreementRow).version,
    unsignedMemberIds: memberIds,
  };
}

async function resetStaleHandoffReportTasks(input: {
  supabase: SupabaseClient;
  campaignId: string;
  memberId: string;
  reportTaskId: string;
}) {
  const { supabase, campaignId, memberId, reportTaskId } = input;
  const { data: staleReportTasks, error: staleReportTaskLookupError } =
    await supabase
      .from("campaign_report_tasks")
      .select("id")
      .eq("campaign_id", campaignId)
      .eq("campaign_member_id", memberId)
      .neq("id", reportTaskId);

  if (staleReportTaskLookupError) {
    return { error: staleReportTaskLookupError.message };
  }

  const staleReportTaskIds = (staleReportTasks || [])
    .map((task) => task.id)
    .filter(Boolean);

  if (staleReportTaskIds.length === 0) {
    return { deletedTaskCount: 0 };
  }

  const { data: stalePerformanceRows, error: stalePerformanceLookupError } =
    await supabase
      .from("content_performance")
      .select("id")
      .in("report_task_id", staleReportTaskIds);

  if (stalePerformanceLookupError) {
    return { error: stalePerformanceLookupError.message };
  }

  const stalePerformanceIds = (stalePerformanceRows || [])
    .map((performance) => performance.id)
    .filter(Boolean);

  const { error: staleMetricByTaskDeleteError } = await supabase
    .from("content_performance_metric_values")
    .delete()
    .in("report_task_id", staleReportTaskIds);

  if (staleMetricByTaskDeleteError) {
    return { error: staleMetricByTaskDeleteError.message };
  }

  if (stalePerformanceIds.length > 0) {
    const { error: staleMetricByPerformanceDeleteError } = await supabase
      .from("content_performance_metric_values")
      .delete()
      .in("performance_id", stalePerformanceIds);

    if (staleMetricByPerformanceDeleteError) {
      return { error: staleMetricByPerformanceDeleteError.message };
    }

    const { error: staleEvidenceByPerformanceDeleteError } = await supabase
      .from("content_performance_evidence")
      .delete()
      .in("performance_id", stalePerformanceIds);

    if (staleEvidenceByPerformanceDeleteError) {
      return { error: staleEvidenceByPerformanceDeleteError.message };
    }
  }

  const { error: staleEvidenceByTaskDeleteError } = await supabase
    .from("content_performance_evidence")
    .delete()
    .in("report_task_id", staleReportTaskIds);

  if (staleEvidenceByTaskDeleteError) {
    return { error: staleEvidenceByTaskDeleteError.message };
  }

  if (stalePerformanceIds.length > 0) {
    const { error: stalePerformanceDeleteError } = await supabase
      .from("content_performance")
      .delete()
      .in("id", stalePerformanceIds);

    if (stalePerformanceDeleteError) {
      return { error: stalePerformanceDeleteError.message };
    }
  }

  const { error: staleReportTaskDeleteError } = await supabase
    .from("campaign_report_tasks")
    .delete()
    .in("id", staleReportTaskIds);

  if (staleReportTaskDeleteError) {
    return { error: staleReportTaskDeleteError.message };
  }

  return { deletedTaskCount: staleReportTaskIds.length };
}

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const url = new URL(request.url);
  const campaignId = url.searchParams.get("campaignId") || DEFAULT_CAMPAIGN_ID;
  const scenario = url.searchParams.get("scenario") || "verified";
  const seedScenario = getDevReportSeedScenario(scenario);

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select(
      [
        "id",
        "brand_id",
        "title",
        "platforms",
        "application_deadline",
        "content_due_date",
        "performance_due_date",
        "posting_window_start",
        "posting_window_end",
        "usage_rights_duration",
        "usage_rights_territory",
        "usage_rights_paid_ads",
      ].join(", "),
    )
    .eq("id", campaignId)
    .single();

  if (campaignError) {
    return NextResponse.json({ error: campaignError.message }, { status: 500 });
  }

  const campaignTimeline = campaign as unknown as CampaignTimelineRow | null;
  if (!campaignTimeline) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const schedule = buildDevReportSeedSchedule({
    postingWindowStart: campaignTimeline.posting_window_start,
    postingWindowEnd: campaignTimeline.posting_window_end,
  });

  const { data: members, error: memberError } = await supabase
    .from("campaign_members")
    .select("id, campaign_id, creator_id")
    .eq("campaign_id", campaignId)
    .order("joined_at", { ascending: true })
    .limit(20);

  if (memberError) {
    return NextResponse.json({ error: memberError.message }, { status: 500 });
  }

  const memberRows = (members || []) as CampaignMemberRow[];
  const member = memberRows[0] || null;
  if (!member) {
    return NextResponse.json(
      { error: "No campaign member found for this campaign" },
      { status: 404 },
    );
  }

  const agreementSeed =
    seedScenario === "agreement-gate"
      ? await seedAgreementGate({ supabase, campaign: campaignTimeline, members: memberRows })
      : null;

  if (agreementSeed?.error) {
    return NextResponse.json({ error: agreementSeed.error }, { status: 500 });
  }

  const { data: existingTasks, error: tasksError } = await supabase
    .from("campaign_report_tasks")
    .select("id, campaign_member_id")
    .eq("campaign_id", campaignId)
    .eq("campaign_member_id", member.id)
    .eq("task_key", "dev-seeded-final")
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

  const staleReportTaskReset =
    seedScenario === "handoff-blockers"
      ? await resetStaleHandoffReportTasks({
          supabase,
          campaignId,
          memberId: member.id,
          reportTaskId: reportTask.id,
        })
      : null;

  if (staleReportTaskReset?.error) {
    return NextResponse.json({ error: staleReportTaskReset.error }, { status: 500 });
  }

  const platformsSeeded: Array<{
    platform: PlatformSeed["platform"];
    submissionId: string;
    readsSeeded: number;
  }> = [];
  let liveUrlBlockerSubmissionId: string | null = null;
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

    const evidenceDrafts = platformSeed.rows.map((row) =>
      buildDevEvidenceDraft({
        campaignId,
        campaignMemberId: member.id,
        reportTaskId: reportTask.id,
        platform: platformSeed.platform,
        row,
      }),
    );
    const evidenceByMeasurementType = new Map(
      evidenceDrafts.map((evidence) => [evidence.measurementType, evidence]),
    );

    const performanceRows = platformSeed.rows.map((row) => {
      const evidence = evidenceByMeasurementType.get(row.measurement_type);

      if (!evidence) {
        throw new Error(`Missing evidence draft for ${row.measurement_type}`);
      }

      return {
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
        screenshot_url: evidence.storageUri,
        verification_status: "screenshot_verified",
        reported_at: schedule.readDates[row.measurement_type],
      };
    });

    const { data: existingPerformanceRows, error: existingPerformanceError } = await supabase
      .from("content_performance")
      .select("id")
      .eq("submission_id", submission.id)
      .eq("report_task_id", reportTask.id);

    if (existingPerformanceError) {
      return NextResponse.json({ error: existingPerformanceError.message }, { status: 500 });
    }

    const existingPerformanceIds = (existingPerformanceRows || [])
      .map((row) => row.id)
      .filter(Boolean);

    if (existingPerformanceIds.length > 0) {
      const { error: deleteExistingEvidenceError } = await supabase
        .from("content_performance_evidence")
        .delete()
        .in("performance_id", existingPerformanceIds);

      if (deleteExistingEvidenceError) {
        return NextResponse.json(
          { error: deleteExistingEvidenceError.message },
          { status: 500 },
        );
      }
    }

    const { error: deletePerformanceError } = await supabase
      .from("content_performance")
      .delete()
      .eq("submission_id", submission.id)
      .eq("report_task_id", reportTask.id);

    if (deletePerformanceError) {
      return NextResponse.json({ error: deletePerformanceError.message }, { status: 500 });
    }

    const { data: performanceData, error: performanceError } = await supabase
      .from("content_performance")
      .insert(performanceRows)
      .select("id, measurement_type");

    if (performanceError) {
      return NextResponse.json({ error: performanceError.message }, { status: 500 });
    }

    const performanceByMeasurementType = new Map(
      (performanceData || []).map((row) => [row.measurement_type, row.id]),
    );
    const missingPerformance = evidenceDrafts.find(
      (evidence) => !performanceByMeasurementType.get(evidence.measurementType),
    );

    if (missingPerformance) {
      return NextResponse.json(
        { error: `Performance read missing for ${missingPerformance.measurementType}` },
        { status: 500 },
      );
    }

    for (const evidence of evidenceDrafts) {
      const { error: uploadError } = await supabase.storage
        .from(EVIDENCE_BUCKET_ID)
        .upload(evidence.storagePath, DEV_EVIDENCE_PNG, {
          contentType: "image/png",
          upsert: true,
        });

      if (uploadError) {
        return NextResponse.json({ error: uploadError.message }, { status: 500 });
      }
    }

    const evidenceRows = evidenceDrafts.map((evidence) => ({
      id: evidence.id,
      campaign_id: campaignId,
      campaign_member_id: member.id,
      report_task_id: reportTask.id,
      submission_id: submission.id,
      performance_id: performanceByMeasurementType.get(evidence.measurementType)!,
      uploaded_by: member.creator_id,
      evidence_type: "screenshot",
      bucket_id: EVIDENCE_BUCKET_ID,
      storage_path: evidence.storagePath,
      file_name: evidence.fileName,
      mime_type: "image/png",
      size_bytes: DEV_EVIDENCE_PNG.length,
      verification_status: "verified",
    }));

    const { error: evidenceError } = await supabase
      .from("content_performance_evidence")
      .insert(evidenceRows);

    if (evidenceError) {
      return NextResponse.json({ error: evidenceError.message }, { status: 500 });
    }

    platformsSeeded.push({
      platform: platformSeed.platform,
      submissionId: submission.id,
      readsSeeded: performanceRows.length,
    });
  }

  if (seedScenario === "handoff-blockers") {
    const liveUrlBlockerSubmission = platformsSeeded[0] || null;

    if (liveUrlBlockerSubmission) {
      liveUrlBlockerSubmissionId = liveUrlBlockerSubmission.submissionId;

      const { data: blockerPerformanceRows, error: blockerPerformanceLookupError } =
        await supabase
          .from("content_performance")
          .select("id")
          .eq("submission_id", liveUrlBlockerSubmissionId)
          .eq("report_task_id", reportTask.id);

      if (blockerPerformanceLookupError) {
        return NextResponse.json(
          { error: blockerPerformanceLookupError.message },
          { status: 500 },
        );
      }

      const blockerPerformanceIds = (blockerPerformanceRows || [])
        .map((row) => row.id)
        .filter(Boolean);

      if (blockerPerformanceIds.length > 0) {
        const { error: blockerEvidenceDeleteError } = await supabase
          .from("content_performance_evidence")
          .delete()
          .in("performance_id", blockerPerformanceIds);

        if (blockerEvidenceDeleteError) {
          return NextResponse.json(
            { error: blockerEvidenceDeleteError.message },
            { status: 500 },
          );
        }
      }

      const { error: blockerPerformanceDeleteError } = await supabase
        .from("content_performance")
        .delete()
        .eq("submission_id", liveUrlBlockerSubmissionId)
        .eq("report_task_id", reportTask.id);

      if (blockerPerformanceDeleteError) {
        return NextResponse.json(
          { error: blockerPerformanceDeleteError.message },
          { status: 500 },
        );
      }

      const { error: blockerSubmissionUpdateError } = await supabase
        .from("content_submissions")
        .update({
          status: "approved",
          published_url: null,
          published_at: null,
          submitted_at: schedule.contentSubmittedAt,
          reviewed_at: schedule.contentReviewedAt,
        })
        .eq("id", liveUrlBlockerSubmissionId);

      if (blockerSubmissionUpdateError) {
        return NextResponse.json(
          { error: blockerSubmissionUpdateError.message },
          { status: 500 },
        );
      }
    }

    const handoffSubmissionIds = platformsSeeded
      .map((platform) => platform.submissionId)
      .filter(Boolean);

    if (handoffSubmissionIds.length > 0) {
      const { data: handoffPerformanceRows, error: handoffPerformanceLookupError } =
        await supabase
          .from("content_performance")
          .select("id")
          .in("submission_id", handoffSubmissionIds)
          .eq("report_task_id", reportTask.id);

      if (handoffPerformanceLookupError) {
        return NextResponse.json(
          { error: handoffPerformanceLookupError.message },
          { status: 500 },
        );
      }

      const handoffPerformanceIds = (handoffPerformanceRows || [])
        .map((row) => row.id)
        .filter(Boolean);

      if (handoffPerformanceIds.length > 0) {
        const { error: handoffEvidenceDeleteError } = await supabase
          .from("content_performance_evidence")
          .delete()
          .in("performance_id", handoffPerformanceIds);

        if (handoffEvidenceDeleteError) {
          return NextResponse.json(
            { error: handoffEvidenceDeleteError.message },
            { status: 500 },
          );
        }
      }

      const { error: handoffPerformanceDeleteError } = await supabase
        .from("content_performance")
        .delete()
        .in("submission_id", handoffSubmissionIds)
        .eq("report_task_id", reportTask.id);

      if (handoffPerformanceDeleteError) {
        return NextResponse.json(
          { error: handoffPerformanceDeleteError.message },
          { status: 500 },
        );
      }
    }
  }

  const { error: taskUpdateError } =
    seedScenario === "operations-alerts"
      ? await supabase
          .from("campaign_report_tasks")
          .update({
            status: "needs_revision",
            submitted_at: submittedAt,
            verified_at: null,
            missed_at: null,
            excused_at: null,
            review_note: "Evidence values need creator correction.",
            period_start: schedule.taskPeriodStart,
            period_end: schedule.taskPeriodEnd,
            due_at: schedule.taskDueAt,
          })
          .eq("id", reportTask.id)
      : seedScenario === "handoff-blockers"
        ? await supabase
            .from("campaign_report_tasks")
            .update({
              status: "pending",
              submitted_at: null,
              verified_at: null,
              missed_at: null,
              excused_at: null,
              review_note: null,
              period_start: schedule.taskPeriodStart,
              period_end: schedule.taskPeriodEnd,
              due_at: schedule.taskDueAt,
            })
            .eq("campaign_id", campaignId)
            .eq("campaign_member_id", member.id)
      : await supabase
          .from("campaign_report_tasks")
          .update({
            status: "verified",
            submitted_at: submittedAt,
            verified_at: submittedAt,
            missed_at: null,
            excused_at: null,
            review_note: null,
            period_start: schedule.taskPeriodStart,
            period_end: schedule.taskPeriodEnd,
            due_at: schedule.taskDueAt,
          })
          .eq("id", reportTask.id);

  if (taskUpdateError) {
    return NextResponse.json({ error: taskUpdateError.message }, { status: 500 });
  }

  const { error: evidenceStatusError } = await supabase
    .from("content_performance_evidence")
    .update({
      verification_status: seedScenario === "operations-alerts" ? "rejected" : "verified",
      review_note:
        seedScenario === "operations-alerts"
          ? "Numbers need to be resubmitted from the native analytics proof."
          : null,
    })
    .eq("report_task_id", reportTask.id);

  if (evidenceStatusError) {
    return NextResponse.json({ error: evidenceStatusError.message }, { status: 500 });
  }

  const { error: performanceStatusError } = await supabase
    .from("content_performance")
    .update({
      verification_status:
        seedScenario === "operations-alerts" ? "rejected" : "screenshot_verified",
    })
    .eq("report_task_id", reportTask.id);

  if (performanceStatusError) {
    return NextResponse.json({ error: performanceStatusError.message }, { status: 500 });
  }

  let missedTaskId: string | null = null;

  if (seedScenario === "operations-alerts") {
    const { data: existingMissedTasks, error: missedTaskLookupError } = await supabase
      .from("campaign_report_tasks")
      .select("id, campaign_member_id")
      .eq("campaign_id", campaignId)
      .eq("campaign_member_id", member.id)
      .eq("task_key", "dev-seeded-missed")
      .limit(1);

    if (missedTaskLookupError) {
      return NextResponse.json(
        { error: missedTaskLookupError.message },
        { status: 500 },
      );
    }

    const existingMissedTask = (existingMissedTasks?.[0] || null) as ReportTaskRow | null;
    const missedDueAt = schedule.taskPeriodStart || schedule.taskDueAt;

    if (existingMissedTask) {
      missedTaskId = existingMissedTask.id;
      const { error: missedUpdateError } = await supabase
        .from("campaign_report_tasks")
        .update({
          status: "missed",
          due_at: missedDueAt,
          submitted_at: null,
          verified_at: null,
          missed_at: schedule.submittedAt,
          excused_at: null,
          review_note: "Creator did not submit the required analytics proof.",
        })
        .eq("id", existingMissedTask.id);

      if (missedUpdateError) {
        return NextResponse.json({ error: missedUpdateError.message }, { status: 500 });
      }
    } else {
      const { data: missedTask, error: missedInsertError } = await supabase
        .from("campaign_report_tasks")
        .insert({
          campaign_id: campaignId,
          campaign_member_id: member.id,
          task_key: "dev-seeded-missed",
          period_start: schedule.taskPeriodStart,
          period_end: schedule.taskPeriodEnd,
          due_at: missedDueAt,
          status: "missed",
          missed_at: schedule.submittedAt,
          review_note: "Creator did not submit the required analytics proof.",
        })
        .select("id, campaign_member_id")
        .single();

      if (missedInsertError) {
        return NextResponse.json({ error: missedInsertError.message }, { status: 500 });
      }

      missedTaskId = (missedTask as ReportTaskRow).id;
    }
  } else {
    const { error: missedDeleteError } = await supabase
      .from("campaign_report_tasks")
      .delete()
      .eq("campaign_id", campaignId)
      .eq("campaign_member_id", member.id)
      .eq("task_key", "dev-seeded-missed");

    if (missedDeleteError) {
      return NextResponse.json({ error: missedDeleteError.message }, { status: 500 });
    }
  }

  return NextResponse.json({
    success: true,
    scenario: seedScenario,
    campaignId,
    memberId: member.id,
    agreementSeed,
     reportTaskId: reportTask.id,
     missedTaskId,
     liveUrlBlockerSubmissionId,
     readsSeeded: platformsSeeded.reduce((total, platform) => total + platform.readsSeeded, 0),
     platformsSeeded,
   });
}
