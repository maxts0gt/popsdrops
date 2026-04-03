/**
 * Quick email template preview — renders all templates to HTML and writes a preview file.
 * Run: npx tsx scripts/preview-email.tsx
 */
import { render } from "@react-email/components";
import { tmpdir } from "node:os";
import path from "node:path";
import { writeFileSync } from "fs";
import { WaitlistApprovedEmail } from "../src/lib/email/templates/waitlist-approved";
import { ApplicationAcceptedEmail } from "../src/lib/email/templates/application-accepted";
import { ContentSubmittedEmail } from "../src/lib/email/templates/content-submitted";
import { ContentApprovedEmail } from "../src/lib/email/templates/content-approved";
import { RevisionRequestedEmail } from "../src/lib/email/templates/revision-requested";
import { ApplicationReceivedEmail } from "../src/lib/email/templates/application-received";
import { CounterOfferEmail } from "../src/lib/email/templates/counter-offer";

const templates = [
  { name: "Waitlist Approved (Brand)", el: WaitlistApprovedEmail({ name: "Sophie Laurent", role: "brand", loginUrl: "https://popsdrops.com/login" }) },
  { name: "Waitlist Approved (Creator)", el: WaitlistApprovedEmail({ name: "Aisha Al-Rashid", role: "creator", loginUrl: "https://popsdrops.com/login" }) },
  { name: "Application Accepted", el: ApplicationAcceptedEmail({ creatorName: "Lena Park", campaignName: "Summer Beauty Launch", dashboardUrl: "https://popsdrops.com/i/campaigns/123" }) },
  { name: "Content Submitted", el: ContentSubmittedEmail({ brandName: "Maison Lumière", creatorName: "Yuki Tanaka", campaignName: "Holiday Collection 2026", reviewUrl: "https://popsdrops.com/b/campaigns/123/content" }) },
  { name: "Content Approved", el: ContentApprovedEmail({ creatorName: "Carlos Mendez", campaignName: "Spring Fragrance Drop", dashboardUrl: "https://popsdrops.com/i/campaigns/456" }) },
  { name: "Revision Requested", el: RevisionRequestedEmail({ creatorName: "Fatima Hassan", campaignName: "Ramadan Glow", feedback: "Please adjust the lighting in the first 3 seconds and add the product name overlay as specified in the brief.", revisionsRemaining: 2, dashboardUrl: "https://popsdrops.com/i/campaigns/789" }) },
  { name: "Application Received", el: ApplicationReceivedEmail({ brandName: "Hermès Beauté", creatorName: "Mia Chen", campaignName: "Silk Skincare Launch", rate: "$2,500", pitch: "I have 3 years of experience creating luxury beauty content for Asian markets. My audience is 80% women aged 22-35 in South Korea and Japan.", reviewUrl: "https://popsdrops.com/b/campaigns/101/applications" }) },
  { name: "Counter Offer", el: CounterOfferEmail({ creatorName: "Dani Oliveira", campaignName: "Festival Collection", originalRate: "$1,200", counterRate: "$800", counterNote: "We love your profile. Could you work within this budget for 2 deliverables instead of 3?", dashboardUrl: "https://popsdrops.com/i/campaigns/202" }) },
];

async function main() {
  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>PopsDrops Email Preview</title>
  <style>
    body { font-family: system-ui; background: #f1f5f9; margin: 0; padding: 40px; }
    .template { margin: 0 auto 60px; max-width: 680px; }
    .template h2 { color: #0f172a; font-size: 14px; letter-spacing: 0.05em; text-transform: uppercase; margin-bottom: 16px; }
    .template .frame { background: white; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden; }
    .template iframe { width: 100%; height: 600px; border: none; }
  </style></head><body>`;

  for (const t of templates) {
    const rendered = await render(t.el);
    html += `<div class="template"><h2>${t.name}</h2><div class="frame"><iframe srcdoc="${rendered.replace(/"/g, '&quot;')}"></iframe></div></div>`;
  }

  html += `</body></html>`;
  const previewPath = path.join(tmpdir(), "popsdrops-email-preview.html");
  writeFileSync(previewPath, html);
  console.log(`Preview written to ${previewPath}`);
}

main();
