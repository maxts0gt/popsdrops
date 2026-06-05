import { isReportingPlatform, type ReportingPlatform } from "./platform-templates";

export type RequiredProofMetricGroup = {
  platform: ReportingPlatform;
  requiredMetricKeys: string[];
};

export type ReportingRequirementRow = {
  platform: string;
  content_format: string | null;
  required_metric_keys: string[] | null;
};

export type SubmittedProofMetricValue = {
  platform?: ReportingPlatform;
  metricKey: string;
  metricValue?: number;
  metricText?: string;
};

export function getRequiredProofMetricGroupsForSubmission(input: {
  campaignPlatforms: string[];
  submissionPlatform: string | null;
  submissionContentFormat: string | null;
  requirements: ReportingRequirementRow[];
}): RequiredProofMetricGroup[] {
  if (!input.submissionPlatform) return [];

  const campaignPlatformSet = new Set(input.campaignPlatforms);
  const matchingContentRequirements = input.requirements.filter(
    (requirement) =>
      !input.submissionContentFormat ||
      !requirement.content_format ||
      requirement.content_format === input.submissionContentFormat,
  );
  const candidateRequirements = matchingContentRequirements.length
    ? matchingContentRequirements
    : input.requirements;
  const groups: RequiredProofMetricGroup[] = [];
  const seenPlatforms = new Set<string>();

  for (const requirement of candidateRequirements) {
    if (!isReportingPlatform(requirement.platform)) continue;

    const isSubmissionPlatform = requirement.platform === input.submissionPlatform;
    const isReportingOnlyChannel = !campaignPlatformSet.has(requirement.platform);

    if (!isSubmissionPlatform && !isReportingOnlyChannel) continue;
    if (seenPlatforms.has(requirement.platform)) continue;

    seenPlatforms.add(requirement.platform);
    groups.push({
      platform: requirement.platform,
      requiredMetricKeys: requirement.required_metric_keys ?? [],
    });
  }

  return groups;
}

export function getMissingRequiredProofMetrics(input: {
  primaryPlatform: ReportingPlatform;
  requiredGroups: RequiredProofMetricGroup[];
  metricValues: SubmittedProofMetricValue[] | undefined;
  sparseMetrics: Record<string, unknown>;
}): string[] {
  const submittedMetricKeysByPlatform = new Map<string, Set<string>>();

  function addSubmittedMetricKey(platform: ReportingPlatform, metricKey: string) {
    const keys = submittedMetricKeysByPlatform.get(platform) ?? new Set<string>();
    keys.add(metricKey);
    submittedMetricKeysByPlatform.set(platform, keys);
  }

  for (const metric of input.metricValues ?? []) {
    if (metric.metricValue == null && !metric.metricText?.trim()) continue;
    addSubmittedMetricKey(metric.platform ?? input.primaryPlatform, metric.metricKey);
  }

  for (const [key, value] of Object.entries(input.sparseMetrics)) {
    if (typeof value === "number" && Number.isFinite(value)) {
      addSubmittedMetricKey(input.primaryPlatform, key);
    }
  }

  const missingMetricKeys: string[] = [];
  for (const group of input.requiredGroups) {
    const submittedMetricKeys =
      submittedMetricKeysByPlatform.get(group.platform) ?? new Set<string>();

    for (const metricKey of group.requiredMetricKeys) {
      if (!submittedMetricKeys.has(metricKey)) {
        missingMetricKeys.push(`${group.platform}:${metricKey}`);
      }
    }
  }

  return missingMetricKeys;
}
