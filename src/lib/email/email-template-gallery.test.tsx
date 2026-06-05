import { describe, expect, it } from "vitest";

import {
  buildEmailPreviewDocument,
  getEmailTemplateGallery,
} from "./email-template-gallery";

describe("email template gallery", () => {
  it("covers every production email template with real preview data", () => {
    const templates = getEmailTemplateGallery();

    expect(templates.map((template) => template.name)).toEqual([
      "Waitlist Approved (Brand)",
      "Waitlist Approved (Creator)",
      "Account Update",
      "Application Accepted",
      "Application Rejected",
      "Application Received",
      "Content Submitted",
      "Content Approved",
      "Revision Requested",
      "Counter Offer",
      "Counter Offer Accepted",
      "Campaign Completed",
      "Campaign Announcement",
      "Report Ready",
      "Report Correction",
    ]);

    for (const template of templates) {
      expect(template.description).toMatch(/\S/);
      expect(template.element).toBeTruthy();
    }
  });

  it("renders a stable premium preview document in the repo output folder", async () => {
    const html = await buildEmailPreviewDocument();

    expect(html).toContain("<title>PopsDrops Email Preview</title>");
    expect(html).toContain("Waitlist Approved (Brand)");
    expect(html).toContain("Report Correction");
    expect(html).toContain("background:#f8fafc");
    expect(html).toContain("iframe");
    expect(html).not.toContain("/tmp/");
    expect(html).not.toContain("John Doe");
    expect(html).not.toContain("Acme");
  });
});
