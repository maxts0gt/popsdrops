import type { CreatorRoomTab } from "./creator-room-next-action";
import { isCreatorPaymentStatusNotification } from "./creator-notification-presentation";

type NotificationData = Record<string, unknown> | null | undefined;

function getNotificationCampaignId(data: NotificationData): string | null {
  const campaignId = data?.campaign_id;
  return typeof campaignId === "string" && campaignId.length > 0
    ? campaignId
    : null;
}

export function buildCreatorCampaignRoomHref(
  campaignId: string,
  tab?: CreatorRoomTab,
): string {
  const baseHref = `/i/campaigns/${campaignId}`;
  return tab ? `${baseHref}?tab=${tab}` : baseHref;
}

export function getCreatorNotificationHref(
  type: string,
  data: NotificationData,
): string {
  const campaignId = getNotificationCampaignId(data);

  if (isCreatorPaymentStatusNotification(type, data)) {
    return "/i/earnings";
  }

  switch (type) {
    case "campaign_match":
      return campaignId ? `/i/discover/${campaignId}` : "/i/discover";
    case "revision_requested":
    case "report_correction_requested":
    case "report_follow_up_requested":
    case "content_approved":
      return campaignId
        ? buildCreatorCampaignRoomHref(campaignId, "submit")
        : "/i/campaigns";
    case "content_due_soon":
    case "deadline":
      return campaignId
        ? buildCreatorCampaignRoomHref(campaignId, "tasks")
        : "/i/campaigns";
    case "application_accepted":
    case "campaign_update":
      return campaignId
        ? buildCreatorCampaignRoomHref(campaignId, "brief")
        : "/i/campaigns";
    case "application_rejected":
      return "/i/campaigns";
    case "review":
    case "review_received":
      return "/i/profile";
    default:
      return "/i/home";
  }
}
