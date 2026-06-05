import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const stringsSource = readFileSync(
  new URL("../../../../../lib/i18n/strings.ts", import.meta.url),
  "utf8",
);
const englishBundle = readFileSync(
  new URL("../../../../../lib/i18n/generated/platform-bundles/en.json", import.meta.url),
  "utf8",
);
const designSource = readFileSync(
  new URL("../../../../../../DESIGN.md", import.meta.url),
  "utf8",
);

describe("brand campaign list operations flow", () => {
  it("loads report health so campaign managers see operational pressure before opening a campaign", () => {
    expect(source).toContain("interface CampaignReportHealth");
    expect(source).toContain("reportHealth: CampaignReportHealth");
    expect(source).toContain('.from("campaign_report_tasks")');
    expect(source).toContain('.from("content_performance_evidence")');
    expect(source).toContain('.from("content_performance")');
    expect(source).toContain("campaign_member_id, report_task_id, submission_id, performance_id, verification_status, created_at");
    expect(source).toContain("performanceRows");
    expect(source).toContain("buildCampaignReportHealth");
    expect(source).toContain("getBrandCampaignListHref");
    expect(source).toContain('data-testid="campaign-health-signals"');
    expect(source).toContain('t("health.missed"');
    expect(source).toContain('t("health.corrections"');
  });

  it("surfaces Enterprise Concierge requests so custom-scope campaigns do not disappear after request", () => {
    expect(source).toContain("interface EnterpriseConciergeRequest");
    expect(source).toContain("EnterpriseConciergeRequestsPanel");
    expect(source).toContain('.from("enterprise_concierge_requests")');
    expect(source).toContain("quoted_service_fee_cents");
    expect(source).toContain('data-testid="enterprise-concierge-requests"');
    expect(source).toContain('id="enterprise-concierge-requests"');
    expect(source).toContain('t("concierge.status.quoted"');
    expect(source).toContain("function getConciergeRequestTypeLabel");
    expect(source).toContain('t("concierge.type.privateCapacity")');
    expect(source).toContain('t("concierge.type.sourcing")');
    expect(stringsSource).toContain('"concierge.type.privateCapacity": "Private capacity review"');
    expect(stringsSource).toContain('"concierge.type.sourcing": "Concierge sourcing"');
  });

  it("uses an operational command-center list instead of the deprecated campaign card grid", () => {
    expect(source).toContain("CampaignOperationsSummary");
    expect(source).toContain('data-testid="campaign-operations-summary"');
    expect(source).toContain('data-testid="campaign-row"');
    expect(source).toContain('data-testid="campaign-row-action-label"');
    expect(source).toContain("{nextAction.label}");
    expect(source).toContain('t("summary.needsAttention"');
    expect(source).toContain('t("nextAction.reviewReports"');
    expect(source).not.toContain("sm:grid-cols-2");
  });

  it("shows payment required on recruiting campaigns before inviting creators", () => {
    expect(source).toContain("service_fee_cents: number | null");
    expect(source).toContain("service_fee_currency: string | null");
    expect(source).toContain("service_fee_status: PaymentStatusType");
    expect(source).toContain("service_package_snapshot: Record<string, unknown> | null");
    expect(source).toContain(
      ".select(\"id, title, status, platforms, markets, max_creators, budget_max, service_fee_cents, service_fee_currency, service_fee_status, service_package_snapshot, created_at\")",
    );
    expect(source).toContain("const serviceFeeRequired = (campaign.service_fee_cents ?? 0) > 0");
    expect(source).toContain('campaign.service_fee_status !== "paid"');
    expect(source.indexOf('t("nextAction.payFee"')).toBeLessThan(
      source.indexOf('t("nextAction.inviteCreators"'),
    );
    expect(source).toContain('data-testid="campaign-payment-required"');
    expect(stringsSource).toContain('"nextAction.payFee": "Pay fee"');
    expect(stringsSource).toContain(
      '"nextAction.payFee.detail": "Unlocks invite link."',
    );
    expect(stringsSource).toContain('"health.paymentRequired": "Payment required"');
    expect(englishBundle).toContain('"nextAction.payFee": "Pay fee"');
    expect(englishBundle).toContain(
      '"nextAction.payFee.detail": "Unlocks invite link."',
    );
    expect(englishBundle).toContain('"health.paymentRequired": "Payment required"');
  });

  it("shows upgraded campaign balance due instead of a vague payment required badge", () => {
    expect(source).toContain("function getCampaignServiceFeeBalanceDueCents");
    expect(source).toContain('"balanceDueCents"');
    expect(source).toContain("const balanceDueCents = getCampaignServiceFeeBalanceDueCents(campaign)");
    expect(source).toContain("const balanceDueDisplay = formatCurrencyCents(");
    expect(source).toContain('data-testid="campaign-payment-balance-due"');
    expect(source).toContain('t("health.balanceDue", { amount: balanceDueDisplay })');
    expect(source).toContain('t("nextAction.payFee.detailAmount", { amount: balanceDueDisplay })');
    expect(stringsSource).toContain('"health.balanceDue": "Balance due {amount}"');
    expect(stringsSource).toContain('"nextAction.payFee.detailAmount": "{amount} due before invites."');
    expect(englishBundle).toContain('"health.balanceDue": "Balance due {amount}"');
    expect(englishBundle).toContain('"nextAction.payFee.detailAmount": "{amount} due before invites."');
  });

  it("treats payment gates as attention and sorts the campaign list by operational urgency", () => {
    expect(source).toContain("function campaignNeedsAttention");
    expect(source).toContain("campaigns.filter(campaignNeedsAttention).length");
    expect(source).toContain("function getCampaignOperationalPriority");
    expect(source).toContain("function sortCampaignsForOperations");
    expect(source).toContain("const sortedCampaigns = useMemo");
    expect(source).toContain("items={sortedCampaigns}");
    expect(source).toContain('sortCampaignsForOperations(byStatus("recruiting"))');
    expect(stringsSource).toContain('"summary.needsAttention.detail": "need action"');
    expect(englishBundle).toContain('"summary.needsAttention.detail": "need action"');
    expect(stringsSource).not.toContain("campaigns with blockers");
    expect(stringsSource).not.toContain("checkout clears");
    expect(source.indexOf("reportHealth.corrections > 0")).toBeLessThan(
      source.indexOf("isCampaignServiceFeeUnpaid(campaign)"),
    );
  });

  it("keeps campaign creation affordances hidden from read-only viewers", () => {
    expect(source).toContain("hasBrandWorkspacePermission");
    expect(source).toContain("canCreateCampaigns");
    expect(source).toContain('teamSettings.currentUserRole');
    expect(source).toContain('"create_campaigns"');
    expect(source).toContain("{canCreateCampaigns && (");
  });

  it("shows compact responsibility owners on campaign rows so teams can scan accountability before opening work", () => {
    expect(source).toContain("interface CampaignResponsibilityAssignmentRow");
    expect(source).toContain("interface CampaignResponsibilitySummary");
    expect(source).toContain("brandTeamMemberId: string | null");
    expect(source).toContain("responsibilities: CampaignResponsibilitySummary[]");
    expect(source).toContain("const teamMembersById = new Map(");
    expect(source).toContain("buildCampaignResponsibilitySummaries");
    expect(source).toContain("const visibleResponsibilities = campaign.responsibilities.filter(");
    expect(source).toContain("const responsibilityChips = visibleResponsibilities.length > 0");
    expect(source).toContain('.from("campaign_responsibility_assignments")');
    expect(source).toContain(
      '.select("id, campaign_id, brand_team_member_id, responsibility")',
    );
    expect(source).toContain("responsibilityRows: (responsibilityRows ?? [])");
    expect(source).toContain('data-testid="campaign-list-responsibilities"');
    expect(source).toContain('data-testid={`campaign-list-responsibility-${responsibility.kind}`}');
    expect(source).toContain('t("responsibility.title")');
    expect(source).toContain('t("responsibility.unassigned")');
    expect(source).toContain('t("responsibility.noneAssigned")');
    expect(stringsSource).toContain('"responsibility.title": "Owners"');
    expect(stringsSource).toContain('"responsibility.reporting": "Reporting"');
    expect(stringsSource).toContain('"responsibility.unassigned": "Unassigned"');
    expect(stringsSource).toContain('"responsibility.noneAssigned": "No owners"');
    expect(englishBundle).toContain('"responsibility.title": "Owners"');
    expect(englishBundle).toContain('"responsibility.reporting": "Reporting"');
    expect(englishBundle).toContain('"responsibility.unassigned": "Unassigned"');
    expect(englishBundle).toContain('"responsibility.noneAssigned": "No owners"');
    expect(designSource).toContain(
      "Campaign list responsibility visibility is a scan aid",
    );
  });

  it("lets managers filter campaign operations by their responsibilities or ownerless work", () => {
    expect(source).toContain('type CampaignWorkFilter = "all" | "mine" | "needs_owner"');
    expect(source).toContain("function campaignHasAssignedResponsibility");
    expect(source).toContain("function campaignHasResponsibilityForMember");
    expect(source).toContain("function filterCampaignsByWork");
    expect(source).toContain("const [workFilter, setWorkFilter] = useState<CampaignWorkFilter>(\"all\")");
    expect(source).toContain("const [currentBrandTeamMemberId, setCurrentBrandTeamMemberId] = useState<string | null>(null)");
    expect(source).toContain("teamSettings.members.find(");
    expect(source).toContain("setCurrentBrandTeamMemberId(currentTeamMember?.id ?? null)");
    expect(source).toContain("const visibleCampaigns = useMemo(");
    expect(source).toContain("filterCampaignsByWork({");
    expect(source).toContain("const myWorkCampaigns = filterCampaignsByWork({");
    expect(source).toContain("const ownerlessCampaigns = filterCampaignsByWork({");
    expect(source).toContain("CampaignWorkFilterBar");
    expect(source).toContain('data-testid="campaign-work-filter"');
    expect(source).toContain('testId: "campaign-work-filter-mine"');
    expect(source).toContain('testId: "campaign-work-filter-needs-owner"');
    expect(source).not.toContain("border-slate-900 bg-slate-900 text-white");
    expect(source).toContain("items={sortedCampaigns}");
    expect(source).toContain('t("workFilter.mine")');
    expect(source).toContain('t("workFilter.needsOwner")');
    expect(stringsSource).toContain('"workFilter.all": "All work"');
    expect(stringsSource).toContain('"workFilter.mine": "My work"');
    expect(stringsSource).toContain('"workFilter.needsOwner": "Needs owner"');
    expect(englishBundle).toContain('"workFilter.all": "All work"');
    expect(englishBundle).toContain('"workFilter.mine": "My work"');
    expect(englishBundle).toContain('"workFilter.needsOwner": "Needs owner"');
    expect(designSource).toContain(
      "Responsibility filters should route work",
    );
    expect(designSource).toContain(
      "Responsibility filters stay helper-weight",
    );
  });
});
