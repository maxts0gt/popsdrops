import {
  getReportingMetricTemplate,
  type ReportingMetricDefinition,
  type ReportingPlatform,
} from "./reporting/platform-templates";

export type MetricFieldType = "integer" | "decimal" | "percentage" | "text";

export type MetricKey = string;

export interface MetricField {
  key: MetricKey;
  label: string;
  description: string;
  required: boolean;
  type: MetricFieldType;
}

function legacyField(
  definition: ReportingMetricDefinition,
  required = definition.isDefault,
): MetricField | null {
  return {
    key: definition.metricKey,
    label: definition.label,
    description:
      definition.evidenceScope === "native_insights"
        ? `${definition.label} from native platform insights`
        : `${definition.label} for the published content`,
    required,
    type:
      definition.fieldType === "text"
        ? "text"
        : definition.fieldType === "percentage"
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

export const PLATFORM_METRICS: Record<ReportingPlatform, MetricField[]> = {
  tiktok: uniqueFields(
    getReportingMetricTemplate("tiktok").map((definition) =>
      legacyField(definition),
    ),
  ),
  instagram: uniqueFields(
    getReportingMetricTemplate("instagram").map((definition) =>
      legacyField(definition),
    ),
  ),
  snapchat: uniqueFields(
    getReportingMetricTemplate("snapchat").map((definition) =>
      legacyField(definition),
    ),
  ),
  youtube: uniqueFields(
    getReportingMetricTemplate("youtube").map((definition) =>
      legacyField(definition),
    ),
  ),
  facebook: uniqueFields(
    getReportingMetricTemplate("facebook").map((definition) =>
      legacyField(definition),
    ),
  ),
  x: uniqueFields(
    getReportingMetricTemplate("x").map((definition) =>
      legacyField(definition),
    ),
  ),
  generic: uniqueFields(
    getReportingMetricTemplate("generic").map((definition) =>
      legacyField(definition),
    ),
  ),
};

export function getPlatformMetricFields(
  platform: ReportingPlatform,
  requiredMetricKeys?: string[],
): MetricField[] {
  if (!requiredMetricKeys?.length) return PLATFORM_METRICS[platform];

  const requiredKeySet = new Set(requiredMetricKeys);
  const fields = uniqueFields(
    getReportingMetricTemplate(platform)
      .filter((definition) => requiredKeySet.has(definition.metricKey))
      .map((definition) => legacyField(definition, true)),
  );

  return fields.length > 0 ? fields : PLATFORM_METRICS[platform];
}

export const PLATFORM_METRIC_NOTES: Record<ReportingPlatform, string> = {
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
  x:
    "X proof can include public post metrics and native analytics screenshots for impressions, replies, reposts, and bookmarks.",
  generic:
    "Generic proof is a brand-defined source such as a partner dashboard, affiliate report, or retail analytics export.",
};
