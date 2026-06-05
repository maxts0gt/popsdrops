export const CAMPAIGN_MODES = ["private", "sourced"] as const;

export type CampaignMode = (typeof CAMPAIGN_MODES)[number];

type CampaignServicePackage = {
  mode: CampaignMode;
  feeCents: number;
  currency: "usd";
  creatorSourcingRequired: boolean;
  titleKey: string;
  descKey: string;
  pricePrefixKey: string;
  feeKey: string;
  scopeDetailKey: string;
  scopeKeys: readonly string[];
  includedCreatorCount?: number;
  includedActiveDays?: number;
  includedReportingDays?: number;
  includedMarketCount?: number;
  includedRecommendationCount?: number;
  includedOutreachInviteCount?: number;
};

type CampaignServicePricingScope = {
  maxCreators?: number | null;
  marketCount?: number | null;
  activeDays?: number | null;
  reportingDays?: number | null;
};

export type CampaignServiceEstimate = {
  mode: CampaignMode;
  feeCents: number;
  currency: "usd";
  tierKey: "workspace" | "enterprise";
  requiresCustomPricing: boolean;
  scopeDetailKey: string;
  customPricingReason?: "private_capacity" | "sourcing";
  includedCreatorCount?: number;
  includedActiveDays?: number;
  includedReportingDays?: number;
  creatorOverageBlocks?: number;
  activeDayOverageBlocks?: number;
  reportingDayOverageBlocks?: number;
  overageFeeCents?: number;
};

export type CampaignServicePaymentEvent = {
  amount_cents?: number | null;
  checkout_session_id?: string | null;
  event_summary?: Record<string, unknown> | null;
  service_fee_status?: string | null;
};

export type CampaignServiceFeeBalance = {
  balanceDueCents: number;
  paidCents: number;
  totalFeeCents: number;
};

export type CampaignPaidCreatorCapacityInput = {
  maxCreators?: number | null;
  paymentEvents?: CampaignServicePaymentEvent[] | null;
  serviceFeeCents?: number | null;
  serviceFeeStatus?: string | null;
  servicePackageSnapshot?: Record<string, unknown> | null;
};

const privateCampaignPricing = {
  baseFeeCents: 14_900,
  includedCreatorCount: 10,
  includedActiveDays: 45,
  includedReportingDays: 14,
  creatorOverageBlockSize: 10,
  creatorOverageFeeCents: 4_900,
  activeDayOverageBlockSize: 30,
  activeDayOverageFeeCents: 4_900,
  reportingDayOverageBlockSize: 30,
  reportingDayOverageFeeCents: 2_900,
} as const;

export const PRIVATE_CAMPAIGN_MAX_SELF_SERVE_CREATORS = 100;

export const CAMPAIGN_SERVICE_PACKAGES: Record<CampaignMode, CampaignServicePackage> = {
  private: {
    mode: "private",
    feeCents: privateCampaignPricing.baseFeeCents,
    currency: "usd",
    creatorSourcingRequired: false,
    titleKey: "mode.private",
    descKey: "mode.private.desc",
    pricePrefixKey: "mode.private.fee",
    feeKey: "mode.private.fee",
    scopeDetailKey: "mode.private.scopeDetail.withOverages",
    includedCreatorCount: privateCampaignPricing.includedCreatorCount,
    includedActiveDays: privateCampaignPricing.includedActiveDays,
    includedReportingDays: privateCampaignPricing.includedReportingDays,
    scopeKeys: [
      "mode.private.scope.workspace",
      "mode.private.scope.invite",
      "mode.private.scope.report",
    ],
  },
  sourced: {
    mode: "sourced",
    feeCents: 0,
    currency: "usd",
    creatorSourcingRequired: true,
    titleKey: "mode.sourced",
    descKey: "mode.sourced.desc",
    pricePrefixKey: "mode.sourced.fee",
    feeKey: "mode.sourced.fee",
    scopeDetailKey: "mode.sourced.scopeDetail",
    scopeKeys: [
      "mode.sourced.scope.shortlist",
      "mode.sourced.scope.workspace",
      "mode.sourced.scope.report",
    ],
  },
};

export function getCampaignServicePackage(mode: CampaignMode) {
  return CAMPAIGN_SERVICE_PACKAGES[mode];
}

export function formatCampaignServiceFee(feeCents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(feeCents / 100);
}

function normalizePricingCount(value: number | null | undefined) {
  return Number.isFinite(value) ? Math.max(1, Number(value)) : 1;
}

function normalizePricingDays(value: number | null | undefined) {
  return Number.isFinite(value) ? Math.max(0, Number(value)) : 0;
}

function getOverageBlocks(value: number, includedValue: number, blockSize: number) {
  return Math.max(0, Math.ceil((value - includedValue) / blockSize));
}

