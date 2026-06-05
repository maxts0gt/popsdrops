import type {
  ReportingAccountRequirement,
  ReportingEvidenceType,
  ReportingPlatform,
} from "./platform-templates";
import { REPORTING_PLATFORMS } from "./platform-templates";

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
const creatorProfilePlatforms = new Set<ReportingPlatform>([
  "instagram",
  "tiktok",
  "youtube",
  "facebook",
  "snapchat",
]);

type CreatorPlatformProfile = {
  platforms?: string[] | null;
  instagram?: unknown | null;
  tiktok?: unknown | null;
  youtube?: unknown | null;
  facebook?: unknown | null;
  snapchat?: unknown | null;
};

function isReportingPlatform(value: string): value is ReportingPlatform {
  return (REPORTING_PLATFORMS as readonly string[]).includes(value);
}

export function getCreatorDeclaredPlatforms(
  profile: CreatorPlatformProfile | null | undefined,
): ReportingPlatform[] {
  if (!profile) return [];

  const platforms = new Set<ReportingPlatform>();

  for (const platform of profile.platforms ?? []) {
    if (isReportingPlatform(platform) && platform !== "generic") {
      platforms.add(platform);
    }
  }

  const connectedPlatformProfiles: Array<[ReportingPlatform, unknown | null | undefined]> = [
    ["instagram", profile.instagram],
    ["tiktok", profile.tiktok],
    ["youtube", profile.youtube],
    ["facebook", profile.facebook],
    ["snapchat", profile.snapchat],
  ];

  for (const [platform, account] of connectedPlatformProfiles) {
    if (account) platforms.add(platform);
  }

  return REPORTING_PLATFORMS.filter((platform) => platforms.has(platform));
}

export function getCreatorReportingEligibility(input: {
  creatorPlatforms: string[];
  requirements: EligibilityRequirement[];
}): CreatorReportingEligibility {
  const creatorPlatforms = new Set(input.creatorPlatforms);
  const missingPlatforms: ReportingPlatform[] = [];
  const confirmationReasons: string[] = [];

  for (const requirement of input.requirements) {
    if (
      creatorProfilePlatforms.has(requirement.platform) &&
      !creatorPlatforms.has(requirement.platform)
    ) {
      missingPlatforms.push(requirement.platform);
      continue;
    }

    if (
      !creatorProfilePlatforms.has(requirement.platform) ||
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
