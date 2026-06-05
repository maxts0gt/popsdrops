import {
  isCampaignApplicationOpen,
  type CampaignLifecycleStatus,
} from "./lifecycle";
import { isCampaignServiceFeeUnlocked } from "./service-fee-visibility";

export const CAMPAIGN_RECRUITMENT_VISIBILITIES = [
  "private_invite",
  "shortlist_invite",
  "open_applications",
] as const;

export type CampaignRecruitmentVisibility =
  (typeof CAMPAIGN_RECRUITMENT_VISIBILITIES)[number];

type RecruitmentVisibilityInput = {
  status?: CampaignLifecycleStatus | string | null;
  application_deadline?: string | null;
  applicationDeadline?: string | null;
  service_fee_cents?: unknown;
  service_fee_status?: unknown;
  recruitment_visibility?: unknown;
  now?: number;
};

const recruitmentVisibilitySet = new Set<string>(
  CAMPAIGN_RECRUITMENT_VISIBILITIES,
);

export function getCampaignRecruitmentVisibility(
  campaign: Pick<RecruitmentVisibilityInput, "recruitment_visibility"> | null | undefined,
): CampaignRecruitmentVisibility {
  const visibility = campaign?.recruitment_visibility;
  return typeof visibility === "string" && recruitmentVisibilitySet.has(visibility)
    ? (visibility as CampaignRecruitmentVisibility)
    : "private_invite";
}

export function requiresVerifiedInviteForApplication(
  campaign: Pick<RecruitmentVisibilityInput, "recruitment_visibility"> | null | undefined,
) {
  return getCampaignRecruitmentVisibility(campaign) !== "open_applications";
}

export function isCampaignOpenForCreatorDiscovery(
  campaign: RecruitmentVisibilityInput | null | undefined,
) {
  if (!campaign) return false;
  return (
    getCampaignRecruitmentVisibility(campaign) === "open_applications" &&
    isCampaignServiceFeeUnlocked(campaign) &&
    isCampaignApplicationOpen({
      status: campaign.status,
      application_deadline: campaign.application_deadline,
      applicationDeadline: campaign.applicationDeadline,
      now: campaign.now,
    })
  );
}

export function isCampaignOpenForPublicApply(
  campaign: RecruitmentVisibilityInput | null | undefined,
  options: { hasInviteToken?: boolean } = {},
) {
  if (!campaign || !isCampaignServiceFeeUnlocked(campaign)) return false;
  if (
    !isCampaignApplicationOpen({
      status: campaign.status,
      application_deadline: campaign.application_deadline,
      applicationDeadline: campaign.applicationDeadline,
      now: campaign.now,
    })
  ) {
    return false;
  }

  const visibility = getCampaignRecruitmentVisibility(campaign);
  return visibility === "open_applications" || Boolean(options.hasInviteToken);
}

export function isCampaignVisibleForPublicApply(
  campaign: RecruitmentVisibilityInput | null | undefined,
  options: { hasInviteToken?: boolean } = {},
) {
  if (!campaign || !isCampaignServiceFeeUnlocked(campaign)) return false;
  if (isCampaignOpenForPublicApply(campaign, options)) return true;

  return Boolean(options.hasInviteToken);
}
