export const REPORTING_PLATFORMS = [
  "instagram",
  "tiktok",
  "youtube",
  "facebook",
  "snapchat",
  "x",
  "generic",
] as const;

export type ReportingPlatform = (typeof REPORTING_PLATFORMS)[number];

export type ReportingMetricFieldType =
  | "integer"
  | "decimal"
  | "percentage"
  | "duration_seconds"
  | "currency"
  | "text";

export type ReportingEvidenceScope =
  | "public"
  | "native_insights"
  | "brand_defined";

export type ReportingAccountRequirement =
  | "public_post_ok"
  | "native_insights_required"
  | "business_or_creator_account_required"
  | "brand_defined";

export type ReportingEvidenceType =
  | "public_url"
  | "manual_metrics"
  | "screenshot"
  | "analytics_export"
  | "csv"
  | "document";

export type ReportingMetricDefinition = {
  platform: ReportingPlatform;
  metricKey: string;
  label: string;
  fieldType: ReportingMetricFieldType;
  evidenceScope: ReportingEvidenceScope;
  isDefault: boolean;
  isPrivateMetric: boolean;
  sortOrder: number;
};

export type ReportingRequirementDraft = {
  platform: ReportingPlatform;
  platformLabel: string | null;
  contentFormat: string;
  accountRequirement: ReportingAccountRequirement;
  evidenceTypes: ReportingEvidenceType[];
  requiredMetricKeys: string[];
  aiExtractionAllowed: boolean;
  creatorConfirmationRequired: boolean;
};

export const DEFAULT_REQUIRED_EVIDENCE: ReportingEvidenceType[] = [
  "public_url",
  "manual_metrics",
  "screenshot",
];

export const REPORTING_PLATFORM_LABELS: Record<ReportingPlatform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  facebook: "Facebook",
  snapchat: "Snapchat",
  x: "X",
  generic: "Generic",
};

function metric(
  platform: ReportingPlatform,
  metricKey: string,
  label: string,
  options: {
    fieldType?: ReportingMetricFieldType;
    evidenceScope?: ReportingEvidenceScope;
    isDefault?: boolean;
    isPrivateMetric?: boolean;
    sortOrder: number;
  },
): ReportingMetricDefinition {
  return {
    platform,
    metricKey,
    label,
    fieldType: options.fieldType ?? "integer",
    evidenceScope: options.evidenceScope ?? "public",
    isDefault: options.isDefault ?? true,
    isPrivateMetric: options.isPrivateMetric ?? false,
    sortOrder: options.sortOrder,
  };
}

export const REPORTING_METRIC_TEMPLATES: Record<
  ReportingPlatform,
  ReportingMetricDefinition[]
