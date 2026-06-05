import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const routeSource = readFileSync(
  new URL("../../../api/public/campaigns/[id]/route.ts", import.meta.url),
  "utf8",
);
const stringsSource = readFileSync(
  new URL("../../../../lib/i18n/strings.ts", import.meta.url),
  "utf8",
);
const publicApplyStrings = stringsSource.slice(
  stringsSource.indexOf('"public.apply": {'),
  stringsSource.indexOf("  },\n} as const;", stringsSource.indexOf('"public.apply": {')),
);

describe("public apply reporting requirements flow", () => {
  it("does not expose unpaid service-fee campaigns through direct invite URLs", () => {
    expect(routeSource).toContain("service_fee_cents");
    expect(routeSource).toContain("service_fee_status");
    expect(routeSource).toContain("isCampaignServiceFeeUnlocked");
    expect(routeSource).toContain("!isCampaignServiceFeeUnlocked(campaignRecord)");
    expect(routeSource).toContain("delete safeCampaignData.service_fee_cents");
    expect(routeSource).toContain("delete safeCampaignData.service_fee_status");
  });

  it("shows reporting requirements and eligibility before applying", () => {
    expect(source).toContain("reportingRequirements");
    expect(source).toContain("getCreatorReportingEligibility");
    expect(source).toContain("reporting_requirements");
  });

  it("shows the campaign reporting cadence before applying", () => {
    expect(routeSource).toContain("campaign_reporting_plans");
    expect(routeSource).toContain("reporting_plan");
    expect(source).toContain("reporting_plan");
    expect(source).toContain("getReportingCadenceDetail");
    expect(source).toContain('t("readiness.reportingCadence")');
    expect(stringsSource).toContain('"readiness.reportingCadence": "Reporting cadence"');
    expect(stringsSource).toContain('"reportingCadence.daily": "Daily reads during monitoring"');
  });

  it("summarizes application readiness before the creator reaches the apply action", () => {
    const readinessIndex = source.indexOf('data-testid="public-apply-readiness"');
    const ctaIndex = source.indexOf("{/* CTA */}");

    expect(readinessIndex).toBeGreaterThan(-1);
    expect(ctaIndex).toBeGreaterThan(-1);
    expect(readinessIndex).toBeLessThan(ctaIndex);
    expect(source).toContain("publicApplyReadinessRows");
    expect(source).toContain('t("readiness.title")');
    expect(source).toContain('t("readiness.platforms")');
    expect(source).toContain('t("readiness.proof")');
    expect(source).toContain('t("readiness.rules")');
  });

  it("shows the creator campaign flow before eligibility and application decisions", () => {
    const flowIndex = source.indexOf('data-testid="public-apply-handoff-sequence"');
    const readinessIndex = source.indexOf('data-testid="public-apply-readiness"');
    const ctaIndex = source.indexOf("{/* CTA */}");

    expect(flowIndex).toBeGreaterThan(-1);
    expect(readinessIndex).toBeGreaterThan(-1);
    expect(ctaIndex).toBeGreaterThan(-1);
    expect(flowIndex).toBeLessThan(readinessIndex);
    expect(flowIndex).toBeLessThan(ctaIndex);
    expect(source).toContain("publicApplyHandoffSteps");
    expect(source).toContain('data-testid="public-apply-handoff-step"');
    expect(source).toContain('t("handoff.title")');
    expect(source).toContain('t("handoff.brief")');
    expect(source).toContain('t("handoff.deliverables")');
    expect(source).toContain('t("handoff.proof")');
    expect(source).toContain('t("handoff.apply")');
  });

  it("keeps the public apply action in normal document flow so it never covers the handoff rail", () => {
    const ctaSource = source.slice(
      source.indexOf("{/* CTA */}"),
      source.indexOf("</main>"),
    );

    expect(ctaSource).toContain('data-testid="public-apply-action"');
    expect(ctaSource).toContain("mt-6");
    expect(ctaSource).not.toContain("sticky bottom-0");
    expect(ctaSource).not.toContain("fixed inset-x-0");
  });

  it("keeps the public apply jump as a quiet helper before the campaign steps", () => {
    const summarySource = source.slice(
      source.indexOf("{/* Key stats */}"),
      source.indexOf('data-testid="public-apply-handoff-sequence"'),
    );

    expect(summarySource).toContain('data-testid="public-apply-summary-row"');
    expect(summarySource).toContain('data-testid="public-apply-jump"');
    expect(summarySource).toContain("sm:flex-row sm:items-center sm:justify-between");
    expect(summarySource).toContain('.getElementById("public-apply-action")');
    expect(summarySource).toContain("scrollIntoView");
    expect(summarySource).toContain('variant="outline"');
    expect(summarySource).toContain('size="sm"');
    expect(summarySource).not.toContain("w-full");
    expect(summarySource).not.toContain('size="lg"');
  });

  it("closes the public apply action when the application deadline has passed", () => {
    expect(source).toContain("isCampaignApplicationOpen");
    expect(source).toContain("const isClosed = !isCampaignApplicationOpen(campaign);");
    expect(source).toContain('data-testid="public-apply-action"');
    expect(source).toContain('t("closed")');
  });

  it("explains why public applications are closed instead of using one mystery state", () => {
    const closedActionSource = source.slice(
      source.indexOf(") : isClosed ? ("),
      source.indexOf(") : hasApplied ? ("),
    );

    expect(source).toContain("getCampaignApplicationClosedReason");
    expect(source).toContain("publicApplicationClosedDetailKeys");
    expect(source).toContain("const applicationClosedReason = getCampaignApplicationClosedReason(campaign);");
    expect(source).toContain("const applicationClosedDetailKey =");
    expect(closedActionSource).toContain('t("closed")');
    expect(closedActionSource).toContain("t(applicationClosedDetailKey)");
    expect(publicApplyStrings).toContain('"closedDetail.deadline": "The application deadline has passed."');
    expect(publicApplyStrings).toContain('"closedDetail.workStarted": "Creator selection is closed because campaign work has started."');
    expect(publicApplyStrings).toContain('"closedDetail.paused": "This campaign is paused and not accepting applications."');
    expect(publicApplyStrings).toContain('"closedDetail.completed": "This campaign is complete and no longer accepting applications."');
    expect(publicApplyStrings).toContain('"closedDetail.cancelled": "This campaign was cancelled and no longer accepts applications."');
    expect(publicApplyStrings).toContain('"closedDetail.notOpen": "The brand has not opened applications yet."');
  });

  it("preserves private invite context from the public invite into creator application", () => {
    expect(source).toContain("useSearchParams");
    expect(source).toContain("inviteId");
    expect(source).toContain("`/api/public/campaigns/${id}${inviteQuery}`");
    expect(source).toContain('data-testid="public-apply-private-invite"');
    expect(source).toContain('t("privateInvite.title")');
    expect(source).toContain('"privateInvite.detail"');
    expect(source).toContain('href={`/i/discover/${campaign.id}${inviteQuery}`}');
    expect(source).toContain("redirect=/apply/${campaign.id}${inviteQuery}");
    expect(routeSource).toContain("campaign_creator_invites");
    expect(routeSource).toContain("isCampaignVisibleForPublicApply");
    expect(publicApplyStrings).toContain('"privateInvite.title": "Private invite"');
    expect(publicApplyStrings).toContain(
      '"privateInvite.detail": "The brand invited you to review this campaign. Apply here; locked materials open after acceptance."',
    );
  });

  it("keeps private invite copy lifecycle-aware when public applications are closed", () => {
    const privateInviteSource = source.slice(
      source.indexOf('data-testid="public-apply-private-invite"'),
      source.indexOf('data-testid="public-apply-readiness"'),
    );

    expect(source).toContain("publicPrivateInviteClosedDetailKeys");
    expect(source).toContain("const publicPrivateInviteClosed = Boolean(inviteId && isClosed);");
    expect(source).toContain("const publicPrivateInviteDetailKey =");
    expect(source).toContain("const PublicPrivateInviteIcon = publicPrivateInviteClosed ? Shield : CheckCircle2;");
    expect(privateInviteSource).toContain("PublicPrivateInviteIcon");
    expect(privateInviteSource).toContain("t(publicPrivateInviteDetailKey)");
    expect(privateInviteSource).toContain("publicPrivateInviteClosed");
    expect(publicApplyStrings).toContain(
      '"privateInvite.closedDetail.completed": "This private invite is preserved for audit because the campaign is complete."',
    );
    expect(publicApplyStrings).toContain(
      '"privateInvite.closedDetail.deadline": "This private invite is preserved for audit, but the application deadline has passed."',
    );
    expect(publicApplyStrings).toContain(
      '"privateInvite.closedDetail.notOpen": "This private invite is preserved, but the brand has not opened applications yet."',
    );
  });

  it("uses intentional public invite copy without borrowed navigation labels or hardcoded website text", () => {
    expect(source).toContain('t("brand.about")');
    expect(source).toContain('t("brand.website")');
    expect(source).not.toContain('tGlobal("ui.common", "nav.home")');
    expect(source).not.toContain(">Website<");
  });

  it("uses text for brand rating instead of decorative star treatment", () => {
    expect(source).toContain('t("brand.rating"');
    expect(source).toContain('t("brand.ratingWithReviews"');
    expect(source).not.toContain("Star,");
    expect(source).not.toContain("<Star");
    expect(source).not.toContain("fill-amber");
    expect(publicApplyStrings).toContain('"brand.rating": "{rating} rating"');
    expect(publicApplyStrings).toContain(
      '"brand.ratingWithReviews": "{rating} rating ({count} reviews)"',
    );
  });

  it("routes accepted creators from the invite link into the campaign room", () => {
    const memberCheckIndex = source.indexOf(".from(\"campaign_members\")");
    const applicationCheckIndex = source.indexOf(".from(\"campaign_applications\")");
    const acceptedCtaIndex = source.indexOf('t("openCampaignRoom")');
    const closedCtaIndex = source.indexOf('t("closed")');
    const submittedCtaIndex = source.indexOf('t("applicationSubmitted")');

    expect(memberCheckIndex).toBeGreaterThan(-1);
    expect(applicationCheckIndex).toBeGreaterThan(-1);
    expect(memberCheckIndex).toBeLessThan(applicationCheckIndex);
    expect(source).toContain("isAcceptedMember");
    expect(source).toContain('href={`/i/campaigns/${campaign.id}`}');
    expect(acceptedCtaIndex).toBeGreaterThan(-1);
    expect(closedCtaIndex).toBeGreaterThan(-1);
    expect(submittedCtaIndex).toBeGreaterThan(-1);
    expect(acceptedCtaIndex).toBeLessThan(closedCtaIndex);
    expect(acceptedCtaIndex).toBeLessThan(submittedCtaIndex);
    expect(stringsSource).toContain('openCampaignRoom: "Open campaign room"');
    expect(stringsSource).toContain('applicationSubmitted: "Application submitted"');
  });

  it("shows the creator-facing campaign image before public application", () => {
    expect(routeSource).toContain("campaign_assets");
    expect(routeSource).toContain("publicCreativeAssets");
    expect(routeSource).toContain("createSignedUrls");
    expect(routeSource).toContain("signed_url");

    expect(source).toContain("campaign_assets");
    expect(source).toContain("pickCreatorFacingHeroAsset");
    expect(source).toContain('data-testid="public-apply-campaign-image"');

    const heroImageSource = source.slice(
      source.indexOf('data-testid="public-apply-campaign-image"'),
      source.indexOf("{/* Brand info */}"),
    );
    expect(heroImageSource).toContain("priority");
    expect(heroImageSource).toContain('loading="eager"');
  });

  it("uses a branded campaign preview instead of an empty icon when the invite has no image", () => {
    expect(source).not.toContain("ImageIcon");
    expect(source).toContain('data-testid="public-apply-campaign-fallback"');
    expect(source).toContain("getBrandInitials");
    expect(source).toContain('t("heroFallback.label")');
    expect(stringsSource).toContain('"heroFallback.label"');
  });

  it("keeps the campaign flow readable without horizontal clipping", () => {
    const flowSource = source.slice(
      source.indexOf('data-testid="public-apply-handoff-sequence"'),
      source.indexOf('data-testid="public-apply-readiness"'),
    );

    expect(flowSource).toContain('aria-label={t("handoff.title")}');
    expect(flowSource).toContain("grid-cols-1");
    expect(flowSource).toContain("sm:grid-cols-5");
    expect(flowSource).not.toContain("overflow-x-auto");
    expect(flowSource).not.toContain("min-w-[36rem]");
    expect(flowSource).not.toContain("min-w-[8.5rem]");
  });

  it("returns and defaults to the campaign's reviewed creator-language brief", () => {
    expect(routeSource).toContain("brief_translated");
    expect(source).toContain("brief_translated");
    expect(source).toContain("getPublicBriefField");
    expect(source).toContain("activeTranslationLocale");
    expect(source).toContain("translatedBriefLocale");
  });

  it("carries timeline, usage rights, and compliance terms into the public invite", () => {
    expect(routeSource).toContain("content_due_date");
    expect(routeSource).toContain("performance_due_date");
    expect(routeSource).toContain("posting_window_start");
    expect(routeSource).toContain("posting_window_end");
    expect(routeSource).toContain("usage_rights_duration");
    expect(routeSource).toContain("usage_rights_territory");
    expect(routeSource).toContain("usage_rights_paid_ads");
    expect(routeSource).toContain("max_revisions");
    expect(routeSource).toContain("compliance_notes");

    expect(source).toContain("formatUsageRight");
    expect(source).toContain("publicApplyTimelineRows");
    expect(source).toContain('data-testid="public-apply-timeline"');
    expect(source).toContain('data-testid="public-apply-usage-rights"');
    expect(source).toContain('data-testid="public-apply-compliance-notes"');
    expect(source).toContain('t("timeline.title")');
    expect(source).toContain('t("timeline.performanceDue")');
    expect(source).toContain('t("usage.title")');
    expect(source).toContain('t("compliance.title")');
    expect(publicApplyStrings).toContain('"timeline.title": "Timeline"');
    expect(publicApplyStrings).toContain('"usage.title": "Usage rights"');
    expect(publicApplyStrings).toContain('"compliance.title": "Compliance notes"');
  });
});
