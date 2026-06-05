import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const creativeKitPanelSource = readFileSync(
  new URL("../../../../../../components/campaigns/brand-creative-kit-panel.tsx", import.meta.url),
  "utf8",
);
const healthItemsSource = source.slice(
  source.indexOf("const healthItems = ["),
  source.indexOf("];", source.indexOf("const healthItems = [")) + 2,
);
const nextActionPresentationSource = source.slice(
  source.indexOf("const nextActionPresentation"),
  source.indexOf("const handoffStagePresentation"),
);
const stringsSource = readFileSync(
  new URL("../../../../../../../src/lib/i18n/strings.ts", import.meta.url),
  "utf8",
);
const platformEnglishBundleSource = readFileSync(
  new URL(
    "../../../../../../../src/lib/i18n/generated/platform-bundles/en.json",
    import.meta.url,
  ),
  "utf8",
);
const platformBundleDir = new URL(
  "../../../../../../../src/lib/i18n/generated/platform-bundles/",
  import.meta.url,
);
const platformBundleFiles = readdirSync(platformBundleDir).filter((fileName) =>
  fileName.endsWith(".json"),
);
const designSource = readFileSync(
  new URL("../../../../../../../DESIGN.md", import.meta.url),
  "utf8",
);

describe("brand campaign workspace flow", () => {
  it("keeps the creators workspace scoped to pending applications", () => {
    expect(source).toContain(
      'const pendingApps = applications.filter((a) => a.status === "pending");',
    );
    expect(source).toContain("{pendingApps.length === 0 ? (");
    expect(source).toContain("{sortedPendingApps.map((app) => {");
    expect(source).toContain('value="creators"');
    expect(source).toContain("{pendingApps.length + members.length}");
    expect(source).not.toContain(
      '{t("tab.applicants")} ({applications.length})',
    );
    expect(source).not.toContain("{applications.length === 0 ? (");
    expect(source).not.toContain("{applications.map((app) => {");
  });

  it("prioritizes useful creator work over empty applicant space", () => {
    const creatorsSource = source.slice(
      source.indexOf('<TabsContent value="creators"'),
      source.indexOf('<TabsContent value="content"'),
    );

    expect(source).toContain("const shouldPrioritizeApplicants = pendingApps.length > 0");
    expect(creatorsSource).toContain('data-testid="campaign-creators-section-members"');
    expect(creatorsSource).toContain('data-testid="campaign-creators-section-applicants"');
    expect(creatorsSource).toContain('data-testid="campaign-creators-empty-note"');
    expect(source).toContain("shouldPrioritizeApplicants ? (");
    expect(creatorsSource).not.toContain('border border-dashed border-border py-12 text-center');
  });

  it("renders pending applicants as a compact sortable worklist", () => {
    const creatorsSource = source.slice(
      source.indexOf('<TabsContent value="creators"'),
      source.indexOf('<TabsContent value="content"'),
    );
    const applicantsSource = creatorsSource.slice(
      creatorsSource.indexOf('data-testid="campaign-creators-section-applicants"'),
      creatorsSource.indexOf('data-testid="campaign-creators-section-members"'),
    );

    expect(source).toContain("type ApplicantSortKey =");
    expect(source).toContain("function ApplicantSortableHead");
    expect(source).toContain("const sortedPendingApps =");
    expect(source).toContain("const handleApplicantSort = useCallback");
    expect(source).toContain('data-testid="campaign-applicants-sort-header"');
    expect(applicantsSource).toContain('data-testid="campaign-applicants-table"');
    expect(applicantsSource).toContain('data-testid="campaign-applicant-action"');
    expect(applicantsSource).toContain('className="flex min-w-[244px] flex-nowrap gap-1.5"');
    expect(applicantsSource).toContain('data-testid="campaign-applicant-pitch"');
    expect(applicantsSource).toContain("{sortedPendingApps.map((app) => {");
    expect(applicantsSource).not.toContain('<th className="pb-3 pe-4 text-start">{t("applicants.pitch")}</th>');
    expect(applicantsSource).not.toContain('<Card key={app.id}>');
    expect(designSource).toContain(
      "Pending applicant review is an operational table, not a stack of profile cards.",
    );
  });

  it("lets managers make bulk applicant decisions inside paid capacity", () => {
    const creatorsSource = source.slice(
      source.indexOf('<TabsContent value="creators"'),
      source.indexOf('<TabsContent value="content"'),
    );
    const applicantsSource = creatorsSource.slice(
      creatorsSource.indexOf('data-testid="campaign-creators-section-applicants"'),
      creatorsSource.indexOf('data-testid="campaign-creators-section-members"'),
    );

    expect(source).toContain("acceptApplicationsBatch");
    expect(source).toContain("rejectApplicationsBatch");
    expect(source).toContain("selectedApplicantIds");
    expect(source).toContain("selectedApplicantsOverCapacity");
    expect(source).toContain("handleBulkAcceptApplicants");
    expect(source).toContain("handleBulkRejectApplicants");
    expect(applicantsSource).toContain('data-testid="campaign-applicant-bulk-toolbar"');
    expect(applicantsSource).toContain('data-testid="campaign-applicant-select-all"');
    expect(applicantsSource).toContain('data-testid="campaign-applicant-select"');
    expect(applicantsSource).toContain('data-testid="campaign-applicant-bulk-accept"');
    expect(applicantsSource).toContain('data-testid="campaign-applicant-bulk-decline"');
    expect(applicantsSource).toContain('t("applicants.bulk.selectUpTo"');
    expect(stringsSource).toContain('"applicants.bulk.selected": "{count} selected"');
    expect(stringsSource).toContain('"applicants.bulk.openSeats": "{count} open seats"');
    expect(platformEnglishBundleSource).toContain('"applicants.bulk.accept": "Accept selected"');
    expect(designSource).toContain(
      "Bulk applicant decisions must remain seat-aware and reversible before submission.",
    );
  });

  it("locks applicant decisions outside the recruiting window", () => {
    const creatorsSource = source.slice(
      source.indexOf('<TabsContent value="creators"'),
      source.indexOf('<TabsContent value="content"'),
    );
    const applicantsSource = creatorsSource.slice(
      creatorsSource.indexOf('data-testid="campaign-creators-section-applicants"'),
      creatorsSource.indexOf('data-testid="campaign-creators-section-members"'),
    );

    expect(source).toContain("const campaignAcceptsApplicationDecisions =");
    expect(source).toContain("canCampaignAcceptApplicationDecision(campaign)");
    expect(source).toContain("campaignAcceptsApplicationDecisions");
    expect(source).toContain("setSelectedApplicantIds([]);");
    expect(source).toContain('t("applicants.closedStage")');
    expect(applicantsSource).toContain(
      "pendingApps.length > 0 && canManageCampaigns && campaignAcceptsApplicationDecisions",
    );
    expect(applicantsSource).toContain(
      "canManageCampaigns && campaignAcceptsApplicationDecisions",
    );
    expect(applicantsSource).toContain('t("applicants.closedAction")');
    expect(stringsSource).toContain(
      '"applicants.closedStage": "Applications are closed for this campaign stage."',
    );
    expect(platformEnglishBundleSource).toContain(
      '"applicants.closedAction": "Closed"',
    );
  });

  it("refreshes campaign data after accepting an application", () => {
    expect(source).toContain("const loadCampaignWorkspace = useCallback(");
    expect(source).toContain("await loadCampaignWorkspace();");
  });

  it("keeps the members table sortable and labels the review action column", () => {
    expect(source).toContain("type MemberSortKey =");
    expect(source).toContain("function MemberSortableHead");
    expect(source).toContain('data-testid="campaign-members-sort-header"');
    expect(source).toContain("aria-sort=");
    expect(source).toContain("const sortedMembers =");
    expect(source).toContain("filteredMembers.map((m) => {");
    expect(source).toContain('{t("members.review")}');
  });

  it("keeps accepted creator member rows compact and operational", () => {
    const creatorsSource = source.slice(
      source.indexOf('<TabsContent value="creators"'),
      source.indexOf('<TabsContent value="content"'),
    );
    const membersSource = creatorsSource.slice(
      creatorsSource.indexOf('data-testid="campaign-creators-section-members"'),
      creatorsSource.indexOf("</TabsContent>"),
    );

    expect(source).toContain("function MemberStatusCell");
    expect(membersSource).toContain('data-testid="campaign-members-table"');
    expect(membersSource).toContain('data-testid="campaign-member-row"');
    expect(membersSource).toContain('data-testid="campaign-member-operation-actions"');
    expect(membersSource).toContain('className="mt-2 flex min-w-[224px] flex-nowrap gap-1.5"');
    expect(membersSource).toContain('<MemberStatusCell');
    expect(membersSource).toContain('testId="campaign-member-payment-status"');
    expect(membersSource).toContain("<FileText");
    expect(membersSource).not.toContain("<MessageCircle");
    expect(membersSource).not.toContain("<Star");
    expect(designSource).toContain(
      "Accepted creator rows must use one status-cell language across agreement, report, proof, and payment.",
    );
  });

  it("lets managers track creator payment status from the accepted creators table", () => {
    const creatorsSource = source.slice(
      source.indexOf('<TabsContent value="creators"'),
      source.indexOf('<TabsContent value="content"'),
    );
    const membersSource = creatorsSource.slice(
      creatorsSource.indexOf('data-testid="campaign-creators-section-members"'),
      creatorsSource.indexOf("</TabsContent>"),
    );

    expect(source).toContain("updateCampaignMemberPaymentStatus");
    expect(source).toContain("const memberPaymentStatuses");
    expect(source).toContain("handleMemberPaymentStatusChange");
    expect(membersSource).toContain('data-testid="campaign-member-payment-status-select"');
    expect(membersSource).toContain("campaign-member-payment-status-option-");
    expect(membersSource).toContain("handleMemberPaymentStatusChange(");
    expect(membersSource).toContain("status as PaymentStatusType");
    expect(membersSource).toContain('aria-label={t("members.paymentTrackingOnly")}');
    expect(stringsSource).toContain('"members.paymentTrackingOnly": "Payment status only"');
    expect(platformEnglishBundleSource).toContain('"members.paymentTrackingOnly": "Payment status only"');
    expect(designSource).toContain(
      "Creator payment controls are tracking only.",
    );
  });

  it("lets managers run selected accepted-creator operations without leaving the roster", () => {
    const creatorsSource = source.slice(
      source.indexOf('<TabsContent value="creators"'),
      source.indexOf('<TabsContent value="content"'),
    );
    const membersSource = creatorsSource.slice(
      creatorsSource.indexOf('data-testid="campaign-creators-section-members"'),
      creatorsSource.indexOf("</TabsContent>"),
    );

    expect(source).toContain("updateCampaignMemberPaymentStatuses");
    expect(source).toContain("requestMissedReportFollowUpsBatch");
    expect(source).toContain("selectedMemberIds");
    expect(source).toContain("memberBulkPaymentStatus");
    expect(source).toContain("selectedMissedReportTaskIds");
    expect(source).toContain("handleBulkMemberPaymentStatus");
    expect(source).toContain("handleBulkMissedReportFollowUp");
    expect(membersSource).toContain('data-testid="campaign-member-bulk-toolbar"');
    expect(membersSource).toContain('data-testid="campaign-member-select-all"');
    expect(membersSource).toContain('data-testid="campaign-member-select"');
    expect(membersSource).toContain('data-testid="campaign-member-bulk-payment-select"');
    expect(membersSource).toContain('data-testid="campaign-member-bulk-payment-save"');
    expect(membersSource).toContain('data-testid="campaign-member-bulk-follow-up"');
    expect(stringsSource).toContain('"members.bulk.selected": "{count} selected"');
    expect(stringsSource).toContain('"members.bulk.missedProof": "{count} missed proof"');
    expect(platformEnglishBundleSource).toContain('"members.bulk.applyPayment": "Apply payment"');
    expect(designSource).toContain(
      "Bulk accepted-creator operations must stay attached to the roster.",
    );
  });

  it("disables bulk missed-proof follow-up outside proof review stages", () => {
    const disabledSource = source.slice(
      source.indexOf("const memberBulkFollowUpDisabled ="),
      source.indexOf("const sortedPendingApps", source.indexOf("const memberBulkFollowUpDisabled =")),
    );

    expect(disabledSource).toContain("const memberBulkFollowUpDisabled =");
    expect(disabledSource).toContain("!campaignAcceptsProofReviewDecisions ||");
    expect(source).toContain(
      "canReviewCampaignContent && campaignAcceptsProofReviewDecisions",
    );
  });

  it("lets managers filter accepted creator rosters before bulk actions", () => {
    const creatorsSource = source.slice(
      source.indexOf('<TabsContent value="creators"'),
      source.indexOf('<TabsContent value="content"'),
    );
    const membersSource = creatorsSource.slice(
      creatorsSource.indexOf('data-testid="campaign-creators-section-members"'),
      creatorsSource.indexOf("</TabsContent>"),
    );
    const filtersIndex = membersSource.indexOf('testId="campaign-member-roster-filters"');
    const bulkIndex = membersSource.indexOf('data-testid="campaign-member-bulk-toolbar"');

    expect(source).toContain("type MemberRosterFilter =");
    expect(source).toContain("memberRosterQuery");
    expect(source).toContain("memberRosterFilter");
    expect(source).toContain("memberRosterFilterOptions");
    expect(source).toContain("filteredMembers");
    expect(source).toContain("handleMemberRosterFilterChange");
    expect(source).toContain("handleMemberRosterQueryChange");
    expect(filtersIndex).toBeGreaterThanOrEqual(0);
    expect(bulkIndex).toBeGreaterThan(filtersIndex);
    expect(membersSource).toContain('data-testid="campaign-member-roster-search"');
    expect(membersSource).toContain('testId="campaign-member-roster-filters"');
    expect(source).toContain('"campaign-member-roster-filter-needs_attention"');
    expect(source).toContain('"campaign-member-roster-filter-missed_proof"');
    expect(source).toContain('"campaign-member-roster-filter-payment_open"');
    expect(source).toContain("filteredMembers.map((m) => {");
    expect(source).toContain("const visibleIds = filteredMembers.map((member) => member.id);");
    expect(source).toContain("setSelectedMemberIds([]);");
    expect(membersSource).toContain('t("members.emptyFiltered")');
    expect(stringsSource).toContain('"members.searchPlaceholder": "Search accepted creators"');
    expect(stringsSource).toContain('"members.filter.needsAttention": "Needs attention"');
    expect(stringsSource).toContain('"members.filter.missedProof": "Missed proof"');
    expect(stringsSource).toContain('"members.filter.paymentOpen": "Payment open"');
    expect(platformEnglishBundleSource).toContain('"members.filter.paymentOpen": "Payment open"');
    expect(designSource).toContain(
      "Accepted creator roster filters stay local to the roster.",
    );
  });

  it("separates requested billing scope from usable paid creator capacity", () => {
    expect(source).toContain("requestedCreatorCapacity");
    expect(source).toContain("paidCreatorCapacity");
    expect(source).toContain('"paidCreatorCapacity"');
    expect(source).toContain('"estimatedMaxCreators"');
    expect(stringsSource).toContain('"serviceFee.scope.creatorCapacity": "Creator capacity"');

    const billingScopeSource = source.slice(
      source.indexOf('data-testid="campaign-billing-scope"'),
      source.indexOf('data-testid="campaign-billing-scope-separate-costs"'),
    );

    expect(billingScopeSource).toContain("serviceFee.scope.creatorCapacity");
    expect(billingScopeSource).toContain("{requestedCreatorCapacity}");
    expect(billingScopeSource).not.toContain("{includedCreatorCount}");
    expect(source).toContain(
      'serviceFeeBalanceDueCents === 0 || campaign.service_fee_status === "paid"',
    );
    expect(source).toContain("? requestedCreatorCapacity");
    expect(source).toContain("creatorCapacityOpenSeats = Math.max(paidCreatorCapacity - members.length, 0)");
    expect(source).toContain("selectedCreatorCapacity !== requestedCreatorCapacity");
  });

  it("lets managers upgrade paid creator capacity and pay only the remaining balance", () => {
    const billingScopeSource = source.slice(
      source.indexOf('data-testid="campaign-billing-scope"'),
      source.indexOf('data-testid="campaign-billing-scope-separate-costs"'),
    );

    expect(source).toContain("updateCampaignCreatorCapacity");
    expect(source).toContain("const creatorCapacityPresets = [10, 50, 100] as const");
    expect(source).toContain("handleCreatorCapacityUpdate");
    expect(source).toContain('"balanceDueCents"');
    expect(source).toContain("serviceFeePaymentDueDisplay");
    expect(source).toContain("selectedCreatorCapacityTotalDisplay");
    expect(source).toContain("selectedCreatorCapacityPaidDisplay");
    expect(source).toContain("selectedCreatorCapacityBalanceDisplay");
    expect(source).toContain('t("serviceFee.payAmount", { amount: serviceFeePaymentDueDisplay })');
    expect(billingScopeSource).toContain('data-testid="campaign-capacity-upgrade-control"');
    expect(billingScopeSource).toContain('data-testid="campaign-capacity-price-preview"');
    expect(billingScopeSource).toContain('serviceFee.capacityControl.detail');
    expect(billingScopeSource).toContain('serviceFee.capacityPreview.total');
    expect(billingScopeSource).toContain('serviceFee.capacityPreview.paidCredit');
    expect(billingScopeSource).toContain('serviceFee.capacityPreview.balance');
    expect(billingScopeSource).toContain(
      'data-testid={`campaign-capacity-option-${option.count}`}',
    );
    expect(billingScopeSource).toContain('data-testid="campaign-capacity-save"');
    expect(billingScopeSource).toContain('serviceFee.scope.balanceDue');
    expect(billingScopeSource).toContain("!scopeChanged");
    expect(stringsSource).toContain('"serviceFee.scope.balanceDue": "Balance due"');
    expect(stringsSource).toContain(
      '"serviceFee.capacityControl.detail": "Base includes 10 creators. Each extra 10 seats adds $49."',
    );
    expect(stringsSource).toContain('"serviceFee.capacityPreview.total": "Total fee"');
    expect(stringsSource).toContain('"serviceFee.capacityPreview.paidCredit": "Paid credit"');
    expect(stringsSource).toContain('"serviceFee.capacityPreview.balance": "Balance after update"');
    expect(stringsSource).toContain('"serviceFee.capacitySavedToast": "Campaign scope updated."');
    expect(stringsSource).toContain(
      '"serviceFee.capacityBalanceToast": "Scope updated. Pay the remaining fee before launch."',
    );
    expect(platformEnglishBundleSource).toContain('"serviceFee.scope.balanceDue": "Balance due"');
    expect(platformEnglishBundleSource).toContain(
      '"serviceFee.capacityBalanceToast": "Scope updated. Pay the remaining fee before launch."',
    );
  });

  it("locks paid scope controls when creator selection is closed", () => {
    const billingScopeSource = source.slice(
      source.indexOf('data-testid="campaign-billing-scope"'),
      source.indexOf('data-testid="campaign-billing-scope-separate-costs"'),
    );

    expect(source).toContain("const campaignAllowsPaidScopeUpdate =");
    expect(source).toContain('campaign.status === "draft" || campaign.status === "recruiting"');
    expect(source).toContain("!applicationDeadlinePassed");
    expect(source).toContain("campaignAllowsPaidScopeUpdate &&");
    expect(billingScopeSource).toContain('data-testid="campaign-capacity-closed-note"');
    expect(billingScopeSource).toContain('t("serviceFee.capacityClosed")');
    expect(stringsSource).toContain(
      '"serviceFee.capacityClosed": "Creator scope is locked once creator selection closes."',
    );
    expect(platformEnglishBundleSource).toContain(
      '"serviceFee.capacityClosed": "Creator scope is locked once creator selection closes."',
    );
  });

  it("lets managers scale creator seats and campaign duration in one paid scope control", () => {
    const billingScopeSource = source.slice(
      source.indexOf('data-testid="campaign-billing-scope"'),
      source.indexOf('data-testid="campaign-billing-scope-separate-costs"'),
    );

    expect(source).toContain("selectedActiveDays");
    expect(source).toContain("selectedReportingDays");
    expect(source).toContain("activeDayScopeOptions");
    expect(source).toContain("reportingDayScopeOptions");
    expect(source).toContain("scopeChanged");
    expect(source).toContain("activeDays: selectedActiveDays");
    expect(source).toContain("reportingDays: selectedReportingDays");
    expect(billingScopeSource).toContain('data-testid="campaign-active-days-options"');
    expect(billingScopeSource).toContain('data-testid={`campaign-active-days-option-${option}`}');
    expect(billingScopeSource).toContain('data-testid="campaign-reporting-days-options"');
    expect(billingScopeSource).toContain('data-testid={`campaign-reporting-days-option-${option}`}');
    expect(billingScopeSource).toContain('serviceFee.capacityControl.durationDetail');
    expect(billingScopeSource).toContain('serviceFee.scope.selectedActiveDays');
    expect(billingScopeSource).toContain('serviceFee.scope.selectedReportingDays');
    expect(stringsSource).toContain(
      '"serviceFee.capacityControl.durationDetail": "Longer campaign and proof windows update the same paid scope."',
    );
    expect(stringsSource).toContain('"serviceFee.capacityUpdate": "Update scope"');
    expect(stringsSource).toContain('"serviceFee.capacityCurrent": "Current scope"');
    expect(stringsSource).toContain(
      '"serviceFee.capacitySavedToast": "Campaign scope updated."',
    );
    expect(platformEnglishBundleSource).toContain(
      '"serviceFee.capacityControl.durationDetail": "Longer campaign and proof windows update the same paid scope."',
    );
  });

  it("surfaces high-volume creator operations before roster tables", () => {
    const creatorsSource = source.slice(
      source.indexOf('<TabsContent value="creators"'),
      source.indexOf('<TabsContent value="content"'),
    );
    const operationsIndex = creatorsSource.indexOf(
      'data-testid="campaign-creator-operations-board"',
    );
    const applicantsIndex = creatorsSource.indexOf(
      'data-testid="campaign-creators-section-applicants"',
    );
    const membersIndex = creatorsSource.indexOf(
      'data-testid="campaign-creators-section-members"',
    );

    expect(source).toContain("const creatorCapacityOpenSeats =");
    expect(source).toContain("const creatorCapacityUsedPercent =");
    expect(source).toContain("const creatorOperations =");
    expect(operationsIndex).toBeGreaterThanOrEqual(0);
    expect(operationsIndex).toBeLessThan(applicantsIndex);
    expect(operationsIndex).toBeLessThan(membersIndex);
    expect(creatorsSource).toContain(
      'data-testid={`campaign-creator-operation-${operation.key}`}',
    );
    expect(creatorsSource).toContain('data-testid="campaign-creator-capacity-bar"');
    expect(creatorsSource).toContain('"campaign-creator-open-seats"');
    expect(source).toContain("creatorOps.accepted");
    expect(source).toContain("creatorOps.openSeats");
    expect(source).toContain("creatorOps.pendingReview");
    expect(source).toContain("creatorOps.needsAttention");
    expect(stringsSource).toContain('"creatorOps.title": "Creator operations"');
    expect(platformEnglishBundleSource).toContain('"creatorOps.openSeats": "Open seats"');
    expect(designSource).toContain(
      "High-volume creator workspaces must expose accepted capacity, open seats, pending applicants, and blocked proof work before tables.",
    );
  });

  it("shows a scale readiness verdict before creator operations detail", () => {
    const creatorsSource = source.slice(
      source.indexOf('<TabsContent value="creators"'),
      source.indexOf('<TabsContent value="content"'),
    );
    const scaleIndex = creatorsSource.indexOf(
      'data-testid="campaign-creator-scale-readiness"',
    );
    const operationsIndex = creatorsSource.indexOf(
      'data-testid="campaign-creator-operations-board"',
    );

    expect(source).toContain("const creatorScaleReadiness =");
    expect(source).toContain("const creatorScaleReadinessItems =");
    expect(source).toContain("creatorInvites.length");
    expect(source).toContain("inviteListStatusCounts.queued");
    expect(source).toContain("inviteListStatusCounts.manual");
    expect(source).toContain("creatorPaymentOpenCount");
    expect(source).toContain("creatorNeedsAttention");
    expect(scaleIndex).toBeGreaterThanOrEqual(0);
    expect(scaleIndex).toBeLessThan(operationsIndex);
    expect(creatorsSource).toContain(
      'data-scale-readiness-state={creatorScaleReadiness.state}',
    );
    expect(creatorsSource).toContain('data-testid="campaign-creator-scale-rail"');
    expect(creatorsSource).toContain(
      'data-testid={`campaign-creator-scale-rail-${item.key}`}',
    );
    expect(creatorsSource.indexOf('data-testid="campaign-creator-scale-rail"')).toBeLessThan(
      creatorsSource.indexOf('data-testid={`campaign-creator-scale-readiness-${item.key}`}'),
    );
    expect(creatorsSource).toContain(
      'data-testid={`campaign-creator-scale-readiness-${item.key}`}',
    );
    expect(source).toContain("creatorScale.ready");
    expect(source).toContain("creatorScale.review");
    expect(source).toContain("creatorScale.blocked");
    expect(source).toContain("creatorScale.invitePipeline");
    expect(source).toContain("creatorScale.paymentExposure");
    expect(source).toContain("creatorScale.proofPressure");
    expect(stringsSource).toContain('"creatorScale.title": "Scale readiness"');
    expect(stringsSource).toContain('"creatorScale.ready": "Ready to operate"');
    expect(stringsSource).toContain('"creatorScale.review": "Review before scaling"');
    expect(stringsSource).toContain('"creatorScale.blocked": "Action needed before scaling"');
    expect(platformEnglishBundleSource).toContain('"creatorScale.invitePipeline": "Invite pipeline"');
  });

  it("summarizes accepted creator report readiness before roster filtering", () => {
    const creatorsSource = source.slice(
      source.indexOf('<TabsContent value="creators"'),
      source.indexOf('<TabsContent value="content"'),
    );
    const membersSource = creatorsSource.slice(
      creatorsSource.indexOf('data-testid="campaign-creators-section-members"'),
      creatorsSource.indexOf("</TabsContent>"),
    );
    const readinessIndex = membersSource.indexOf(
      'data-testid="campaign-member-report-readiness"',
    );
    const filtersIndex = membersSource.indexOf(
      'testId="campaign-member-roster-filters"',
    );
    const bulkIndex = membersSource.indexOf(
      'data-testid="campaign-member-bulk-toolbar"',
    );

    expect(source).toContain("function isMemberOperationsReportReady");
    expect(source).toContain("function isMemberOperationsReviewOpen");
    expect(source).toContain("const memberReportReadiness =");
    expect(source).toContain("memberReportReadiness.map((item) => (");
    expect(source).toContain('data-testid={`campaign-member-report-readiness-${item.key}`}');
    expect(source).toContain("members.reportReadiness.ready");
    expect(source).toContain("members.reportReadiness.review");
    expect(source).toContain("members.reportReadiness.missed");
    expect(source).toContain("members.reportReadiness.paymentOpen");
    expect(readinessIndex).toBeGreaterThanOrEqual(0);
    expect(filtersIndex).toBeGreaterThan(readinessIndex);
    expect(bulkIndex).toBeGreaterThan(filtersIndex);
    expect(stringsSource).toContain('"members.reportReadiness.title": "Report readiness"');
    expect(stringsSource).toContain('"members.reportReadiness.ready": "Ready"');
    expect(stringsSource).toContain('"members.reportReadiness.review": "To review"');
    expect(stringsSource).toContain('"members.reportReadiness.missed": "Missed proof"');
    expect(stringsSource).toContain('"members.reportReadiness.paymentOpen": "Payment open"');
    expect(platformEnglishBundleSource).toContain('"members.reportReadiness.title": "Report readiness"');
    expect(designSource).toContain(
      "Accepted creator report readiness is visible before roster filters.",
    );
  });

  it("shows a compact campaign responsibility panel for brand teams", () => {
    const overviewSource = source.slice(
      source.indexOf('<TabsContent value="overview"'),
      source.indexOf('<TabsContent value="brief"'),
    );

    expect(source).toContain("type CampaignResponsibilityKind =");
    expect(source).toContain("updateCampaignResponsibility");
    expect(source).toContain("const campaignResponsibilitySlots");
    expect(source).toContain("handleCampaignResponsibilityChange");
    expect(source).toContain("responsibilityAssignments");
    expect(source).toContain("teamMembers");
    expect(overviewSource).toContain('data-testid="campaign-responsibility-panel"');
    expect(overviewSource).toContain('data-testid={`campaign-responsibility-slot-${slot.kind}`}');
    expect(overviewSource).toContain('data-testid={`campaign-responsibility-select-${slot.kind}`}');
    expect(overviewSource).toContain('data-testid={`campaign-responsibility-assignee-${slot.kind}`}');
    expect(stringsSource).toContain('"responsibility.title": "Campaign responsibilities"');
    expect(stringsSource).toContain('"responsibility.owner": "Owner"');
    expect(stringsSource).toContain('"responsibility.approvals": "Approvals"');
    expect(stringsSource).toContain('"responsibility.reporting": "Reporting"');
    expect(stringsSource).toContain('"responsibility.billing": "Billing"');
    expect(platformEnglishBundleSource).toContain('"responsibility.title": "Campaign responsibilities"');
    expect(designSource).toContain(
      "Campaign responsibility is a compact accountability panel, not a project-management board.",
    );
  });

  it("surfaces responsibility owners beside content and reporting work queues", () => {
    const contentSource = source.slice(
      source.indexOf('<TabsContent value="content"'),
      source.indexOf('<TabsContent value="reporting"'),
    );
    const reportingSource = source.slice(
      source.indexOf('<TabsContent value="reporting"'),
      source.indexOf("</TabsContent>", source.indexOf('<TabsContent value="reporting"')),
    );

    expect(source).toContain("function getCampaignResponsibilityOwnerName");
    expect(source).toContain("function WorkstreamOwnerChip");
    expect(source).toContain("data-testid={testId}");
    expect(source).toContain("const approvalsOwnerName = getCampaignResponsibilityOwnerName");
    expect(source).toContain("const reportingOwnerName = getCampaignResponsibilityOwnerName");
    expect(contentSource).toContain('testId="campaign-content-approval-owner"');
    expect(contentSource).toContain('workstreamLabel={t("responsibility.approvals")}');
    expect(reportingSource).toContain('testId="campaign-reporting-owner"');
    expect(reportingSource).toContain('testId="campaign-reporting-proof-queue-owner"');
    expect(reportingSource).toContain('workstreamLabel={t("responsibility.reporting")}');
    expect(stringsSource).toContain('"responsibility.workstreamOwner": "Owner"');
    expect(platformEnglishBundleSource).toContain('"responsibility.workstreamOwner": "Owner"');
    expect(designSource).toContain(
      "Workstream owner chips belong beside the queue they route.",
    );
  });

  it("lets workstream owners filter content and reporting queues without making another board", () => {
    const contentSource = source.slice(
      source.indexOf('<TabsContent value="content"'),
      source.indexOf('<TabsContent value="reporting"'),
    );
    const reportingSource = source.slice(
      source.indexOf('<TabsContent value="reporting"'),
      source.indexOf("</TabsContent>", source.indexOf('<TabsContent value="reporting"')),
    );

    expect(source).toContain("type ContentQueueFilter =");
    expect(source).toContain("type ReportingQueueFilter =");
    expect(source).toContain("function QueueFilterBar");
    expect(source).toContain("const [contentQueueFilter, setContentQueueFilter]");
    expect(source).toContain("const [reportingQueueFilter, setReportingQueueFilter]");
    expect(source).toContain("const currentUserOwnsApprovals =");
    expect(source).toContain("const currentUserOwnsReporting =");
    expect(source).toContain("const contentQueueFilterCounts =");
    expect(source).toContain("const reportingQueueFilterCounts =");
    expect(source).toContain("const filteredSubmissions =");
    expect(source).toContain("const filteredReportingQueueRows =");
    expect(contentSource).toContain('testId="campaign-content-queue-filters"');
    expect(source).toContain('"campaign-content-queue-filter-my_work"');
    expect(source).toContain('"campaign-content-queue-filter-needs_review"');
    expect(contentSource).toContain("{sortedFilteredSubmissions.map((cs) => {");
    expect(contentSource).toContain('t("queueFilter.emptyContent")');
    expect(reportingSource).toContain('testId="campaign-reporting-proof-filters"');
    expect(source).toContain('"campaign-reporting-proof-filter-my_work"');
    expect(source).toContain('"campaign-reporting-proof-filter-missed"');
    expect(reportingSource).toContain("{sortedFilteredReportingQueueRows.map((row) => {");
    expect(reportingSource).toContain('t("queueFilter.emptyReporting")');
    expect(stringsSource).toContain('"queueFilter.all": "All"');
    expect(stringsSource).toContain('"queueFilter.myWork": "My work"');
    expect(stringsSource).toContain('"queueFilter.needsReview": "Needs review"');
    expect(platformEnglishBundleSource).toContain('"queueFilter.myWork": "My work"');
    expect(designSource).toContain(
      "Queue filters stay local to content and reporting worklists.",
    );
  });

  it("lets managers paste a private invite list without becoming a creator CRM", () => {
    const creatorsSource = source.slice(
      source.indexOf('<TabsContent value="creators"'),
      source.indexOf('<TabsContent value="content"'),
    );

    expect(source).toContain("parseCreatorInviteImport({");
    expect(source).toContain("reservedContacts: creatorInvites");
    expect(source).toContain('invite.status !== "sent"');
    expect(source).toContain("importCampaignCreatorInvites");
    expect(source).toContain("sendCampaignCreatorInvite");
    expect(source).toContain("removeCampaignCreatorInvite");
    expect(source).toContain("const inviteImportOverCapacityCount =");
    expect(source).toContain("const inviteImportSuggestedCapacity =");
    expect(source).toContain("creatorInviteImportPreview.summary.openSeats");
    expect(source).toContain("const [inviteListQuery, setInviteListQuery]");
    expect(source).toContain("const [inviteListStatusFilter, setInviteListStatusFilter]");
    expect(source).toContain("const filteredCreatorInvites =");
    expect(source).toContain("function handleInviteCapacityReview()");
    expect(source).toContain("function handleSendSavedCreatorInvite(");
    expect(source).toContain("function handleRemoveSavedCreatorInvite(");
    expect(source).toContain(
      "value: inviteImportSuggestedCapacity",
    );
    expect(creatorsSource).toContain('data-testid="campaign-creator-invite-import"');
    expect(creatorsSource).toContain('data-testid="campaign-invite-import-textarea"');
    expect(creatorsSource).toContain('data-testid="campaign-invite-import-submit"');
    expect(creatorsSource).toContain('data-testid="campaign-invite-import-summary"');
    expect(creatorsSource).toContain('data-testid="campaign-invite-import-over-capacity"');
    expect(creatorsSource).toContain('data-testid="campaign-invite-import-capacity-warning"');
    expect(creatorsSource).toContain('data-testid="campaign-invite-import-review-capacity"');
    expect(creatorsSource).toContain('data-testid="campaign-invite-list-search"');
    expect(creatorsSource).toContain('data-testid="campaign-invite-list-filter"');
    expect(creatorsSource).toContain('data-testid="campaign-invite-row"');
    expect(creatorsSource).toContain('data-testid="campaign-invite-send"');
    expect(creatorsSource).toContain('data-testid="campaign-invite-remove"');
    expect(creatorsSource).toContain('["manual", "failed"].includes(invite.status)');
    expect(creatorsSource).toContain('invite.status === "failed"');
    expect(creatorsSource).toContain("creatorCapacityOpenSeats");
    expect(creatorsSource).toContain("canShareInviteLink");
    expect(stringsSource).toContain('"inviteImport.title": "Invite list"');
    expect(stringsSource).toContain('"inviteImport.detail": "Paste creator emails or @handles from a spreadsheet, comma list, or one per line. Emails can be queued; handles stay as manual outreach."');
    expect(stringsSource).toContain('"inviteImport.capacityWarning": "Extra contacts: {count}. Review {capacity}-creator capacity before saving the full list."');
    expect(stringsSource).toContain('"inviteImport.reviewCapacity": "Review capacity"');
    expect(stringsSource).toContain('"inviteImport.search": "Search saved invites"');
    expect(stringsSource).toContain('"inviteImport.filter.all": "All contacts"');
    expect(stringsSource).toContain('"inviteImport.sendSaved": "Send"');
    expect(stringsSource).toContain('"inviteImport.sendAgain": "Retry email"');
    expect(stringsSource).toContain('"inviteImport.remove": "Remove"');
    expect(stringsSource).toContain('"inviteImport.status.sent": "Applied"');
    expect(platformEnglishBundleSource).toContain('"inviteImport.ready": "Ready to invite"');
    expect(platformEnglishBundleSource).toContain('"inviteImport.reviewCapacity": "Review capacity"');
    expect(platformEnglishBundleSource).toContain('"inviteImport.search": "Search saved invites"');
    expect(platformEnglishBundleSource).toContain('"inviteImport.status.sent": "Applied"');
    expect(designSource).toContain(
      "Bulk creator intake must stay a lightweight import tray, not a CRM.",
    );
    expect(designSource).toContain(
      "If a pasted invite list exceeds open seats, keep the user inside the same flow.",
    );
    expect(designSource).toContain(
      "Saved invite lists need lightweight row controls.",
    );
  });

  it("keeps creator invites lifecycle-aware in the brand cockpit", () => {
    const creatorsSource = source.slice(
      source.indexOf('<TabsContent value="creators"'),
      source.indexOf('<TabsContent value="content"'),
    );

    expect(source).toContain("const creatorInvitesAreManageable =");
    expect(source).toContain("const creatorInvitesAreSendable =");
    expect(source).toContain("const applicationDeadlinePassed =");
    expect(source).toContain('campaign.status === "draft" || campaign.status === "recruiting"');
    expect(source).toContain('campaign.status === "recruiting"');
    expect(source).toContain("canShareInviteLink && creatorInvitesAreSendable");
    expect(creatorsSource).toContain("creatorInvitesAreManageable");
    expect(creatorsSource).toContain("creatorInvitesAreSendable");
    expect(creatorsSource).toContain('t("inviteImport.closed")');
    expect(source).toContain("const creatorInviteReadOnlyStatusKeys");
    expect(creatorsSource).toContain(
      "creatorInvitesAreManageable ? creatorInviteStatusKeys : creatorInviteReadOnlyStatusKeys",
    );
    expect(stringsSource).toContain('"inviteImport.closed": "Creator invites are closed for this campaign stage."');
    expect(stringsSource).toContain('"inviteImport.statusReadOnly.queued": "Queued before close"');
    expect(stringsSource).toContain('"inviteImport.statusReadOnly.manual": "Saved before close"');
    expect(platformEnglishBundleSource).toContain('"inviteImport.closed": "Creator invites are closed for this campaign stage."');
    expect(platformEnglishBundleSource).toContain('"inviteImport.statusReadOnly.queued": "Queued before close"');

    for (const bundleFile of platformBundleFiles) {
      const bundleSource = readFileSync(new URL(bundleFile, platformBundleDir), "utf8");

      expect(bundleSource, bundleFile).toContain('"inviteImport.statusReadOnly.manual"');
      expect(bundleSource, bundleFile).toContain('"inviteImport.statusReadOnly.queued"');
      expect(bundleSource, bundleFile).toContain('"inviteImport.statusReadOnly.sent"');
      expect(bundleSource, bundleFile).toContain('"inviteImport.statusReadOnly.failed"');
    }
  });

  it("names why brand invite management is closed", () => {
    const creatorsSource = source.slice(
      source.indexOf('<TabsContent value="creators"'),
      source.indexOf('<TabsContent value="content"'),
    );

    expect(source).toContain("getCampaignApplicationClosedReason");
    expect(source).toContain("brandInviteClosedDetailKeys");
    expect(source).toContain("const creatorInviteClosedReason = campaign");
    expect(source).toContain("const creatorInviteClosedDetailKey =");
    expect(creatorsSource).toContain("t(creatorInviteClosedDetailKey)");
    expect(stringsSource).toContain('"inviteImport.closedDetail.deadline": "The application deadline has passed; saved outreach stays visible for audit."');
    expect(stringsSource).toContain('"inviteImport.closedDetail.workStarted": "Creator selection is closed because campaign work has started."');
    expect(stringsSource).toContain('"inviteImport.closedDetail.paused": "Creator invites are paused until the campaign resumes."');
    expect(stringsSource).toContain('"inviteImport.closedDetail.completed": "Campaign is complete; saved outreach stays visible for audit."');
    expect(stringsSource).toContain('"inviteImport.closedDetail.cancelled": "Campaign was cancelled; saved outreach stays visible for audit."');
    expect(platformEnglishBundleSource).toContain('"inviteImport.closedDetail.deadline": "The application deadline has passed; saved outreach stays visible for audit."');
  });

  it("loads report task and proof state into the campaign workspace", () => {
    expect(source).toContain("interface ReportTaskRow");
    expect(source).toContain("interface EvidenceRow");
    expect(source).toContain("const [reportTasks, setReportTasks]");
    expect(source).toContain("const [evidenceRows, setEvidenceRows]");
    expect(source).toContain('.from("campaign_report_tasks")');
    expect(source).toContain('.from("content_performance_evidence")');
    expect(source).toContain(".eq(\"campaign_id\", campaignId)");
  });

  it("shows campaign reporting operations without sending managers to the report page first", () => {
    expect(source).toContain("const reportingOperations =");
    expect(source).toContain('data-testid="campaign-reporting-operations"');
    expect(source).toContain('data-testid="campaign-reporting-operation-card"');
    expect(source).toContain("const hasActionableWork = operation.actionCount > 0");
    expect(source).toContain("hasActionableWork &&");
    expect(source).toContain("reporting.cleared");
    expect(source).toContain("reporting.toReview");
    expect(source).toContain("reporting.corrections");
    expect(source).toContain("reporting.missed");
    expect(source).toContain("reporting.clearedWaitingDetail");
  });

  it("shows the campaign reporting cadence as dated brand-side work", () => {
    const reportingSource = source.slice(
      source.indexOf('<TabsContent value="reporting"'),
      source.indexOf("</TabsContent>", source.indexOf('<TabsContent value="reporting"')),
    );

    expect(source).toContain("task_key: string");
    expect(source).toContain("period_start: string | null");
    expect(source).toContain("period_end: string | null");
    expect(source).toContain(
      '.select("id, campaign_member_id, task_key, period_start, period_end, due_at, status, submitted_at, review_note, missed_at, excused_at")',
    );
    expect(source).toContain("formatBrandReportTaskWindow");
    expect(source).toContain("formatBrandReportTaskCount");
    expect(source).toContain("getBrandReportTaskLabelKey");
    expect(source).toContain('if (taskKey.startsWith("extra:")) return "reporting.scheduleKind.extra";');
    expect(reportingSource).toContain('data-testid="campaign-reporting-schedule"');
    expect(reportingSource).toContain('data-testid="campaign-reporting-schedule-item"');
    expect(reportingSource).toContain("reportTasks.map");
    expect(reportingSource).toContain("overflow-x-auto");
    expect(stringsSource).toContain('"reporting.scheduleTitle": "Reporting schedule"');
    expect(stringsSource).toContain('"reporting.scheduleDetail": "Dated proof reads across accepted creators."');
    expect(stringsSource).toContain('"reporting.scheduleCountSingular": "1 read"');
    expect(stringsSource).toContain('"reporting.scheduleKind.extra": "Extra read"');
    expect(platformEnglishBundleSource).toContain('"reporting.scheduleTitle": "Reporting schedule"');
    expect(designSource).toContain(
      "Brand reporting tabs must show the campaign cadence as dated work.",
    );
  });

  it("uses brand-side report review copy when proof is already waiting on the manager", () => {
    expect(stringsSource).toContain('"reporting.toReviewDetail": "Needs brand review"');
    expect(stringsSource).not.toContain('"reporting.toReviewDetail": "Proof waiting"');
    expect(platformEnglishBundleSource).toContain('"reporting.toReviewDetail": "Needs brand review"');
    expect(platformEnglishBundleSource).not.toContain('"reporting.toReviewDetail": "Proof waiting"');
  });

  it("adds sortable report and proof columns to the members table", () => {
    expect(source).toContain('"report" | "proof"');
    expect(source).toContain("getMemberOperations(");
    expect(source).toContain('sortKey="report"');
    expect(source).toContain('sortKey="proof"');
    expect(source).toContain('{t("members.report")}');
    expect(source).toContain('{t("members.proof")}');
    expect(source).toContain('testId="campaign-member-report-status"');
    expect(source).toContain('testId="campaign-member-proof-status"');
  });

  it("turns report operation signals into manager workflow actions", () => {
    const reportingOperationRenderSource = source.slice(
      source.indexOf("{reportingOperations.map((operation) => {"),
      source.indexOf("<Card data-testid=\"campaign-reporting-proof-queue\">"),
    );

    expect(source).toContain("const activeTab = getCampaignDetailTabFromSearchParams(searchParams)");
    expect(source).toContain("handleOperationCardClick");
    expect(source).toContain('value={activeTab}');
    expect(source).toContain('onValueChange={handleCampaignTabChange}');
    expect(source).toContain('handleCampaignTabChange("reporting")');
    expect(source).toContain('setReportingQueueFilter("needs_review")');
    expect(source).toContain('setReportingQueueFilter("corrections")');
    expect(source).toContain('setReportingQueueFilter("missed")');
    expect(source).toContain('setScrollTargetTestId("campaign-reporting-proof-queue")');
    expect(source).toContain('operation.key === "corrections"');
    expect(reportingOperationRenderSource).not.toContain(
      'href={`/b/campaigns/${campaign.id}/report`}',
    );
  });

  it("keeps the invite strip out of the command center until sharing is the next job", () => {
    expect(source).toContain("const shouldShowInviteStrip =");
    expect(source).toContain("canShareInviteLink ||");
    expect(source).toContain('nextAction.kind === "invite_creators"');
    expect(source).toContain("Boolean(inviteLifecycleClosedReason)");
    expect(source).toContain("{shouldShowInviteStrip && (");
  });

  it("keeps completed campaign invite history read-only instead of almost actionable", () => {
    const inviteImportSource = source.slice(
      source.indexOf('<Card data-testid="campaign-creator-invite-import">'),
      source.indexOf('<section', source.indexOf('<Card data-testid="campaign-creator-invite-import">')),
    );

    expect(source).toContain("creatorInvitesAreManageable");
    expect(inviteImportSource).toContain('"inviteImport.readOnly"');
    expect(inviteImportSource).toContain('t("inviteImport.closedClean")');
    expect(inviteImportSource).toContain('t("inviteImport.closedAction")');
    expect(inviteImportSource).toContain('"inviteImport.savedClosedDetail"');
    expect(inviteImportSource).toContain("creatorInvitesAreManageable && (");
    expect(stringsSource).toContain('"inviteImport.closedAction": "Closed"');
    expect(platformEnglishBundleSource).toContain('"inviteImport.closedAction": "Closed"');
  });

  it("gives paused and cancelled campaigns read-only cockpit states instead of invite actions", () => {
    expect(nextActionPresentationSource).toContain("campaign_paused:");
    expect(nextActionPresentationSource).toContain('labelKey: "cockpit.campaignPaused"');
    expect(nextActionPresentationSource).toContain("campaign_cancelled:");
    expect(nextActionPresentationSource).toContain('labelKey: "cockpit.campaignCancelled"');
    expect(stringsSource).toContain('"cockpit.campaignPaused": "Campaign paused"');
    expect(stringsSource).toContain('"cockpit.campaignCancelled": "Campaign cancelled"');
    expect(platformEnglishBundleSource).toContain(
      '"cockpit.campaignPaused": "Campaign paused"',
    );
    expect(platformEnglishBundleSource).toContain(
      '"cockpit.campaignCancelled": "Campaign cancelled"',
    );

    for (const bundleFile of platformBundleFiles) {
      const bundleSource = readFileSync(new URL(bundleFile, platformBundleDir), "utf8");
      expect(bundleSource, bundleFile).toContain('"cockpit.campaignPaused"');
      expect(bundleSource, bundleFile).toContain('"cockpit.campaignCancelled"');
    }
  });

  it("lets brand managers mark a missed report as excused from the members table", () => {
    expect(source).toContain("markReportTaskExcused");
    expect(source).toContain("handleExcuseReportTask");
    expect(source).toContain("operations?.reportStatus === \"missed\"");
    expect(source).toContain('data-testid="campaign-member-excuse-report"');
    expect(source).toContain('t("reportStatus.markExcused")');
  });

  it("lets brand managers send one missed-report follow-up from the members table", () => {
    expect(source).toContain("requestMissedReportFollowUp");
    expect(source).toContain("handleRequestReportFollowUp");
    expect(source).toContain('data-testid="campaign-member-follow-up-report"');
    expect(source).toContain('t("reportStatus.followUp")');
    expect(source).toContain('t("reportStatus.followUpSentToast")');
  });

  it("lets brand managers recover missed reports from the reporting proof queue", () => {
    const reportingQueueSource = source.slice(
      source.indexOf('<Card data-testid="campaign-reporting-proof-queue">'),
      source.indexOf("</tbody>", source.indexOf('<Card data-testid="campaign-reporting-proof-queue">')),
    );

    expect(reportingQueueSource).toContain('row.task.status === "missed"');
    expect(reportingQueueSource).toContain('data-testid="campaign-reporting-follow-up-missed"');
    expect(reportingQueueSource).toContain('data-testid="campaign-reporting-mark-excused"');
    expect(reportingQueueSource).toContain("handleRequestReportFollowUp(row.task.id)");
    expect(reportingQueueSource).toContain("handleExcuseReportTask(row.task.id)");
  });

  it("names late report proof as submitted late instead of hiding it behind generic review copy", () => {
    expect(source).toContain('task.status === "submitted_late"');
    expect(source).toContain('t("reportStatus.submittedLate")');
    expect(stringsSource).toContain('"reportStatus.submittedLate": "Submitted late"');
    expect(platformEnglishBundleSource).toContain('"reportStatus.submittedLate": "Submitted late"');
  });

  it("keeps verified late proof visible in the reporting proof queue", () => {
    const reportingQueueSource = source.slice(
      source.indexOf("const statusPresentationByState"),
      source.indexOf("const evidenceLabel", source.indexOf("const statusPresentationByState")),
    );

    expect(source).toContain("function isReportTaskLate");
    expect(reportingQueueSource).toContain("isReportTaskLate(task)");
    expect(reportingQueueSource).toContain('t("reportStatus.verifiedLate")');
    expect(stringsSource).toContain('"reportStatus.verifiedLate": "Verified late"');
  });

  it("treats creator resubmitted correction proof as the current proof state", () => {
    expect(source).toContain("getCurrentEvidenceReviewStatuses");
    expect(source).toContain("evidence.verification_status as EvidenceReviewStatus");
    expect(source).toContain("const currentEvidenceStatuses = getCurrentEvidenceReviewStatuses(");
    expect(source).toContain("currentEvidenceStatuses.some((status) => status === \"submitted\")");
    expect(source).toContain("const hasCorrectionReturned =");
    expect(source).toContain('label: t("reportStatus.correctionReturned")');
    expect(stringsSource).toContain('"reportStatus.correctionReturned": "Correction returned"');
    expect(platformEnglishBundleSource).toContain('"reportStatus.correctionReturned": "Correction returned"');
  });

  it("shows campaign agreement setup and sortable member signature status", () => {
    expect(source).toContain("BrandAgreementPanel");
    expect(source).toContain("AgreementStatusCell");
    expect(source).toContain("agreementStatusRows");
    expect(source).toContain(".from(\"campaign_member_agreement_status\")");
    expect(source).toContain('sortKey="agreement"');
    expect(source).toContain('{t("members.agreement")}');
  });

  it("puts creator-facing Creative Kit setup in the brand campaign workspace", () => {
    expect(source).toContain("BrandCreativeKitPanel");
    expect(source).toContain("type CampaignCreativeAsset");
    expect(source).toContain("const [creativeAssets, setCreativeAssets]");
    expect(source).toContain('.from("campaign_assets")');
    expect(creativeKitPanelSource).toContain('data-testid="brand-creative-kit-panel"');
    expect(creativeKitPanelSource).toContain('href={`/i/discover/${campaignId}`}');
    expect(creativeKitPanelSource).not.toContain(
      'render={<Link href={`/i/discover/${campaignId}`}',
    );
  });

  it("shows launch readiness before setup panels so managers know if the invite is safe to share", () => {
    const readinessIndex = source.indexOf('data-testid="campaign-launch-readiness"');
    const agreementIndex = source.indexOf("<BrandAgreementPanel");

    expect(readinessIndex).toBeGreaterThan(-1);
    expect(agreementIndex).toBeGreaterThan(-1);
    expect(readinessIndex).toBeLessThan(agreementIndex);
    expect(source).toContain("launchReadinessItems");
    expect(source).toContain('data-testid="campaign-launch-readiness-item"');
    expect(source).toContain('href={`/apply/${campaign.id}`}');
    expect(source).not.toContain('render={<Link href={`/apply/${campaign.id}`}');
    expect(source).toContain('t("launchReadiness.title")');
    expect(source).toContain('t("launchReadiness.ready")');
    expect(source).toContain('t("launchReadiness.needsWork"');
  });

  it("uses real links for report and preview helper actions outside the command center", () => {
    const commandCenterSource = source.slice(
      source.indexOf('data-testid="campaign-command-center"'),
      source.indexOf('data-testid="campaign-detail-tabs"'),
    );

    expect(source).toContain('href={`/b/campaigns/${campaign.id}/report`}');
    expect(source).toContain('href={`/apply/${campaign.id}`}');
    expect(commandCenterSource).not.toContain("href={nextActionHref}");
    expect(commandCenterSource).not.toContain("inline-flex h-7 items-center justify-center");
  });

  it("bases launch readiness on creator image, brief, deliverables, reporting proof, rules, and invite link", () => {
    expect(source).toContain("interface DeliverableRow");
    expect(source).toContain("interface CampaignReportingRequirementRow");
    expect(source).toContain("const [deliverables, setDeliverables]");
    expect(source).toContain("const [reportingRequirements, setReportingRequirements]");
    expect(source).toContain('.from("campaign_deliverables")');
    expect(source).toContain('.from("campaign_reporting_requirements")');
    expect(source).toContain('t("launchReadiness.image")');
    expect(source).toContain('t("launchReadiness.brief")');
    expect(source).toContain('t("launchReadiness.deliverables")');
    expect(source).toContain('t("launchReadiness.reporting")');
    expect(source).toContain('t("launchReadiness.rules")');
    expect(source).toContain('t("launchReadiness.invite")');
  });

  it("lets brand managers choose required creator proof fields before work starts", () => {
    const briefSource = source.slice(
      source.indexOf('<TabsContent value="brief"'),
      source.indexOf('<TabsContent value="creators"'),
    );

    expect(source).toContain("updateCampaignReportingRequirement");
    expect(source).toContain("getReportingMetricTemplate");
    expect(source).toContain("required_metric_keys");
    expect(source).toContain("reportingMetricDrafts");
    expect(source).toContain("handleReportingRequirementUpdate");
    expect(source).toContain("canEditReportingRequirements");
    expect(briefSource).toContain('data-testid="campaign-reporting-config"');
    expect(briefSource).toContain('data-testid="campaign-reporting-requirement-card"');
    expect(briefSource).toContain('data-testid="campaign-reporting-metric-toggle"');
    expect(briefSource).toContain('data-testid="campaign-reporting-requirement-save"');
    expect(stringsSource).toContain('"reportingConfig.title": "Proof fields"');
    expect(platformEnglishBundleSource).toContain('"reportingConfig.save": "Save proof fields"');
  });

  it("turns launch readiness into the draft campaign launch action", () => {
    const readinessSource = source.slice(
      source.indexOf('data-testid="campaign-launch-readiness"'),
      source.indexOf("<BrandAgreementPanel"),
    );

    expect(source).toContain("launchCampaign");
    expect(source).toContain("async function handleLaunchCampaign");
    expect(source).toContain('const isDraftCampaign = campaign.status === "draft"');
    expect(source).toContain("const canLaunchCampaign =");
    expect(source).toContain("canManageCampaigns &&");
    expect(source).toContain("isDraftCampaign &&");
    expect(source).toContain("launchReadinessBlockers === 0 &&");
    expect(readinessSource).toContain('data-testid="campaign-launch-action"');
    expect(readinessSource).toContain('onClick={handleLaunchCampaign}');
    expect(readinessSource).toContain("disabled={!canLaunchCampaign || actionLoading === \"launch\"}");
    expect(readinessSource).toContain('t("launchReadiness.launch")');
    expect(readinessSource).toContain('t("launchReadiness.preview")');
    expect(readinessSource).toContain('isDraftCampaign ? (');
  });

  it("gates launch and invite sharing on paid private campaign fees", () => {
    const readinessSource = source.slice(
      source.indexOf('data-testid="campaign-launch-readiness"'),
      source.indexOf("<BrandAgreementPanel"),
    );
    const inviteCardSource = source.slice(
      source.indexOf("function InviteLinkCard"),
      source.indexOf("function ReportingQueueSortableHead"),
    );

    expect(source).toContain(
      'const serviceFeeIsPaid = campaign?.service_fee_status === "paid"',
    );
    expect(source).toContain("const canLaunchCampaign =");
    expect(source).toContain("const canShareInviteLink =");
    expect(source).toContain("canManageCampaigns &&");
    expect(source).toContain("launchReadinessBlockers === 0 &&");
    expect(source).toContain("serviceFeeIsPaid &&");
    expect(source).toContain("!isDraftCampaign");
    expect(source).toContain("createCampaignServiceFeeCheckout");
    expect(source).toContain("const handleServiceFeeCheckout = useCallback(async () =>");
    expect(source).toContain('const checkoutState = searchParams.get("checkout")');
    expect(source).toContain(
      'checkoutState === "cancelled" && serviceFeeRequired && !serviceFeeIsPaid',
    );
    expect(readinessSource).toContain('data-testid="campaign-service-fee-gate"');
    expect(source).toContain(
      'data-testid="campaign-service-fee-cancelled"',
    );
    expect(readinessSource).toContain('data-testid="campaign-service-fee-action"');
    expect(readinessSource).toContain('t("launchReadiness.payToLaunch")');
    expect(source).toContain('t("serviceFee.cancelled.title")');
    expect(stringsSource).toContain(
      '"serviceFee.cancelled.title": "Payment not completed"',
    );
    expect(platformEnglishBundleSource).toContain(
      '"serviceFee.cancelled.title": "Payment not completed"',
    );
    expect(readinessSource).toContain('onClick={handleServiceFeeCheckout}');
    expect(inviteCardSource).toContain("canShare");
    expect(source).toContain('"invite.payFirst"');
  });

  it("shows a single payment recovery action for unsafe service fee states", () => {
    const readinessSource = source.slice(
      source.indexOf('data-testid="campaign-launch-readiness"'),
      source.indexOf("<BrandAgreementPanel"),
    );
    const commandCenterSource = source.slice(
      source.indexOf('data-testid="campaign-command-center"'),
      source.indexOf('data-testid="campaign-detail-tabs"'),
    );

    expect(source).toContain("const serviceFeeNeedsRecovery =");
    expect(source).toContain('campaign.service_fee_status === "failed"');
    expect(source).toContain('campaign.service_fee_status === "refunded"');
    expect(source).toContain('campaign.service_fee_status === "disputed"');
    expect(source).toContain('campaign.service_fee_status === "overdue"');
    expect(commandCenterSource).toContain('data-testid="campaign-service-fee-recovery"');
    expect(commandCenterSource).toContain('t("serviceFee.recovery.title")');
    expect(commandCenterSource).toContain('t("serviceFee.recovery.detail")');
    expect(commandCenterSource).toContain('t("serviceFee.recovery.action")');
    expect(readinessSource).toContain("serviceFeeBlocksLaunch && !serviceFeeNeedsRecovery");
    expect(stringsSource).toContain(
      '"serviceFee.recovery.title": "Payment needs attention"',
    );
    expect(platformEnglishBundleSource).toContain(
      '"serviceFee.recovery.title": "Payment needs attention"',
    );
  });

  it("does not badge unpaid campaigns as ready to share while payment still blocks invites", () => {
    expect(source).toContain("const serviceFeeRequired =");
    expect(source).toContain("serviceFeePaid: serviceFeeIsPaid");
    expect(source).toContain('kind === "pay_service_fee"');
    expect(nextActionPresentationSource).toContain('labelKey: "cockpit.payServiceFee"');
    expect(source).toContain("const overviewIsPaymentBlocked =");
    expect(source).toContain('t("launchReadiness.paymentRequired")');
    expect(source).toContain('t("launchReadiness.paymentRequiredSummary")');
    expect(source).toContain('t("launchReadiness.paymentRequiredDetail")');
    expect(stringsSource).toContain('"cockpit.payServiceFee": "Pay PopsDrops fee"');
    expect(stringsSource).toContain('"launchReadiness.paymentRequired": "Payment required"');
    expect(platformEnglishBundleSource).toContain(
      '"launchReadiness.paymentRequired": "Payment required"',
    );
  });

  it("keeps the invite strip visible as a locked state when payment blocks sharing", () => {
    expect(source).toContain("const shouldShowInviteStrip =");
    expect(source).toContain("canShareInviteLink ||");
    expect(source).toContain('nextAction.kind === "invite_creators"');
    expect(source).toContain("overviewIsPaymentBlocked ||");
    expect(source).toContain('data-testid="campaign-invite-locked"');
    expect(source).toContain('"invite.payFirst"');
  });

  it("prioritizes lifecycle closure over payment copy in the invite strip", () => {
    expect(source).toContain("const inviteLifecycleClosedReason =");
    expect(source).toContain("const inviteBlockedMessageKey =");
    expect(source).toContain(
      "? inviteLifecycleClosedMessageKeys[inviteLifecycleClosedReason]",
    );
    expect(source).toContain("const inviteBlockedActionKey =");
    expect(source).toContain(
      '? "invite.closedAction"',
    );
    expect(source).toContain(
      'const isLifecycleClosedInvite = blockedActionKey === "invite.closedAction"',
    );
    expect(source).toContain("border-slate-200 bg-slate-50 text-slate-700");
    expect(stringsSource).toContain(
      '"invite.closed.completed": "Campaign is complete. Invite links stay closed for audit."',
    );
    expect(platformEnglishBundleSource).toContain(
      '"invite.closed.completed": "Campaign is complete. Invite links stay closed for audit."',
    );
  });

  it("keeps payment as one command-center CTA instead of duplicating it in the invite strip", () => {
    const inviteCardSource = source.slice(
      source.indexOf("function InviteLinkCard"),
      source.indexOf("function ReportingQueueSortableHead"),
    );

    expect(inviteCardSource).toContain(
      'blockedActionKey !== "invite.payFirstCta"',
    );
    expect(inviteCardSource).toContain(
      'blockedActionKey !== "invite.closedAction"',
    );
    expect(inviteCardSource).toContain("shouldShowBlockedAction && (");
  });

  it("gives blocked launch requirements concrete draft fixes", () => {
    const readinessSource = source.slice(
      source.indexOf('data-testid="campaign-launch-readiness"'),
      source.indexOf("<BrandAgreementPanel"),
    );

    expect(source).toContain("updateCampaignLaunchSetup");
    expect(source).toContain("type LaunchReadinessItem");
    expect(source).toContain("targetTestId");
    expect(source).toContain("function handleLaunchReadinessFix");
    expect(source).toContain("async function handleSaveLaunchBrief");
    expect(source).toContain("async function handleAddLaunchDeliverable");
    expect(source).toContain("async function handleSyncLaunchReporting");
    expect(readinessSource).toContain('data-testid="campaign-launch-readiness-fix"');
    expect(readinessSource).toContain('data-testid="campaign-launch-readiness-fixes"');
    expect(readinessSource).toContain('data-testid="campaign-launch-brief-fix"');
    expect(readinessSource).toContain('data-testid="campaign-launch-deliverable-fix"');
    expect(readinessSource).toContain('data-testid="campaign-launch-reporting-fix"');
    expect(readinessSource).toContain('t("launchReadiness.locked")');
    expect(source).toContain('t("launchReadiness.fix.image")');
    expect(source).toContain('t("launchReadiness.fix.rules")');
  });

  it("starts the brand campaign room with one command center instead of scattered hero cards", () => {
    const commandCenterSource = source.slice(
      source.indexOf('data-testid="campaign-command-center"'),
      source.indexOf('data-testid="campaign-detail-tabs"'),
    );

    expect(source).toContain("getCampaignNextAction");
    expect(source).toContain('data-testid="campaign-command-center"');
    expect(source).toContain('data-testid="campaign-next-action"');
    expect(source).toContain('data-testid="campaign-health-strip"');
    expect(commandCenterSource).toContain("<InviteLinkCard");
    expect(source).toContain('data-testid="campaign-invite-strip"');
    expect(source).toContain('data-testid="campaign-detail-tabs"');
    expect(source).not.toContain("{/* Invite Link */}");
    expect(source).not.toContain("{/* Phase KPI Cards */}");
  });

  it("keeps invite sharing locked until creator handoff readiness is complete", () => {
    const inviteCardSource = source.slice(
      source.indexOf("function InviteLinkCard"),
      source.indexOf("function ReportingQueueSortableHead"),
    );
    const commandCenterSource = source.slice(
      source.indexOf('data-testid="campaign-command-center"'),
      source.indexOf('data-testid="campaign-detail-tabs"'),
    );

    expect(source).toContain(
      "const canShareInviteLink =",
    );
    expect(source).toContain("canManageCampaigns &&");
    expect(source).toContain("launchReadinessBlockers === 0 &&");
    expect(source).toContain("serviceFeeIsPaid &&");
    expect(source).toContain("!isDraftCampaign");
    expect(source).toContain("const canSharePublicApplyLink =");
    expect(commandCenterSource).toContain("canShare={canSharePublicApplyLink}");
    expect(commandCenterSource).toContain("blockedMessageKey={inviteBlockedMessageKey}");
    expect(commandCenterSource).toContain("blockedActionKey={inviteBlockedActionKey}");
    expect(inviteCardSource).toContain("canShare");
    expect(inviteCardSource).toContain('data-testid="campaign-invite-locked"');
    expect(inviteCardSource).toContain('data-testid="campaign-invite-copy"');
    expect(inviteCardSource).toContain("{canShare && (");
    expect(inviteCardSource).not.toContain("disabled={!canShare");
    expect(inviteCardSource).toContain("blockedMessageKey");
    expect(inviteCardSource).toContain("blockedActionKey");
    expect(source).toContain('"invite.locked"');
    expect(source).toContain('"invite.payFirst"');
    expect(source).toContain('"invite.launchFirst"');
    expect(source).toContain('"invite.fixSetup"');
    expect(stringsSource).toContain(
      '"invite.locked": "Complete setup to reveal the invite link."',
    );
    expect(designSource).toContain(
      "Invite links are not shareable until creator handoff readiness is complete.",
    );
  });

  it("keeps the page header free of duplicate report shortcuts", () => {
    const headerSource = source.slice(
      source.indexOf("{/* Header */}"),
      source.indexOf('data-testid="campaign-command-center"'),
    );
    const reportingSource = source.slice(
      source.indexOf('<TabsContent value="reporting"'),
      source.indexOf("</Tabs>", source.indexOf('<TabsContent value="reporting"')),
    );

    expect(headerSource).not.toContain('href={`/b/campaigns/${campaign.id}/report`}');
    expect(headerSource).not.toContain('t("action.viewReport")');
    expect(source).toContain('<TabsTrigger value="reporting"');
    expect(reportingSource).toContain(
      'data-testid="campaign-reporting-report-link"',
    );
    expect(reportingSource).toContain('href={`/b/campaigns/${campaign.id}/report`}');
  });

  it("anchors command center metric values to one scan line", () => {
    const commandCenterSource = source.slice(
      source.indexOf('data-testid="campaign-command-center"'),
      source.indexOf('data-testid="campaign-detail-tabs"'),
    );

    expect(commandCenterSource).toContain('data-testid="campaign-health-value"');
    expect(commandCenterSource).toContain('data-testid="campaign-health-detail"');
    expect(commandCenterSource).toContain("grid min-h-[92px] grid-rows-[auto_1fr]");
    expect(commandCenterSource).toContain("self-end");
    expect(commandCenterSource).not.toContain("flex min-h-[92px] flex-col justify-between");
    expect(designSource).toContain("Command-center metric values align");
  });

  it("uses the tabs as the primary campaign detail workspace below the command center", () => {
    const commandCenterIndex = source.indexOf('data-testid="campaign-command-center"');
    const detailTabsIndex = source.indexOf('data-testid="campaign-detail-tabs"');
    const readinessIndex = source.indexOf('data-testid="campaign-launch-readiness"');
    const agreementIndex = source.indexOf("<BrandAgreementPanel");
    const creativeKitIndex = source.indexOf("<BrandCreativeKitPanel");
    const reportingIndex = source.indexOf('data-testid="campaign-reporting-operations"');

    expect(commandCenterIndex).toBeGreaterThan(-1);
    expect(detailTabsIndex).toBeGreaterThan(-1);
    expect(readinessIndex).toBeGreaterThan(-1);
    expect(agreementIndex).toBeGreaterThan(-1);
    expect(creativeKitIndex).toBeGreaterThan(-1);
    expect(reportingIndex).toBeGreaterThan(-1);
    expect(commandCenterIndex).toBeLessThan(detailTabsIndex);
    expect(detailTabsIndex).toBeLessThan(readinessIndex);
    expect(source).toContain('<TabsTrigger value="overview"');
    expect(source).toContain('<TabsTrigger value="brief"');
    expect(source).toContain('<TabsTrigger value="creators"');
    expect(source).toContain('<TabsTrigger value="content"');
    expect(source).toContain('<TabsTrigger value="reporting"');
    expect(source).not.toContain('<TabsTrigger value="applicants"');
    expect(source).not.toContain('<TabsTrigger value="members"');
  });

  it("names the setup workspace honestly and badges total launch readiness instead of only deliverables", () => {
    const tabsListSource = source.slice(
      source.indexOf("<TabsList"),
      source.indexOf("</TabsList>", source.indexOf("<TabsList")),
    );

    expect(stringsSource).toContain('"tab.brief": "Setup"');
    expect(platformEnglishBundleSource).toContain('"tab.brief": "Setup"');
    expect(source).toContain("const setupTabBadge =");
    expect(source).toContain("launchReadinessItems.filter((item) => item.ready).length");
    expect(tabsListSource).toContain("{setupTabBadge}");
    expect(tabsListSource).not.toContain("{deliverables.length}");
  });

  it("keeps campaign workspace navigation visible while managers scan long sections", () => {
    const tabsRailSource = source.slice(
      source.indexOf("<TabsList"),
      source.indexOf("</TabsList>", source.indexOf("<TabsList")),
    );

    expect(tabsRailSource).toContain('data-testid="campaign-detail-tab-rail"');
    expect(tabsRailSource).toContain("sticky top-14");
    expect(tabsRailSource).toContain("lg:top-0");
    expect(tabsRailSource).toContain("z-20");
    expect(tabsRailSource).toContain("backdrop-blur");
  });

  it("makes campaign workspace tabs URL addressable for refresh-safe operations", () => {
    const componentSetupSource = source.slice(
      source.indexOf("export default function CampaignRoomPage"),
      source.indexOf("useEffect(() => {", source.indexOf("export default function CampaignRoomPage")),
    );
    const tabsSource = source.slice(
      source.indexOf("<Tabs"),
      source.indexOf('data-testid="campaign-launch-readiness"'),
    );

    expect(source).toContain("CAMPAIGN_DETAIL_TABS");
    expect(source).toContain("getCampaignDetailTabFromSearchParams");
    expect(source).toContain("buildCampaignDetailTabUrl");
    expect(source).toContain("isCampaignDetailTab");
    expect(source).toContain("useSearchParams");
    expect(source).toContain("usePathname");
    expect(source).toContain("useRouter");
    expect(componentSetupSource).toContain("const activeTab = getCampaignDetailTabFromSearchParams(searchParams)");
    expect(componentSetupSource).not.toContain('useState("overview")');
    expect(source).toContain("function handleCampaignTabChange");
    expect(source).toContain("router.push(buildCampaignDetailTabUrl(pathname, searchParams, tab)");
    expect(tabsSource).toContain("onValueChange={handleCampaignTabChange}");
    expect(source).not.toContain("setActiveTab(");
  });

  it("places campaign details in intentional tab sections", () => {
    const overviewSource = source.slice(
      source.indexOf('<TabsContent value="overview"'),
      source.indexOf('<TabsContent value="brief"'),
    );
    const briefSource = source.slice(
      source.indexOf('<TabsContent value="brief"'),
      source.indexOf('<TabsContent value="creators"'),
    );
    const creatorsSource = source.slice(
      source.indexOf('<TabsContent value="creators"'),
      source.indexOf('<TabsContent value="content"'),
    );
    const contentSource = source.slice(
      source.indexOf('<TabsContent value="content"'),
      source.indexOf('<TabsContent value="reporting"'),
    );
    const reportingSource = source.slice(
      source.indexOf('<TabsContent value="reporting"'),
      source.indexOf("</Tabs>", source.indexOf('<TabsContent value="reporting"')),
    );

    expect(overviewSource).toContain('data-testid="campaign-overview-snapshot"');
    expect(overviewSource).not.toContain('data-testid="campaign-launch-readiness"');
    expect(overviewSource).not.toContain("<InviteLinkCard");
    expect(source).toContain('data-testid="campaign-invite-strip"');
    expect(overviewSource).toContain('data-testid="campaign-overview-readiness"');
    expect(overviewSource).not.toContain('data-testid="campaign-billing-scope"');
    expect(briefSource).toContain('data-testid="campaign-launch-readiness"');
    expect(briefSource).toContain('data-testid="campaign-billing-scope"');
    expect(briefSource).toContain("<BrandCreativeKitPanel");
    expect(briefSource).toContain("<BrandAgreementPanel");
    expect(briefSource).toContain('data-testid="campaign-deliverables-summary"');
    expect(creatorsSource).toContain("{sortedPendingApps.map((app) => {");
    expect(creatorsSource).toContain("filteredMembers.map((m) => {");
    expect(contentSource).toContain('data-testid="campaign-handoff-rail"');
    expect(contentSource).toContain("{sortedFilteredSubmissions.map((cs) => {");
    expect(reportingSource).toContain('data-testid="campaign-reporting-operations"');
    expect(reportingSource).toContain('href={`/b/campaigns/${campaign.id}/report`}');
  });

  it("starts setup with a compact creator handoff sequence before readiness details", () => {
    const briefSource = source.slice(
      source.indexOf('<TabsContent value="brief"'),
      source.indexOf('<TabsContent value="creators"'),
    );
    const sequenceIndex = briefSource.indexOf('data-testid="campaign-setup-sequence"');
    const readinessIndex = briefSource.indexOf('data-testid="campaign-launch-readiness"');

    expect(sequenceIndex).toBeGreaterThan(-1);
    expect(readinessIndex).toBeGreaterThan(-1);
    expect(sequenceIndex).toBeLessThan(readinessIndex);
    expect(briefSource).toContain("launchReadinessItems.map((item, index) =>");
    expect(briefSource).toContain('data-testid="campaign-setup-sequence-item"');
    expect(briefSource).toContain('t("setupSequence.title")');
    expect(briefSource).toContain('t("setupSequence.ready")');
    expect(briefSource).toContain('t("setupSequence.needsWork")');
  });

  it("collapses launch readiness details when setup has no blockers", () => {
    const briefSource = source.slice(
      source.indexOf('<TabsContent value="brief"'),
      source.indexOf('<TabsContent value="creators"'),
    );

    expect(briefSource).toContain("launchReadinessBlockers > 0 ? (");
    expect(briefSource).toContain('data-testid="campaign-launch-readiness-blockers"');
    expect(briefSource).toContain('data-testid="campaign-launch-ready-summary"');
    expect(briefSource).toContain('t("launchReadiness.readySummary")');
    expect(briefSource).toContain('t("launchReadiness.readyDetail")');
    expect(briefSource).toContain('data-testid="campaign-launch-readiness-fixes"');
    expect(briefSource).toContain("isDraftCampaign && launchReadinessBlockers > 0 && canManageCampaigns && (");
    expect(stringsSource).toContain(
      '"launchReadiness.readySummary": "Creator handoff is ready."',
    );
    expect(platformEnglishBundleSource).toContain(
      '"launchReadiness.readySummary": "Creator handoff is ready."',
    );
    expect(designSource).toContain(
      "Do not repeat complete checklists as full cards",
    );
  });

  it("keeps overview tab status and quick actions tied to campaign state", () => {
    const tabsListSource = source.slice(
      source.indexOf("<TabsList"),
      source.indexOf('value="brief"', source.indexOf("<TabsList")),
    );
    const overviewSource = source.slice(
      source.indexOf('<TabsContent value="overview"'),
      source.indexOf('<TabsContent value="brief"'),
    );

    expect(source).toContain("const overviewTabBadge =");
    expect(source).toContain('campaign.status === "completed"');
    expect(source).toContain("const canEditCampaignOperations =");
    expect(source).toContain('campaign.status !== "completed"');
    expect(tabsListSource).toContain("{overviewTabBadge}");
    expect(tabsListSource).not.toContain('t("launchReadiness.ready")');
    expect(overviewSource).toContain("shouldShowCampaignControls");
    expect(overviewSource).toContain('data-testid="campaign-overview-panels"');
    expect(overviewSource).toContain('lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.72fr)]');
    expect(overviewSource).toContain('data-testid="campaign-overview-timeline"');
    expect(overviewSource).toContain('data-testid="campaign-overview-readiness"');
    expect(overviewSource).toContain('data-testid="campaign-overview-readiness-action"');
    expect(overviewSource).toContain('data-testid="campaign-overview-timeline-item"');
    expect(overviewSource).toContain('t("label.applicationDeadline")');
    expect(overviewSource).toContain("formatShortDate(campaign.application_deadline, locale)");
    expect(overviewSource).toContain('data-testid="campaign-controls"');
    expect(overviewSource).toContain('data-testid="campaign-controls-rail"');
    expect(overviewSource).toContain('data-testid="campaign-control-action"');
    expect(overviewSource).toContain("{shouldShowCampaignControls && (");
    expect(overviewSource).not.toContain('<Card data-testid="campaign-controls">');
  });

  it("renders campaign header metadata without loose separator characters", () => {
    const headerSource = source.slice(
      source.indexOf('data-testid="campaign-header-meta"'),
      source.indexOf('data-testid="campaign-command-center"'),
    );

    expect(headerSource).toContain('data-testid="campaign-header-meta-item"');
    expect(headerSource).toContain("headerMetaItems.map");
    expect(headerSource).toContain("border-s border-border");
    expect(headerSource).not.toContain('text-muted-foreground/50">|</span>');
  });

  it("keeps the sticky campaign tab rail below the mobile brand header", () => {
    const tabRailSource = source.slice(
      source.indexOf('data-testid="campaign-detail-tab-rail"'),
      source.indexOf('<TabsContent value="overview"'),
    );

    expect(tabRailSource).toContain("sticky top-14");
    expect(tabRailSource).toContain("lg:top-0");
    expect(tabRailSource).not.toContain("sticky top-0 z-20");
  });

  it("names overview campaign controls by the work they perform", () => {
    expect(stringsSource).toContain('"section.quickActions": "Campaign controls"');
    expect(stringsSource).toContain('"action.sendAnnouncement": "Send creator update"');
    expect(stringsSource).toContain('"action.extendDeadline": "Change application deadline"');
    expect(platformEnglishBundleSource).toContain('"section.quickActions": "Campaign controls"');
    expect(platformEnglishBundleSource).toContain('"action.sendAnnouncement": "Send creator update"');
    expect(platformEnglishBundleSource).toContain('"action.extendDeadline": "Change application deadline"');
    expect(stringsSource).not.toContain('"section.quickActions": "Quick Actions"');
    expect(stringsSource).not.toContain('"action.sendAnnouncement": "Send Announcement"');
    expect(stringsSource).not.toContain('"action.extendDeadline": "Extend Deadline"');
  });

  it("only shows application deadline controls while recruiting can still change safely", () => {
    const controlsSource = source.slice(
      source.indexOf('data-testid="campaign-controls"'),
      source.indexOf('<TabsContent value="brief"'),
    );

    expect(source).toContain("const canManageApplicationDeadline =");
    expect(source).toContain('campaign.status === "draft" || campaign.status === "recruiting"');
    expect(source).toContain("!applicationDeadlinePassed");
    expect(controlsSource).toContain("{canManageApplicationDeadline && (");
    expect(controlsSource).toContain("{showDeadlineDialog && canManageApplicationDeadline && (");
  });

  it("only exposes creator announcements while the campaign can actually notify members", () => {
    const controlsSource = source.slice(
      source.indexOf('data-testid="campaign-controls"'),
      source.indexOf('<TabsContent value="brief"'),
    );

    expect(source).toContain("const canSendCampaignAnnouncement =");
    expect(source).toContain(
      '["recruiting", "in_progress", "publishing", "monitoring"].includes(campaign.status)',
    );
    expect(source).toContain("const shouldShowCampaignControls =");
    expect(source).toContain("canSendCampaignAnnouncement || canManageApplicationDeadline");
    expect(source).toContain("{shouldShowCampaignControls && (");
    expect(controlsSource).toContain("{canSendCampaignAnnouncement && (");
    expect(controlsSource).toContain('data-testid="campaign-announcement-control"');
    expect(controlsSource).toContain("{showAnnouncementDialog && canSendCampaignAnnouncement && (");
  });

  it("bounds changed application deadlines by the content due date", () => {
    const controlsSource = source.slice(
      source.indexOf('data-testid="campaign-controls"'),
      source.indexOf('<TabsContent value="brief"'),
    );

    expect(controlsSource).toContain('max={getDateInputValue(campaign.content_due_date)}');
    expect(source).toContain('const [deadlineError, setDeadlineError] = useState("");');
    expect(controlsSource).toContain("const contentDueDateKey = getDateInputValue(campaign.content_due_date);");
    expect(controlsSource).toContain("if (contentDueDateKey && newDeadline > contentDueDateKey)");
    expect(controlsSource).toContain("setDeadlineError(message)");
    expect(controlsSource).toContain('role="alert"');
    expect(controlsSource).toContain('t("deadline.contentDueLimit")');
    expect(stringsSource).toContain(
      '"deadline.contentDueLimit": "Applications must close on or before content is due."',
    );
    expect(platformEnglishBundleSource).toContain(
      '"deadline.contentDueLimit": "Applications must close on or before content is due."',
    );
  });

  it("offers an explicit start-work gate after recruiting is resolved", () => {
    expect(source).toContain("startCampaignWork");
    expect(source).toContain("const unresolvedApplicationCount =");
    expect(source).toContain("const canStartCampaignWork =");
    expect(source).toContain('campaign.status === "recruiting"');
    expect(source).toContain("members.length > 0");
    expect(source).toContain("unresolvedApplicationCount === 0");
    expect(source).toContain('data-testid="campaign-start-work-action"');
    expect(source).toContain('toast.success(t("startWork.startedToast"))');
    expect(source).toContain('t("startWork.start")');
    expect(source).toContain('t("startWork.starting")');
  });

  it("uses singular next-action copy when exactly one creator or proof needs work", () => {
    expect(source).toContain("detailSingularKey?: string");
    expect(source).toContain(
      'detailSingularKey: "cockpit.monitorCorrectionsDetailSingular"',
    );
    expect(source).toContain("nextActionCount === 1 && nextActionMeta.detailSingularKey");
    expect(stringsSource).toContain('"cockpit.monitorCorrectionsDetailSingular":');
    expect(stringsSource).toContain("1 creator needs to resubmit proof.");
    expect(platformEnglishBundleSource).toContain(
      '"cockpit.monitorCorrectionsDetailSingular": "1 creator needs to resubmit proof."',
    );
    expect(stringsSource).not.toContain('"cockpit.monitorCorrectionsDetail": "{count} creator need');
  });

  it("keeps the command center focused on aligned operational metrics", () => {
    expect(healthItemsSource).toContain('tc("metric.creatorBudget")');
    expect(healthItemsSource).toContain('tc("metric.creators")');
    expect(healthItemsSource).toContain('tc("metric.content")');
    expect(healthItemsSource).toContain('tc("metric.reports")');
    expect(healthItemsSource).toContain('tc("metric.spent")');
    expect(healthItemsSource).toContain('tc("metric.accepted")');
    expect(healthItemsSource).toContain('tc("metric.approved")');
    expect(healthItemsSource).toContain('tc("metric.cleared")');
    expect(healthItemsSource).not.toContain('t("serviceFee.label")');
    expect(healthItemsSource).not.toContain("campaign-service-fee-status");
  });

  it("counts excused report tasks as cleared in the command center", () => {
    expect(source).toContain("const reportsCleared = reportTasks.filter");
    expect(source).toContain('task.status === "excused"');
    expect(source).toContain("reportingOperationCounts.settled");
    expect(source).toContain("const verified = reportTasks.filter");
    expect(healthItemsSource).toContain("reportsCleared");
    expect(healthItemsSource).not.toContain("reportsReceived");
  });

  it("anchors command center metric values to one shared baseline", () => {
    const healthStripSource = source.slice(
      source.indexOf('data-testid="campaign-health-strip"'),
      source.indexOf("</div>", source.indexOf('data-testid="campaign-health-strip"')),
    );

    expect(healthStripSource).toContain('data-testid="campaign-health-label"');
    expect(healthStripSource).toContain('data-testid="campaign-health-value-group"');
    expect(healthStripSource).toContain("grid min-h-[92px] grid-rows-[auto_1fr]");
    expect(healthStripSource).toContain("self-end");
    expect(healthStripSource).not.toContain(
      "flex min-h-[92px] flex-col justify-between",
    );
  });

  it("shows billing scope in its own quiet panel outside the command center", () => {
    const commandCenterSource = source.slice(
      source.indexOf('data-testid="campaign-command-center"'),
      source.indexOf('data-testid="campaign-detail-tabs"'),
    );
    const billingScopeSource = source.slice(
      source.indexOf('data-testid="campaign-billing-scope"'),
      source.indexOf('data-testid="campaign-billing-scope-separate-costs"'),
    );

    expect(source).toContain("service_package_snapshot");
    expect(source).toContain('data-testid="campaign-billing-scope"');
    expect(source).toContain('data-testid="campaign-billing-scope-included"');
    expect(source).toContain('data-testid="campaign-billing-scope-separate-costs"');
    expect(source).toContain("getServicePackageSnapshotNumber(");
    expect(source).toContain('t("serviceFee.scope.private")');
    expect(source).toContain('t("serviceFee.scope.separateCosts")');
    expect(billingScopeSource).toContain('t("serviceFee.scope.creatorCapacity")');
    expect(billingScopeSource).not.toContain('tc("metric.creators")');
    expect(billingScopeSource).not.toContain('t("metric.creators")');
    expect(commandCenterSource).not.toContain('data-testid="campaign-billing-scope"');
    expect(commandCenterSource).not.toContain('t("serviceFee.label")');
  });

  it("shows a compact payment receipt and Stripe reference inside billing scope", () => {
    const billingScopeSource = source.slice(
      source.indexOf('data-testid="campaign-billing-scope"'),
      source.indexOf('data-testid="campaign-billing-scope-separate-costs"'),
    );

    expect(source).toContain("service_fee_checkout_session_id");
    expect(source).toContain("service_fee_payment_intent_id");
    expect(source).toContain("service_fee_last_event_id");
    expect(source).toContain("service_fee_paid_at");
    expect(source).toContain("serviceFeeStatusDetailKey");
    expect(source).toContain("serviceFeeReferenceRows");
    expect(source).toContain('labelKey: "serviceFee.reference.paymentIntent"');
    expect(billingScopeSource).toContain('data-testid="campaign-service-fee-receipt"');
    expect(billingScopeSource).toContain('data-testid="campaign-service-fee-reference"');
    expect(billingScopeSource).toContain('t("serviceFee.receipt.title")');
    expect(billingScopeSource).toContain("t(row.labelKey)");
    expect(billingScopeSource).toContain('formatShortDate(serviceFeeStatusDate, locale)');
    expect(stringsSource).toContain('"serviceFee.receipt.title": "Payment received"');
    expect(stringsSource).toContain('"serviceFee.reference.paymentIntent": "Payment intent"');
    expect(platformEnglishBundleSource).toContain('"serviceFee.receipt.title": "Payment received"');
    expect(platformEnglishBundleSource).toContain('"serviceFee.reference.paymentIntent": "Payment intent"');
  });

  it("uses a clear proof-attention icon for correction monitoring", () => {
    const monitorCorrectionSource = nextActionPresentationSource.slice(
      nextActionPresentationSource.indexOf("monitor_corrections:"),
      nextActionPresentationSource.indexOf("no_blockers:"),
    );

    expect(monitorCorrectionSource).toContain("icon: FileWarning");
    expect(monitorCorrectionSource).not.toContain("icon: RotateCcw");
  });

  it("uses specific next action labels instead of a generic open action", () => {
    expect(nextActionPresentationSource).toContain('ctaKey: "cockpit.reviewProofCta"');
    expect(nextActionPresentationSource).toContain('ctaKey: "cockpit.reviewCorrectionsCta"');
    expect(nextActionPresentationSource).toContain('ctaKey: "cockpit.reviewApplicantsCta"');
    expect(nextActionPresentationSource).toContain('ctaKey: "cockpit.configureRulesCta"');
    expect(nextActionPresentationSource).toContain('ctaKey: "cockpit.addCreativeCta"');
    expect(nextActionPresentationSource).toContain('ctaKey: "cockpit.inviteCreatorsCta"');
    expect(stringsSource).toContain('"cockpit.monitorCorrections": "Review corrections"');
    expect(nextActionPresentationSource).not.toContain('ctaKey: "cockpit.open"');
  });

  it("uses a proof-attention icon for correction operation cards", () => {
    const reportingOperationsSource = source.slice(
      source.indexOf("const reportingOperations ="),
      source.indexOf("const sortedMembers ="),
    );
    const correctionOperationSource = reportingOperationsSource.slice(
      reportingOperationsSource.indexOf('key: "corrections"'),
      reportingOperationsSource.indexOf('key: "missed"'),
    );

    expect(correctionOperationSource).toContain("icon: FileWarning");
    expect(correctionOperationSource).not.toContain("icon: RotateCcw");
  });

  it("does not duplicate the header report shortcut when there are no blockers", () => {
    expect(source).toContain(
      'nextAction.kind === "no_blockers" || !canUseNextAction ? null',
    );
    expect(source).not.toContain(
      'nextAction.kind === "no_blockers"\n      ? `/b/campaigns/${campaign.id}/report`',
    );
  });

  it("does not call pending creator report reads clear reporting", () => {
    expect(source).toContain("const pendingReportReads = reportTasks.filter");
    expect(source).toContain("pendingReports: pendingReportReads");
    expect(nextActionPresentationSource).toContain("wait_for_reports:");
    expect(nextActionPresentationSource).toContain('labelKey: "cockpit.waitForReports"');
    expect(nextActionPresentationSource).toContain('ctaKey: "cockpit.trackReportsCta"');
    expect(stringsSource).toContain('"cockpit.waitForReports": "Waiting on reports"');
    expect(stringsSource).toContain(
      '"cockpit.waitForReportsDetailSingular": "1 report read is still pending."',
    );
    expect(platformEnglishBundleSource).toContain('"cockpit.waitForReports": "Waiting on reports"');
    expect(designSource).toContain(
      "Never show No blockers while report reads are still pending",
    );
  });

  it("keeps proof next actions inside the campaign reporting workspace", () => {
    const nextActionSource = source.slice(
      source.indexOf("const handleNextAction = useCallback"),
      source.indexOf("if (loading) {"),
    );
    const commandCenterSource = source.slice(
      source.indexOf('data-testid="campaign-command-center"'),
      source.indexOf('data-testid="campaign-detail-tabs"'),
    );

    expect(nextActionSource).toContain('kind === "wait_for_reports"');
    expect(nextActionSource).toContain('handleCampaignTabChange("reporting")');
    expect(nextActionSource).toContain('setScrollTargetTestId("campaign-reporting-proof-queue")');
    expect(commandCenterSource).not.toContain("nextActionHref");
    expect(commandCenterSource).not.toContain('href={nextActionHref}');
  });

  it("offers campaign completion only after the handoff workflow is settled", () => {
    expect(source).toContain("completeCampaign");
    expect(source).toContain("getCampaignCloseoutReadiness");
    expect(source).toContain("getActiveCampaignSubmissions");
    expect(source).toContain("parent_submission_id");
    expect(source).toContain("const activeSubmissions =");
    expect(source).toContain("const closeoutReadiness =");
    expect(source).toContain("const settledReportTaskIds = new Set");
    expect(source).toContain("if (settledReportTaskIds.has(task.id)) continue;");
    expect(source).toContain("readyToComplete: closeoutReadiness.ready");
    expect(nextActionPresentationSource).toContain("complete_campaign:");
    expect(nextActionPresentationSource).toContain('labelKey: "cockpit.completeCampaign"');
    expect(nextActionPresentationSource).toContain('ctaKey: "cockpit.completeCampaignCta"');
    expect(source).toContain("const handleCompleteCampaign = useCallback(async () =>");
    expect(source).toContain('actionLoading === "complete-campaign"');
    expect(source).toContain('toast.success(t("completeCampaign.completedToast"))');
  });

  it("mirrors the creator handoff as a compact brand-side progress rail", () => {
    expect(source).toContain("getBrandCampaignHandoffSummary");
    expect(source).toContain("const handoffSummary =");
    expect(source).toContain('data-testid="campaign-handoff-rail"');
    expect(source).toContain('data-testid="campaign-handoff-stage"');
    expect(source).toContain("handoff.content");
    expect(source).toContain("handoff.liveUrl");
    expect(source).toContain("handoff.proof");
    expect(source).toContain('handleCampaignTabChange("content")');
  });

  it("distinguishes review links from missing live URLs in the content tab", () => {
    expect(source).toContain("const primaryContentUrl =");
    expect(source).toContain("const primaryContentUrlLabelKey =");
    expect(source).toContain('t("content.liveUrlMissing")');
    expect(source).toContain('"content.reviewLink"');
    expect(source).toContain('"content.liveUrl"');
  });

  it("renders content submissions as a sortable scan-first worklist", () => {
    const contentSource = source.slice(
      source.indexOf('<TabsContent value="content"'),
      source.indexOf('<TabsContent value="reporting"'),
    );

    expect(source).toContain("type ContentSortKey =");
    expect(source).toContain("function ContentSortableHead");
    expect(source).toContain("const sortedFilteredSubmissions =");
    expect(contentSource).toContain('data-testid="campaign-content-table"');
    expect(contentSource).toContain("<ContentSortableHead");
    expect(contentSource).toContain("{sortedFilteredSubmissions.map((cs) => {");
    expect(contentSource).not.toContain("<Card key={cs.id}>");
  });

  it("keeps proof readiness visible inside the content handoff worklist", () => {
    const contentSource = source.slice(
      source.indexOf('<TabsContent value="content"'),
      source.indexOf('<TabsContent value="reporting"'),
    );

    expect(source).toContain('type ContentSortKey = "creator" | "platform" | "status" | "submitted" | "version" | "proof";');
    expect(source).toContain("function getSubmissionProofPresentation");
    expect(source).toContain("const submissionEvidence = evidenceRows.filter");
    expect(source).toContain("evidence.submission_id === submission.id ||");
    expect(source).toContain("submission_id");
    expect(contentSource).toContain('sortKey="proof"');
    expect(contentSource).toContain('{t("content.proof")}');
    expect(contentSource).toContain('testId="campaign-content-proof-status"');
    expect(contentSource).toContain("<MemberStatusCell");
    expect(stringsSource).toContain('"content.proof": "Proof"');
    expect(platformEnglishBundleSource).toContain('"content.proof": "Proof"');
    expect(designSource).toContain(
      "Brand content worklists must keep proof readiness in the same row as the content submission.",
    );
  });

  it("mirrors the creator draft-live-proof sequence inside each brand content row", () => {
    const contentSource = source.slice(
      source.indexOf('<TabsContent value="content"'),
      source.indexOf('<TabsContent value="reporting"'),
    );

    expect(contentSource).toContain('data-testid="campaign-content-handoff-grid"');
    expect(contentSource).toContain('data-testid="campaign-content-handoff-stage"');
    expect(contentSource).toContain('data-handoff-stage="draft"');
    expect(contentSource).toContain('data-handoff-stage="liveUrl"');
    expect(contentSource).toContain('data-handoff-stage="proof"');
    expect(contentSource).toContain("content.handoffDraft");
    expect(contentSource).toContain("content.handoffLiveUrl");
    expect(contentSource).toContain("content.handoffProof");
    expect(contentSource).toContain("liveUrlPresentation");
    expect(contentSource).toContain("proofPresentation");
    expect(stringsSource).toContain('"content.handoffDraft": "Draft"');
    expect(stringsSource).toContain('"content.handoffLiveUrl": "Live URL"');
    expect(stringsSource).toContain('"content.handoffProof": "Proof"');
    expect(designSource).toContain(
      "Brand content rows should mirror the creator room sequence: draft, live URL, proof.",
    );
  });

  it("turns the reporting tab into a sortable proof review queue", () => {
    const reportingSource = source.slice(
      source.indexOf('<TabsContent value="reporting"'),
      source.indexOf("</TabsContent>", source.indexOf('<TabsContent value="reporting"')),
    );

    expect(source).toContain("type ReportingQueueSortKey =");
    expect(source).toContain("function ReportingQueueSortableHead");
    expect(source).toContain("const reportingQueueRows =");
    expect(source).toContain("const sortedFilteredReportingQueueRows =");
    expect(reportingSource).toContain('data-testid="campaign-reporting-proof-queue"');
    expect(reportingSource).toContain('data-testid="campaign-reporting-proof-row"');
    expect(reportingSource).toContain('testId="campaign-reporting-proof-status"');
    expect(reportingSource).toContain('data-testid="campaign-reporting-proof-evidence"');
    expect(reportingSource).toContain('data-testid="campaign-reporting-proof-action"');
    expect(reportingSource).toContain("<ReportingQueueSortableHead");
    expect(reportingSource).toContain('{t("members.review")}');
    expect(reportingSource).not.toContain('{t("content.action")}');
    expect(reportingSource).toContain('{t("reporting.queueTitle")}');
    expect(reportingSource).toContain('? t("reporting.queueEmpty")');
    expect(reportingSource).toContain(': t("queueFilter.emptyReporting")');
    expect(stringsSource).toContain('"reporting.queueTitle": "Proof queue"');
    expect(platformEnglishBundleSource).toContain('"reporting.queueTitle": "Proof queue"');
    expect(designSource).toContain(
      "Reporting tabs must include an operational proof queue, not only summary cards.",
    );
  });

  it("shows the selected report goal inside the brand proof review queue", () => {
    const reportingSource = source.slice(
      source.indexOf('<TabsContent value="reporting"'),
      source.indexOf("</TabsContent>", source.indexOf('<TabsContent value="reporting"')),
    );

    expect(source).toContain("getReportGoalContext");
    expect(source).toContain("const [reportGoalContext, setReportGoalContext]");
    expect(source).toContain(".from(\"campaign_reporting_plans\")");
    expect(source).toContain("report_preset_id, report_chart_mode_id, report_block_ids");
    expect(source).toContain("setReportGoalContext(getReportGoalContext");
    expect(reportingSource).toContain('data-testid="campaign-reporting-proof-report-goal"');
    expect(reportingSource).toContain('t("reporting.reportGoal.title")');
    expect(reportingSource).toContain('t("reporting.reportGoal.detail"');
    expect(reportingSource).toContain("reportGoalContext.blockLabelKeys");
    expect(stringsSource).toContain('"reporting.reportGoal.title": "Report goal"');
    expect(stringsSource).toContain(
      '"reporting.reportGoal.detail": "{goal} proof should support {blocks}."',
    );
    expect(platformEnglishBundleSource).toContain('"reporting.reportGoal.title": "Report goal"');
  });

  it("counts brand proof review work by proof item instead of collapsing by task", () => {
    const operationCountsSource = source.slice(
      source.indexOf("const reportingOperationCounts = useMemo(() => {"),
      source.indexOf("const pendingReportReads ="),
    );

    expect(operationCountsSource).toContain("let toReview = 0;");
    expect(operationCountsSource).toContain("let corrections = 0;");
    expect(operationCountsSource).toContain("getCurrentEvidenceRowsForTask(");
    expect(operationCountsSource).toContain("getCurrentPerformanceRowsForTask(");
    expect(operationCountsSource).toContain("toReview += 1;");
    expect(operationCountsSource).toContain("corrections += 1;");
    expect(operationCountsSource).not.toContain("const toReviewTaskIds = new Set<string>();");
    expect(operationCountsSource).not.toContain("correctionTaskIds.size");
  });

  it("keeps proof review evidence-level when one reporting read has multiple posts", () => {
    const reportingRowsSource = source.slice(
      source.indexOf("const reportingQueueRows ="),
      source.indexOf("const sortedFilteredReportingQueueRows ="),
    );
    const reviewHandlerSource = source.slice(
      source.indexOf("async function handleVerifyPerformanceEvidence"),
      source.indexOf("async function handleRequestPerformanceCorrection"),
    );

    expect(source).toContain("function getCurrentEvidenceRowsForTask");
    expect(reportingRowsSource).toContain("reportTasks.flatMap((task) =>");
    expect(reportingRowsSource).toContain("currentEvidenceRows.length > 0");
    expect(reportingRowsSource).toContain("currentEvidence");
    expect(reportingRowsSource).toContain("rowId");
    expect(reportingRowsSource).toContain("evidenceLabel");
    expect(source).toContain('key={row.rowId}');
    expect(source).toContain('data-evidence-id={row.currentEvidence?.id ?? undefined}');
    expect(source).toContain("{sortedFilteredReportingQueueRows.length}");
    expect(reviewHandlerSource).not.toContain("setReportTasks((current)");
    expect(reviewHandlerSource).toContain("await loadCampaignWorkspace();");
    expect(designSource).toContain(
      "Proof queue rows are evidence-level when one reporting read contains multiple posts.",
    );
  });

  it("lets brand managers review submitted proof from the reporting queue", () => {
    const reportingSource = source.slice(
      source.indexOf('<TabsContent value="reporting"'),
      source.indexOf("</TabsContent>", source.indexOf('<TabsContent value="reporting"')),
    );

    expect(source).toContain("reviewPerformanceEvidence");
    expect(source).toContain("performance_id, file_name, mime_type, size_bytes, storage_path");
    expect(source).toContain("signedEvidenceUrlsByPath");
    expect(source).toContain("handleVerifyPerformanceEvidence");
    expect(source).toContain("handleRequestPerformanceCorrection");
    expect(source).toContain("proofCorrectionDialog");
    expect(reportingSource).toContain('data-testid="campaign-reporting-open-proof"');
    expect(reportingSource).toContain('data-testid="campaign-reporting-verify-proof"');
    expect(reportingSource).toContain('data-testid="campaign-reporting-request-correction"');
    expect(reportingSource).toContain('{t("reporting.openProof")}');
    expect(reportingSource).toContain('"reporting.verifyProof"');
    expect(reportingSource).toContain('{t("reporting.requestCorrection")}');
    expect(source).toContain('data-testid="campaign-reporting-correction-dialog"');
    expect(source).toContain('data-testid="campaign-reporting-correction-note"');
    expect(stringsSource).toContain('"reporting.openProof": "Open proof"');
    expect(stringsSource).toContain('"reporting.verifyProof": "Verify"');
    expect(stringsSource).toContain('"reporting.requestCorrection": "Request correction"');
    expect(platformEnglishBundleSource).toContain('"reporting.openProof": "Open proof"');
    expect(designSource).toContain(
      "Proof review actions must live beside the proof row that needs a decision.",
    );
  });

  it("shows proof review waiting age beside report impact before brand decisions", () => {
    const reportingSource = source.slice(
      source.indexOf('<TabsContent value="reporting"'),
      source.indexOf("</TabsContent>", source.indexOf('<TabsContent value="reporting"')),
    );

    expect(reportingSource).toContain("const proofReviewWaitingAge =");
    expect(reportingSource).toContain('data-testid="campaign-reporting-proof-review-age"');
    expect(reportingSource).toContain('data-proof-waiting-state="waiting"');
    expect(reportingSource).toContain('row.queueState === "review"');
    expect(reportingSource).toContain('row.queueState === "correction_returned"');
    expect(reportingSource).toContain('t("proofStatus.waiting")');
    expect(reportingSource).toContain("timeAgo(row.submittedAt, tc, locale)");
    expect(reportingSource.indexOf('data-testid="campaign-reporting-proof-impact"')).toBeLessThan(
      reportingSource.indexOf('data-testid="campaign-reporting-proof-review-age"'),
    );
  });

  it("treats returned correction proof as fresh review work instead of stale correction state", () => {
    expect(source).toContain("getCurrentEvidenceReviewStatuses");
    expect(source).toContain("function getProofStatus");
    expect(source).toContain("verification_status as EvidenceReviewStatus");
    expect(source).toContain("const hasCorrectionReturned =");
    expect(source).toContain('t("reportStatus.correctionReturned")');
    expect(source).toMatch(
      /correction_returned:\s*{\s*label:\s*t\("reporting\.impact\.pending"\)/,
    );
    expect(stringsSource).toContain('"reportStatus.correctionReturned": "Correction returned"');
    expect(platformEnglishBundleSource).toContain(
      '"reportStatus.correctionReturned": "Correction returned"',
    );
    expect(designSource).toContain(
      "Returned proof after a correction is brand review work.",
    );
  });

  it("keeps campaign operation controls behind brand workspace permissions", () => {
    expect(source).toContain("hasBrandWorkspacePermission");
    expect(source).toContain("canManageCampaigns");
    expect(source).toContain("canReviewCampaignContent");
    expect(source).toContain("canManageBilling");
    expect(source).toContain("canManageCampaignAssets");
    expect(source).toContain('"manage_campaigns"');
    expect(source).toContain('"review_content"');
    expect(source).toContain('"manage_billing"');
    expect(source).toContain("getBrandTeamSettings");
    expect(source).toContain('teamSettings.currentUserRole');
  });

  it("turns read-only campaign states into quiet status instead of disabled action controls", () => {
    const inviteCardSource = source.slice(
      source.indexOf("function InviteLinkCard"),
      source.indexOf("function ReportingQueueSortableHead"),
    );
    const commandCenterSource = source.slice(
      source.indexOf('data-testid="campaign-command-center"'),
      source.indexOf("{checkoutWasCancelled &&"),
    );

    expect(inviteCardSource).toContain("canManage");
    expect(inviteCardSource).toContain('data-testid="campaign-invite-read-only"');
    expect(inviteCardSource).toContain('t("invite.noPermission")');
    expect(inviteCardSource).toContain("{canShare && (");
    expect(inviteCardSource).not.toContain("disabled={!canShare}");
    expect(commandCenterSource).toContain("canUseNextAction");
    expect(commandCenterSource).toContain(
      'nextAction.kind === "no_blockers" || !canUseNextAction',
    );
    expect(stringsSource).toContain(
      '"invite.noPermission": "Only managers can share invite links."',
    );
    expect(platformEnglishBundleSource).toContain(
      '"invite.noPermission": "Only managers can share invite links."',
    );
  });

  it("locks content and proof decisions outside active campaign work stages", () => {
    const contentSource = source.slice(
      source.indexOf('<TabsContent value="content"'),
      source.indexOf('<TabsContent value="reporting"'),
    );
    const reportingSource = source.slice(
      source.indexOf('<TabsContent value="reporting"'),
      source.indexOf("</TabsContent>", source.indexOf('<TabsContent value="reporting"')),
    );

    expect(source).toContain("const campaignAcceptsContentReviewDecisions =");
    expect(source).toContain("const campaignAcceptsProofReviewDecisions =");
    expect(source).toContain(
      '["in_progress", "publishing", "monitoring"].includes(campaign.status)',
    );
    expect(source).toContain("!campaignAcceptsContentReviewDecisions");
    expect(source).toContain("!campaignAcceptsProofReviewDecisions");
    expect(contentSource).toContain(
      'data-testid="campaign-content-read-only-stage"',
    );
    expect(contentSource).toContain('t("content.readOnlyStage")');
    expect(contentSource).toContain(
      'cs.status === "submitted" && canReviewCampaignContent && campaignAcceptsContentReviewDecisions',
    );
    expect(reportingSource).toContain(
      'data-testid="campaign-reporting-read-only-stage"',
    );
    expect(reportingSource).toContain('t("reporting.readOnlyStage")');
    expect(reportingSource).toContain(
      "needsReportReview && canReviewCampaignContent && campaignAcceptsProofReviewDecisions",
    );
    expect(reportingSource).toContain(
      'row.task.status === "missed" && canReviewCampaignContent && campaignAcceptsProofReviewDecisions',
    );
    expect(stringsSource).toContain(
      '"content.readOnlyStage": "Content review is closed for this campaign stage."',
    );
    expect(stringsSource).toContain(
      '"reporting.readOnlyStage": "Proof review is closed for this campaign stage."',
    );
    expect(platformEnglishBundleSource).toContain(
      '"content.readOnlyStage": "Content review is closed for this campaign stage."',
    );
    expect(platformEnglishBundleSource).toContain(
      '"reporting.readOnlyStage": "Proof review is closed for this campaign stage."',
    );
  });
});
