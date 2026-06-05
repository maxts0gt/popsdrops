export type CampaignServiceFeeVisibility = {
  service_fee_cents?: unknown;
  service_fee_status?: unknown;
};

export function isCampaignServiceFeeUnlocked(
  campaign: CampaignServiceFeeVisibility,
): boolean {
  const feeCents = Number(campaign.service_fee_cents ?? 0);
  const status =
    typeof campaign.service_fee_status === "string"
      ? campaign.service_fee_status
      : null;

  return Number.isFinite(feeCents) && (feeCents <= 0 || status === "paid");
}
