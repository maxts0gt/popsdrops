import {
  REPORTING_METRIC_TEMPLATES,
  getDefaultReportingRequirement,
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
