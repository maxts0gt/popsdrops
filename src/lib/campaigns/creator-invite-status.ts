export const ACTIVE_CAMPAIGN_CREATOR_INVITE_STATUSES = [
  "manual",
  "queued",
  "sent",
] as const;

export type ActiveCampaignCreatorInviteStatus =
  (typeof ACTIVE_CAMPAIGN_CREATOR_INVITE_STATUSES)[number];

const activeCampaignCreatorInviteStatusSet = new Set<string>(
  ACTIVE_CAMPAIGN_CREATOR_INVITE_STATUSES,
);

export function isActiveCampaignCreatorInviteStatus(
  status: unknown,
): status is ActiveCampaignCreatorInviteStatus {
  return (
    typeof status === "string" &&
    activeCampaignCreatorInviteStatusSet.has(status)
  );
}
