type BuildStripeCheckoutSessionBodyInput = {
  appBaseUrl: string;
  brandId: string;
  campaignId: string;
  campaignTitle: string;
  creatorCapacity?: number | null;
  customerEmail?: string | null;
  includedActiveDays?: number | null;
  includedReportingDays?: number | null;
  feeCents: number;
  feeCurrency: string;
  feeLabel: string;
};

type CreateStripeCheckoutSessionInput = {
  body: URLSearchParams;
  fetcher?: typeof fetch;
  secretKey: string;
};

type CampaignServicePaymentEvent = {
  amount_cents?: number | null;
  service_fee_status?: string | null;
};

export function getCampaignServiceFeeBalance({
  feeCents,
  paymentEvents = [],
}: {
  feeCents: number | null | undefined;
  paymentEvents?: CampaignServicePaymentEvent[] | null;
}) {
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

function normalizeAppBaseUrl(value: string) {
  const url = new URL(value);

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Checkout return URL must use http or https.");
  }

  if (url.search || url.hash) {
    throw new Error("Checkout return URL must be a base URL.");
  }

  const pathname = url.pathname === "/" ? "" : url.pathname.replace(/\/+$/u, "");
  return `${url.protocol}//${url.host}${pathname}`;
}

export function normalizeAllowedAppBaseUrls(raw?: string | null) {
  return (raw ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map(normalizeAppBaseUrl);
}

export function resolveAllowedAppBaseUrl({
  allowedAppBaseUrls,
  requestedAppBaseUrl,
}: {
  allowedAppBaseUrls: string[];
  requestedAppBaseUrl: string;
}) {
  if (allowedAppBaseUrls.length === 0) {
    throw new Error("Checkout return URL allow-list is not configured.");
  }

  const requested = normalizeAppBaseUrl(requestedAppBaseUrl);
  const allowed = new Set(allowedAppBaseUrls.map(normalizeAppBaseUrl));

  if (!allowed.has(requested)) {
    throw new Error("Checkout return URL is not allowed.");
  }

  return requested;
}

function formatCheckoutScopeLabel({
  creatorCapacity,
  includedActiveDays,
  includedReportingDays,
}: Pick<
  BuildStripeCheckoutSessionBodyInput,
  "creatorCapacity" | "includedActiveDays" | "includedReportingDays"
>) {
  const scope = [
    Number.isFinite(creatorCapacity)
      ? `${Number(creatorCapacity)} creator capacity`
      : null,
    Number.isFinite(includedActiveDays)
      ? `${Number(includedActiveDays)} active days`
      : null,
    Number.isFinite(includedReportingDays)
      ? `${Number(includedReportingDays)} reporting days`
      : null,
  ].filter(Boolean);

  return scope.join(", ");
}

export function buildStripeCheckoutSessionBody({
  appBaseUrl,
  brandId,
  campaignId,
  campaignTitle,
  creatorCapacity,
  customerEmail,
  includedActiveDays,
  includedReportingDays,
  feeCents,
  feeCurrency,
  feeLabel,
}: BuildStripeCheckoutSessionBodyInput) {
  const body = new URLSearchParams();
  const metadata = {
    brandId,
    campaignId,
    kind: "campaign_service_fee",
  };
  const scopeLabel = formatCheckoutScopeLabel({
    creatorCapacity,
    includedActiveDays,
    includedReportingDays,
  });

  body.set("mode", "payment");
  body.set("client_reference_id", campaignId);
  if (customerEmail) body.set("customer_email", customerEmail);
  body.set("line_items[0][price_data][currency]", feeCurrency);
  body.set("line_items[0][price_data][product_data][name]", "PopsDrops Private Campaign OS");
  body.set(
    "line_items[0][price_data][product_data][description]",
    [campaignTitle, scopeLabel, feeLabel].filter(Boolean).join(" - "),
  );
  body.set("line_items[0][price_data][unit_amount]", String(feeCents));
  body.set("line_items[0][quantity]", "1");
  body.set("success_url", `${appBaseUrl}/b/campaigns/${campaignId}?tab=brief&checkout=success`);
  body.set("cancel_url", `${appBaseUrl}/b/campaigns/${campaignId}?tab=brief&checkout=cancelled`);

  for (const [key, value] of Object.entries(metadata)) {
    body.set(`metadata[${key}]`, value);
    body.set(`payment_intent_data[metadata][${key}]`, value);
  }
  for (const [key, value] of Object.entries({
    creatorCapacity,
    includedActiveDays,
    includedReportingDays,
  })) {
    if (!Number.isFinite(value)) continue;
    body.set(`metadata[${key}]`, String(Number(value)));
    body.set(`payment_intent_data[metadata][${key}]`, String(Number(value)));
  }

  return body;
}

export async function createStripeCheckoutSession({
  body,
  fetcher = fetch,
  secretKey,
}: CreateStripeCheckoutSessionInput) {
  const response = await fetcher("https://api.stripe.com/v1/checkout/sessions", {
    body,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });
  const responseText = await response.text();
  let payload: unknown = null;

  try {
    payload = JSON.parse(responseText) as unknown;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "error" in payload &&
      payload.error &&
      typeof payload.error === "object" &&
      "message" in payload.error &&
      typeof payload.error.message === "string"
        ? payload.error.message
        : "Stripe Checkout Session creation failed.";
    throw new Error(message);
  }

  const id =
    payload &&
    typeof payload === "object" &&
    "id" in payload &&
    typeof payload.id === "string"
      ? payload.id
      : null;
  const url =
    payload &&
    typeof payload === "object" &&
    "url" in payload &&
    typeof payload.url === "string"
      ? payload.url
      : null;
  const paymentIntentId =
    payload &&
    typeof payload === "object" &&
    "payment_intent" in payload &&
    typeof payload.payment_intent === "string"
      ? payload.payment_intent
      : null;

  if (!id) {
    throw new Error("Stripe did not return a checkout session id.");
  }

  if (!url) {
    throw new Error("Stripe did not return a checkout URL.");
  }

  return { id, paymentIntentId, url };
}
