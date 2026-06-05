export const BRAND_CAMPAIGN_WORKSPACE_TABS = [
  "overview",
  "brief",
  "creators",
  "content",
  "reporting",
] as const;

export type BrandCampaignWorkspaceTab =
  (typeof BRAND_CAMPAIGN_WORKSPACE_TABS)[number];

export type BrandCampaignReportHealth = {
  missed?: number;
  corrections?: number;
  toReview?: number;
};

type NotificationData = Record<string, unknown> | null | undefined;

function getNotificationCampaignId(data: NotificationData): string | null {
  const campaignId = data?.campaign_id;
  return typeof campaignId === "string" && campaignId.length > 0
    ? campaignId
    : null;
}

export function buildBrandCampaignWorkspaceHref(
  campaignId: string,
  tab?: BrandCampaignWorkspaceTab,
): string {
  const baseHref = `/b/campaigns/${campaignId}`;
  return tab ? `${baseHref}?tab=${tab}` : baseHref;
}

export function buildBrandCampaignReportHref(campaignId: string): string {
  return `/b/campaigns/${campaignId}/report`;
}

export function getBrandCampaignListHref({
  awaitingContent = 0,
  id,
  reportHealth,
}: {
  awaitingContent?: number;
  id: string;
  reportHealth?: BrandCampaignReportHealth | null;
}): string {
  if ((reportHealth?.missed ?? 0) > 0) {
    return buildBrandCampaignWorkspaceHref(id, "creators");
  }

  if (awaitingContent > 0) {
    return buildBrandCampaignWorkspaceHref(id, "content");
  }

  if (
    (reportHealth?.corrections ?? 0) > 0 ||
    (reportHealth?.toReview ?? 0) > 0
  ) {
    return buildBrandCampaignWorkspaceHref(id, "reporting");
  }

  return buildBrandCampaignWorkspaceHref(id);
}

export function getBrandNotificationHref(
  type: string,
  data: NotificationData,
): string {
  const campaignId = getNotificationCampaignId(data);

  switch (type) {
    case "application_received":
    case "new_application":
      return campaignId
        ? buildBrandCampaignWorkspaceHref(campaignId, "creators")
        : "/b/campaigns";
    case "content_submitted":
    case "content_published":
      return campaignId
        ? buildBrandCampaignWorkspaceHref(campaignId, "content")
        : "/b/campaigns";
    case "performance_submitted":
      return campaignId
        ? buildBrandCampaignWorkspaceHref(campaignId, "reporting")
        : "/b/campaigns";
    case "campaign_update":
      return campaignId ? buildBrandCampaignWorkspaceHref(campaignId) : "/b/campaigns";
    case "campaign_completed":
    case "report_ready_for_review":
    case "report_correction_resubmitted":
      return campaignId ? buildBrandCampaignReportHref(campaignId) : "/b/campaigns";
    case "review_received":
    case "new_review":
      return "/b/home";
    default:
      return "/b/home";
  }
}
