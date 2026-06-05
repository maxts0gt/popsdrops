import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

function readOptional(path: URL) {
  const filePath = fileURLToPath(path);
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
}

const detailSource = readOptional(new URL("./page.tsx", import.meta.url));

const campaignsSource = readFileSync(
  fileURLToPath(new URL("../page.tsx", import.meta.url)),
  "utf8",
);

const campaignAttentionSource = readFileSync(
  fileURLToPath(
    new URL("../../../../../../lib/admin/campaign-attention.ts", import.meta.url),
  ),
  "utf8",
);

const revenueSource = readFileSync(
  fileURLToPath(new URL("../../revenue/page.tsx", import.meta.url)),
  "utf8",
);

describe("admin campaign detail quality contract", () => {
  it("builds a focused command view from existing campaign operating data", () => {
    expect(detailSource).toContain("async function fetchAdminCampaignDetail");
    expect(detailSource).toContain(".from(\"campaigns\")");
    expect(detailSource).toContain(".from(\"campaign_applications\")");
    expect(detailSource).toContain(".from(\"campaign_members\")");
    expect(detailSource).toContain(".from(\"content_submissions\")");
    expect(detailSource).toContain(".from(\"campaign_report_tasks\")");
    expect(detailSource).toContain(".from(\"content_performance_evidence\")");
    expect(detailSource).toContain(".from(\"report_export_jobs\")");
    expect(detailSource).toContain(".from(\"campaign_assets\")");
    expect(detailSource).toContain(".from(\"campaign_agreements\")");
    expect(detailSource).toContain(".from(\"campaign_payment_events\")");
    expect(detailSource).toContain(".from(\"admin_audit_log\")");
    expect(detailSource).toContain("loadReportInterventionAuditEntries");
    expect(detailSource).toContain("campaign_report_task");
    expect(detailSource).toContain("reportTasks.map((task) => task.id)");
    expect(detailSource).toContain("reportExportJobs");

    expect(detailSource).toContain("Campaign command center");
    expect(detailSource).toContain("Operating health");
    expect(detailSource).toContain("Creator operations");
    expect(detailSource).toContain("Content and reporting");
    expect(detailSource).toContain("Rules and materials");
    expect(detailSource).toContain("Payment trail");
    expect(detailSource).toContain("Recent admin activity");
    expect(detailSource).toContain("`/apply/${campaign.id}`");
    expect(detailSource).not.toContain("`/b/campaigns/${campaign.id}`");
  });

  it("keeps admin campaign entry points pointed at the exact campaign", () => {
    expect(campaignsSource).toContain("`/admin/campaigns/${c.id}`");
    expect(revenueSource).toContain(
      "`/admin/campaigns/${campaign.id}?focus=finance#admin-finance-exception`",
    );
  });

  it("keeps the drill-in operational and free of decorative filler", () => {
    expect(detailSource).not.toContain(["Spark", "les"].join(""));
    expect(detailSource).not.toContain(["Za", "p"].join(""));
    expect(detailSource).not.toContain("Rocket");
    expect(detailSource).not.toContain("Future:");
    expect(detailSource).not.toContain("Planned Features");
    expect(detailSource).not.toContain("\u2014");
  });

  it("opens admin queue drill-ins on the exact blocker instead of a generic detail page", () => {
    expect(campaignsSource).toContain("getAdminCampaignAttentionItems");
    expect(campaignAttentionSource).toContain("?focus=reporting#admin-reporting-exceptions");
    expect(campaignAttentionSource).toContain("?focus=launch#admin-launch-readiness");
    expect(campaignAttentionSource).toContain('label: "Launch blocker"');
    expect(campaignAttentionSource).toContain("isServiceFeeBlockingLaunch");
    expect(revenueSource).toContain("#service-fees");

    expect(detailSource).toContain('type AdminCampaignFocus = "finance" | "launch" | "reporting" | null;');
    expect(detailSource).toContain("function getAdminCampaignFocus");
    expect(detailSource).toContain("data-testid=\"admin-campaign-focus-panel\"");
    expect(detailSource).toContain("id=\"admin-launch-readiness\"");
    expect(detailSource).toContain("id=\"admin-reporting-exceptions\"");
    expect(detailSource).toContain("data-testid=\"admin-reporting-exception-row\"");
    expect(detailSource).toContain("excuseAdminReportTask");
    expect(detailSource).toContain("data-testid=\"admin-reporting-excuse-form\"");
    expect(detailSource).toContain("data-testid=\"admin-reporting-excuse-reason\"");
    expect(detailSource).toContain("data-testid=\"admin-reporting-excuse-submit\"");
    expect(detailSource).toContain("name=\"excuse_reason\"");
    expect(detailSource).toContain("required");
    expect(detailSource).toContain("minLength={12}");
    expect(detailSource).toContain("Why can this missed report be excused?");
    expect(detailSource).toContain("Required for audit");
    expect(detailSource).toContain("Mark excused");
    expect(detailSource).toContain("review_note");
    expect(detailSource).toContain("getReportCorrectionEvidence");
    expect(detailSource).toContain("isEvidenceVisibleInReport");
    expect(detailSource).toContain("evidence.performance_id");
    expect(detailSource).toContain("data-testid=\"admin-reporting-correction-note\"");
    expect(detailSource).toContain("Review proof");
    expect(detailSource).toContain("?evidence=${correctionEvidence.id}&reportTask=${task.id}#report-evidence-trail");
    expect(detailSource).toContain("function isServiceFeeBlockingCampaign");
    expect(detailSource).toContain("const serviceFeeRequired = (campaign.service_fee_cents ?? 0) > 0");
    expect(detailSource).toContain('campaign.service_fee_status !== "paid"');
    expect(detailSource).toContain("Resolve service fee before sharing");
    expect(detailSource).toContain("blocks the invite link and launch actions");
    expect(detailSource).toContain("Review reporting exceptions");
    expect(detailSource).toContain("Reporting intervention trace");
    expect(detailSource).toContain("data-testid=\"admin-reporting-intervention-trace\"");
    expect(detailSource).toContain("data-testid=\"admin-reporting-intervention-row\"");
    expect(detailSource).toContain("data-testid=\"admin-reporting-intervention-reason\"");
    expect(detailSource).toContain("data-testid=\"admin-reporting-evidence-review-row\"");
    expect(detailSource).toContain("Proof awaiting brand review");
    expect(detailSource).toContain("Needs brand review");
    expect(detailSource).toContain("getCurrentAdminEvidenceReviewRows");
    expect(detailSource).toContain("currentPendingEvidenceReviewRows");
    expect(detailSource).toContain("Correction returned");
    expect(detailSource).toContain("Corrected proof awaiting brand review");
    expect(detailSource).toContain("replaced a rejected proof");
    expect(detailSource).toContain("Review returned correction");
    expect(detailSource).toContain("REVIEW_SLA_MS");
    expect(detailSource).toContain("isReportReviewSlaBreached");
    expect(detailSource).toContain("Review SLA breach");
    expect(detailSource).toContain("Proof review older than 24h");
    expect(detailSource).toContain("Ask the brand owner to review or intervene.");
    expect(detailSource).toContain("data-testid=\"admin-reporting-evidence-review-age\"");
    expect(detailSource).toContain("getReportInterventionReason");
    expect(detailSource).toContain("No reporting interventions recorded yet.");
    expect(detailSource).toContain("data-testid=\"admin-reporting-focus-label\"");
    expect(detailSource).toContain("data-testid=\"admin-reporting-brand-report-link\"");
    expect(detailSource).toContain("Failed report exports");
    expect(detailSource).toContain("Report export failed");
    expect(detailSource).toContain("retryAdminReportExportJob");
    expect(detailSource).toContain("data-testid=\"admin-reporting-export-failure-row\"");
    expect(detailSource).toContain("data-testid=\"admin-reporting-export-retry-form\"");
    expect(detailSource).toContain("name=\"report_export_job_id\"");
    expect(detailSource).toContain("Retry export");
    expect(detailSource).toContain("border-slate-200 bg-white px-2.5 text-xs");
    expect(detailSource).toContain("font-medium text-slate-700");
    expect(detailSource).toContain("inline-flex h-7 shrink-0 items-center justify-center rounded-lg");
    expect(detailSource).toContain("border border-slate-200 bg-white px-2.5 text-[0.8rem]");
    expect(detailSource).toContain("shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50");
    expect(detailSource).toContain("focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200");
    expect(detailSource).toContain('WebkitTextFillColor: "#0f172a"');
    expect(detailSource).toContain('outline: "none"');
    expect(detailSource).toContain('textDecoration: "none"');
    expect(detailSource).not.toContain('campaign.status === "draft" && campaign.service_fee_status !== "paid"');
    expect(detailSource).not.toContain('detail.campaign.status === "draft"');
    expect(detailSource).toContain("scroll-mt-24");
  });

  it("explains unsafe service-fee states inside the campaign drill-in", () => {
    expect(detailSource).toContain("service_fee_paid_at");
    expect(detailSource).toContain("service_fee_failed_at");
    expect(detailSource).toContain("service_fee_refunded_at");
    expect(detailSource).toContain("service_fee_disputed_at");
    expect(detailSource).toContain("const paymentExceptionStatuses = new Set<PaymentStatusType>");
    expect(detailSource).toContain("function isServiceFeeException");
    expect(detailSource).toContain("function getServiceFeeEventDate");
    expect(detailSource).toContain('data-testid="admin-campaign-finance-exception"');
    expect(detailSource).toContain('id="admin-finance-exception"');
    expect(detailSource).toContain('data-testid="admin-campaign-payment-lock-state"');
    expect(detailSource).toContain('data-testid="admin-campaign-payment-next-action"');
    expect(detailSource).toContain('data-testid="admin-campaign-payment-trace"');
    expect(detailSource).toContain("Creator and public access locked");
    expect(detailSource).toContain("Brand retry checkout");
    expect(detailSource).toContain("#admin-payment-trail");
  });
});
