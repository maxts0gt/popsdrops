import type { Platform } from "@/lib/constants";
import {
  getReportingMetricTemplate,
  type ReportingMetricDefinition,
} from "@/lib/reporting/platform-templates";

export type MetricFieldType = "integer" | "decimal" | "percentage";

export type MetricKey =
  | "views"
  | "reach"
  | "impressions"
  | "likes"
  | "comments"
  | "shares"
  | "saves"
  | "sends"
  | "screenshots"
  | "replies"
  | "clicks"
  | "completion_rate"
  | "avg_watch_time_seconds"
  | "subscriber_gains";

export interface MetricField {
  key: MetricKey;
  label: string;
  description: string;
  required: boolean;
  type: MetricFieldType;
}

const LEGACY_KEY_MAP: Record<string, MetricKey | null> = {
  favorites: "saves",
  avg_view_duration_seconds: "avg_watch_time_seconds",
  watch_time_minutes: null,
  impressions_click_through_rate: "clicks",
  subscribers_gained: "subscriber_gains",
  reactions: "likes",
  viewers: "reach",
  swipe_ups: "clicks",
  avg_view_time_seconds: "avg_watch_time_seconds",
  total_view_time_seconds: null,
  profile_visits: "reach",
  link_clicks: "clicks",
};

function legacyField(definition: ReportingMetricDefinition): MetricField | null {
  const mapped = LEGACY_KEY_MAP[definition.metricKey] ?? definition.metricKey;
  if (!mapped) return null;

  return {
    key: mapped as MetricKey,
    label: definition.label,
    description:
      definition.evidenceScope === "native_insights"
        ? `${definition.label} from native platform insights`
        : `${definition.label} for the published content`,
    required: definition.isDefault,
    type:
      definition.fieldType === "percentage"
        ? "percentage"
        : definition.fieldType === "integer"
          ? "integer"
          : "decimal",
  };
}

function uniqueFields(fields: Array<MetricField | null>): MetricField[] {
  const seen = new Set<string>();

  return fields.filter((field): field is MetricField => {
    if (!field || seen.has(field.key)) return false;
    seen.add(field.key);
    return true;
  });
}

export const PLATFORM_METRICS: Record<Platform, MetricField[]> = {
  tiktok: uniqueFields(getReportingMetricTemplate("tiktok").map(legacyField)),
  instagram: uniqueFields(
    getReportingMetricTemplate("instagram").map(legacyField),
  ),
  snapchat: uniqueFields(
    getReportingMetricTemplate("snapchat").map(legacyField),
  ),
  youtube: uniqueFields(getReportingMetricTemplate("youtube").map(legacyField)),
  facebook: uniqueFields(
    getReportingMetricTemplate("facebook").map(legacyField),
  ),
};

export const PLATFORM_METRIC_NOTES: Record<Platform, string> = {
  tiktok:
    "TikTok reporting can include public engagement plus native analytics such as watch time and completion.",
  instagram:
    "Instagram reporting may require professional insights for reach, impressions, saves, shares, and profile actions.",
  youtube:
    "YouTube reporting may require Studio analytics for impressions, watch time, and subscriber impact.",
  snapchat:
    "Snapchat reporting often depends on Public Profile analytics screenshots for private engagement signals.",
  facebook:
    "Facebook reporting may require Page or professional dashboard insights for reach, impressions, and clicks.",
};
