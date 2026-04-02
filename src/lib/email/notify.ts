import { createElement } from "react";
import { sendEmail } from "./send";
import { ContentSubmittedEmail } from "./templates/content-submitted";
import { ContentApprovedEmail } from "./templates/content-approved";
import { RevisionRequestedEmail } from "./templates/revision-requested";
import { ApplicationReceivedEmail } from "./templates/application-received";
import { ApplicationAcceptedEmail } from "./templates/application-accepted";
import { CounterOfferEmail } from "./templates/counter-offer";
import { WaitlistApprovedEmail } from "./templates/waitlist-approved";

// ---------------------------------------------------------------------------
// Notification → Email mapping
// ---------------------------------------------------------------------------

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://popsdrops.com";

interface EmailNotification {
  type: string;
  recipientEmail: string;
  recipientName: string;
  data: Record<string, unknown>;
}

/**
 * Send an email notification based on type.
 * Non-blocking — errors are logged, never thrown.
 */
export async function sendNotificationEmail({
  type,
  recipientEmail,
  recipientName,
  data,
}: EmailNotification) {
  try {
    switch (type) {
      case "content_submitted":
        await sendEmail({
          to: recipientEmail,
          subject: `New content submitted for "${data.campaignTitle}"`,
          template: createElement(ContentSubmittedEmail, {
            brandName: recipientName,
            creatorName: data.creatorName as string,
            campaignTitle: data.campaignTitle as string,
            platform: data.platform as string,
            campaignUrl: `${BASE_URL}/b/campaigns/${data.campaignId}`,
          }),
        });
        break;

      case "content_approved":
        await sendEmail({
          to: recipientEmail,
          subject: `Content approved for "${data.campaignTitle}"`,
          template: createElement(ContentApprovedEmail, {
            creatorName: recipientName,
            campaignTitle: data.campaignTitle as string,
            campaignUrl: `${BASE_URL}/i/campaigns/${data.campaignId}`,
          }),
        });
        break;

      case "revision_requested":
        await sendEmail({
          to: recipientEmail,
          subject: `Changes requested for "${data.campaignTitle}"`,
          template: createElement(RevisionRequestedEmail, {
            creatorName: recipientName,
            campaignTitle: data.campaignTitle as string,
            feedback: data.feedback as string,
            campaignUrl: `${BASE_URL}/i/campaigns/${data.campaignId}`,
          }),
        });
        break;

      case "application_received":
        await sendEmail({
          to: recipientEmail,
          subject: `New application for "${data.campaignTitle}"`,
          template: createElement(ApplicationReceivedEmail, {
            brandName: recipientName,
            creatorName: data.creatorName as string,
            campaignTitle: data.campaignTitle as string,
            proposedRate: data.proposedRate as number,
            campaignUrl: `${BASE_URL}/b/campaigns/${data.campaignId}`,
          }),
        });
        break;

      case "application_accepted":
        await sendEmail({
          to: recipientEmail,
          subject: `You've been accepted to "${data.campaignTitle}"`,
          template: createElement(ApplicationAcceptedEmail, {
            creatorName: recipientName,
            campaignTitle: data.campaignTitle as string,
            acceptedRate: data.acceptedRate as number,
            campaignUrl: `${BASE_URL}/i/campaigns/${data.campaignId}`,
          }),
        });
        break;

      case "counter_offer":
        await sendEmail({
          to: recipientEmail,
          subject: `Counter offer for "${data.campaignTitle}" — $${data.counterRate}`,
          template: createElement(CounterOfferEmail, {
            creatorName: recipientName,
            campaignTitle: data.campaignTitle as string,
            counterRate: data.counterRate as number,
            message: data.message as string | undefined,
            campaignUrl: `${BASE_URL}/i/discover/${data.campaignId}`,
          }),
        });
        break;

      case "account_approved":
        await sendEmail({
          to: recipientEmail,
          subject: "Your PopsDrops account has been approved",
          template: createElement(WaitlistApprovedEmail, {
            name: recipientName,
            role: data.role as "brand" | "creator",
            loginUrl: `${BASE_URL}/login`,
          }),
        });
        break;

      default:
        // Unsupported notification type — skip email
        break;
    }
  } catch (error) {
    console.error(`Failed to send ${type} email to ${recipientEmail}:`, error);
  }
}