> = {
  instagram: [
    metric("instagram", "views", "Views", { sortOrder: 10 }),
    metric("instagram", "reach", "Reach", {
      evidenceScope: "native_insights",
      isPrivateMetric: true,
      sortOrder: 20,
    }),
    metric("instagram", "impressions", "Impressions", {
      evidenceScope: "native_insights",
      isPrivateMetric: true,
      sortOrder: 30,
    }),
    metric("instagram", "likes", "Likes", { sortOrder: 40 }),
    metric("instagram", "comments", "Comments", { sortOrder: 50 }),
    metric("instagram", "shares", "Shares", {
      evidenceScope: "native_insights",
      isPrivateMetric: true,
      sortOrder: 60,
    }),
    metric("instagram", "saves", "Saves", {
      evidenceScope: "native_insights",
      isPrivateMetric: true,
      sortOrder: 70,
    }),
    metric("instagram", "profile_visits", "Profile visits", {
      evidenceScope: "native_insights",
      isDefault: false,
      isPrivateMetric: true,
      sortOrder: 80,
    }),
    metric("instagram", "link_clicks", "Link clicks", {
      evidenceScope: "native_insights",
      isDefault: false,
      isPrivateMetric: true,
      sortOrder: 90,
    }),
  ],
  tiktok: [
    metric("tiktok", "views", "Views", { sortOrder: 10 }),
    metric("tiktok", "likes", "Likes", { sortOrder: 20 }),
    metric("tiktok", "comments", "Comments", { sortOrder: 30 }),
    metric("tiktok", "shares", "Shares", { sortOrder: 40 }),
    metric("tiktok", "favorites", "Favorites", {
      evidenceScope: "native_insights",
      isPrivateMetric: true,
      sortOrder: 50,
    }),
    metric("tiktok", "avg_watch_time_seconds", "Average watch time", {
      fieldType: "duration_seconds",
      evidenceScope: "native_insights",
      isPrivateMetric: true,
      sortOrder: 60,
    }),
    metric("tiktok", "completion_rate", "Completion rate", {
      fieldType: "percentage",
      evidenceScope: "native_insights",
      isPrivateMetric: true,
      sortOrder: 70,
    }),
    metric("tiktok", "profile_views", "Profile views", {
      evidenceScope: "native_insights",
      isDefault: false,
      isPrivateMetric: true,
      sortOrder: 80,
    }),
  ],
  youtube: [
    metric("youtube", "views", "Views", { sortOrder: 10 }),
    metric("youtube", "impressions", "Impressions", {
      evidenceScope: "native_insights",
      isPrivateMetric: true,
      sortOrder: 20,
    }),
    metric("youtube", "impressions_click_through_rate", "Impressions CTR", {
      fieldType: "percentage",
      evidenceScope: "native_insights",
      isPrivateMetric: true,
      sortOrder: 30,
    }),
    metric("youtube", "watch_time_minutes", "Watch time", {
      fieldType: "decimal",
      evidenceScope: "native_insights",
      isPrivateMetric: true,
      sortOrder: 40,
    }),
    metric("youtube", "avg_view_duration_seconds", "Average view duration", {
      fieldType: "duration_seconds",
      evidenceScope: "native_insights",
      isPrivateMetric: true,
      sortOrder: 50,
    }),
    metric("youtube", "likes", "Likes", { sortOrder: 60 }),
    metric("youtube", "comments", "Comments", { sortOrder: 70 }),
    metric("youtube", "shares", "Shares", {
      evidenceScope: "native_insights",
      isDefault: false,
      isPrivateMetric: true,
      sortOrder: 80,
    }),
    metric("youtube", "subscribers_gained", "Subscribers gained", {
      evidenceScope: "native_insights",
      isDefault: false,
      isPrivateMetric: true,
      sortOrder: 90,
    }),
  ],
  facebook: [
    metric("facebook", "reach", "Reach", {
      evidenceScope: "native_insights",
      isPrivateMetric: true,
      sortOrder: 10,
    }),
    metric("facebook", "impressions", "Impressions", {
      evidenceScope: "native_insights",
      isPrivateMetric: true,
      sortOrder: 20,
    }),
    metric("facebook", "views", "Views", { sortOrder: 30 }),
    metric("facebook", "reactions", "Reactions", { sortOrder: 40 }),
    metric("facebook", "comments", "Comments", { sortOrder: 50 }),
    metric("facebook", "shares", "Shares", { sortOrder: 60 }),
    metric("facebook", "clicks", "Clicks", {
      evidenceScope: "native_insights",
      isDefault: false,
      isPrivateMetric: true,
      sortOrder: 70,
    }),
    metric("facebook", "profile_visits", "Profile visits", {
      evidenceScope: "native_insights",
      isDefault: false,
      isPrivateMetric: true,
      sortOrder: 80,
    }),
  ],
  snapchat: [
    metric("snapchat", "views", "Views", { sortOrder: 10 }),
    metric("snapchat", "viewers", "Viewers", {
      evidenceScope: "native_insights",
      isPrivateMetric: true,
      sortOrder: 20,
    }),
    metric("snapchat", "screenshots", "Screenshots", {
      evidenceScope: "native_insights",
      isPrivateMetric: true,
      sortOrder: 30,
    }),
    metric("snapchat", "shares", "Shares", {
      evidenceScope: "native_insights",
      isPrivateMetric: true,
      sortOrder: 40,
    }),
    metric("snapchat", "swipe_ups", "Swipe-ups", {
      evidenceScope: "native_insights",
      isPrivateMetric: true,
      sortOrder: 50,
    }),
    metric("snapchat", "avg_view_time_seconds", "Average view time", {
      fieldType: "duration_seconds",
      evidenceScope: "native_insights",
      isPrivateMetric: true,
      sortOrder: 60,
    }),
    metric("snapchat", "total_view_time_seconds", "Total view time", {
      fieldType: "duration_seconds",
      evidenceScope: "native_insights",
      isDefault: false,
      isPrivateMetric: true,
      sortOrder: 70,
    }),
    metric("snapchat", "comments", "Comments", {
      evidenceScope: "native_insights",
      isDefault: false,
      sortOrder: 80,
    }),
    metric("snapchat", "favorites", "Favorites", {
      evidenceScope: "native_insights",
      isDefault: false,
      sortOrder: 90,
    }),
  ],
  x: [
    metric("x", "impressions", "Impressions", {
      evidenceScope: "native_insights",
      isPrivateMetric: true,
      sortOrder: 10,
    }),
    metric("x", "likes", "Likes", { sortOrder: 20 }),
    metric("x", "replies", "Replies", { sortOrder: 30 }),
    metric("x", "reposts", "Reposts", { sortOrder: 40 }),
    metric("x", "quotes", "Quotes", { sortOrder: 50 }),
    metric("x", "bookmarks", "Bookmarks", {
      evidenceScope: "native_insights",
      isPrivateMetric: true,
      sortOrder: 60,
    }),
    metric("x", "clicks", "Clicks", {
      evidenceScope: "native_insights",
      isDefault: false,
      isPrivateMetric: true,
      sortOrder: 70,
    }),
    metric("x", "video_views", "Video views", {
      isDefault: false,
      sortOrder: 80,
    }),
  ],
  generic: [
    metric("generic", "views", "Views", { sortOrder: 10 }),
    metric("generic", "reach", "Reach", { isDefault: false, sortOrder: 20 }),
    metric("generic", "impressions", "Impressions", {
      isDefault: false,
      sortOrder: 30,
    }),
    metric("generic", "engagements", "Engagements", { sortOrder: 40 }),
    metric("generic", "clicks", "Clicks", { sortOrder: 50 }),
    metric("generic", "screenshots", "Screenshots", {
      isDefault: false,
      sortOrder: 60,
    }),
    metric("generic", "conversions", "Conversions", {
      isDefault: false,
      sortOrder: 70,
    }),
    metric("generic", "custom_1", "Custom metric 1", {
      fieldType: "text",
      evidenceScope: "brand_defined",
      isDefault: false,
      sortOrder: 80,
    }),
    metric("generic", "custom_2", "Custom metric 2", {
      fieldType: "text",
      evidenceScope: "brand_defined",
      isDefault: false,
      sortOrder: 90,
    }),
    metric("generic", "custom_3", "Custom metric 3", {
      fieldType: "text",
      evidenceScope: "brand_defined",
      isDefault: false,
      sortOrder: 100,
    }),
  ],
};

