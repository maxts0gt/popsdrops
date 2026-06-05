import { createElement, type ReactElement } from "react";
import { ContentSubmittedEmail } from "./templates/content-submitted";
import { ContentApprovedEmail } from "./templates/content-approved";
import { RevisionRequestedEmail } from "./templates/revision-requested";
import { ApplicationReceivedEmail } from "./templates/application-received";
import { ApplicationAcceptedEmail } from "./templates/application-accepted";
import { CounterOfferEmail } from "./templates/counter-offer";
import { WaitlistApprovedEmail } from "./templates/waitlist-approved";
import { ReportNotificationEmail } from "./templates/report-notification";
import { BrandTeamInvitationEmail } from "./templates/brand-team-invitation";
import {
  EMAIL_NOTIFICATION_TYPES,
  isEmailNotificationType,
} from "./notification-types";

export { EMAIL_NOTIFICATION_TYPES, isEmailNotificationType };

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://popsdrops.com";

type EmailNotificationBuildInput = {
  type: string;
  recipientName: string;
  data: Record<string, unknown>;
};

export type BuiltNotificationEmail = {
  subject: string;
  template: ReactElement;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function getStringValue(
  data: Record<string, unknown>,
  nested: Record<string, unknown>,
  camelKey: string,
  snakeKey: string,
  fallback = "",
): string {
  const value =
    data[camelKey] ??
    data[snakeKey] ??
    nested[camelKey] ??
    nested[snakeKey] ??
    fallback;
  return typeof value === "string" && value.trim() ? value : fallback;
}

function getNumberValue(
  data: Record<string, unknown>,
  nested: Record<string, unknown>,
  camelKey: string,
  snakeKey: string,
  fallback = 0,
): number {
  const value =
    data[camelKey] ?? data[snakeKey] ?? nested[camelKey] ?? nested[snakeKey];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeNotificationData(data: Record<string, unknown>) {
  const nested = asRecord(data.data);
  return {
    body: getStringValue(data, nested, "body", "body"),
    campaignId: getStringValue(data, nested, "campaignId", "campaign_id"),
    campaignTitle: getStringValue(
      data,
      nested,
      "campaignTitle",
      "campaign_title",
      "Campaign",
    ),
    creatorName: getStringValue(
      data,
      nested,
      "creatorName",
      "creator_name",
      "A creator",
    ),
    platform: getStringValue(data, nested, "platform", "platform"),
    title: getStringValue(data, nested, "title", "title", "Campaign update"),
  };
}

function buildBrandCampaignUrl(campaignId: string) {
  return campaignId
    ? `${BASE_URL}/b/campaigns/${campaignId}`
    : `${BASE_URL}/b/campaigns`;
}

function buildCreatorCampaignUrl(campaignId: string) {
  return campaignId
    ? `${BASE_URL}/i/campaigns/${campaignId}`
    : `${BASE_URL}/i/campaigns`;
}

function formatEmailDate(value: string, fallback = "the scheduled date") {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return fallback;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatTeamRoleLabel(value: string) {
  switch (value) {
    case "admin":
      return "Admin";
    case "viewer":
      return "Viewer";
    default:
      return "Manager";
  }
}

function buildReportEmail({
  type,
  data,
}: {
  type: string;
  data: Record<string, unknown>;
}): BuiltNotificationEmail | null {
  const payload = normalizeNotificationData(data);
  const reportUrl = `${BASE_URL}/b/campaigns/${payload.campaignId}/report`;
  const campaignUrl = `${BASE_URL}/i/campaigns/${payload.campaignId}`;

  switch (type) {
    case "report_ready_for_review":
      return {
        subject: `Report ready to review: ${payload.campaignTitle}`,
        template: createElement(ReportNotificationEmail, {
          preview: `Report ready: ${payload.campaignTitle}`,
          heading: "Report proof is ready.",
          message:
            payload.body ||
            `${payload.creatorName} submitted report proof for ${payload.campaignTitle}.`,
          campaignTitle: payload.campaignTitle,
          actionLabel: "Open report",
          actionUrl: reportUrl,
        }),
      };

    case "report_correction_resubmitted":
      return {
        subject: `Correction resubmitted: ${payload.campaignTitle}`,
        template: createElement(ReportNotificationEmail, {
          preview: `Correction resubmitted: ${payload.campaignTitle}`,
          heading: "Correction resubmitted.",
          message:
            payload.body ||
            `${payload.creatorName} resubmitted report proof for ${payload.campaignTitle}.`,
          campaignTitle: payload.campaignTitle,
          actionLabel: "Open report",
          actionUrl: reportUrl,
        }),
      };

    case "report_correction_requested":
      return {
        subject: `Report correction requested: ${payload.campaignTitle}`,
        template: createElement(ReportNotificationEmail, {
          preview: `Report correction requested: ${payload.campaignTitle}`,
          heading: "Report correction requested.",
          message: payload.body || "The brand requested a corrected report proof.",
          campaignTitle: payload.campaignTitle,
          actionLabel: "Open campaign",
          actionUrl: campaignUrl,
        }),
      };

    case "report_follow_up_requested":
      return {
        subject: `Report follow-up requested: ${payload.campaignTitle}`,
        template: createElement(ReportNotificationEmail, {
          preview: `Report follow-up requested: ${payload.campaignTitle}`,
          heading: "Performance proof is still needed.",
          message:
            payload.body ||
            `${payload.campaignTitle} still needs performance proof.`,
          campaignTitle: payload.campaignTitle,
          actionLabel: "Open campaign",
          actionUrl: campaignUrl,
        }),
      };

    default:
      return null;
  }
}

export function buildNotificationEmail({
  type,
  recipientName,
  data,
}: EmailNotificationBuildInput): BuiltNotificationEmail | null {
  const reportEmail = buildReportEmail({ type, data });
  if (reportEmail) return reportEmail;

  const payload = normalizeNotificationData(data);

  switch (type) {
    case "content_submitted":
      return {
        subject: `Content submitted: ${payload.campaignTitle}`,
        template: createElement(ContentSubmittedEmail, {
          brandName: recipientName,
          creatorName: payload.creatorName,
          campaignTitle: payload.campaignTitle,
          platform: payload.platform,
          campaignUrl: `${BASE_URL}/b/campaigns/${payload.campaignId}`,
        }),
      };

    case "content_approved":
      return {
        subject: `Content approved: ${payload.campaignTitle}`,
        template: createElement(ContentApprovedEmail, {
          creatorName: recipientName,
          campaignTitle: payload.campaignTitle,
          campaignUrl: `${BASE_URL}/i/campaigns/${payload.campaignId}`,
        }),
      };

    case "revision_requested":
      return {
        subject: `Changes requested: ${payload.campaignTitle}`,
        template: createElement(RevisionRequestedEmail, {
          creatorName: recipientName,
          campaignTitle: payload.campaignTitle,
          feedback: getStringValue(data, asRecord(data.data), "feedback", "feedback"),
          campaignUrl: `${BASE_URL}/i/campaigns/${payload.campaignId}`,
        }),
      };

    case "application_received":
      return {
        subject: `Application received: ${payload.campaignTitle}`,
        template: createElement(ApplicationReceivedEmail, {
          brandName: recipientName,
          creatorName: payload.creatorName,
          campaignTitle: payload.campaignTitle,
          proposedRate: getNumberValue(
            data,
            asRecord(data.data),
            "proposedRate",
            "proposed_rate",
          ),
          campaignUrl: `${BASE_URL}/b/campaigns/${payload.campaignId}`,
        }),
      };

    case "application_accepted":
      return {
        subject: `Application accepted: ${payload.campaignTitle}`,
        template: createElement(ApplicationAcceptedEmail, {
          creatorName: recipientName,
          campaignTitle: payload.campaignTitle,
          acceptedRate: getNumberValue(
            data,
            asRecord(data.data),
            "acceptedRate",
            "accepted_rate",
          ),
          campaignUrl: `${BASE_URL}/i/campaigns/${payload.campaignId}`,
        }),
      };

    case "application_rejected":
      return {
        subject: `Application update: ${payload.campaignTitle}`,
        template: createElement(ReportNotificationEmail, {
          preview: `Application update: ${payload.campaignTitle}`,
          heading: "Application update.",
          message:
            payload.body ||
            "The campaign manager chose a different creator fit for this campaign.",
          campaignTitle: payload.campaignTitle,
          actionLabel: "View campaigns",
          actionUrl: `${BASE_URL}/i/campaigns`,
        }),
      };

    case "counter_offer":
      return {
        subject: `Counter offer: ${payload.campaignTitle}, $${getNumberValue(
          data,
          asRecord(data.data),
          "counterRate",
          "counter_rate",
        )}`,
        template: createElement(CounterOfferEmail, {
          creatorName: recipientName,
          campaignTitle: payload.campaignTitle,
          counterRate: getNumberValue(
            data,
            asRecord(data.data),
            "counterRate",
            "counter_rate",
          ),
          message:
            getStringValue(data, asRecord(data.data), "message", "message") ||
            undefined,
          campaignUrl: `${BASE_URL}/i/discover/${payload.campaignId}`,
        }),
      };

    case "campaign_match":
      return {
        subject: `Counter offer accepted: ${payload.campaignTitle}`,
        template: createElement(ReportNotificationEmail, {
          preview: `Counter offer accepted: ${payload.campaignTitle}`,
          heading: "Counter offer accepted.",
          message:
            payload.body ||
            `${payload.creatorName} accepted your counter offer.`,
          campaignTitle: payload.campaignTitle,
          actionLabel: "Open campaign",
          actionUrl: buildBrandCampaignUrl(payload.campaignId),
        }),
      };

    case "campaign_completed":
      return {
        subject: `Campaign completed: ${payload.campaignTitle}`,
        template: createElement(ReportNotificationEmail, {
          preview: `Campaign completed: ${payload.campaignTitle}`,
          heading: "Campaign completed.",
          message:
            payload.body ||
            "The campaign is complete. Review the workspace and leave your campaign feedback.",
          campaignTitle: payload.campaignTitle,
          actionLabel: "Open campaign",
          actionUrl: buildCreatorCampaignUrl(payload.campaignId),
        }),
      };

    case "campaign_update":
      {
        const nested = asRecord(data.data);
        const actionUrl = getStringValue(
          data,
          nested,
          "actionUrl",
          "action_url",
          buildCreatorCampaignUrl(payload.campaignId),
        );

        return {
          subject: `${payload.title}: ${payload.campaignTitle}`,
          template: createElement(ReportNotificationEmail, {
            preview: `${payload.title}: ${payload.campaignTitle}`,
            heading: `${payload.title}.`,
            message:
              payload.body ||
              "The campaign manager shared an update for this campaign.",
            campaignTitle: payload.campaignTitle,
            actionLabel: "Open campaign",
            actionUrl,
          }),
        };
      }

    case "payment_received":
      return {
        subject: `Payment marked paid: ${payload.campaignTitle}`,
        template: createElement(ReportNotificationEmail, {
          preview: `Payment marked paid: ${payload.campaignTitle}`,
          heading: "Payment marked paid.",
          message:
            payload.body ||
            "The campaign manager marked your creator payment as paid.",
          campaignTitle: payload.campaignTitle,
          actionLabel: "Open earnings",
          actionUrl: `${BASE_URL}/i/earnings`,
        }),
      };

    case "account_approved":
      return {
        subject: "Your PopsDrops account has been approved",
        template: createElement(WaitlistApprovedEmail, {
          name: recipientName,
          role: getStringValue(
            data,
            asRecord(data.data),
            "role",
            "role",
            "creator",
          ) as "brand" | "creator",
          loginUrl: getStringValue(
            data,
            asRecord(data.data),
            "loginUrl",
            "login_url",
            `${BASE_URL}/login`,
          ),
        }),
      };

    case "account_rejected": {
      const reason = getStringValue(
        data,
        asRecord(data.data),
        "reason",
        "reason",
        payload.body || "Your account could not be approved at this time.",
      );

      return {
        subject: "PopsDrops account update",
        template: createElement(ReportNotificationEmail, {
          preview: "PopsDrops account update",
          heading: "Account update.",
          message: reason,
          campaignTitle: "PopsDrops",
          actionLabel: "Contact PopsDrops",
          actionUrl: "mailto:notifications@popsdrops.com",
        }),
      };
    }

    case "account_suspended": {
      const reason = getStringValue(
        data,
        asRecord(data.data),
        "reason",
        "reason",
        payload.body ||
          "Your PopsDrops account access has been suspended. Contact PopsDrops if you need help.",
      );

      return {
        subject: "PopsDrops access suspended",
        template: createElement(ReportNotificationEmail, {
          preview: "PopsDrops access suspended",
          heading: "Access suspended.",
          message: reason,
          campaignTitle: "PopsDrops",
          actionLabel: "Contact PopsDrops",
          actionUrl: "mailto:notifications@popsdrops.com",
        }),
      };
    }

    case "account_restored": {
      const loginUrl = getStringValue(
        data,
        asRecord(data.data),
        "loginUrl",
        "login_url",
        `${BASE_URL}/login`,
      );

      return {
        subject: "PopsDrops access restored",
        template: createElement(ReportNotificationEmail, {
          preview: "PopsDrops access restored",
          heading: "Access restored.",
          message:
            payload.body ||
            "Your PopsDrops account access has been restored. You can sign in again.",
          campaignTitle: "PopsDrops",
          actionLabel: "Open PopsDrops",
          actionUrl: loginUrl,
        }),
      };
    }

    case "account_review_reopened": {
      const reason = getStringValue(
        data,
        asRecord(data.data),
        "reason",
        "reason",
        payload.body ||
          "Your PopsDrops account has been returned to review. We will email you when the review is complete.",
      );

      return {
        subject: "PopsDrops account review reopened",
        template: createElement(ReportNotificationEmail, {
          preview: "PopsDrops account review reopened",
          heading: "Account review reopened.",
          message: reason,
          campaignTitle: "PopsDrops",
          actionLabel: "Contact PopsDrops",
          actionUrl: "mailto:notifications@popsdrops.com",
        }),
      };
    }

    case "brand_team_invitation": {
      const nested = asRecord(data.data);
      const brandName = getStringValue(
        data,
        nested,
        "brandName",
        "brand_name",
        "your brand workspace",
      );
      const role = getStringValue(data, nested, "role", "role", "manager");
      const loginUrl = getStringValue(
        data,
        nested,
        "loginUrl",
        "login_url",
        `${BASE_URL}/login`,
      );
      const teamInvitationUrl = getStringValue(
        data,
        nested,
        "teamInvitationUrl",
        "team_invitation_url",
        loginUrl,
      );

      return {
        subject: `You were invited to ${brandName} on PopsDrops`,
        template: createElement(BrandTeamInvitationEmail, {
          recipientName,
          brandName,
          invitedByName: getStringValue(
            data,
            nested,
            "invitedByName",
            "invited_by_name",
            "A teammate",
          ),
          roleLabel: formatTeamRoleLabel(role),
          expiresAt: getStringValue(data, nested, "expiresAt", "expires_at"),
          loginUrl,
          teamInvitationUrl,
        }),
      };
    }

    case "data_deletion_scheduled": {
      const nested = asRecord(data.data);
      const scheduledFor = getStringValue(
        data,
        nested,
        "scheduledFor",
        "scheduled_for",
      );
      const verificationDueAt = getStringValue(
        data,
        nested,
        "verificationDueAt",
        "verification_due_at",
      );
      const scheduledDate = formatEmailDate(scheduledFor);
      const responseDate = formatEmailDate(
        verificationDueAt,
        "the legal response date",
      );

      return {
        subject: "PopsDrops account deletion scheduled",
        template: createElement(ReportNotificationEmail, {
          preview: `Account deletion scheduled for ${scheduledDate}`,
          heading: "Account deletion scheduled.",
          message:
            payload.body ||
            `Your PopsDrops account deletion is scheduled for ${scheduledDate}. The privacy response target is ${responseDate}.`,
          campaignTitle: scheduledDate,
          contextLabel: "Scheduled for",
          actionLabel: "Contact PopsDrops",
          actionUrl: "mailto:notifications@popsdrops.com",
        }),
      };
    }

    case "data_deletion_completed": {
      const nested = asRecord(data.data);
      const completedAt = getStringValue(
        data,
        nested,
        "completedAt",
        "completed_at",
        getStringValue(data, nested, "processedAt", "processed_at"),
      );
      const completedDate = formatEmailDate(completedAt, "today");

      return {
        subject: "PopsDrops account deletion completed",
        template: createElement(ReportNotificationEmail, {
          preview: `Account deletion completed ${completedDate}`,
          heading: "Account deletion completed.",
          message:
            payload.body ||
            "Your PopsDrops account deletion request has been processed. Required legal, tax, fraud, campaign, payment, agreement, and audit records may remain only in anonymized or legally required form.",
          campaignTitle: completedDate,
          contextLabel: "Completed",
          actionLabel: "View privacy policy",
          actionUrl: `${BASE_URL}/privacy`,
        }),
      };
    }

    case "data_export_ready": {
      const nested = asRecord(data.data);
      const expiresAt = getStringValue(
        data,
        nested,
        "downloadExpiresAt",
        "download_expires_at",
      );
      const expiresDate = formatEmailDate(expiresAt, "the expiry date");

      return {
        subject: "PopsDrops data export ready",
        template: createElement(ReportNotificationEmail, {
          preview: `Data export available until ${expiresDate}`,
          heading: "Your data export is ready.",
          message:
            payload.body ||
            `Your PopsDrops data export is ready. Download it from privacy settings before ${expiresDate}.`,
          campaignTitle: expiresDate,
          contextLabel: "Available until",
          actionLabel: "Open privacy settings",
          actionUrl: `${BASE_URL}/b/settings`,
        }),
      };
    }

    case "privacy_request_denied": {
      const nested = asRecord(data.data);
      const requestType = getStringValue(
        data,
        nested,
        "requestType",
        "request_type",
        "privacy",
      );
      const reason = getStringValue(
        data,
        nested,
        "reason",
        "reason",
        "We could not complete this request based on the information available.",
      );

      return {
        subject: "PopsDrops privacy request update",
        template: createElement(ReportNotificationEmail, {
          preview: "Privacy request update",
          heading: "Privacy request update.",
          message:
            payload.body ||
            `We could not complete your ${requestType} request. Reason: ${reason}`,
          campaignTitle: reason,
          contextLabel: "Reason",
          actionLabel: "Contact PopsDrops",
          actionUrl: "mailto:notifications@popsdrops.com",
        }),
      };
    }

    default:
      return null;
  }
}
