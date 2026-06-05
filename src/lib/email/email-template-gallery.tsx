import { render } from "@react-email/components";
import { resolve } from "node:path";
import type { ReactElement } from "react";

import { ApplicationAcceptedEmail } from "./templates/application-accepted";
import { ApplicationReceivedEmail } from "./templates/application-received";
import { ContentApprovedEmail } from "./templates/content-approved";
import { ContentSubmittedEmail } from "./templates/content-submitted";
import { CounterOfferEmail } from "./templates/counter-offer";
import { ReportNotificationEmail } from "./templates/report-notification";
import { RevisionRequestedEmail } from "./templates/revision-requested";
import { WaitlistApprovedEmail } from "./templates/waitlist-approved";

export type EmailTemplatePreview = {
  name: string;
  description: string;
  element: ReactElement;
};

export const EMAIL_PREVIEW_OUTPUT_PATH = resolve(
  process.cwd(),
  "output/email-preview/popsdrops-email-preview.html",
);

export function getEmailTemplateGallery(): EmailTemplatePreview[] {
  return [
    {
      name: "Waitlist Approved (Brand)",
      description: "Brand access approval with one sign-in action.",
      element: (
        <WaitlistApprovedEmail
          name="Sophie Laurent"
          role="brand"
          loginUrl="https://popsdrops.com/login"
        />
      ),
    },
    {
      name: "Waitlist Approved (Creator)",
      description: "Creator network approval with profile next step.",
      element: (
        <WaitlistApprovedEmail
          name="Aisha Rahman"
          role="creator"
          loginUrl="https://popsdrops.com/login"
        />
      ),
    },
    {
      name: "Account Update",
      description: "Quiet account status notice for manual review outcomes.",
      element: (
        <ReportNotificationEmail
          preview="PopsDrops account update"
          heading="Account update."
          message="Your account could not be approved at this time. Contact PopsDrops if you believe this should be reviewed again."
          campaignTitle="PopsDrops account"
          actionLabel="Contact PopsDrops"
          actionUrl="mailto:notifications@popsdrops.com"
        />
      ),
    },
    {
      name: "Application Accepted",
      description: "Creator acceptance notice with agreed campaign rate.",
      element: (
        <ApplicationAcceptedEmail
          creatorName="Lena Park"
          campaignTitle="Seoul Retail Launch"
          acceptedRate={1500}
          campaignUrl="https://popsdrops.com/i/campaigns/123"
        />
      ),
    },
    {
      name: "Application Rejected",
      description: "Creator application update with a calm next step.",
      element: (
        <ReportNotificationEmail
          preview="Application update: Seoul Retail Launch"
          heading="Application update."
          message="The campaign manager chose a different creator fit for this campaign."
          campaignTitle="Seoul Retail Launch"
          actionLabel="View campaigns"
          actionUrl="https://popsdrops.com/i/campaigns"
        />
      ),
    },
    {
      name: "Application Received",
      description: "Brand review prompt for a new creator application.",
      element: (
        <ApplicationReceivedEmail
          brandName="Hermes Beaute"
          creatorName="Mia Chen"
          campaignTitle="Silk Skincare Launch"
          proposedRate={2500}
          campaignUrl="https://popsdrops.com/b/campaigns/101"
        />
      ),
    },
    {
      name: "Content Submitted",
      description: "Brand review notice for submitted creator work.",
      element: (
        <ContentSubmittedEmail
          brandName="Maison Lumiere"
          creatorName="Yuki Tanaka"
          campaignTitle="Holiday Collection 2026"
          platform="Instagram"
          campaignUrl="https://popsdrops.com/b/campaigns/123"
        />
      ),
    },
    {
      name: "Content Approved",
      description: "Creator publishing notice after brand approval.",
      element: (
        <ContentApprovedEmail
          creatorName="Carlos Mendez"
          campaignTitle="Spring Fragrance Drop"
          campaignUrl="https://popsdrops.com/i/campaigns/456"
        />
      ),
    },
    {
      name: "Revision Requested",
      description: "Creator correction notice with specific brand feedback.",
      element: (
        <RevisionRequestedEmail
          creatorName="Fatima Hassan"
          campaignTitle="Ramadan Glow"
          feedback="Adjust the opening shot and add the product name overlay from the brief."
          campaignUrl="https://popsdrops.com/i/campaigns/789"
        />
      ),
    },
    {
      name: "Counter Offer",
      description: "Creator rate negotiation notice with brand note.",
      element: (
        <CounterOfferEmail
          creatorName="Dani Oliveira"
          campaignTitle="Festival Collection"
          counterRate={800}
          message="We like the fit. Can you support two deliverables within this budget?"
          campaignUrl="https://popsdrops.com/i/campaigns/202"
        />
      ),
    },
    {
      name: "Counter Offer Accepted",
      description: "Brand notice when a creator accepts a counter offer.",
      element: (
        <ReportNotificationEmail
          preview="Counter offer accepted: Festival Collection"
          heading="Counter offer accepted."
          message="Dani Oliveira accepted your counter offer."
          campaignTitle="Festival Collection"
          actionLabel="Open campaign"
          actionUrl="https://popsdrops.com/b/campaigns/202"
        />
      ),
    },
    {
      name: "Campaign Completed",
      description: "Creator closeout notice after a campaign is completed.",
      element: (
        <ReportNotificationEmail
          preview="Campaign completed: Spring Fragrance Drop"
          heading="Campaign completed."
          message="The campaign is complete. Review the workspace and leave your campaign feedback."
          campaignTitle="Spring Fragrance Drop"
          actionLabel="Open campaign"
          actionUrl="https://popsdrops.com/i/campaigns/456"
        />
      ),
    },
    {
      name: "Campaign Announcement",
      description: "Creator-facing campaign announcement from the brand.",
      element: (
        <ReportNotificationEmail
          preview="Campaign announcement: Holiday Collection 2026"
          heading="Campaign announcement."
          message="Please use the updated publishing window from the campaign room."
          campaignTitle="Holiday Collection 2026"
          actionLabel="Open campaign"
          actionUrl="https://popsdrops.com/i/campaigns/123"
        />
      ),
    },
    {
      name: "Report Ready",
      description: "Brand report review notice for submitted proof.",
      element: (
        <ReportNotificationEmail
          preview="Report ready: K-Beauty Retail Launch"
          heading="Report proof is ready."
          message="Mina Park submitted report proof for K-Beauty Retail Launch."
          campaignTitle="K-Beauty Retail Launch"
          actionLabel="Open report"
          actionUrl="https://popsdrops.com/b/campaigns/4707/report"
        />
      ),
    },
    {
      name: "Report Correction",
      description: "Creator correction prompt for incomplete report proof.",
      element: (
        <ReportNotificationEmail
          preview="Report correction requested: K-Beauty Retail Launch"
          heading="Report correction requested."
          message="Upload the full native analytics view so the brand can verify the report."
          campaignTitle="K-Beauty Retail Launch"
          actionLabel="Open campaign"
          actionUrl="https://popsdrops.com/i/campaigns/4707"
        />
      ),
    },
  ];
}