function readPositiveInteger(value: unknown) {
  const parsed =
    typeof value === "string" && value.trim() !== ""
      ? Number(value)
      : typeof value === "number"
        ? value
        : null;

  return Number.isFinite(parsed) && Number(parsed) > 0
    ? Math.floor(Number(parsed))
    : 0;
}

function readPaidCreatorCapacityFromEvent(event: CampaignServicePaymentEvent) {
  if (event.service_fee_status !== "paid") return 0;
  return readCreatorCapacityFromEvent(event);
}

function readCreatorCapacityFromEvent(event: CampaignServicePaymentEvent) {
  const summary = event.event_summary ?? {};
  return Math.max(
    readPositiveInteger(summary.creatorCapacity),
    readPositiveInteger(summary.startingCapacity),
    readPositiveInteger(summary.startingCreatorCapacity),
    readPositiveInteger(summary.estimatedMaxCreators),
  );
}

function readPaidCreatorCapacityFromLedger(
  paymentEvents: CampaignServicePaymentEvent[] | null | undefined,
) {
  const events = paymentEvents ?? [];
  const paidCheckoutSessionIds = new Set(
    events
      .filter((event) => event.service_fee_status === "paid")
      .map((event) => event.checkout_session_id)
      .filter((id): id is string => typeof id === "string" && id.length > 0),
  );

  return Math.max(
    0,
    ...events.map((event) => {
      const directCapacity = readPaidCreatorCapacityFromEvent(event);
      if (directCapacity > 0) return directCapacity;
      if (
        event.checkout_session_id &&
        paidCheckoutSessionIds.has(event.checkout_session_id)
      ) {
        return readCreatorCapacityFromEvent(event);
      }
      return 0;
    }),
  );
}

function dateStringToUtcDay(value: string | null | undefined): number | null {
  if (!value) return null;

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  return Math.round(Date.UTC(year, month, day) / (24 * 60 * 60 * 1000));
}

export function getCampaignServicePricingDays({
  postingWindowStart,
  postingWindowEnd,
  performanceDueDate,
}: {
  postingWindowStart?: string | null;
  postingWindowEnd?: string | null;
  performanceDueDate?: string | null;
}) {
  const startDay = dateStringToUtcDay(postingWindowStart);
  const endDay = dateStringToUtcDay(postingWindowEnd);
  const performanceDay = dateStringToUtcDay(performanceDueDate);
  const activeDays =
    startDay === null || endDay === null ? 0 : Math.max(1, endDay - startDay + 1);
  const reportingDays =
    endDay === null || performanceDay === null ? 0 : Math.max(0, performanceDay - endDay);

  return { activeDays, reportingDays };
}

export function getCampaignServiceEstimate(
  mode: CampaignMode,
  scope: CampaignServicePricingScope = {},
): CampaignServiceEstimate {
  const servicePackage = getCampaignServicePackage(mode);

  if (mode === "private") {
    const maxCreators = normalizePricingCount(scope.maxCreators);
    const activeDays = normalizePricingDays(scope.activeDays);
    const reportingDays = normalizePricingDays(scope.reportingDays);

    if (maxCreators > PRIVATE_CAMPAIGN_MAX_SELF_SERVE_CREATORS) {
      return {
        mode,
        feeCents: 0,
        currency: servicePackage.currency,
        tierKey: "enterprise",
        requiresCustomPricing: true,
        scopeDetailKey: "mode.private.scopeDetail.customCapacity",
        customPricingReason: "private_capacity",
      };
    }

    const creatorOverageBlocks = getOverageBlocks(
      maxCreators,
      privateCampaignPricing.includedCreatorCount,
      privateCampaignPricing.creatorOverageBlockSize,
    );
    const activeDayOverageBlocks = getOverageBlocks(
      activeDays,
      privateCampaignPricing.includedActiveDays,
      privateCampaignPricing.activeDayOverageBlockSize,
    );
    const reportingDayOverageBlocks = getOverageBlocks(
      reportingDays,
      privateCampaignPricing.includedReportingDays,
      privateCampaignPricing.reportingDayOverageBlockSize,
    );
    const overageFeeCents =
      creatorOverageBlocks * privateCampaignPricing.creatorOverageFeeCents +
      activeDayOverageBlocks * privateCampaignPricing.activeDayOverageFeeCents +
      reportingDayOverageBlocks * privateCampaignPricing.reportingDayOverageFeeCents;

    return {
      mode,
      feeCents: servicePackage.feeCents + overageFeeCents,
      currency: servicePackage.currency,
      tierKey: "workspace",
      requiresCustomPricing: false,
      scopeDetailKey: servicePackage.scopeDetailKey,
      includedCreatorCount: privateCampaignPricing.includedCreatorCount,
      includedActiveDays: privateCampaignPricing.includedActiveDays,
      includedReportingDays: privateCampaignPricing.includedReportingDays,
      creatorOverageBlocks,
      activeDayOverageBlocks,
      reportingDayOverageBlocks,
      overageFeeCents,
    };
  }

  return {
    mode,
    feeCents: 0,
    currency: servicePackage.currency,
    tierKey: "enterprise",
    requiresCustomPricing: true,
    scopeDetailKey: servicePackage.scopeDetailKey,
    customPricingReason: "sourcing",
  };
}

