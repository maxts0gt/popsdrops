import type {
  ReportingAccountRequirement,
  ReportingEvidenceType,
  ReportingPlatform,
} from "./platform-templates";

export type EligibilityRequirement = {
  platform: ReportingPlatform;
  platformLabel: string | null;
  contentFormat: string;
  accountRequirement: ReportingAccountRequirement;
  evidenceTypes: ReportingEvidenceType[];
  requiredMetricKeys: string[];
};

export type CreatorReportingEligibility = {
  status: "eligible" | "needs_confirmation" | "not_eligible";
  missingPlatforms: ReportingPlatform[];
  confirmationReasons: string[];
};

const confirmationEvidenceTypes = new Set<ReportingEvidenceType>([
  "screenshot",
  "analytics_export",
  "csv",
  "document",
]);

export function getCreatorReportingEligibility(input: {
  creatorPlatforms: string[];
  requirements: EligibilityRequirement[];
}): CreatorReportingEligibility {
  const creatorPlatforms = new Set(input.creatorPlatforms);
  const missingPlatforms: ReportingPlatform[] = [];
  const confirmationReasons: string[] = [];

  for (const requirement of input.requirements) {
    if (
      requirement.platform !== "generic" &&
      !creatorPlatforms.has(requirement.platform)
    ) {
      missingPlatforms.push(requirement.platform);
      continue;
    }

    if (
      requirement.platform === "generic" ||
      requirement.accountRequirement !== "public_post_ok" ||
      requirement.evidenceTypes.some((type) => confirmationEvidenceTypes.has(type))
    ) {
      confirmationReasons.push(requirement.platform);
    }
  }

  if (missingPlatforms.length > 0) {
    return { status: "not_eligible", missingPlatforms, confirmationReasons };
  }

  return {
    status: confirmationReasons.length > 0 ? "needs_confirmation" : "eligible",
    missingPlatforms,
    confirmationReasons,
  };
}