function escapeHtmlAttribute(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function buildEmailPreviewDocument() {
  const templates = getEmailTemplateGallery();
  const renderedTemplates = await Promise.all(
    templates.map(async (template) => ({
      ...template,
      html: await render(template.element),
    })),
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>PopsDrops Email Preview</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body { margin:0; background:#f8fafc; color:#0f172a; font-family:Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    main { max-width:980px; margin:0 auto; padding:48px 24px 72px; }
    header { margin:0 0 28px; }
    h1 { margin:0; font-size:28px; line-height:1.2; letter-spacing:0; }
    .intro { margin:10px 0 0; color:#64748b; font-size:15px; line-height:1.6; }
    .template { margin:0 0 36px; }
    .template-head { display:flex; align-items:flex-end; justify-content:space-between; gap:20px; margin:0 0 12px; }
    .template h2 { margin:0; font-size:13px; line-height:1.3; letter-spacing:0; color:#0f172a; }
    .template p { margin:4px 0 0; color:#64748b; font-size:12px; line-height:1.5; }
    .frame { overflow:hidden; border:1px solid #e2e8f0; border-radius:14px; background:#fff; box-shadow:0 12px 32px rgba(15, 23, 42, 0.08); }
    iframe { display:block; width:100%; height:650px; border:0; background:#f8fafc; }
    @media (max-width: 720px) {
      main { padding:28px 14px 48px; }
      h1 { font-size:23px; }
      .template-head { display:block; }
      iframe { height:720px; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>PopsDrops Email Preview</h1>
      <p class="intro">Production React Email templates rendered with branded layout and realistic preview data.</p>
    </header>
    ${renderedTemplates
      .map(
        (template) => `<section class="template">
      <div class="template-head">
        <div>
          <h2>${template.name}</h2>
          <p>${template.description}</p>
        </div>
      </div>
      <div class="frame">
        <iframe title="${escapeHtmlAttribute(template.name)} preview" srcdoc="${escapeHtmlAttribute(template.html)}"></iframe>
      </div>
    </section>`,
      )
      .join("\n")}
  </main>
</body>
</html>
`;
}
