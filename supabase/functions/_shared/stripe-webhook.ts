export type StripeWebhookEvent = {
  id?: string;
  type?: string;
  data?: {
    object?: {
      amount?: number | null;
      amount_total?: number | null;
      charge?: string | null;
      currency?: string | null;
      id?: string;
      mode?: string;
      payment_status?: string;
      payment_intent?: string | null;
      metadata?: Record<string, string | undefined>;
    };
  };
};

export type CampaignServiceFeeWebhookStatus =
  | "paid"
  | "failed"
  | "refunded"
  | "disputed";

export type CampaignServiceFeeStatusUpdate = {
  amountCents: number | null;
  campaignId: string;
  chargeId: string | null;
  checkoutSessionId: string | null;
  currency: string | null;
  eventSummary: Record<string, unknown>;
  paymentIntentId: string | null;
  serviceFeeStatus: CampaignServiceFeeWebhookStatus;
  stripeEventId: string | null;
  stripeEventType: string;
};

export type CampaignServiceFeeLookupRequest = {
  chargeId: string | null;
  paymentIntentId: string | null;
  serviceFeeStatus: CampaignServiceFeeWebhookStatus;
};

export type CampaignServiceFeePersistence = {
  campaignUpdate: Record<string, unknown>;
  paymentEvent: Record<string, unknown>;
  stripeEventId: string;
};

export type ExistingCampaignServiceFeeState = {
  service_fee_charge_id?: string | null;
  service_fee_checkout_session_id?: string | null;
  service_fee_cents?: number | null;
  service_fee_payment_intent_id?: string | null;
  service_package_snapshot?: Record<string, unknown> | null;
  service_fee_status?: string | null;
};

export type CampaignServiceFeePaymentEvent = {
  amount_cents?: number | null;
  checkout_session_id?: string | null;
  event_summary?: Record<string, unknown> | null;
  service_fee_status?: string | null;
};

type VerifyStripeWebhookSignatureInput = {
  nowSeconds?: number;
  payload: string;
  secret: string;
  signatureHeader: string;
  toleranceSeconds?: number;
};

function parseStripeSignatureHeader(signatureHeader: string) {
  const parts = signatureHeader.split(",");
  const timestampPart = parts.find((part) => part.startsWith("t="));
  const timestamp = Number(timestampPart?.slice(2));
  const signatures = parts
    .filter((part) => part.startsWith("v1="))
    .map((part) => part.slice(3))
    .filter(Boolean);

  if (!Number.isFinite(timestamp) || signatures.length === 0) {
    throw new Error("Invalid Stripe signature header");
  }

  return { signatures, timestamp };
}

function toHex(buffer: ArrayBuffer) {
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeEqualHex(a: string, b: string) {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }

  return result === 0;
}

