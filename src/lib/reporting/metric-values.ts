import type {
  ReportingMetricSourceType,
  ReportingPlatform,
} from "@/types/database";

type SubmittedMetricValue = {
  metricKey: string;
  metricLabel?: string;
  metricValue?: number;
  metricText?: string;
};

const legacyColumnMap: Record<string, string> = {
  views: "views",
  reach: "reach",
  impressions: "impressions",
  likes: "likes",
  reactions: "likes",
  comments: "comments",
  shares: "shares",
  saves: "saves",
  favorites: "saves",
  screenshots: "screenshots",
  replies: "replies",
  clicks: "clicks",
  link_clicks: "clicks",
  swipe_ups: "clicks",
  completion_rate: "completion_rate",
  avg_watch_time_seconds: "avg_watch_time_seconds",
  avg_view_duration_seconds: "avg_watch_time_seconds",
  avg_view_time_seconds: "avg_watch_time_seconds",
  subscribers_gained: "subscriber_gains",
  subscriber_gains: "subscriber_gains",
};

export function mapMetricValuesToLegacyPerformanceColumns(
  metricValues: SubmittedMetricValue[],
): Record<string, number> {
  const output: Record<string, number> = {};

  for (const metric of metricValues) {
    const legacyColumn = legacyColumnMap[metric.metricKey];
    if (!legacyColumn || metric.metricValue == null) continue;
    output[legacyColumn] = metric.metricValue;
  }

  return output;
}

export function buildMetricValueRows(input: {
  performanceId: string;
  reportTaskId: string | null;
  platform: ReportingPlatform;
  metricValues: SubmittedMetricValue[];
  sourceType: ReportingMetricSourceType;
  confirmedByCreator: boolean;
}) {
  const confirmedAt = input.confirmedByCreator ? new Date().toISOString() : null;

  return input.metricValues.map((metric) => ({
    performance_id: input.performanceId,
    report_task_id: input.reportTaskId,
    platform: input.platform,
    metric_key: metric.metricKey,
    metric_label: metric.metricLabel ?? metric.metricKey,
    metric_value: metric.metricValue ?? null,
    metric_text: metric.metricText ?? null,
    source_type: input.sourceType,
    confirmed_by_creator: input.confirmedByCreator,
    confirmed_at: confirmedAt,
  }));
}
