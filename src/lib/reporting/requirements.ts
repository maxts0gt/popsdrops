import {
  REPORTING_METRIC_TEMPLATES,
  getDefaultReportingRequirement,
  getReportingMetricTemplate,
  isReportingPlatform,
  type ReportingPlatform,
  type ReportingRequirementDraft,
} from "./platform-templates";

type DeliverableLike = {
  platform: string;
  content_type: string;
  quantity: number;
};

export type CampaignReportingRequirementInput = ReportingRequirementDraft & {
  sortOrder?: number;
};

export type AdditionalProofChannelInput = {
  platform: ReportingPlatform;
  platformLabel?: string | null;
};

export type MeasurementContractGoal =
  | "awareness"
  | "engagement_quality"
  | "traffic_actions"
  | "luxury_proof";

const MEASUREMENT_CONTRACT_METRICS: Record<
  MeasurementContractGoal,
  Partial<Record<ReportingPlatform, string[]>>
> = {
  awareness: {
    instagram: ["views", "reach", "impressions"],
    tiktok: ["views", "avg_watch_time_seconds", "completion_rate"],
    youtube: ["views", "impressions", "watch_time_minutes"],
    facebook: ["reach", "impressions", "views"],
    snapchat: ["views", "viewers", "avg_view_time_seconds"],
    x: ["impressions", "video_views"],
    generic: ["views", "reach", "impressions"],
  },
  engagement_quality: {
    instagram: ["likes", "comments", "shares", "saves"],
    tiktok: ["likes", "comments", "shares", "favorites"],
    youtube: ["likes", "comments", "shares", "subscribers_gained"],
    facebook: ["reactions", "comments", "shares"],
    snapchat: ["shares", "screenshots", "comments", "favorites"],
    x: ["likes", "replies", "reposts", "bookmarks"],
    generic: ["engagements", "clicks"],
  },
  traffic_actions: {
    instagram: ["views", "link_clicks", "profile_visits"],
    tiktok: ["views", "profile_views"],
    youtube: ["views", "impressions_click_through_rate", "subscribers_gained"],
    facebook: ["views", "clicks", "profile_visits"],
    snapchat: ["views", "swipe_ups"],
    x: ["impressions", "clicks"],
    generic: ["views", "clicks", "conversions"],
  },
  luxury_proof: {
    instagram: ["views", "reach", "comments", "saves"],
    tiktok: ["views", "comments", "shares", "favorites"],
    youtube: ["views", "comments", "watch_time_minutes"],
    facebook: ["reach", "comments", "shares"],
    snapchat: ["views", "screenshots", "shares"],
    x: ["impressions", "replies", "bookmarks"],
    generic: ["views", "engagements", "custom_1"],
  },
};

export function buildDefaultCampaignReportingRequirements(
  deliverables: DeliverableLike[],
): CampaignReportingRequirementInput[] {
  const seen = new Set<string>();
  const requirements: CampaignReportingRequirementInput[] = [];

  for (const deliverable of deliverables) {
    if (!isReportingPlatform(deliverable.platform)) continue;
    const key = `${deliverable.platform}:${deliverable.content_type}`;
    if (seen.has(key)) continue;
    seen.add(key);

    requirements.push({
      ...getDefaultReportingRequirement(
        deliverable.platform,
        deliverable.content_type,
      ),
      sortOrder: requirements.length,
    });
  }

  return requirements;
}

export function getMeasurementContractMetricKeys(
  goal: MeasurementContractGoal,
  platform: ReportingPlatform,
): string[] {
  const allowedMetricKeys = new Set(
    getReportingMetricTemplate(platform).map((metric) => metric.metricKey),
  );
  const preferredMetricKeys =
    MEASUREMENT_CONTRACT_METRICS[goal][platform] ??
    getDefaultReportingRequirement(platform, "content").requiredMetricKeys;
  const supportedMetricKeys = preferredMetricKeys.filter((key) =>
    allowedMetricKeys.has(key),
  );

  return supportedMetricKeys.length > 0
    ? supportedMetricKeys
    : getDefaultReportingRequirement(platform, "content").requiredMetricKeys;
}

export function buildMeasurementContractReportingRequirements(input: {
  deliverables: DeliverableLike[];
  goal: MeasurementContractGoal;
  additionalProofChannels?: AdditionalProofChannelInput[];
  selectedMetricKeysByPlatform?: Partial<Record<ReportingPlatform, string[]>>;
}): CampaignReportingRequirementInput[] {
  const baseRequirements = buildDefaultCampaignReportingRequirements(input.deliverables).map(
    (requirement) => {
      const allowedMetricKeys = new Set(
        getReportingMetricTemplate(requirement.platform).map(
          (metric) => metric.metricKey,
        ),
      );
      const selectedMetricKeys =
        input.selectedMetricKeysByPlatform?.[requirement.platform]?.filter((key) =>
          allowedMetricKeys.has(key),
        );

      return {
        ...requirement,
        requiredMetricKeys: selectedMetricKeys?.length
          ? selectedMetricKeys
        : getMeasurementContractMetricKeys(input.goal, requirement.platform),
      };
    },
  );
  const contentFormats = Array.from(
    new Set(
      input.deliverables
        .map((deliverable) => deliverable.content_type)
        .filter(Boolean),
    ),
  );
  const additionalRequirements: CampaignReportingRequirementInput[] = [];

  for (const contentFormat of contentFormats) {
    for (const channel of input.additionalProofChannels ?? []) {
      if (!isReportingPlatform(channel.platform)) continue;
      const defaultRequirement = getDefaultReportingRequirement(
        channel.platform,
        contentFormat,
      );
      const allowedMetricKeys = new Set(
        getReportingMetricTemplate(channel.platform).map(
          (metric) => metric.metricKey,
        ),
      );
      const selectedMetricKeys =
        input.selectedMetricKeysByPlatform?.[channel.platform]?.filter((key) =>
          allowedMetricKeys.has(key),
        );

      additionalRequirements.push({
        ...defaultRequirement,
        platformLabel:
          channel.platform === "generic"
            ? channel.platformLabel?.trim() || defaultRequirement.platformLabel
            : defaultRequirement.platformLabel,
        requiredMetricKeys: selectedMetricKeys?.length
          ? selectedMetricKeys
          : getMeasurementContractMetricKeys(input.goal, channel.platform),
        sortOrder: baseRequirements.length + additionalRequirements.length,
      });
    }
  }

  return [...baseRequirements, ...additionalRequirements];
}

export function validateRequirementMetricKeys(input: {
  platform: ReportingPlatform;
  platformLabel: string | null;
  requiredMetricKeys: string[];
}): string[] {
  const invalid: string[] = [];

  if (input.platform === "generic" && !input.platformLabel?.trim()) {
    invalid.push("platform_label");
  }

  const allowed = new Set(
    REPORTING_METRIC_TEMPLATES[input.platform].map((metric) => metric.metricKey),
  );

  for (const key of input.requiredMetricKeys) {
    if (!allowed.has(key)) invalid.push(key);
  }

  return invalid;
}

export function getMetricLabel(
  platform: ReportingPlatform,
  metricKey: string,
): string {
  return (
    REPORTING_METRIC_TEMPLATES[platform].find(
      (metric) => metric.metricKey === metricKey,
    )?.label ?? metricKey
  );
}