export function getCampaignServiceFeeBalance({
  feeCents,
  paymentEvents = [],
}: {
  feeCents: number | null | undefined;
  paymentEvents?: CampaignServicePaymentEvent[] | null;
}): CampaignServiceFeeBalance {
  const totalFeeCents = Math.max(0, Number(feeCents) || 0);
  const paidCents = (paymentEvents ?? []).reduce((sum, event) => {
    if (event.service_fee_status !== "paid") return sum;
    const amount = Number(event.amount_cents ?? 0);
    return Number.isFinite(amount) ? sum + Math.max(0, amount) : sum;
  }, 0);

  return {
    balanceDueCents: Math.max(0, totalFeeCents - paidCents),
    paidCents,
    totalFeeCents,
  };
}

export function getCampaignPaidCreatorCapacity({
  maxCreators,
  paymentEvents = [],
  serviceFeeCents,
  serviceFeeStatus,
  servicePackageSnapshot,
}: CampaignPaidCreatorCapacityInput) {
  const requestedMaxCreators = Math.max(
    1,
    Math.floor(normalizePricingCount(maxCreators)),
  );
  const totalFeeCents = Math.max(0, Number(serviceFeeCents ?? 0) || 0);

  if (totalFeeCents === 0 || serviceFeeStatus === "paid") {
    return requestedMaxCreators;
  }

  const paidEventCapacity = readPaidCreatorCapacityFromLedger(paymentEvents);
  const snapshotPaidCapacity = readPositiveInteger(
    servicePackageSnapshot?.paidCreatorCapacity,
  );
  const explicitPaidCapacity = Math.max(paidEventCapacity, snapshotPaidCapacity);

  if (explicitPaidCapacity > 0) {
    return Math.min(requestedMaxCreators, explicitPaidCapacity);
  }

  const balance = getCampaignServiceFeeBalance({
    feeCents: totalFeeCents,
    paymentEvents,
  });
  if (balance.paidCents >= privateCampaignPricing.baseFeeCents) {
    return Math.min(
      requestedMaxCreators,
      privateCampaignPricing.includedCreatorCount,
    );
  }

  return 0;
}

export function getCampaignServiceInsertFields(
  mode: CampaignMode,
  scope: CampaignServicePricingScope = {},
) {
  const servicePackage = getCampaignServicePackage(mode);
  const serviceEstimate = getCampaignServiceEstimate(mode, scope);

  return {
    campaign_mode: servicePackage.mode,
    creator_sourcing_required: servicePackage.creatorSourcingRequired,
    service_fee_cents: serviceEstimate.feeCents,
    service_fee_currency: serviceEstimate.currency,
    service_fee_status: "pending" as const,
    service_package_snapshot: {
      mode: servicePackage.mode,
      feeCents: serviceEstimate.feeCents,
      currency: serviceEstimate.currency,
      creatorSourcingRequired: servicePackage.creatorSourcingRequired,
      requiresCustomPricing: serviceEstimate.requiresCustomPricing,
      tierKey: serviceEstimate.tierKey,
      includedCreatorCount: serviceEstimate.includedCreatorCount,
      includedActiveDays: serviceEstimate.includedActiveDays,
      includedReportingDays: serviceEstimate.includedReportingDays,
      includedMarketCount: servicePackage.includedMarketCount,
      includedRecommendationCount: servicePackage.includedRecommendationCount,
      includedOutreachInviteCount: servicePackage.includedOutreachInviteCount,
      estimatedMaxCreators: normalizePricingCount(scope.maxCreators),
      estimatedMarketCount: normalizePricingCount(scope.marketCount),
      estimatedActiveDays: normalizePricingDays(scope.activeDays),
      estimatedReportingDays: normalizePricingDays(scope.reportingDays),
      creatorOverageBlocks: serviceEstimate.creatorOverageBlocks,
      activeDayOverageBlocks: serviceEstimate.activeDayOverageBlocks,
      reportingDayOverageBlocks: serviceEstimate.reportingDayOverageBlocks,
      overageFeeCents: serviceEstimate.overageFeeCents,
      scopeKeys: [...servicePackage.scopeKeys],
    },
  };
}
