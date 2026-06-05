import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const publicApplySource = readFileSync(
  new URL("../../../../apply/[id]/page.tsx", import.meta.url),
  "utf8",
);
const stringsSource = readFileSync(
  new URL("../../../../../../lib/i18n/strings.ts", import.meta.url),
  "utf8",
);
const generatedEnglishSource = readFileSync(
  new URL(
    "../../../../../../lib/i18n/generated/platform-bundles/en.json",
    import.meta.url,
  ),
  "utf8",
);
const designSource = readFileSync(
  new URL("../../../../../../../DESIGN.md", import.meta.url),
  "utf8",
);

describe("creator campaign detail budget flow", () => {
  it("shows total creator cash as per-creator compensation", () => {
    expect(source).toContain("formatBudgetPerCreatorRange(");
    expect(source).toContain("getBudgetPerCreatorAmount(");
    expect(source).not.toContain("const budgetStr = formatBudgetRange(");

    expect(publicApplySource).toContain("formatBudgetPerCreatorRange(");
    expect(publicApplySource).not.toContain("formatBudgetRange(");
  });

  it("keeps the public apply header aware of signed-in users", () => {
    expect(publicApplySource).toContain("const headerHref =");
    expect(publicApplySource).toContain('userRole === "creator"');
    expect(publicApplySource).toContain('userRole === "brand"');
    expect(publicApplySource).toContain("const headerLabel =");
    expect(publicApplySource).not.toContain('href="/login"');
  });

  it("labels usage rights scope instead of duration", () => {
    expect(stringsSource).toContain('"usage.duration": "Scope: {value}"');
    expect(generatedEnglishSource).toContain('"usage.duration": "Scope: {value}"');
    expect(source).toContain("function formatUsageRight(value: string): string");
    expect(source).toContain("formatUsageRight(campaign.usage_rights_duration)");
    expect(source).toContain("formatUsageRight(campaign.usage_rights_territory)");
    expect(stringsSource).not.toContain('"usage.duration": "Duration: {value}"');
    expect(generatedEnglishSource).not.toContain(
      '"usage.duration": "Duration: {value}"',
    );
    expect(source).not.toContain("formatSnakeCase(campaign.usage_rights_duration)");
  });

  it("renders the creator-facing campaign image and Creative Kit before application", () => {
    expect(source).toContain("campaign_assets");
    expect(source).toContain("createSignedUrls");
    expect(source).toContain("pickCreatorFacingHeroAsset");
    expect(source).toContain('data-testid="creator-campaign-hero-asset"');
    expect(source).toContain('data-testid="creator-campaign-hero-fallback-visual"');
    expect(source).toContain('data-testid="creator-creative-kit"');
    expect(source).toContain('data-testid="creator-creative-kit-asset"');
    expect(source).toContain("formatCreativeAssetCount(");
    expect(stringsSource).toContain('"creativeKit.assetSingular": "{count} asset"');
    expect(stringsSource).toContain('"creativeKit.assetPlural": "{count} assets"');
  });

  it("keeps Creative Kit assets compact and branded when thumbnails are loading", () => {
    const creativeKitSource = source.slice(
      source.indexOf('data-testid="creator-creative-kit"'),
      source.indexOf("{getBriefField(\"description\")"),
    );

    expect(creativeKitSource).toContain(
      'data-testid="creator-creative-kit-asset"',
    );
    expect(creativeKitSource).toContain("flex min-w-0 items-center gap-3");
    expect(creativeKitSource).toContain("relative size-16");
    expect(creativeKitSource).toContain("bg-slate-950");
    expect(creativeKitSource).toContain("radial-gradient");
    expect(creativeKitSource).toContain("brandInitials(brand.company_name)");
    expect(creativeKitSource).toContain('loading="eager"');
    expect(creativeKitSource).not.toContain("aspect-[4/3]");
    expect(creativeKitSource).not.toContain("ImageIcon");
    expect(designSource).toContain(
      "Public Creative Kit previews must never look like blank upload placeholders.",
    );
  });

  it("shows a compact application readiness check before the pitch form", () => {
    const readinessIndex = source.indexOf('data-testid="creator-apply-readiness"');
    const applyFormIndex = source.indexOf('id="apply-form"');

    expect(readinessIndex).toBeGreaterThan(-1);
    expect(applyFormIndex).toBeGreaterThan(-1);
    expect(readinessIndex).toBeLessThan(applyFormIndex);
    expect(source).toContain("applicationReadinessRows");
    expect(source).toContain('t("readiness.title")');
    expect(source).toContain('t("readiness.profileReady")');
    expect(source).toContain('t("readiness.missingPlatforms"');
  });

  it("shows reporting cadence as a creator obligation before the pitch form", () => {
    const readinessSource = source.slice(
      source.indexOf('data-testid="creator-apply-readiness"'),
      source.indexOf('data-testid="creator-application-card"'),
    );

    expect(source).toContain("campaign_reporting_plans");
    expect(source).toContain("reportingPlan");
    expect(source).toContain("getReportingCadenceDetail");
    expect(source).toContain('label: t("readiness.reportingCadence")');
    expect(readinessSource).toContain("applicationReadinessRows.map");
    expect(stringsSource).toContain('"readiness.reportingCadence": "Reporting cadence"');
    expect(stringsSource).toContain('"reportingCadence.daily": "Daily reads during monitoring"');
    expect(generatedEnglishSource).toContain('"readiness.reportingCadence": "Reporting cadence"');
  });

  it("shows the creator campaign flow before the brief and pitch form", () => {
    const flowIndex = source.indexOf('data-testid="creator-campaign-handoff-sequence"');
    const briefIndex = source.indexOf('t("brief.label")');
    const applyFormIndex = source.indexOf('id="apply-form"');

    expect(flowIndex).toBeGreaterThan(-1);
    expect(briefIndex).toBeGreaterThan(-1);
    expect(applyFormIndex).toBeGreaterThan(-1);
    expect(flowIndex).toBeLessThan(briefIndex);
    expect(flowIndex).toBeLessThan(applyFormIndex);
    expect(source).toContain("creatorCampaignHandoffSteps");
    expect(source).toContain('data-testid="creator-campaign-handoff-step"');
    expect(source).toContain('t("handoff.title")');
    expect(source).toContain('t("handoff.brief")');
    expect(source).toContain('t("handoff.deliverables")');
    expect(source).toContain('t("handoff.proof")');
    expect(source).toContain('t("handoff.apply")');
  });

  it("keeps the creator campaign flow readable without horizontal clipping", () => {
    const flowSource = source.slice(
      source.indexOf('data-testid="creator-campaign-handoff-sequence"'),
      source.indexOf("{/* Brief */}"),
    );

    expect(flowSource).toContain('aria-label={t("handoff.title")}');
    expect(flowSource).toContain("grid-cols-1");
    expect(flowSource).toContain("grid-cols-5");
    expect(flowSource).toContain("sm:grid-cols-5");
    expect(flowSource).not.toContain("overflow-x-auto");
    expect(flowSource).not.toContain("min-w-[36rem]");
    expect(flowSource).not.toContain("min-w-[8.5rem]");
  });

  it("keeps the apply CTA as a quiet helper jump before the campaign steps", () => {
    const headerSource = source.slice(
      source.indexOf("{/* Key numbers */}"),
      source.indexOf('data-testid="creator-campaign-handoff-sequence"'),
    );
    const summaryRowSource = source.slice(
      source.indexOf('data-testid="creator-campaign-summary-row"'),
      source.indexOf('data-testid="creator-campaign-handoff-sequence"'),
    );

    expect(headerSource).toContain('data-testid="creator-campaign-summary-row"');
    expect(headerSource).toContain('data-testid="creator-campaign-apply-jump"');
    expect(summaryRowSource).toContain('data-testid="creator-campaign-apply-jump"');
    expect(headerSource).toContain('variant="outline"');
    expect(headerSource).toContain('size="sm"');
    expect(headerSource).toContain("sm:flex-row sm:items-center sm:justify-between");
    expect(headerSource).toContain('.getElementById("apply-form")');
    expect(headerSource).toContain("scrollIntoView");
    expect(headerSource).not.toContain("w-full");
    expect(headerSource).not.toContain('size="lg"');
    expect(headerSource).not.toContain("mt-5 flex justify-end");
    expect(source).not.toContain("fixed inset-x-0");
    expect(source).not.toContain("{/* Mobile sticky apply bar */}");
    expect(designSource).toContain(
      "Creator application CTAs must never overlap or sit as a full-width slab on top of the campaign flow rail.",
    );
  });

  it("uses a Chrome-friendly numeric text field for creator rate entry", () => {
    const rateFieldSource = source.slice(
      source.indexOf('htmlFor="rate"'),
      source.indexOf('htmlFor="pitch"'),
    );

    expect(rateFieldSource).toContain('type="text"');
    expect(rateFieldSource).toContain('inputMode="numeric"');
    expect(rateFieldSource).toContain('pattern="[0-9]*"');
    expect(rateFieldSource).toContain('replace(/\\D/g, "")');
    expect(rateFieldSource).not.toContain('type="number"');
  });

  it("prioritizes the above-the-fold creator campaign image", () => {
    const heroImageSource = source.slice(
      source.indexOf('data-testid="creator-campaign-hero-asset"'),
      source.indexOf("{/* Header */}"),
    );

    expect(heroImageSource).toContain("heroAsset?.signedUrl");
    expect(heroImageSource).toContain("priority");
    expect(heroImageSource).toContain('loading="eager"');
    expect(heroImageSource).toContain("creator-campaign-hero-fallback-visual");
    expect(heroImageSource).not.toContain("ImageIcon");
  });

  it("keeps Creative Kit thumbnails eager at compact size when they remain above the fold", () => {
    const creativeKitSource = source.slice(
      source.indexOf('data-testid="creator-creative-kit"'),
      source.indexOf("{getBriefField(\"description\")"),
    );

    expect(creativeKitSource).toContain('sizes="64px"');
    expect(creativeKitSource).toContain('loading="eager"');
    expect(creativeKitSource).toContain("priority={asset.id === heroAsset?.id}");
  });

  it("defaults creator brief copy to the reviewed campaign language when available", () => {
    expect(source).toContain("activeTranslationLocale");
    expect(source).toContain("translatedBriefLocale");
    expect(source).toContain("getBriefField");
    expect(source).toContain("brief_translated");
    expect(publicApplySource).toContain("activeTranslationLocale");
    expect(publicApplySource).toContain("getPublicBriefField");
  });

  it("gives the save campaign icon button an accessible state and label", () => {
    expect(source).toContain('aria-pressed={saved}');
    expect(source).toContain('saved ? t("action.removeSavedCampaign") : t("action.saveCampaign")');
    expect(stringsSource).toContain('"action.saveCampaign": "Save campaign"');
    expect(stringsSource).toContain('"action.removeSavedCampaign": "Remove saved campaign"');
    expect(generatedEnglishSource).toContain('"action.saveCampaign": "Save campaign"');
    expect(generatedEnglishSource).toContain(
      '"action.removeSavedCampaign": "Remove saved campaign"',
    );
  });

  it("turns the application area into a clear brand review handoff", () => {
    const applicationSource = source.slice(
      source.indexOf('data-testid="creator-application-card"'),
      source.indexOf("{/* End application */}"),
    );

    expect(applicationSource).toContain('data-testid="creator-application-review-summary"');
    expect(applicationSource).toContain('data-testid="creator-application-rate-field"');
    expect(applicationSource).toContain('data-testid="creator-application-pitch-field"');
    expect(applicationSource).toContain('t("apply.reviewTitle")');
    expect(applicationSource).toContain('t("apply.reviewDetail")');
    expect(applicationSource).toContain('t("apply.rateReview")');
    expect(applicationSource).toContain('t("apply.pitchReview")');
    expect(stringsSource).toContain('"apply.reviewTitle": "Brand review"');
    expect(stringsSource).toContain('"apply.reviewDetail"');
    expect(stringsSource).toContain(
      '"Send your rate and pitch. The brand decides before the campaign room unlocks."',
    );
  });

  it("shows private invite context only after the token is verified for this creator", () => {
    const applicationSource = source.slice(
      source.indexOf('data-testid="creator-application-card"'),
      source.indexOf("{/* End application */}"),
    );

    expect(source).toContain("getCreatorCampaignInviteContext");
    expect(source).toContain('type PrivateInviteContextState = "none" | "verified" | "unavailable"');
    expect(source).toContain("const [verifiedInviteId, setVerifiedInviteId]");
    expect(source).toContain("setVerifiedInviteId(inviteContext.inviteId);");
    expect(source).toContain('setPrivateInviteContext("verified");');
    expect(source).toContain('setPrivateInviteContext("unavailable");');
    expect(applicationSource).toContain('privateInviteContext === "verified"');
    expect(applicationSource).toContain('data-testid="creator-private-invite-context"');
    expect(applicationSource).toContain('privateInviteContext === "unavailable"');
    expect(applicationSource).toContain('data-testid="creator-private-invite-unavailable"');
    expect(applicationSource).toContain("invite_id: verifiedInviteId ?? undefined");
    expect(applicationSource).not.toContain("{inviteId && (");
    expect(stringsSource).toContain('"privateInvite.unavailableTitle": "Invite link unavailable"');
    expect(generatedEnglishSource).toContain(
      '"privateInvite.unavailableTitle": "Invite link unavailable"',
    );
  });

  it("keeps verified private invite context neutral when applications are closed", () => {
    const applicationSource = source.slice(
      source.indexOf('data-testid="creator-application-card"'),
      source.indexOf("{/* End application */}"),
    );

    expect(source).toContain("creatorPrivateInviteClosedDetailKeys");
    expect(source).toContain("const creatorPrivateInviteClosed = privateInviteContext === \"verified\" && applicationClosed;");
    expect(source).toContain("const creatorPrivateInviteDetailKey =");
    expect(source).toContain("const CreatorPrivateInviteIcon = creatorPrivateInviteClosed ? Shield : CheckCircle2;");
    expect(applicationSource).toContain("CreatorPrivateInviteIcon");
    expect(applicationSource).toContain("t(creatorPrivateInviteDetailKey)");
    expect(applicationSource).toContain("creatorPrivateInviteClosed");
    expect(stringsSource).toContain(
      '"privateInvite.closedDetail.completed": "This invite is confirmed, but the campaign is complete and no longer accepting applications."',
    );
    expect(generatedEnglishSource).toContain(
      '"privateInvite.closedDetail.completed": "This invite is confirmed, but the campaign is complete and no longer accepting applications."',
    );
  });

  it("locks invite-only application forms until the invite is verified", () => {
    const applicationSource = source.slice(
      source.indexOf('data-testid="creator-application-card"'),
      source.indexOf("{/* End application */}"),
    );

    expect(source).toContain("requiresVerifiedInviteForApplication");
    expect(source).toContain("applicationNeedsVerifiedInvite");
    expect(applicationSource).toContain(
      'data-testid="creator-application-invite-required"',
    );
    expect(stringsSource).toContain('"apply.inviteRequired": "Private invite required"');
    expect(generatedEnglishSource).toContain(
      '"apply.inviteRequired": "Private invite required"',
    );
  });

  it("closes the creator apply form after the application deadline", () => {
    const applicationSource = source.slice(
      source.indexOf('data-testid="creator-application-card"'),
      source.indexOf("{/* End application */}"),
    );

    expect(source).toContain("isCampaignApplicationOpen");
    expect(source).toContain("getCampaignApplicationDeadlineDaysLeft");
    expect(source).toContain("const applicationClosed = !isCampaignApplicationOpen(campaign);");
    expect(source).not.toContain("new Date(dateStr).getTime() - Date.now()");
    expect(source).toContain("!applied && !applicationClosed");
    expect(applicationSource).toContain('data-testid="creator-application-closed"');
    expect(applicationSource).toContain('t("apply.closed")');
    expect(applicationSource).toContain('t("apply.closedDetail")');
    expect(stringsSource).toContain('"apply.closed": "Applications are closed"');
    expect(generatedEnglishSource).toContain('"apply.closed": "Applications are closed"');
  });

  it("tells creators why the application gate is closed", () => {
    const applicationSource = source.slice(
      source.indexOf('data-testid="creator-application-card"'),
      source.indexOf("{/* End application */}"),
    );

    expect(source).toContain("getCampaignApplicationClosedReason");
    expect(source).toContain("creatorApplicationClosedDetailKeys");
    expect(source).toContain("const applicationClosedReason = getCampaignApplicationClosedReason(campaign);");
    expect(source).toContain("const applicationClosedDetailKey =");
    expect(applicationSource).toContain("t(applicationClosedDetailKey)");
    expect(stringsSource).toContain('"apply.closedDetail.deadline": "The application deadline has passed."');
    expect(stringsSource).toContain('"apply.closedDetail.workStarted": "Creator selection is closed because campaign work has started."');
    expect(stringsSource).toContain('"apply.closedDetail.paused": "This campaign is paused and not accepting applications."');
    expect(stringsSource).toContain('"apply.closedDetail.completed": "This campaign is complete and no longer accepting applications."');
    expect(stringsSource).toContain('"apply.closedDetail.cancelled": "This campaign was cancelled and no longer accepts applications."');
    expect(stringsSource).toContain('"apply.closedDetail.notOpen": "The brand has not opened applications yet."');
    expect(generatedEnglishSource).toContain('"apply.closedDetail.deadline": "The application deadline has passed."');
  });

  it("opens the accepted creator directly into the campaign room", () => {
    const applicationSource = source.slice(
      source.indexOf('data-testid="creator-application-card"'),
      source.indexOf("{/* End application */}"),
    );

    expect(applicationSource).toContain('data-testid="creator-application-state"');
    expect(applicationSource).toContain('data-testid="creator-application-open-room"');
    expect(applicationSource).toContain('href={`/i/campaigns/${campaign.id}`}');
    expect(applicationSource).toContain('t("apply.openRoom")');
    expect(stringsSource).toContain('"apply.openRoom": "Open campaign room"');
    expect(generatedEnglishSource).toContain('"apply.openRoom": "Open campaign room"');
    expect(applicationSource).not.toContain('href="/i/campaigns"');
  });

  it("uses text for brand rating instead of decorative star treatment", () => {
    expect(source).toContain('t("brand.rating"');
    expect(stringsSource).toContain('"brand.rating": "{rating} rating"');
    expect(generatedEnglishSource).toContain('"brand.rating": "{rating} rating"');
    expect(source).not.toContain("Star,");
    expect(source).not.toContain("<Star");
    expect(source).not.toContain("★");
  });

  it("does not reveal unpaid service-fee campaign detail to creators", () => {
    expect(source).toContain("service_fee_cents: number | null");
    expect(source).toContain("service_fee_status: string | null");
    expect(source).toContain("isCampaignServiceFeeUnlocked");
    expect(source).toContain("if (!isCampaignServiceFeeUnlocked(rest))");
  });
});
