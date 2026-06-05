import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const stringSource = readFileSync(
  new URL("../../../../../../lib/i18n/strings.ts", import.meta.url),
  "utf8",
);
const campaignActionSource = readFileSync(
  new URL("../../../../../../app/actions/campaigns.ts", import.meta.url),
  "utf8",
);
const marketPickerSource = readFileSync(
  new URL(
    "../../../../../../components/campaigns/campaign-market-picker.tsx",
    import.meta.url,
  ),
  "utf8",
);

function stepSource(step: number) {
  const start = source.indexOf(`{step === ${step} && (`);
  const end = source.indexOf(`{step === ${step + 1} && (`);

  expect(start, `step ${step} start`).toBeGreaterThan(-1);
  expect(end, `step ${step + 1} start`).toBeGreaterThan(start);

  return source.slice(start, end);
}

function reviewStepSource() {
  const start = source.indexOf("{step === FINAL_STEP && (");
  const end = source.indexOf("{/* Navigation */", start);

  expect(start, "review step start").toBeGreaterThan(-1);
  expect(end, "navigation start").toBeGreaterThan(start);

  return source.slice(start, end);
}

function settingsStepSource() {
  const start = source.indexOf("{step === 4 && (");
  const end = source.indexOf("{/* Step 5: Review & Publish */", start);

  expect(start, "settings step start").toBeGreaterThan(-1);
  expect(end, "review step comment").toBeGreaterThan(start);

  return source.slice(start, end);
}

function expectStringEntry(key: string, value: string) {
  expect(stringSource).toContain(`"${key}"`);
  expect(stringSource).toContain(`"${value}"`);
}

