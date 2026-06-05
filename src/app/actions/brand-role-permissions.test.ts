import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const campaignsSource = readFileSync(
  new URL("./campaigns.ts", import.meta.url),
  "utf8",
);
const contentSource = readFileSync(
  new URL("./content.ts", import.meta.url),
  "utf8",
);
const reportingEvidenceSource = readFileSync(
  new URL("./reporting-evidence.ts", import.meta.url),
  "utf8",
);
const campaignAssetsSource = readFileSync(
  new URL("./campaign-assets.ts", import.meta.url),
  "utf8",
);
const campaignAgreementsSource = readFileSync(
  new URL("./campaign-agreements.ts", import.meta.url),
  "utf8",
);
const applicationsSource = readFileSync(
  new URL("./applications.ts", import.meta.url),
  "utf8",
);
const reportSharesSource = readFileSync(
  new URL("./report-shares.ts", import.meta.url),
  "utf8",
);
const reportExportJobsSource = readFileSync(
  new URL("./report-export-jobs.ts", import.meta.url),
  "utf8",
);

describe("brand action role permissions", () => {
  it("gates campaign and billing actions by named permissions", () => {
    expect(campaignsSource).toContain("assertBrandWorkspacePermission");
    expect(campaignsSource).toContain('"create_campaigns"');
    expect(campaignsSource).toContain('"manage_campaigns"');
    expect(campaignsSource).toContain('"manage_billing"');
    expect(campaignsSource).not.toContain("assertBrandWorkspaceRole(supabase, user.id)");
  });

  it("gates content review, reporting review, assets, agreements, and applications by campaign operations permissions", () => {
    expect(contentSource).toContain("hasBrandWorkspacePermission");
    expect(contentSource).toContain('"review_content"');
    expect(reportingEvidenceSource).toContain("hasBrandWorkspacePermission");
    expect(reportingEvidenceSource).toContain('"review_content"');
    expect(campaignAssetsSource).toContain("assertBrandWorkspacePermission");
    expect(campaignAssetsSource).toContain('"manage_campaigns"');
    expect(campaignAgreementsSource).toContain("assertBrandWorkspacePermission");
    expect(campaignAgreementsSource).toContain('"manage_campaigns"');
    expect(applicationsSource).toContain("assertBrandWorkspacePermission");
    expect(applicationsSource).toContain('"manage_campaigns"');
  });

  it("lets viewers list reports but restricts creating and revoking share links", () => {
    expect(reportSharesSource).toContain("assertBrandReportShareAccess");
    expect(reportSharesSource).toContain('"view_campaigns"');
    expect(reportSharesSource).toContain('"share_reports"');
    expect(reportSharesSource).toContain("listReportShareLinks");
    expect(reportSharesSource).toContain("createReportShareLink");
    expect(reportSharesSource).toContain("revokeReportShareLink");
  });

  it("restricts durable report exports to teammates who can share reports", () => {
    expect(reportExportJobsSource).toContain("assertBrandWorkspacePermission");
    expect(reportExportJobsSource).toContain('"share_reports"');
    expect(reportExportJobsSource).not.toContain("getBrandWorkspaceForCurrentUser");
    expect(reportExportJobsSource).not.toContain('profile?.role === "admin"');
  });
});