export function isReportingPlatform(value: string): value is ReportingPlatform {
  return REPORTING_PLATFORMS.includes(value as ReportingPlatform);
}

export function getReportingPlatformLabel(platform: ReportingPlatform): string {
  return REPORTING_PLATFORM_LABELS[platform];
}

export function getReportingMetricTemplate(
  platform: ReportingPlatform,
): ReportingMetricDefinition[] {
  return REPORTING_METRIC_TEMPLATES[platform].toSorted(
    (a, b) => a.sortOrder - b.sortOrder,
  );
}

export function getDefaultReportingRequirement(
  platform: ReportingPlatform,
  contentFormat: string,
): ReportingRequirementDraft {
  const defaultMetricDefinitions = getReportingMetricTemplate(platform).filter(
    (metricDefinition) => metricDefinition.isDefault,
  );

  return {
    platform,
    platformLabel: platform === "generic" ? "" : null,
    contentFormat,
    accountRequirement:
      platform === "generic"
        ? "brand_defined"
        : defaultMetricDefinitions.some(
              (definition) => definition.evidenceScope === "native_insights",
            )
          ? "native_insights_required"
          : "public_post_ok",
    evidenceTypes: DEFAULT_REQUIRED_EVIDENCE,
    requiredMetricKeys: defaultMetricDefinitions.map(
      (metricDefinition) => metricDefinition.metricKey,
    ),
    aiExtractionAllowed: true,
    creatorConfirmationRequired: true,
  };
}