describe("campaign builder flow", () => {
  it("keeps the first screen focused on the campaign operating model", () => {
    const modelStep = stepSource(0);

    expect(modelStep).toContain("campaignModes.map");
    expect(modelStep).toContain('data-testid="campaign-recruitment-visibility"');
    expect(modelStep).not.toContain("playbooks.map");
    expect(modelStep).not.toContain("playbook.scratch");
  });

  it("makes creator recruitment visibility an explicit choice before setup", () => {
    const modelStep = stepSource(0);

    expect(modelStep).toContain("recruitmentVisibilityOptions.map");
    expect(modelStep).toContain("setRecruitmentVisibility");
    expect(source).toContain("recruitment_visibility: recruitmentVisibility");
    expectStringEntry("recruitment.private.title", "Private invite only");
    expectStringEntry("recruitment.open.title", "Open applications");
  });

  it("asks for the brand's own campaign details after the operating model step", () => {
    const detailsStep = stepSource(1);

    expect(detailsStep).toContain("step.basics");
    expect(detailsStep).toContain("field.briefDescription");
    expect(detailsStep).toContain("CampaignCreatorPreviewPicker");
    expect(source).toContain('data-testid="campaign-creator-preview-image-picker"');
    expect(detailsStep).toContain("field.platforms");
    expect(detailsStep).toContain("PlatformPicker");
    expect(detailsStep).toContain("MarketPicker");
    expect(detailsStep).not.toContain("campaignGoalOptions.map");
    expect(detailsStep).not.toContain("goal.title");
    expect(detailsStep).not.toContain("playbook");
    expect(detailsStep).not.toContain("options={marketLabels}");
    expect(detailsStep).not.toContain("field.niches");
  });

  it("shows a live creator-facing preview while campaign details are edited", () => {
    const detailsStep = stepSource(1);

    expect(source).toContain("function CampaignCreatorLivePreview(");
    expect(detailsStep).toContain("CampaignCreatorLivePreview");
    expect(detailsStep).toContain('data-testid="campaign-details-and-preview"');
    expect(source).toContain('data-testid="campaign-creator-live-preview"');
    expect(source).toContain('data-testid="campaign-creator-live-preview-image"');
    expect(source).toContain("campaignImagePreviewUrl");
    expect(source).toContain("title.trim() || previewCopy.untitled");
    expect(source).toContain("description.trim() || previewCopy.descriptionFallback");
    expect(source).toContain("platforms.length");
    expect(source).toContain("markets.length");
    expect(source).toContain("creatorLanguageLabel");
    expect(stringSource).toContain('"creatorPreview.title": "Creator preview"');
    expect(stringSource).toContain('"creatorPreview.untitled": "Untitled campaign"');
    expect(stringSource).toContain(
      '"creatorPreview.descriptionFallback": "Campaign description will appear here."',
    );
  });

  it("lets brands review the creator-language campaign preview before publishing", () => {
    const detailsStep = stepSource(1);
    const reviewStep = reviewStepSource();

    expect(source).toContain("const [creatorLanguage, setCreatorLanguage]");
    expect(source).toContain("const [generatingCreatorDraft, setGeneratingCreatorDraft]");
    expect(source).toContain("const [translatedDescription, setTranslatedDescription]");
    expect(source).toContain("async function generateCreatorLanguageDraft()");
    expect(source).toContain("buildBriefTranslations()");
    expect(source).toContain("brief_translated: buildBriefTranslations()");
    expect(detailsStep).toContain("CreatorLanguagePlanner");
    expect(detailsStep).toContain('data-testid="campaign-creator-language-planner"');
    expect(detailsStep).toContain("onGenerateDraft={generateCreatorLanguageDraft}");
    expect(detailsStep).toContain("generatingDraft={generatingCreatorDraft}");
    expect(detailsStep).toContain("field.creatorLanguage");
    expect(detailsStep).toContain("field.creatorLanguagePreview");
    expect(reviewStep).toContain("review.label.creatorLanguage");
    expect(reviewStep).toContain("creatorLanguageLabel");
    expect(stringSource).toContain('"field.creatorLanguage": "Creator language"');
    expect(stringSource).toContain(
      '"field.creatorLanguagePreview": "Creator preview"',
    );
    expect(stringSource).toContain('"action.generateCreatorDraft": "Generate draft"');
    expect(stringSource).toContain('"action.generatingCreatorDraft": "Generating"');
  });

  it("generates creator-language drafts through the Supabase Edge Function without saving the campaign", () => {
    expect(source).toContain('supabase.functions.invoke("translate-brief"');
    expect(source).toContain("targetLocale: creatorLanguage");
    expect(source).toContain("briefFields: {");
    expect(source).toContain("description: description.trim()");
    expect(source).toContain("requirements: requirements.trim()");
    expect(source).toContain("const translatedFields = data?.translation");
    expect(source).toContain("setTranslatedDescription(translatedFields.description ?? \"\")");
    expect(source).toContain("toast.success(t(\"success.creatorDraftGenerated\"))");
    expect(source).toContain("toast.error(t(\"error.creatorDraftFailed\"))");
    expect(source.indexOf("async function generateCreatorLanguageDraft()")).toBeLessThan(
      source.indexOf("async function handleSaveDraft()"),
    );

    const draftGeneratorStart = source.indexOf("async function generateCreatorLanguageDraft()");
    const draftGeneratorEnd = source.indexOf("async function uploadCampaignImage", draftGeneratorStart);
    const draftGeneratorSource = source.slice(draftGeneratorStart, draftGeneratorEnd);

    expect(draftGeneratorSource).not.toContain("createCampaign(");
    expect(draftGeneratorSource).not.toContain("publishCampaign(");
    expect(draftGeneratorSource).not.toContain("router.push(");
    expectStringEntry(
      "error.creatorDraftUnavailable",
      "Add a campaign description before generating a draft",
    );
    expect(stringSource).toContain(
      '"success.creatorDraftGenerated": "Creator draft generated"',
    );
    expect(stringSource).toContain(
      '"error.creatorDraftFailed": "Creator draft could not be generated"',
    );
  });

  it("requires a creator-facing campaign image before leaving campaign details", () => {
    expect(source).toContain("const [campaignImageFile, setCampaignImageFile]");
    expect(source).toContain("const [campaignImagePreviewUrl, setCampaignImagePreviewUrl]");
    expect(source).toContain("if (!campaignImageFile) errs.campaignImage");
    expect(source).toContain('t("error.campaignImageRequired")');
    expect(stringSource).toContain('"field.campaignImage": "Campaign image"');
    expectStringEntry(
      "error.campaignImageRequired",
      "Add a campaign image for the creator preview",
    );
  });

  it("uploads the creator preview image as a public campaign asset before routing or publishing", () => {
    expect(source).toContain("async function uploadCampaignImage(campaignId: string)");
    expect(source).toContain("createCampaignAssetUpload({");
    expect(source).toContain('assetType: "product_image"');
    expect(source).toContain('visibility: "public"');
    expect(source).toContain("await markCampaignAssetReady({");
    expect(source).toContain("await uploadCampaignImage(id)");
    expect(source.indexOf("await uploadCampaignImage(id)")).toBeLessThan(
      source.indexOf("await publishCampaign(id)"),
    );
  });

  it("confirms the creator preview image in the review step", () => {
    const reviewStep = reviewStepSource();

    expect(reviewStep).toContain('data-testid="campaign-review-creator-preview-image"');
    expect(reviewStep).toContain("campaignImagePreviewUrl");
    expect(reviewStep).toContain("review.label.campaignImage");
    expect(stringSource).toContain('"review.label.campaignImage": "Campaign image"');
  });

  it("labels the brief field as campaign description", () => {
    expect(stringSource).toContain('"field.briefDescription": "Campaign description"');
    expect(stringSource).not.toContain('"field.briefDescription": "Campaign idea"');
  });

  it("carries compliance notes from setup into review and the public invite payload", () => {
    const settingsStep = settingsStepSource();
    const reviewStep = reviewStepSource();

    expect(settingsStep).toContain('value={complianceNotes}');
    expect(source).toContain("compliance_notes: complianceNotes.trim() || undefined");
    expect(reviewStep).toContain("review.label.complianceNotes");
    expect(reviewStep).toContain("complianceNotes.trim() || t(\"review.none\")");
    expect(stringSource).toContain('"field.complianceNotes": "Compliance Notes"');
    expect(stringSource).toContain('"review.label.complianceNotes": "Compliance notes"');
  });

  it("keeps reporting-only proof channels out of the publishing platform picker", () => {
    const detailsStep = stepSource(1);

    expect(source).toContain("function PlatformPicker(");
    expect(source).not.toContain("normalizeCustomPlatform");
    expect(detailsStep).not.toContain("field.platforms.custom");
    expect(detailsStep).not.toContain("custom-platform");
    expect(stringSource).toContain('"field.platforms": "Publishing platforms"');
  });

  it("places campaign model pricing in the card footer", () => {
    const modelStep = stepSource(0);

    expect(modelStep).toContain('data-testid="campaign-mode-price-footer"');
    expect(modelStep).toContain('data-testid="campaign-mode-card"');
    expect(modelStep).toContain('data-testid="campaign-mode-price"');
    expect(modelStep).not.toContain("mode.scopeKeys.map");
  });

  it("keeps campaign model cards scoped, concise, and honest about sourcing", () => {
    const modelStep = stepSource(0);

    expect(source).toContain('useState<CampaignMode>("private")');
    expect(modelStep).toContain("mode.title");
    expect(source).toContain("getCampaignServiceEstimate");
    expect(source).toContain("serviceFeeEstimate.feeCents");
    expect(source).toContain("serviceFeeEstimate.scopeDetailKey");
    expect(source).toContain("t(mode.pricePrefixKey)");
    expect(modelStep).not.toContain("mode.subtitle");
    expect(modelStep).not.toContain("mode.scopeKeys.map");
    expect(stringSource).toContain('"mode.title": "Operating model"');
    expectStringEntry(
      "mode.subtitle",
      "Private invite is the default. Concierge is quoted only when real sourcing help is needed.",
    );
    expect(stringSource).toContain(
      '"mode.private": "Private Campaign OS"',
    );
    expectStringEntry(
      "mode.private.desc",
      "Invite the creators you actually want. PopsDrops handles briefs, rules, assets, submissions, proof, and reports.",
    );
    expectStringEntry(
      "mode.private.scopeDetail.withOverages",
      "Base includes 10 creators, 45 active days, and 14 reporting days. Overage: $49 per extra 10 creators, $49 per extra 30 active days, $29 per extra 30 reporting days.",
    );
    expect(stringSource).toContain(
      '"mode.sourced": "Enterprise Concierge"',
    );
    expectStringEntry(
      "mode.sourced.desc",
      "Rare high-touch sourcing for large or reputation-sensitive launches. PopsDrops scopes feasibility, outreach, support, and price first.",
    );
    expectStringEntry(
      "mode.sourced.scopeDetail",
      "Custom quote after creator target, markets, budget, and outreach reality are confirmed.",
    );
    expect(stringSource).toContain('"mode.private.fee": "Launch price"');
    expect(stringSource).toContain('"mode.sourced.fee": "Custom quote"');
    expect(stringSource).not.toContain('"mode.sourced": "Sourced Campaign"');
    expect(stringSource).not.toContain('"mode.sourced": "Sourcing Assist"');
    expect(stringSource).not.toContain("self-serve Sourcing Assist");
    expect(stringSource).not.toContain("PopsDrops manages the workspace, approvals");
    expect(stringSource).not.toContain(
      "Choose the operating model first. You can still save a draft before launch.",
    );
  });

  it("shows the scoped PopsDrops fee in budget and review instead of a fixed sourced promise", () => {
    const budgetStep = stepSource(3);
    const reviewStep = reviewStepSource();

    expect(source).toContain("marketPricingScopeCount");
    expect(source).toContain("maxCreatorsForPricing");
    expect(source).toContain("activeDaysForPricing");
    expect(source).toContain("reportingDaysForPricing");
    expect(source).toContain("getCampaignServiceEstimate(campaignMode");
    expect(campaignActionSource).toContain("getCampaignServiceInsertFields(campaign_mode");
    expect(campaignActionSource).toContain("getCampaignServicePricingDays");
    expect(budgetStep).toContain("serviceFeeEstimate.feeCents");
    expect(budgetStep).toContain("serviceFeeEstimate.scopeDetailKey");
    expect(budgetStep).toContain("serviceFeeScopeSummary");
    expect(source).toContain('data-testid="service-fee-capacity-summary"');
    expect(reviewStep).toContain("review.label.serviceFee");
    expect(stringSource).toContain('"review.label.serviceFee": "PopsDrops fee"');
    expectStringEntry(
      "investment.serviceFee.capacitySummary",
      "{count} creator capacity",
    );
    expectStringEntry(
      "mode.private.scopeDetail.withOverages",
      "Base includes 10 creators, 45 active days, and 14 reporting days. Overage: $49 per extra 10 creators, $49 per extra 30 active days, $29 per extra 30 reporting days.",
    );
    expectStringEntry(
      "error.creatorsCountMax",
      "Use Enterprise Concierge for more than 100 creators",
    );
  });

  it("makes 100 creator private capacity a visible self-serve choice", () => {
    const budgetStep = stepSource(3);

    expect(source).toContain("PRIVATE_CAMPAIGN_MAX_SELF_SERVE_CREATORS");
    expect(source).toContain("creatorCapacityPresets");
    expect(source).toContain("[10, 50, 100]");
    expect(source).not.toContain("[10, 25, 50, 100]");
    expect(source).toContain("creatorCapacityOptions");
    expect(source).toContain("option.feeDisplay");
    expect(source).toContain('data-testid="creator-capacity-preset"');
    expect(source).toContain("data-testid={`creator-capacity-preset-${option.count}`}");
    expect(source).toContain("copy.setCreatorCapacity");
    expect(source).toContain("PRIVATE_CAMPAIGN_MAX_SELF_SERVE_CREATORS");
    expect(source).toContain(
      'requestedCreatorsCount > PRIVATE_CAMPAIGN_MAX_SELF_SERVE_CREATORS',
    );
    expect(budgetStep).toContain("CampaignInvestmentPlanner");
    expectStringEntry(
      "investment.creators.setCapacity",
      "Set creator capacity to {count}",
    );
  });

  it("makes the launch review explain billing scope before publishing", () => {
    const reviewStep = reviewStepSource();

    expect(reviewStep).toContain('data-testid="campaign-review-billing-scope"');
    expect(reviewStep).toContain("serviceFeeDisplay");
    expect(reviewStep).toContain("maxCreatorsForPricing");
    expect(reviewStep).toContain("serviceFeeEstimate.includedActiveDays");
    expect(reviewStep).toContain("serviceFeeEstimate.includedReportingDays");
    expect(reviewStep).toContain("review.billingScope.creatorCapacity");
    expect(reviewStep).toContain("review.billingScope.separateCosts");
    expect(stringSource).toContain('"review.billingScope.title": "Billing and scope"');
    expectStringEntry("review.billingScope.creatorCapacity", "Creator capacity");
    expectStringEntry(
      "review.billingScope.separateCosts",
      "Creator cash, product value, and fulfillment stay separate from the PopsDrops fee.",
    );
    expectStringEntry(
      "review.publishWarning.private",
      "Publishing creates the private campaign workspace, creator invite link, and PopsDrops fee record.",
    );
  });

  it("hands all sourced launches to Enterprise Concierge instead of creating a fake self-serve quote", () => {
    const budgetStep = stepSource(3);

    expect(source).toContain("requestEnterpriseConcierge");
    expect(source).toContain("requiresEnterpriseConcierge");
    expect(source).toContain('campaignMode === "sourced"');
    expect(source).toContain("if (requiresEnterpriseConcierge)");
    expect(source).toContain("navigationNextDisabled");
    expect(source).toContain("EnterpriseConciergePanel");
    expect(source).toContain("serviceFeeEstimate.requiresCustomPricing");
    expect(source).toContain("serviceFeeDisplay");
    expect(source).toContain("campaignInvestmentTotalDisplay");
    expect(source).toContain("function clearEnterpriseReview()");
    expect(source).toContain('data-testid="enterprise-concierge-panel"');
    expect(budgetStep).toContain("EnterpriseConciergePanel");
    expect(budgetStep).toContain("onRequest={requestEnterpriseReview}");
    expect(budgetStep).toContain("clearEnterpriseReview();");
    expect(campaignActionSource).toContain("export async function requestEnterpriseConcierge");
    expect(campaignActionSource).toContain('.from("enterprise_concierge_requests")');
    expect(stringSource).toContain('"investment.serviceFee.custom": "Custom"');
    expect(stringSource).toContain('"investment.total.custom": "Scope review required"');
    expect(stringSource).toContain('"enterprise.title": "Enterprise Concierge"');
    expect(stringSource).toContain('"enterprise.action": "Request quote"');
    expect(stringSource).toContain('"success.enterpriseRequested": "Concierge review requested"');
  });

  it("routes private campaigns above 100 creators to Concierge review instead of showing self-serve pricing", () => {
    const budgetStep = stepSource(3);

    expect(source).toContain("privateCapacityExceedsSelfServe");
    expect(source).toContain(
      'campaignMode === "private" && maxCreatorsForPricing > PRIVATE_CAMPAIGN_MAX_SELF_SERVE_CREATORS',
    );
    expect(source).toContain(
      "const requiresEnterpriseConcierge = privateCapacityExceedsSelfServe ||",
    );
    expect(source).toContain(
      'privateCapacityExceedsSelfServe ? t("investment.serviceFee.custom")',
    );
    expect(source).toContain(
      'privateCapacityExceedsSelfServe ? t("investment.total.custom")',
    );
    expect(budgetStep).toContain("EnterpriseConciergePanel");
    expect(stringSource).toContain('"error.creatorsCountMax":');
    expect(stringSource).toContain(
      '"Use Enterprise Concierge for more than 100 creators"',
    );
  });

  it("submits over-100 private campaigns as private capacity reviews, not sourced labor", () => {
    expect(source).toContain("campaign_mode: campaignMode");
    expect(source).toContain(
      'requestReason: privateCapacityExceedsSelfServe ? "private_capacity" : "sourcing"',
    );
    expect(source).toContain('trackingHref="/b/campaigns#enterprise-concierge-requests"');
    expect(source).toContain('data-testid="enterprise-concierge-follow-up"');
    expect(stringSource).toContain(
      '"enterprise.detail.privateCapacity": "Private campaigns above 100 creators need a scoped capacity review before the workspace is created."',
    );
    expect(stringSource).toContain(
      '"enterprise.followUp": "Track this request from Campaigns while PopsDrops scopes the quote."',
    );
  });

  it("renders the country list directly under search with room for 5 rows", () => {
    expect(marketPickerSource).not.toContain("absolute z-20");
    expect(marketPickerSource).toContain('data-testid="market-country-list"');
    expect(marketPickerSource).toContain("h-[220px]");
    expect(marketPickerSource).toContain("dropdownPanelRef");
    expect(marketPickerSource).toContain("scrollIntoView");
    expect(marketPickerSource).toContain('block: "center"');
    expect(marketPickerSource.indexOf("Search className")).toBeLessThan(
      marketPickerSource.indexOf("market-country-list"),
    );
    expect(marketPickerSource.indexOf("market-country-list")).toBeLessThan(
      marketPickerSource.indexOf("selected-markets-list"),
    );
    expect(marketPickerSource).toContain("copy.selectedCount");
  });

  it("offers global and regional campaign scopes before country search", () => {
    expect(source).toContain("MARKET_SCOPE_OPTIONS");
    expect(source).toContain("scopeOptions={marketScopeOptions}");
    expect(marketPickerSource).toContain('data-testid="market-scope-list"');
    expect(marketPickerSource).toContain("selectScope");
    expect(marketPickerSource).toContain('scope.value === "global"');
    expect(marketPickerSource.indexOf("market-scope-list")).toBeLessThan(
      marketPickerSource.indexOf("Search className"),
    );
    expect(marketPickerSource.indexOf("Search className")).toBeLessThan(
      marketPickerSource.indexOf("market-country-list"),
    );
    expect(marketPickerSource).toContain("copy.scopeLabel");
    expect(stringSource).toContain('"field.markets.scope": "Market scope"');
  });

  it("keeps selected target markets visible outside the search dropdown", () => {
    expect(marketPickerSource).toContain('data-testid="selected-markets-list"');
    expect(marketPickerSource).not.toContain('data-testid="selected-market-footer"');
    expect(marketPickerSource).toContain(")}\n      {selectedOptions.length > 0 && (");
    expect(marketPickerSource.indexOf("market-country-list")).toBeLessThan(
      marketPickerSource.indexOf("selected-markets-list"),
    );
  });

  it("does not ship taxonomy selection in the brand builder", () => {
    expect(source).not.toContain("playbooks.map");
    expect(source).not.toContain("selectedPlaybook");
    expect(source).not.toContain("playbook_id");
    expect(source).not.toContain("campaignGoalOptions");
    expect(source).not.toContain("campaignGoal");
    expect(source).not.toContain("goal.contextPrefix");
  });

  it("moves creator niche selection into creator criteria", () => {
    const briefStep = stepSource(2);

    expect(briefStep).toContain('data-testid="creator-criteria-section"');
    expect(briefStep).toContain("field.creatorCriteria");
    expect(briefStep).toContain("field.niches");
    expect(source).toContain("if (s === 2)");
    expect(source).toContain("errs.niches");
    expect(stringSource).toContain('"field.creatorCriteria": "Creator Criteria"');
    expect(stringSource).toContain('"error.nicheRequired": "Select at least one creator niche"');
  });

  it("shows human labels for deliverable formats", () => {
    const briefStep = stepSource(2);

    expect(briefStep).toContain("formatLabels[d.format as ContentFormat]");
    expect(briefStep).not.toContain("<SelectValue />");
  });

  it("uses the milestone rail as the inline campaign timeline selector", () => {
    const budgetStep = stepSource(3);
    const selectorFunctionStart = source.indexOf("function CampaignTimelineSelector(");
    const selectorFunctionEnd = source.indexOf("// ---------------------------------------------------------------------------", selectorFunctionStart);
    const selectorSource = source.slice(selectorFunctionStart, selectorFunctionEnd);

    expect(source).toContain("function CampaignTimelineSelector(");
    expect(source).toContain("function TimelineCalendar(");
    expect(source).toContain("activeTimelineField");
    expect(source).toContain("if (!dates.startDate && !dates.endDate) return copy.notSet");
    expect(source).toContain('data-testid="campaign-timeline-milestone-overview"');
    expect(source).toContain('data-testid="campaign-timeline-summary"');
    expect(source).toContain('data-testid="campaign-timeline-selector"');
    expect(source).toContain('data-testid="timeline-calendar-grid"');
    expect(source).toContain('data-testid="timeline-rail-selector-button"');
    expect(source).toContain("activeTimelineField={activeTimelineField}");
    expect(source).toContain("onSelectField={selectTimelineField}");
    expect(source).toContain('data-timeline-selected-field={activeTimelineField}');
    expect(source).toContain("aria-pressed={isSelected}");
    expect(selectorSource).toContain("<TimelineMilestoneRail");
    expect(selectorSource.indexOf("<TimelineMilestoneRail")).toBeLessThan(
      selectorSource.indexOf("<TimelineCalendar"),
    );
    expect(selectorSource).not.toContain("timelineFields.map");
    expect(source).not.toContain("grid grid-cols-2 gap-2 sm:grid-cols-5");
    expect(source).not.toContain('data-testid="timeline-active-field-indicator"');
    expect(source).not.toContain("function CalendarDatePicker(");
    expect(source).not.toContain("calendarPanelRef");
    expect(source).not.toContain("DialogTrigger");
    expect(source).not.toContain("  CalendarDays,");
    expect(budgetStep).toContain("CampaignTimelineSelector");
    expect(budgetStep).not.toContain("CampaignTimelineEditor");
    expect(budgetStep).not.toContain("CalendarDatePicker");
    expect(budgetStep).not.toContain('type="date"');
    expect(budgetStep).not.toContain("timeline.edit");
    expect(stringSource).toContain('"timeline.title": "Campaign Timeline"');
    expect(stringSource).not.toContain('"timeline.selecting":');
    expect(stringSource).not.toContain('"timeline.edit":');
  });

  it("visually separates campaign boundaries, range days, and milestones", () => {
    expect(source).toContain("function getTimelineMilestoneMarker(");
    expect(source).toContain("function getTimelineMilestoneTone(");
    expect(source).toContain("const timelineMilestoneToneClassNames");
    expect(source).toContain("isMilestoneOutsideWindow");
    expect(source).toContain("data-timeline-tone");
    expect(source).toContain('data-timeline-tone={timelineTone}');
    expect(source).toContain("data-timeline-milestone-tone={milestoneTone ?? undefined}");
    expect(source).toContain('"timeline-boundary"');
    expect(source).toContain('"timeline-range"');
    expect(source).toContain('"timeline-milestone-outside"');
    expect(source).toContain('"timeline-milestone-marker"');
    expect(source).toContain("copy.milestoneLabels.application");
    expect(source).toContain("copy.milestoneLabels.content");
    expect(source).toContain("copy.milestoneLabels.performance");
    expect(source).toContain('"bg-sky-700 text-white"');
    expect(source).toContain('"bg-amber-600 text-white"');
    expect(source).toContain('"bg-teal-700 text-white"');
    expect(source).not.toContain("isActive || isWindowEdge");
    expect(stringSource).toContain('"timeline.application.marker": "Apps"');
    expect(stringSource).toContain('"timeline.content.marker": "Due"');
    expect(stringSource).toContain('"timeline.performance.marker": "Data"');
  });

  it("uses compact numeric dates in the timeline summary and rail selector", () => {
    expect(source).toContain("function formatCompactTimelineDate(");
    expect(source).toContain('return value.replaceAll("-", "/")');
    expect(source).toContain("function formatTimelineDate(value: string, fallback: string)");
    expect(source).toContain("formatCompactTimelineDate(value) || fallback");
    expect(source).toContain("formatTimelineDate(value, copy.notSet)");
    expect(source).not.toContain("formatTimelineDate(value, locale, copy.notSet)");
  });

  it("adds a post-campaign performance due milestone for creator metrics", () => {
    expect(source).toContain(
      'type TimelineField = "start" | "end" | "application" | "content" | "performance"',
    );
    expect(source).toContain("performanceDeadline");
    expect(source).toContain("setPerformanceDeadline");
    expect(source).toContain("getDefaultPerformanceDueDate");
    expect(source).toContain("addCalendarDays");
    expect(source).toContain("performance_due_date: performanceDeadline || undefined");
    expect(source).toContain('if (field === "content") setActiveTimelineField("performance")');
    expect(source).toContain("isPerformanceMilestonePostCampaign");
    expect(source).toContain('"timeline-milestone-post-campaign"');
    expect(stringSource).toContain('"timeline.performance": "Performance due"');
    expect(stringSource).toContain('"timeline.performance.marker": "Data"');
  });

  it("lets brands choose reporting cadence without forcing daily work by default", () => {
    const budgetStep = stepSource(3);
    const reviewStep = reviewStepSource();

    expect(source).toContain('type ReportingCadence = "final_only" | "weekly" | "daily_launch_window"');
    expect(source).toContain('useState<ReportingCadence>("final_only")');
    expect(source).toContain("function ReportingCadenceSelector(");
    expect(budgetStep).toContain('data-testid="campaign-reporting-cadence"');
    expect(budgetStep).toContain("ReportingCadenceSelector");
    expect(source).toContain("reporting_cadence: reportingCadence");
    expect(reviewStep).toContain("review.label.reporting");
    expect(reviewStep).toContain("selectedReportingCadenceLabel");
    expect(stringSource).toContain('"reporting.title": "Reporting cadence"');
    expect(stringSource).toContain('"reporting.final.title": "Final report"');
    expect(stringSource).toContain('"reporting.keyReads.title": "Key reads"');
    expect(stringSource).toContain('"reporting.daily.title": "Daily window"');
    expect(stringSource).toContain('"review.label.reporting": "Reporting"');
  });

  it("lets brands choose a campaign report goal before creators start submitting proof", () => {
    const budgetStep = stepSource(3);
    const reviewStep = reviewStepSource();

    expect(source).toContain("listReportCompositionTemplates");
    expect(source).toContain("reportGoalTemplates");
    expect(source).toContain("applyCampaignReportTemplate");
    expect(budgetStep).toContain("ReportGoalSelector");
    expect(source).toContain('data-testid="campaign-report-goal"');
    expect(source).toContain('data-testid="campaign-report-goal-template"');
    expect(source).toContain('data-testid="campaign-report-goal-preset"');
    expect(source).toContain("report_template_id: selectedReportTemplateId");
    expect(source).toContain("report_preset_id: selectedReportPresetId");
    expect(source).toContain("report_chart_mode_id: selectedReportChartModeId");
    expect(source).toContain("report_block_ids: selectedReportBlockIds");
    expect(reviewStep).toContain("review.label.reportGoal");
    expect(reviewStep).toContain("selectedReportGoalTitle");
    expectStringEntry("reportGoal.title", "Report goal");
    expectStringEntry(
      "reportGoal.detail",
      "Choose the executive proof shape before creators submit evidence.",
    );
    expectStringEntry("review.label.reportGoal", "Report goal");
  });

  it("frames the selected report goal as the proof output of the campaign", () => {
    const budgetStep = stepSource(3);
    const reviewStep = reviewStepSource();

    expect(source).toContain("REPORT_BUILDER_BLOCKS");
    expect(source).toContain("REPORT_BUILDER_CHART_MODES");
    expect(source).toContain("selectedReportGoalBlockLabels");
    expect(source).toContain("selectedReportGoalChartLabel");
    expect(budgetStep).toContain("ReportGoalOutputPreview");
    expect(source).toContain('data-testid="campaign-report-output-preview"');
    expect(source).toContain('data-testid="campaign-report-output-block"');
    expect(reviewStep).toContain("review.label.reportChart");
    expect(reviewStep).toContain("review.label.reportBlocks");
    expect(reviewStep).toContain("selectedReportGoalChartLabel");
    expect(reviewStep).toContain("selectedReportGoalBlockLabels.join");
    expectStringEntry("reportGoal.outputEyebrow", "Proof output");
    expectStringEntry(
      "reportGoal.outputTitle",
      "The report this campaign will produce",
    );
    expectStringEntry(
      "reportGoal.outputDetail",
      "Creator proof tasks and the final shared report follow this shape.",
    );
    expectStringEntry("reportGoal.blocksLabel", "Report blocks");
    expectStringEntry("reportGoal.creatorProofLabel", "Creator proof");
    expectStringEntry(
      "reportGoal.creatorProofDetail",
      "Creators see the metrics and evidence needed to support this report.",
    );
    expectStringEntry("review.label.reportChart", "Report chart");
    expectStringEntry("review.label.reportBlocks", "Report blocks");
  });

  it("does not let the default report template overwrite a brand's report goal choice", () => {
    expect(source).toContain("reportGoalUserSelectionRef");
    expect(source).toContain("markUserSelection");
    expect(source).toContain("reportGoalUserSelectionRef.current = true");
    expect(source).toContain("!reportGoalUserSelectionRef.current");
    expect(source).toContain(
      "applyCampaignReportTemplate(defaultTemplate, { markUserSelection: false })",
    );
  });

  it("uses a goal-led measurement contract instead of making brands choose from a wall of metrics", () => {
    const budgetStep = stepSource(3);
    const reviewStep = reviewStepSource();

    expect(source).toContain(
      'type MeasurementContractGoal = "awareness" | "engagement_quality" | "traffic_actions" | "luxury_proof"',
    );
    expect(source).toContain('useState<MeasurementContractGoal>("luxury_proof")');
    expect(source).toContain("function MeasurementContractSelector(");
    expect(source).toContain("buildMeasurementContractReportingRequirements({");
    expect(source).toContain("selectedMetricKeysByPlatform");
    expect(budgetStep).toContain('data-testid="campaign-measurement-contract"');
    expect(budgetStep).toContain("MeasurementContractSelector");
    expect(reviewStep).toContain("review.label.measurement");
    expect(reviewStep).toContain("selectedMeasurementContractLabel");
    expect(stringSource).toContain('"measurement.title": "Measurement contract"');
    expect(stringSource).toContain('"measurement.luxury.title": "Executive proof"');
    expect(stringSource).toContain('"measurement.engagement.title": "Quality engagement"');
    expect(stringSource).toContain('"measurement.requiredFields": "Creator fields"');
  });

  it("keeps additional proof channels in the measurement contract instead of publishing platforms", () => {
    const measurementStep = stepSource(3);

    expect(source).toContain("additionalProofChannels");
    expect(source).toContain("toggleAdditionalProofChannel");
    expect(source).toContain("additionalProofChannels={additionalProofChannels}");
    expect(source).toContain("additionalProofChannels:");
    expect(measurementStep).toContain("measurement.additionalProof.title");
    expect(measurementStep).toContain("measurement.additionalProof.x");
    expect(measurementStep).toContain("measurement.additionalProof.generic");
    expect(measurementStep).not.toContain("field.platforms.custom");
  });

  it("creates proof requirements for every selected first-class campaign platform", () => {
    const buildInputStart = source.indexOf("function buildCampaignInput()");
    const buildInputEnd = source.indexOf(
      "function buildAgreementDraftInput",
      buildInputStart,
    );
    const buildInputSource = source.slice(buildInputStart, buildInputEnd);

    expect(source).toContain("buildCampaignPlatformDeliverables");
    expect(source).toContain("getCampaignDeliverablePlatforms");
    expect(buildInputSource).toContain("buildCampaignPlatformDeliverables({");
    expect(buildInputSource).toContain("platforms,");
    expect(buildInputSource).toContain("deliverables,");
    expect(buildInputSource).not.toContain("platforms[0]");
    expect(source).toContain('"error.standardPlatformRequired"');
  });

  it("auto-places editable middle timeline milestones after start and end are selected", () => {
    expect(source).toContain("function getDefaultApplicationDeadline(");
    expect(source).toContain("function getDefaultContentDeadline(");
    expect(source).toContain("nextDates.applicationDeadline = getDefaultApplicationDeadline(");
    expect(source).toContain("nextDates.contentDeadline = getDefaultContentDeadline(");
    expect(source).toContain("compareDateStrings(nextDates.applicationDeadline, nextDates.startDate) < 0");
    expect(source).toContain("compareDateStrings(nextDates.applicationDeadline, nextDates.endDate) > 0");
    expect(source).toContain("compareDateStrings(nextDates.contentDeadline, nextDates.startDate) < 0");
    expect(source).toContain("compareDateStrings(nextDates.contentDeadline, nextDates.endDate) > 0");
  });

  it("renders a live milestone rail inside the campaign timeline selector", () => {
    const budgetStep = stepSource(3);
    const timelineSummaryStart = budgetStep.indexOf('data-testid="campaign-timeline-summary"');
    const timelineSelectorStart = budgetStep.indexOf("<CampaignTimelineSelector");
    const selectorFunctionStart = source.indexOf("function CampaignTimelineSelector(");
    const selectorFunctionEnd = source.indexOf("// ---------------------------------------------------------------------------", selectorFunctionStart);
    const selectorSource = source.slice(selectorFunctionStart, selectorFunctionEnd);
    const milestoneOverviewStart = selectorSource.indexOf(
      'data-testid="campaign-timeline-milestone-overview"',
    );
    const timelineCalendarStart = selectorSource.indexOf("<TimelineCalendar");

    expect(source).toContain("function getTimelineMilestonePosition(");
    expect(source).toContain("function formatTimelineMilestoneDate(");
    expect(source).toContain("function TimelineMilestoneRail(");
    expect(source).toContain('data-testid="timeline-milestone-rail"');
    expect(source).toContain("data-timeline-rail-tone");
    expect(source).toContain("data-timeline-outside-direction={timelineRailPoint.outsideDirection}");
    expect(source).toContain("timelineRailStartPosition");
    expect(source).toContain("timelineRailEndPosition");
    expect(source).toContain("timelineRailPoint");
    expect(source).toContain("timelineRailDate");
    expect(source).toContain('"timeline-rail-outside-label"');
    expect(source).toContain('"timeline-rail-outside-dot"');
    expect(source).toContain("insetInlineStart: `${timelineRailPoint.position}%`");
    expect(milestoneOverviewStart).toBeGreaterThan(-1);
    expect(timelineCalendarStart).toBeGreaterThan(milestoneOverviewStart);
    expect(budgetStep).not.toContain('data-testid="campaign-timeline-milestone-overview"');
    expect(timelineSummaryStart).toBeGreaterThan(-1);
    expect(timelineSelectorStart).toBeGreaterThan(timelineSummaryStart);
    expect(selectorSource).toContain("<TimelineMilestoneRail");
    expect(source).toContain("copy.railLabel");
    expect(stringSource).toContain('"timeline.rail.label": "Campaign timeline milestones"');
  });

  it("keeps outside milestones visually separate from the campaign rail", () => {
    expect(source).toContain("const timelineRailStartPosition = 12");
    expect(source).toContain("const timelineRailEndPosition = 80");
    expect(source).toContain("const timelineRailOutsideAfterPosition = 92");
    expect(source).toContain('const timelineRailOutsideBoundaryGap = "14px"');
    expect(source).toContain("? `top-0 ${outsideMarkerPlacement}`");
    expect(source).toContain("timeline-rail-outside-label");
    expect(source).toContain("timelineRailOutsideDotClassName");
    expect(source).toContain('data-timeline-rail-tone="timeline-outside-extension"');
    expect(source).toContain('data-timeline-rail-tone="timeline-post-campaign-extension"');
    expect(source).toContain("absolute top-10 h-1 -translate-y-1/2 rounded-full");
    expect(source).toContain(
      "insetInlineStart: `calc(${timelineRailEndPosition}% + ${timelineRailOutsideBoundaryGap})`",
    );
    expect(source).toContain(
      "insetInlineEnd: `calc(${100 - timelineRailStartPosition}% + ${timelineRailOutsideBoundaryGap})`",
    );
    expect(source).toContain(
      "repeating-linear-gradient(to right, rgb(252 165 165) 0 8px, transparent 8px 14px)",
    );
    expect(source).toContain(
      "repeating-linear-gradient(to right, rgb(13 148 136) 0 8px, transparent 8px 14px)",
    );
  });

  it("anchors boundary labels to the actual rail endpoints", () => {
    expect(source).toContain('data-timeline-boundary-label="start"');
    expect(source).toContain('data-timeline-boundary-label="end"');
    expect(source).toContain("style={{ insetInlineStart: `${timelineRailStartPosition}%` }}");
    expect(source).toContain("style={{ insetInlineStart: `${timelineRailEndPosition}%` }}");
    expect(source).not.toContain("flex items-start justify-between gap-4 text-xs");
  });

  it("keeps timeline milestones visible above the inline calendar grid", () => {
    const budgetStep = stepSource(3);
    const selectorFunctionStart = source.indexOf("function CampaignTimelineSelector(");
    const selectorFunctionEnd = source.indexOf("// ---------------------------------------------------------------------------", selectorFunctionStart);
    const selectorSource = source.slice(selectorFunctionStart, selectorFunctionEnd);
    const milestoneOverviewStart = selectorSource.indexOf(
      'data-testid="campaign-timeline-milestone-overview"',
    );
    const timelineCalendarStart = selectorSource.indexOf("<TimelineCalendar");
    const summaryStart = budgetStep.indexOf('data-testid="campaign-timeline-summary"');
    const selectorStart = budgetStep.indexOf("<CampaignTimelineSelector", summaryStart);

    expect(milestoneOverviewStart).toBeGreaterThan(-1);
    expect(timelineCalendarStart).toBeGreaterThan(milestoneOverviewStart);
    expect(summaryStart).toBeGreaterThan(-1);
    expect(selectorStart).toBeGreaterThan(summaryStart);
    expect(budgetStep).not.toContain("hasTimelineSummary &&");
  });

  it("uses a campaign investment planner instead of a budget range", () => {
    const budgetStep = stepSource(3);

    expect(source).toContain("function CampaignInvestmentPlanner(");
    expect(budgetStep).toContain('data-testid="campaign-investment-planner"');
    expect(budgetStep).toContain("CampaignInvestmentPlanner");
    expect(budgetStep).not.toContain("compensationOptions.map");
    expect(source).not.toContain('data-testid="compensation-model-control"');
    expect(source).not.toContain("CompensationModel");
    expect(source).not.toContain("compensationModel");
    expect(source).not.toContain("setCompensationModel");
    expect(source).not.toContain("compensationOptions");
    expect(source).not.toContain('data-testid="compensation-model-description"');
    expect(source).not.toContain("selectedCompensationOption?.description");
    expect(source).not.toContain("copy.title");
    expect(source).not.toContain("copy.description");
    expect(source).not.toContain("copy.compensationModel");
    expect(source).toContain('data-testid="investment-input-list"');
    expect(source).toContain('data-testid="investment-input-row"');
    expect(source).toContain('data-testid="investment-input-control"');
    expect(source).toContain('data-testid="investment-cost-breakdown"');
    expect(source).toContain('data-testid="creator-cash-formula"');
    expect(source).toContain('data-testid="popsdrops-fee-summary-row"');
    expect(source).toContain('data-testid="campaign-total-summary-row"');
    expect(source).toContain("investmentInputItems.map");
    expect(source).toContain("icon: Users");
    expect(source).toContain("icon: DollarSign");
    expect(source).toContain("icon: Package");
    expect(source).toContain("icon: Truck");
    expect(source).toContain('aria-label={copy.decreaseCreators}');
    expect(source).toContain('aria-label={copy.increaseCreators}');
    expect(source).toContain("[appearance:textfield]");
    expect(source).not.toContain('data-testid="investment-input-grid"');
    expect(source).not.toContain('data-testid="investment-input-tile"');
    expect(budgetStep).toContain("creatorBudgetPerCreator");
    expect(budgetStep).toContain("campaignInvestmentTotal");
    expect(source).toContain("const creatorCashFormula");
    expect(source).toContain('`${creatorCountNumber} x ${formatMoneyAmount(creatorBudgetPerCreator, locale)}`');
    expect(source).toContain("serviceFeeDisplay={serviceFeeDisplay}");
    expect(source).toContain("const resolvedServiceFeeDisplay");
    expect(source).not.toContain('data-testid="investment-summary-grid"');
    expect(source).not.toContain("copy.savedBudgetHint");
    expect(budgetStep).not.toContain("field.budgetRange");
    expect(budgetStep).not.toContain("field.budgetMin");
    expect(budgetStep).not.toContain("field.budgetMax");
    expect(stringSource).not.toContain('"investment.title": "Campaign investment"');
    expect(stringSource).not.toContain('"investment.description":');
    expect(stringSource).not.toContain('"investment.compensationModel":');
    expect(stringSource).not.toContain('"investment.compensation.productOnly":');
    expect(stringSource).not.toContain('"investment.compensation.productCash":');
    expect(stringSource).not.toContain('"investment.compensation.cashOnly":');
    expect(stringSource).not.toContain('"investment.compensation.affiliate":');
    expect(stringSource).not.toContain('"investment.compensation.productOnly.desc":');
    expect(stringSource).not.toContain('"investment.compensation.productCash.desc":');
    expect(stringSource).not.toContain('"investment.compensation.cashOnly.desc":');
    expect(stringSource).not.toContain('"investment.compensation.affiliate.desc":');
    expect(stringSource).toContain('"field.creatorsCount": "Creators"');
    expect(stringSource).toContain('"investment.creatorBudget": "Creator cash"');
    expect(source).not.toContain("description={item.description}");
    expect(stringSource).not.toContain('"investment.creatorsCount.hint":');
    expect(stringSource).not.toContain('"investment.creatorBudget.hint":');
    expect(stringSource).not.toContain('"investment.productValue.hint":');
    expect(stringSource).not.toContain('"investment.fulfillment.hint":');
    expect(stringSource).toContain('"investment.creators.decrease": "Decrease creators"');
    expect(stringSource).toContain('"investment.creators.increase": "Increase creators"');
    expect(stringSource).toContain('"investment.productValue": "Product value"');
    expect(stringSource).toContain('"investment.fulfillment": "Fulfillment"');
    expect(stringSource).toContain('"investment.serviceFee": "PopsDrops fee"');
    expect(stringSource).not.toContain('"investment.perCreator":');
    expect(stringSource).toContain('"investment.total": "Total"');
    expect(stringSource).not.toContain('"investment.savedBudgetHint":');
  });

  it("saves creator cash budget separately from the on-screen investment estimate", () => {
    expect(source).toContain("const creatorBudgetAmount = parseMoneyAmount(creatorBudget)");
    expect(source).toContain("budget_min: creatorBudgetAmount");
    expect(source).toContain("budget_max: creatorBudgetAmount");
    expect(source).toContain("serviceFeeEstimate.feeCents / 100");
    expect(source).not.toContain("budget_min: Number(budgetMin)");
    expect(source).not.toContain("budget_max: Number(budgetMax)");
  });

  it("validates campaign investment and timeline rules before review", () => {
    expect(source).toContain("const hasCampaignInvestment");
    expect(source).toContain('errs.budget = t("error.investmentRequired")');
    expect(source).not.toContain("Number(budgetMax) < Number(budgetMin)");
    expect(source).not.toContain('errs.budget = t("error.budgetOrder")');
    expect(source).toContain("compareDateStrings");
    expect(source).toContain('errs.dates = t("error.dateOrder")');
    expect(source).toContain("compareDateStrings(applicationDeadline, startDate) < 0");
    expect(source).not.toContain("compareDateStrings(applicationDeadline, startDate) > 0");
    expect(source).toContain("compareDateStrings(performanceDeadline, endDate) < 0");
    expectStringEntry(
      "error.investmentRequired",
      "Add creator compensation, product value, or fulfillment budget",
    );
    expectStringEntry(
      "error.dateOrder",
      "Timeline dates must move from applications to content, campaign end, then performance due",
    );
  });

  it("saves the brand's freeform idea as the brief description", () => {
    expect(source).toContain("brief_description: description.trim()");
    expect(source).toContain("if (s === 1)");
    expect(source).toContain("errs.description");
    expect(source).not.toContain("function buildBriefDescription()");
  });

  it("keeps agreement gate setup after campaign details and before launch review", () => {
    expect(source).toContain("agreementGateEnabled");
    expect(source).toContain("buildDefaultAgreementRules");
    expect(source).toContain("Campaign Rules");
    expect(source).toContain("agreement.previewSummary");
  });

  it("resets scroll position when the wizard step changes", () => {
    expect(source).toContain("window.scrollTo({");
    expect(source).toContain("}, [step]);");
  });

  it("keeps wizard navigation visible on compact viewports", () => {
    expect(source).toContain("fixed inset-x-0 bottom-0");
  });
});
