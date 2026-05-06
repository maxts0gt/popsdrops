"use server";

import { revalidatePath } from "next/cache";
import { buildMetricValueRows } from "@/lib/reporting/metric-values";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "./auth";

type ConfirmableReportingPlatform =
  | "instagram"
  | "tiktok"
  | "youtube"
  | "facebook"
  | "snapchat"
  | "x"
  | "generic";

export async function confirmAiExtraction(input: {
  extractionId: string;
  performanceId: string;
  reportTaskId: string;
  platform: ConfirmableReportingPlatform;
  values: Array<{
    metricKey: string;
    metricLabel: string;
    metricValue?: number;
    metricText?: string;
  }>;
}) {
  const user = await getUser();
  const supabase = await createClient();

  const { data: extraction } = await supabase
    .from("content_performance_ai_extractions")
    .select("id, report_task_id, status")
    .eq("id", input.extractionId)
    .eq("report_task_id", input.reportTaskId)
    .single();

  if (!extraction) throw new Error("Extraction not found");
  if (extraction.status !== "pending_confirmation") {
    throw new Error("Extraction has already been resolved");
  }

  const rows = buildMetricValueRows({
    performanceId: input.performanceId,
    reportTaskId: input.reportTaskId,
    platform: input.platform,
    metricValues: input.values,
    sourceType: "creator_confirmed",
    confirmedByCreator: true,
  });

  const { error: upsertError } = await supabase
    .from("content_performance_metric_values")
    .upsert(rows, { onConflict: "performance_id,metric_key" });

  if (upsertError) throw new Error(upsertError.message);

  const { error: updateError } = await supabase
    .from("content_performance_ai_extractions")
    .update({
      status: "accepted_by_creator",
    })
    .eq("id", extraction.id);

  if (updateError) throw new Error(updateError.message);

  const { data: task } = await supabase
    .from("campaign_report_tasks")
    .select("campaign_id")
    .eq("id", input.reportTaskId)
    .single();

  if (task?.campaign_id) {
    revalidatePath(`/i/campaigns/${task.campaign_id}`);
    revalidatePath(`/b/campaigns/${task.campaign_id}`);
    revalidatePath(`/b/campaigns/${task.campaign_id}/report`);
  }

  return { ok: true, userId: user.id };
}
