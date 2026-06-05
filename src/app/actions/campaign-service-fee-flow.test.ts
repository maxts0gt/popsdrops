import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const campaignActionsSource = readFileSync(
  new URL("./campaigns.ts", import.meta.url),
  "utf8",
);
const lifecycleSource = readFileSync(
  new URL("../../lib/campaigns/lifecycle.ts", import.meta.url),
  "utf8",
);

describe("campaign service fee flow", () => {
  it("validates the PopsDrops fee obligation before publishing a campaign", () => {
    const launchSource = campaignActionsSource.slice(
      campaignActionsSource.indexOf("export async function launchCampaign"),
      campaignActionsSource.indexOf("export async function publishCampaign"),
    );

    expect(campaignActionsSource).toContain(
      "function assertCampaignHasServiceFeeObligation",
    );
    expect(launchSource).toContain(
      "service_fee_cents, service_fee_currency, service_fee_status, service_package_snapshot",
    );
    expect(launchSource).toContain("assertCampaignHasServiceFeeObligation(campaign)");
    expect(campaignActionsSource).toContain(
      'throw new Error("Campaign service fee is missing. Save a fresh draft before publishing.")',
    );
    expect(launchSource.indexOf("assertCampaignHasServiceFeeObligation(campaign)")).toBeLessThan(
      launchSource.indexOf('.update({ status: "recruiting"'),
    );
  });

  it("requires the private campaign fee to be paid before launch", () => {
    const launchSource = campaignActionsSource.slice(
      campaignActionsSource.indexOf("export async function launchCampaign"),
      campaignActionsSource.indexOf("export async function publishCampaign"),
    );

    expect(campaignActionsSource).toContain(
      "function assertCampaignServiceFeePaid",
    );
    expect(campaignActionsSource).toContain(
      'throw new Error("Pay the PopsDrops fee before launching this campaign.")',
    );
    expect(launchSource).toContain("assertCampaignHasServiceFeeObligation(campaign)");
    expect(launchSource).toContain("assertCampaignServiceFeePaid(campaign)");
    expect(launchSource.indexOf("assertCampaignServiceFeePaid(campaign)")).toBeLessThan(
      launchSource.indexOf("assertCampaignLaunchReadiness"),
    );
    expect(launchSource.indexOf("assertCampaignServiceFeePaid(campaign)")).toBeLessThan(
      launchSource.indexOf('.update({ status: "recruiting"'),
    );
  });

  it("delegates campaign fee Checkout creation to the Supabase Edge Function", () => {
    expect(campaignActionsSource).toContain(
      "export async function createCampaignServiceFeeCheckout",
    );
    expect(campaignActionsSource).toContain("supabase.functions.invoke");
    expect(campaignActionsSource).toContain(
      '"create-stripe-checkout-session"',
    );
    expect(campaignActionsSource).toContain("getAppBaseUrl()");
    expect(campaignActionsSource).not.toContain("getStripeServerClient");
    expect(campaignActionsSource).not.toContain("checkout.sessions.create");
    expect(campaignActionsSource).not.toContain("STRIPE_SECRET_KEY");
  });

  it("requires checkout to use the current paid scope from the service package snapshot", () => {
    expect(campaignActionsSource).toContain(
      "service_package_snapshot?.estimatedMaxCreators",
    );
    expect(campaignActionsSource).toContain(
      "service_package_snapshot?.estimatedActiveDays",
    );
    expect(campaignActionsSource).toContain(
      "service_package_snapshot?.estimatedReportingDays",
    );
    expect(campaignActionsSource).toContain("campaign.max_creators");
    expect(campaignActionsSource).toContain("checkoutPricingDays");
    expect(campaignActionsSource).toContain(
      'throw new Error("Campaign service fee is out of sync. Save the campaign scope before paying.")',
    );
  });

  it("stores new application deadlines at end of day so launch-day applications do not close at midnight", () => {
    const createSource = campaignActionsSource.slice(
      campaignActionsSource.indexOf("export async function createCampaign"),
      campaignActionsSource.indexOf("export async function updateCampaignLaunchSetup"),
    );

    expect(campaignActionsSource).toContain(
      "function normalizeApplicationDeadlineForStorage",
    );
    expect(campaignActionsSource).toContain('return `${dateKey}T23:59:59.999Z`;');
    expect(createSource).toContain("const campaignDataForInsert = {");
    expect(createSource).toContain(
      "application_deadline: normalizeApplicationDeadlineForStorage(campaignData.application_deadline)",
    );
    expect(createSource.indexOf("const campaignDataForInsert = {")).toBeLessThan(
      createSource.indexOf(".insert({"),
    );
    expect(createSource).toContain("...campaignDataForInsert");
  });

  it("lets brands increase private creator capacity and pay the remaining balance only", () => {
    expect(campaignActionsSource).toContain(
      "export async function updateCampaignCreatorCapacity",
    );
    expect(campaignActionsSource).toContain("campaignCreatorCapacityUpdateSchema");
    expect(campaignActionsSource).toContain("PRIVATE_CAMPAIGN_MAX_SELF_SERVE_CREATORS");
    expect(campaignActionsSource).toContain("campaign_payment_events");
    expect(campaignActionsSource).toContain("getCampaignServiceFeeBalance");
    expect(campaignActionsSource).toContain("acceptedCreatorCount");
    expect(campaignActionsSource).toContain(
      'throw new Error("Creator capacity cannot be lower than accepted creators.")',
    );
    expect(campaignActionsSource).toContain(
      'const nextServiceFeeStatus = balance.balanceDueCents === 0 ? "paid" : "pending"',
    );
    expect(campaignActionsSource).toContain("service_fee_status: nextServiceFeeStatus");
    expect(campaignActionsSource).toContain(
      "revalidatePath(`/b/campaigns/${parsed.data.campaignId}`)",
    );
  });

  it("keeps paid campaign scope changes inside draft or open recruiting", () => {
    const updateScopeSource = campaignActionsSource.slice(
      campaignActionsSource.indexOf("export async function updateCampaignCreatorCapacity"),
      campaignActionsSource.indexOf("export async function importCampaignCreatorInvites"),
    );

    expect(lifecycleSource).toContain(
      "function assertCampaignAllowsPaidScopeUpdate",
    );
    expect(lifecycleSource).toContain(
      'throw new Error("Campaign scope can only be changed before creator selection closes.")',
    );
    expect(updateScopeSource).toContain(".select(");
    expect(updateScopeSource).toContain("application_deadline");
    expect(updateScopeSource).toContain("content_due_date");
    expect(updateScopeSource).toContain(
      "assertCampaignAllowsPaidScopeUpdate(campaign);",
    );
    expect(updateScopeSource.indexOf("assertCampaignAllowsPaidScopeUpdate(campaign);")).toBeLessThan(
      updateScopeSource.indexOf("campaign_payment_events"),
    );
  });

  it("lets brands extend private campaign duration inside the paid scope", () => {
    const updateScopeSource = campaignActionsSource.slice(
      campaignActionsSource.indexOf("export async function updateCampaignCreatorCapacity"),
      campaignActionsSource.indexOf("export async function importCampaignCreatorInvites"),
    );

    expect(campaignActionsSource).toContain("activeDays");
    expect(campaignActionsSource).toContain("reportingDays");
    expect(campaignActionsSource).toContain("function addUtcDaysDateKey");
    expect(updateScopeSource).toContain("posting_window_end: nextPostingWindowEnd");
    expect(updateScopeSource).toContain("performance_due_date: nextPerformanceDueDate");
    expect(updateScopeSource).toContain("monitoring_end_date: nextPerformanceDueDate");
    expect(updateScopeSource).toContain("estimatedActiveDays");
    expect(updateScopeSource).toContain("estimatedReportingDays");
    expect(updateScopeSource).toContain(
      'throw new Error("Paid campaign duration cannot be reduced after payment.")',
    );
    expect(updateScopeSource).toContain(
      'throw new Error("Set the posting window before changing paid duration.")',
    );
  });


  it("keeps local checkout smoke completion explicitly dev-only", () => {
    expect(campaignActionsSource).toContain(
      "export async function markCampaignServiceFeePaidForDevSmoke",
    );
    expect(campaignActionsSource).toContain("assertDevOnlyServiceFeeSmoke()");
    expect(campaignActionsSource).toContain('process.env.NODE_ENV === "production"');
    expect(campaignActionsSource).toContain(
      'throw new Error("Dev payment completion is disabled in production.")',
    );
    expect(campaignActionsSource).toContain('service_fee_status: "paid"');
  });

  it("validates launch readiness before making a campaign public", () => {
    const launchSource = campaignActionsSource.slice(
      campaignActionsSource.indexOf("export async function launchCampaign"),
      campaignActionsSource.indexOf("export async function publishCampaign"),
    );
    const publishSource = campaignActionsSource.slice(
      campaignActionsSource.indexOf("export async function publishCampaign"),
      campaignActionsSource.indexOf("export async function completeCampaign"),
    );

    expect(campaignActionsSource).toContain("function assertCampaignLaunchReadiness");
    expect(launchSource).toContain("assertCampaignHasServiceFeeObligation(campaign)");
    expect(launchSource).toContain("assertCampaignLaunchReadiness");
    expect(launchSource).toContain('.from("campaign_assets")');
    expect(launchSource).toContain('.from("campaign_deliverables")');
    expect(launchSource).toContain('.from("campaign_reporting_requirements")');
    expect(launchSource).toContain('.from("campaign_agreements")');
    expect(campaignActionsSource).toContain(
      "Launch campaign is missing a creator-facing campaign image.",
    );
    expect(campaignActionsSource).toContain(
      "Launch campaign needs at least one deliverable.",
    );
    expect(campaignActionsSource).toContain(
      "Launch campaign needs at least one proof requirement.",
    );
    expect(campaignActionsSource).toContain(
      "Publish campaign rules before launching, or remove the signing gate.",
    );
    expect(publishSource).toContain("return launchCampaign(campaignId)");
  });

  it("does not expose an arbitrary campaign status mutation", () => {
    expect(campaignActionsSource).not.toContain(
      "export async function updateCampaignStatus",
    );
  });

  it("keeps launch setup fixes scoped to brand-owned draft campaigns", () => {
    const fixSource = campaignActionsSource.slice(
      campaignActionsSource.indexOf("export async function updateCampaignLaunchSetup"),
      campaignActionsSource.indexOf("export async function launchCampaign"),
    );

    expect(campaignActionsSource).toContain("const campaignLaunchSetupSchema");
    expect(fixSource).toContain(".eq(\"brand_id\", workspace.brandId)");
    expect(fixSource).toContain("assertBrandWorkspacePermission");
    expect(fixSource).toContain("\"manage_campaigns\"");
    expect(fixSource).toContain("campaign.status !== \"draft\"");
    expect(fixSource).toContain(".from(\"campaign_deliverables\")");
    expect(fixSource).toContain(".insert(");
    expect(fixSource).toContain("buildDefaultCampaignReportingRequirements");
    expect(fixSource).toContain("validateRequirementMetricKeys");
    expect(fixSource).toContain(".from(\"campaign_reporting_requirements\")");
    expect(fixSource).toContain("revalidatePath(`/b/campaigns/${parsed.data.campaignId}`)");
    expect(fixSource).toContain("revalidatePath(`/apply/${parsed.data.campaignId}`)");
  });

  it("guards campaign completion with closeout readiness before changing status", () => {
    const completeSource = campaignActionsSource.slice(
      campaignActionsSource.indexOf("export async function completeCampaign"),
      campaignActionsSource.indexOf("export async function updateCampaignDeadline"),
    );

    expect(campaignActionsSource).toContain("getCampaignCloseoutReadiness");
    expect(campaignActionsSource).toContain("assertCampaignCloseoutReadiness");
    expect(completeSource).toContain('.from("campaign_members")');
    expect(completeSource).toContain('.from("content_submissions")');
    expect(completeSource).toContain("parent_submission_id");
    expect(completeSource).toContain('.from("campaign_report_tasks")');
    expect(completeSource).toContain("assertCampaignCloseoutReadiness(closeoutReadiness)");
    expect(completeSource.indexOf("assertCampaignCloseoutReadiness(closeoutReadiness)")).toBeLessThan(
      completeSource.indexOf('status: "completed"'),
    );
    expect(completeSource).toContain('.eq("status", "monitoring")');
    expect(completeSource).toContain('.neq("status", "completed")');
    expect(completeSource).toContain('.select("id")');
    expect(completeSource).toContain('revalidatePath(`/i/campaigns/${campaignId}`)');
    expect(completeSource).toContain('revalidatePath("/i/campaigns")');
  });

  it("keeps application deadline edits inside draft or still-open recruiting campaigns", () => {
    const deadlineSource = campaignActionsSource.slice(
      campaignActionsSource.indexOf("export async function updateCampaignDeadline"),
      campaignActionsSource.indexOf("export async function sendCampaignAnnouncement"),
    );

    expect(lifecycleSource).toContain("function assertCampaignAllowsApplicationDeadlineUpdate");
    expect(lifecycleSource).toContain(
      'throw new Error("Application deadline can only be changed before recruiting closes.")',
    );
    expect(deadlineSource).toContain('.select("id, status, application_deadline, content_due_date")');
    expect(deadlineSource).toContain("assertCampaignAllowsApplicationDeadlineUpdate(campaign);");
    expect(deadlineSource.indexOf("assertCampaignAllowsApplicationDeadlineUpdate(campaign);")).toBeLessThan(
      deadlineSource.indexOf(".update({ application_deadline: normalizedDeadline })"),
    );
  });

  it("keeps edited application deadlines inside the campaign work timeline", () => {
    const deadlineSource = campaignActionsSource.slice(
      campaignActionsSource.indexOf("export async function updateCampaignDeadline"),
      campaignActionsSource.indexOf("export async function sendCampaignAnnouncement"),
    );

    expect(deadlineSource).toContain('.select("id, status, application_deadline, content_due_date")');
    expect(deadlineSource).toContain("assertApplicationDeadlineBeforeContentDueDate");
    expect(deadlineSource.indexOf("assertApplicationDeadlineBeforeContentDueDate")).toBeLessThan(
      deadlineSource.indexOf(".update({ application_deadline: normalizedDeadline })"),
    );
    expect(campaignActionsSource).toContain(
      'throw new Error("Applications must close on or before the content due date.")',
    );
  });

  it("keeps brand campaign updates inside active campaign stages", () => {
    const announcementSource = campaignActionsSource.slice(
      campaignActionsSource.indexOf("export async function sendCampaignAnnouncement"),
    );

    expect(lifecycleSource).toContain("function assertCampaignAllowsAnnouncement");
    expect(lifecycleSource).toContain(
      'throw new Error("Creator updates can only be sent while the campaign is active.")',
    );
    expect(announcementSource).toContain(".select(\"id, title, status\")");
    expect(announcementSource).toContain("assertCampaignAllowsAnnouncement(campaign);");
    expect(announcementSource.indexOf("assertCampaignAllowsAnnouncement(campaign);")).toBeLessThan(
      announcementSource.indexOf("createPrivilegedNotifications"),
    );
  });

  it("lets brands explicitly start creator work only after recruiting is resolved", () => {
    const startWorkSource = campaignActionsSource.slice(
      campaignActionsSource.indexOf("export async function startCampaignWork"),
      campaignActionsSource.indexOf("export async function completeCampaign"),
    );

    expect(lifecycleSource).toContain("function assertCampaignAllowsWorkStart");
    expect(lifecycleSource).toContain(
      'throw new Error("Campaign work can only start from recruiting.")',
    );
    expect(lifecycleSource).toContain(
      'throw new Error("Accept at least one creator before starting work.")',
    );
    expect(lifecycleSource).toContain(
      'throw new Error("Resolve pending applications before starting work.")',
    );
    expect(startWorkSource).toContain(".select(\"id, status, title\")");
    expect(startWorkSource).toContain(".eq(\"status\", \"recruiting\")");
    expect(startWorkSource).toContain(".from(\"campaign_members\")");
    expect(startWorkSource).toContain(".from(\"campaign_applications\")");
    expect(startWorkSource).toContain("assertCampaignAllowsWorkStart");
    expect(startWorkSource.indexOf("assertCampaignAllowsWorkStart")).toBeLessThan(
      startWorkSource.indexOf('status: "in_progress"'),
    );
    expect(startWorkSource).toContain("createPrivilegedNotifications");
    expect(startWorkSource).toContain('revalidatePath(`/i/campaigns/${campaignId}`)');
  });
});
