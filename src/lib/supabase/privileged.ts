import "server-only";

import {
  createPerPostReportTaskDraft,
  generateReportTaskDrafts,
} from "@/lib/reporting/task-schedule";
import type { Database } from "@/types/database";
import { createAdminClient } from "./admin";

type CampaignMemberInsert =
  Database["public"]["Tables"]["campaign_members"]["Insert"];
type CampaignReportTaskInsert =
  Database["public"]["Tables"]["campaign_report_tasks"]["Insert"];
type NotificationInsert =
  Database["public"]["Tables"]["notifications"]["Insert"];

export async function upsertPrivilegedCampaignMember(
  member: CampaignMemberInsert,
) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("campaign_members")
    .upsert(member, { onConflict: "campaign_id,creator_id" })
    .select("id, campaign_id, creator_id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as {
    id: string;
    campaign_id: string;
    creator_id: string;
  };
}

export async function createPrivilegedReportTasksForMember(memberId: string) {
  const admin = createAdminClient();

  const { data: member, error: memberError } = await admin
    .from("campaign_members")
    .select(
      `id, campaign_id,
       campaigns (
         id,
         performance_due_date,
         posting_window_start,
         posting_window_end
       )`,
    )
    .eq("id", memberId)
    .single();

  if (memberError) throw new Error(memberError.message);
  if (!member) throw new Error("Campaign member not found");

  const campaign = Array.isArray(member.campaigns)
    ? member.campaigns[0]
    : member.campaigns;

  if (!campaign) throw new Error("Campaign not found for report task creation");

  const { data: reportingPlan, error: planError } = await admin
    .from("campaign_reporting_plans")
    .select("cadence, grace_period_hours, custom_due_dates, starts_at, ends_at")
    .eq("campaign_id", member.campaign_id)
    .maybeSingle();

  if (planError) throw new Error(planError.message);

  const taskDrafts = generateReportTaskDrafts({
    campaignId: member.campaign_id,
    campaignMemberId: member.id,
    performanceDueDate: campaign.performance_due_date ?? null,
    reportingPlan: reportingPlan
      ? {
          cadence: reportingPlan.cadence,
          gracePeriodHours: reportingPlan.grace_period_hours,
          customDueDates: reportingPlan.custom_due_dates ?? [],
          startsAt: reportingPlan.starts_at,
          endsAt: reportingPlan.ends_at,
        }
      : null,
  });

  if (taskDrafts.length === 0) return [];

  const { data: insertedTasks, error: insertError } = await admin
    .from("campaign_report_tasks")
    .upsert(taskDrafts satisfies CampaignReportTaskInsert[], {
      onConflict: "campaign_member_id,task_key",
      ignoreDuplicates: true,
    })
    .select("id, campaign_id, campaign_member_id, due_at, status");

  if (insertError) throw new Error(insertError.message);

  return insertedTasks ?? [];
}

export async function markPrivilegedReportTaskSubmitted(
  reportTaskId: string,
  submittedAt: string,
) {
  const admin = createAdminClient();

  const { data: reportTask, error: reportTaskError } = await admin
    .from("campaign_report_tasks")
    .select("id, due_at")
    .eq("id", reportTaskId)
    .single();

  if (reportTaskError) throw new Error(reportTaskError.message);
  if (!reportTask) throw new Error("Report task not found");

  const status =
    new Date(submittedAt).getTime() > new Date(reportTask.due_at).getTime()
      ? "submitted_late"
      : "submitted";

  const { error: updateError } = await admin
    .from("campaign_report_tasks")
    .update({
      status,
      submitted_at: submittedAt,
      updated_at: submittedAt,
    })
    .eq("id", reportTaskId);

  if (updateError) throw new Error(updateError.message);

  return { id: reportTaskId, status };
}

export async function markPrivilegedReportTaskSubmittedIfComplete(input: {
  reportTaskId: string;
  submittedAt: string;
}) {
  const admin = createAdminClient();

  const { data: reportTask, error: reportTaskError } = await admin
    .from("campaign_report_tasks")
    .select("id, campaign_member_id, due_at, status")
    .eq("id", input.reportTaskId)
    .single();

  if (reportTaskError) throw new Error(reportTaskError.message);
  if (!reportTask) throw new Error("Report task not found");

  const { count: publishedSubmissionCount, error: submissionCountError } =
    await admin
      .from("content_submissions")
      .select("id", { count: "exact", head: true })
      .eq("campaign_member_id", reportTask.campaign_member_id)
      .eq("status", "published");

  if (submissionCountError) throw new Error(submissionCountError.message);

  const { data: performanceRows, error: performanceError } = await admin
    .from("content_performance")
    .select("submission_id")
    .eq("report_task_id", input.reportTaskId);

  if (performanceError) throw new Error(performanceError.message);

  const reportedSubmissionCount = new Set(
    (performanceRows ?? []).map((row) => row.submission_id),
  ).size;
  const requiredSubmissionCount = publishedSubmissionCount ?? 0;

  if (
    requiredSubmissionCount > 0 &&
    reportedSubmissionCount < requiredSubmissionCount
  ) {
    return {
      id: input.reportTaskId,
      status: reportTask.status,
      completed: false,
    };
  }

  const submitted = await markPrivilegedReportTaskSubmitted(
    input.reportTaskId,
    input.submittedAt,
  );

  return { ...submitted, completed: true };
}

export async function createPrivilegedReportTaskForSubmission(input: {
  submissionId: string;
  campaignId: string;
  campaignMemberId: string;
}) {
  const admin = createAdminClient();

  const { data: reportingPlan, error: planError } = await admin
    .from("campaign_reporting_plans")
    .select("cadence")
    .eq("campaign_id", input.campaignId)
    .maybeSingle();

  if (planError) throw new Error(planError.message);
  if (reportingPlan?.cadence !== "per_post") return null;

  const { data: campaign, error: campaignError } = await admin
    .from("campaigns")
    .select("performance_due_date")
    .eq("id", input.campaignId)
    .single();

  if (campaignError) throw new Error(campaignError.message);
  if (!campaign?.performance_due_date) return null;

  const draft = createPerPostReportTaskDraft({
    campaignId: input.campaignId,
    campaignMemberId: input.campaignMemberId,
    submissionId: input.submissionId,
    dueAt: campaign.performance_due_date,
  });

  const { data, error } = await admin
    .from("campaign_report_tasks")
    .upsert(draft satisfies CampaignReportTaskInsert, {
      onConflict: "campaign_member_id,task_key",
      ignoreDuplicates: true,
    })
    .select("id, campaign_id, campaign_member_id, due_at, status")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function createPrivilegedNotification(
  notification: NotificationInsert,
) {
  const admin = createAdminClient();
  const { error } = await admin.from("notifications").insert(notification);

  if (error) {
    console.error("Failed to create notification:", error);
  }
}

export async function createPrivilegedNotifications(
  notifications: NotificationInsert[],
) {
  if (notifications.length === 0) return;

  const admin = createAdminClient();
  const { error } = await admin.from("notifications").insert(notifications);

  if (error) {
    console.error("Failed to create notifications:", error);
  }
}
