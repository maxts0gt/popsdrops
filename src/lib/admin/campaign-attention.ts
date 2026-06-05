import type { PaymentStatusType } from "@/types/database";

export type CampaignAttentionKind =
  | "payment"
  | "launch"
  | "reporting"
  | "operations";

export type AdminCampaignAttentionInput = {
  id: string;
  invite_reserved_count: number;
  member_count: number;
  paid_creator_capacity: number | null;
  report_correction_count: number;
  report_missed_count: number;
  service_fee_cents: number | null;
  service_fee_status: PaymentStatusType;
  title: string;
};

export type CampaignAttentionItem = {
  actionLabel: string;
  campaignId: string;
  detail: string;
  href: string;
  id: string;
  kind: CampaignAttentionKind;
  label: string;
  title: string;
};

const paymentExceptionStatuses = new Set<PaymentStatusType>([
  "failed",
  "refunded",
  "disputed",
  "overdue",
]);

function normalizeCount(value: number | null | undefined) {
  return Number.isFinite(value) ? Math.max(0, Math.floor(Number(value))) : 0;
}

export function serviceFeeLabel(status: PaymentStatusType) {
  return status[0].toUpperCase() + status.slice(1);
}

export function isServiceFeeBlockingLaunch(
  campaign: Pick<
    AdminCampaignAttentionInput,
    "service_fee_cents" | "service_fee_status"
  >,
) {
  const serviceFeeRequired = (campaign.service_fee_cents ?? 0) > 0;
  return serviceFeeRequired && campaign.service_fee_status !== "paid";
}

export function getAdminCampaignAttentionItems(
  campaign: AdminCampaignAttentionInput,
): CampaignAttentionItem[] {
  const items: CampaignAttentionItem[] = [];

  if (paymentExceptionStatuses.has(campaign.service_fee_status)) {
    items.push({
      actionLabel: "Open finance",
      campaignId: campaign.id,
      detail: `${serviceFeeLabel(campaign.service_fee_status)} service fee needs finance review.`,
      href: `/admin/campaigns/${campaign.id}?focus=finance#admin-finance-exception`,
      id: `${campaign.id}:payment`,
      kind: "payment",
      label: "Payment exception",
      title: campaign.title,
    });
  }

  if (isServiceFeeBlockingLaunch(campaign)) {
    items.push({
      actionLabel: "Review launch gate",
      campaignId: campaign.id,
      detail: `${serviceFeeLabel(campaign.service_fee_status)} service fee blocks invite links and launch actions.`,
      href: `/admin/campaigns/${campaign.id}?focus=launch#admin-launch-readiness`,
      id: `${campaign.id}:launch`,
      kind: "launch",
      label: "Launch blocker",
      title: campaign.title,
    });
  }

  const paidCreatorCapacity =
    campaign.paid_creator_capacity === null
      ? null
      : normalizeCount(campaign.paid_creator_capacity);
  const reservedCreatorSeats =
    normalizeCount(campaign.member_count) +
    normalizeCount(campaign.invite_reserved_count);
  if (
    paidCreatorCapacity !== null &&
    reservedCreatorSeats > paidCreatorCapacity
  ) {
    items.push({
      actionLabel: "Open operations",
      campaignId: campaign.id,
      detail: `${reservedCreatorSeats} creator seats reserved for ${paidCreatorCapacity} paid slots. Pause outreach or increase capacity.`,
      href: `/admin/campaigns/${campaign.id}?focus=operations#admin-creator-operations`,
      id: `${campaign.id}:operations`,
      kind: "operations",
      label: "Invite capacity exception",
      title: campaign.title,
    });
  }

  const reportExceptionCount =
    campaign.report_correction_count + campaign.report_missed_count;
  if (reportExceptionCount > 0) {
    const parts = [
      campaign.report_missed_count > 0
        ? `${campaign.report_missed_count} missed`
        : null,
      campaign.report_correction_count > 0
        ? `${campaign.report_correction_count} correction`
        : null,
    ].filter(Boolean);
    items.push({
      actionLabel: "Open campaign",
      campaignId: campaign.id,
      detail: `${parts.join(", ")} report task${reportExceptionCount === 1 ? " needs" : "s need"} review.`,
      href: `/admin/campaigns/${campaign.id}?focus=reporting#admin-reporting-exceptions`,
      id: `${campaign.id}:reporting`,
      kind: "reporting",
      label: "Reporting exception",
      title: campaign.title,
    });
  }

  return items;
}