export async function createStripeWebhookSignature(
  secret: string,
  timestamp: number,
  payload: string,
) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${timestamp}.${payload}`),
  );

  return toHex(signature);
}

export async function verifyStripeWebhookSignature({
  nowSeconds = Math.floor(Date.now() / 1000),
  payload,
  secret,
  signatureHeader,
  toleranceSeconds = 300,
}: VerifyStripeWebhookSignatureInput) {
  const { signatures, timestamp } = parseStripeSignatureHeader(signatureHeader);
  const ageSeconds = Math.abs(nowSeconds - timestamp);

  if (ageSeconds > toleranceSeconds) {
    throw new Error("Stripe signature timestamp is outside tolerance");
  }

  const expected = await createStripeWebhookSignature(secret, timestamp, payload);
  const hasMatch = signatures.some((signature) =>
    constantTimeEqualHex(signature, expected),
  );

  if (!hasMatch) {
    throw new Error("Stripe signature verification failed");
  }
}

export function extractCampaignIdFromStripeMetadata(
  metadata?: Record<string, string | undefined>,
) {
  if (metadata?.kind !== "campaign_service_fee" || !metadata.campaignId) {
    return null;
  }

  return metadata.campaignId;
}

function readString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
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

function appendNumericMetadata(
  eventSummary: Record<string, unknown>,
  metadata: Record<string, string | undefined> | undefined,
  key: string,
) {
  const value = readPositiveInteger(metadata?.[key]);
  if (value > 0) eventSummary[key] = value;
}

function getCheckoutSessionId(event: StripeWebhookEvent) {
  const objectId = readString(event.data?.object?.id);
  return objectId?.startsWith("cs_") ? objectId : null;
}

function getChargeId(event: StripeWebhookEvent) {
  const explicitCharge = readString(event.data?.object?.charge);
  if (explicitCharge) return explicitCharge;

  const objectId = readString(event.data?.object?.id);
  return objectId?.startsWith("ch_") ? objectId : null;
}

export function buildCampaignServiceFeeStatusUpdate(
  event: StripeWebhookEvent,
  campaignId: string,
  serviceFeeStatus: CampaignServiceFeeWebhookStatus,
): CampaignServiceFeeStatusUpdate {
  const object = event.data?.object;
  const amountCents =
    readNumber(object?.amount_total) ?? readNumber(object?.amount) ?? null;
  const eventSummary: Record<string, unknown> = {
    objectId: readString(object?.id),
    paymentStatus: readString(object?.payment_status),
  };

  appendNumericMetadata(eventSummary, object?.metadata, "creatorCapacity");
  appendNumericMetadata(eventSummary, object?.metadata, "includedActiveDays");
  appendNumericMetadata(eventSummary, object?.metadata, "includedReportingDays");

  return {
    amountCents,
    campaignId,
    chargeId: getChargeId(event),
    checkoutSessionId: getCheckoutSessionId(event),
    currency: readString(object?.currency)?.toLowerCase() ?? null,
    eventSummary,
    paymentIntentId: readString(object?.payment_intent),
    serviceFeeStatus,
    stripeEventId: readString(event.id),
    stripeEventType: event.type ?? "unknown",
  };
}

function readPaidCreatorCapacityFromPaymentEvent(
  event: CampaignServiceFeePaymentEvent,
) {
  if (event.service_fee_status !== "paid") return 0;
  return readCreatorCapacityFromPaymentEvent(event);
}

function readCreatorCapacityFromPaymentEvent(
  event: CampaignServiceFeePaymentEvent,
) {
  const summary = event.event_summary ?? {};
  return Math.max(
    readPositiveInteger(summary.creatorCapacity),
    readPositiveInteger(summary.startingCapacity),
    readPositiveInteger(summary.startingCreatorCapacity),
    readPositiveInteger(summary.estimatedMaxCreators),
  );
}

function readPaidCreatorCapacityFromPaymentLedger(
  paymentEvents: CampaignServiceFeePaymentEvent[] | null | undefined,
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
      const directCapacity = readPaidCreatorCapacityFromPaymentEvent(event);
      if (directCapacity > 0) return directCapacity;
      if (
        event.checkout_session_id &&
        paidCheckoutSessionIds.has(event.checkout_session_id)
      ) {
        return readCreatorCapacityFromPaymentEvent(event);
      }
      return 0;
    }),
  );
}

function buildStripeEventIdFallback(statusUpdate: CampaignServiceFeeStatusUpdate) {
  return `${statusUpdate.stripeEventType}:${statusUpdate.campaignId}:${
    statusUpdate.paymentIntentId ||
    statusUpdate.chargeId ||
    statusUpdate.checkoutSessionId ||
    "unknown"
  }`;
}

export function buildCampaignServiceFeePersistence(
  statusUpdate: CampaignServiceFeeStatusUpdate,
  receivedAt: string,
): CampaignServiceFeePersistence {
  const stripeEventId =
    statusUpdate.stripeEventId || buildStripeEventIdFallback(statusUpdate);
  const eventType = statusUpdate.stripeEventType;
  const statusTimestamp =
    statusUpdate.serviceFeeStatus === "paid"
      ? { service_fee_paid_at: receivedAt }
      : statusUpdate.serviceFeeStatus === "failed"
        ? { service_fee_failed_at: receivedAt }
        : statusUpdate.serviceFeeStatus === "refunded"
          ? { service_fee_refunded_at: receivedAt }
          : statusUpdate.serviceFeeStatus === "disputed"
            ? { service_fee_disputed_at: receivedAt }
            : {};
  const campaignUpdate: Record<string, unknown> = {
    ...statusTimestamp,
    service_fee_last_event_at: receivedAt,
    service_fee_last_event_id: stripeEventId,
    service_fee_last_event_type: eventType,
    service_fee_status: statusUpdate.serviceFeeStatus,
    updated_at: receivedAt,
  };

  if (statusUpdate.checkoutSessionId) {
    campaignUpdate.service_fee_checkout_session_id =
      statusUpdate.checkoutSessionId;
  }
  if (statusUpdate.paymentIntentId) {
    campaignUpdate.service_fee_payment_intent_id =
      statusUpdate.paymentIntentId;
  }
  if (statusUpdate.chargeId) {
    campaignUpdate.service_fee_charge_id = statusUpdate.chargeId;
  }

  return {
    campaignUpdate,
    paymentEvent: {
      amount_cents: statusUpdate.amountCents,
      campaign_id: statusUpdate.campaignId,
      charge_id: statusUpdate.chargeId,
      checkout_session_id: statusUpdate.checkoutSessionId,
      currency: statusUpdate.currency,
      event_id: stripeEventId,
      event_summary: statusUpdate.eventSummary,
      event_type: eventType,
      payment_intent_id: statusUpdate.paymentIntentId,
      provider: "stripe",
      received_at: receivedAt,
      service_fee_status: statusUpdate.serviceFeeStatus,
    },
    stripeEventId,
  };
}

export function buildCampaignServiceFeeSnapshotWithLedger({
  paymentEvents = [],
  serviceFeeCents,
  servicePackageSnapshot,
}: {
  paymentEvents?: CampaignServiceFeePaymentEvent[] | null;
  serviceFeeCents?: number | null;
  servicePackageSnapshot?: Record<string, unknown> | null;
}) {
  const totalFeeCents = Math.max(0, Number(serviceFeeCents ?? 0) || 0);
  const paidCents = Math.min(
    totalFeeCents,
    (paymentEvents ?? []).reduce((sum, event) => {
      if (event.service_fee_status !== "paid") return sum;
      const amount = Number(event.amount_cents ?? 0);
      return Number.isFinite(amount) ? sum + Math.max(0, amount) : sum;
    }, 0),
  );
  const paidCreatorCapacity = Math.max(
    readPositiveInteger(servicePackageSnapshot?.paidCreatorCapacity),
    readPaidCreatorCapacityFromPaymentLedger(paymentEvents),
  );

  return {
    ...(servicePackageSnapshot ?? {}),
    balanceDueCents: Math.max(0, totalFeeCents - paidCents),
    paidCents,
    ...(paidCreatorCapacity > 0 ? { paidCreatorCapacity } : {}),
  };
}

function matchesExistingStripeReference(
  current: ExistingCampaignServiceFeeState,
  statusUpdate: CampaignServiceFeeStatusUpdate,
) {
  return Boolean(
    (statusUpdate.checkoutSessionId &&
      current.service_fee_checkout_session_id === statusUpdate.checkoutSessionId) ||
      (statusUpdate.paymentIntentId &&
        current.service_fee_payment_intent_id === statusUpdate.paymentIntentId) ||
      (statusUpdate.chargeId &&
        current.service_fee_charge_id === statusUpdate.chargeId),
  );
}

export function shouldApplyCampaignServiceFeeWebhookUpdate(
  current: ExistingCampaignServiceFeeState | null | undefined,
  statusUpdate: CampaignServiceFeeStatusUpdate,
) {
  if (!current) return true;
  if (statusUpdate.serviceFeeStatus !== "paid") return true;

  const currentStatus = current.service_fee_status;
  const isLockedFinanceState =
    currentStatus === "refunded" || currentStatus === "disputed";

  if (!isLockedFinanceState) return true;

  return !matchesExistingStripeReference(current, statusUpdate);
}

function getCheckoutStatusUpdate(
  event: StripeWebhookEvent,
): CampaignServiceFeeStatusUpdate | null {
  const session = event.data?.object;
  if (session?.mode !== "payment") return null;

  const campaignId = extractCampaignIdFromStripeMetadata(session.metadata);
  if (!campaignId) return null;

  if (
    event.type === "checkout.session.completed" &&
    session.payment_status === "paid"
  ) {
    return buildCampaignServiceFeeStatusUpdate(event, campaignId, "paid");
  }

  if (event.type === "checkout.session.async_payment_succeeded") {
    return buildCampaignServiceFeeStatusUpdate(event, campaignId, "paid");
  }

  if (event.type === "checkout.session.async_payment_failed") {
    return buildCampaignServiceFeeStatusUpdate(event, campaignId, "failed");
  }

  return null;
}

function getChargeStatusForEvent(
  event: StripeWebhookEvent,
): CampaignServiceFeeWebhookStatus | null {
  if (event.type === "charge.refunded") return "refunded";
  if (event.type === "charge.dispute.created") return "disputed";
  return null;
}

export function extractCampaignServiceFeeStatusUpdate(
  event: StripeWebhookEvent,
): CampaignServiceFeeStatusUpdate | null {
  const checkoutUpdate = getCheckoutStatusUpdate(event);
  if (checkoutUpdate) return checkoutUpdate;

  const serviceFeeStatus = getChargeStatusForEvent(event);
  if (!serviceFeeStatus) return null;

  const campaignId = extractCampaignIdFromStripeMetadata(
    event.data?.object?.metadata,
  );
  if (!campaignId) return null;

  return buildCampaignServiceFeeStatusUpdate(event, campaignId, serviceFeeStatus);
}

export function extractCampaignServiceFeeLookupRequest(
  event: StripeWebhookEvent,
): CampaignServiceFeeLookupRequest | null {
  if (extractCampaignServiceFeeStatusUpdate(event)) return null;

  const serviceFeeStatus = getChargeStatusForEvent(event);
  if (!serviceFeeStatus) return null;

  const object = event.data?.object;
  const chargeId =
    typeof object?.charge === "string"
      ? object.charge
      : event.type === "charge.refunded" && typeof object?.id === "string"
        ? object.id
        : null;
  const paymentIntentId =
    typeof object?.payment_intent === "string" ? object.payment_intent : null;

  if (!chargeId && !paymentIntentId) return null;

  return { chargeId, paymentIntentId, serviceFeeStatus };
}
