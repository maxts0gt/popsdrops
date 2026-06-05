import { createClient } from "npm:@supabase/supabase-js@2";

import {
  buildCampaignServiceFeePersistence,
  buildCampaignServiceFeeSnapshotWithLedger,
  buildCampaignServiceFeeStatusUpdate,
  extractCampaignIdFromStripeMetadata,
  extractCampaignServiceFeeLookupRequest,
  extractCampaignServiceFeeStatusUpdate,
  shouldApplyCampaignServiceFeeWebhookUpdate,
  verifyStripeWebhookSignature,
  type CampaignServiceFeeStatusUpdate,
  type StripeWebhookEvent,
} from "../_shared/stripe-webhook.ts";

const jsonHeaders = { "Content-Type": "application/json" };

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: jsonHeaders,
    status,
  });
}

async function fetchStripeObject(
  path: string,
  secretKey: string,
): Promise<Record<string, unknown> | null> {
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: {
      Authorization: `Bearer ${secretKey}`,
    },
    method: "GET",
  });

  if (!response.ok) {
    throw new Error(`Stripe lookup failed with ${response.status}`);
  }

  const payload = (await response.json()) as unknown;
  return payload && typeof payload === "object"
    ? (payload as Record<string, unknown>)
    : null;
}

function readStripeMetadata(
  payload: Record<string, unknown> | null,
): Record<string, string | undefined> | undefined {
  const metadata = payload?.metadata;
  if (!metadata || typeof metadata !== "object") return undefined;

  return metadata as Record<string, string | undefined>;
}

function readStripeString(payload: Record<string, unknown> | null, key: string) {
  const value = payload?.[key];
  return typeof value === "string" ? value : null;
}

async function resolveCampaignServiceFeeStatusUpdate(
  event: StripeWebhookEvent,
): Promise<CampaignServiceFeeStatusUpdate | null> {
  const directUpdate = extractCampaignServiceFeeStatusUpdate(event);
  if (directUpdate) return directUpdate;

  const lookupRequest = extractCampaignServiceFeeLookupRequest(event);
  if (!lookupRequest) return null;

  const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeSecretKey) {
    throw new Error("Stripe secret key is not configured");
  }

  let paymentIntentId = lookupRequest.paymentIntentId;

  if (lookupRequest.chargeId) {
    const charge = await fetchStripeObject(
      `charges/${encodeURIComponent(lookupRequest.chargeId)}`,
      stripeSecretKey,
    );
    const campaignId = extractCampaignIdFromStripeMetadata(
      readStripeMetadata(charge),
    );
    if (campaignId) {
      return buildCampaignServiceFeeStatusUpdate(
        {
          id: event.id,
          type: event.type,
          data: {
            object: {
              amount:
                typeof charge?.amount === "number"
                  ? (charge.amount as number)
                  : null,
              currency: readStripeString(charge, "currency"),
              id: readStripeString(charge, "id") ?? undefined,
              metadata: readStripeMetadata(charge),
              payment_intent: readStripeString(charge, "payment_intent"),
            },
          },
        },
        campaignId,
        lookupRequest.serviceFeeStatus,
      );
    }
    paymentIntentId ||= readStripeString(charge, "payment_intent");
  }

  if (paymentIntentId) {
    const paymentIntent = await fetchStripeObject(
      `payment_intents/${encodeURIComponent(paymentIntentId)}`,
      stripeSecretKey,
    );
    const campaignId = extractCampaignIdFromStripeMetadata(
      readStripeMetadata(paymentIntent),
    );
    if (campaignId) {
      return buildCampaignServiceFeeStatusUpdate(
        {
          id: event.id,
          type: event.type,
          data: {
            object: {
              amount:
                typeof paymentIntent?.amount === "number"
                  ? (paymentIntent.amount as number)
                  : null,
              currency: readStripeString(paymentIntent, "currency"),
              id: readStripeString(paymentIntent, "id") ?? undefined,
              metadata: readStripeMetadata(paymentIntent),
              payment_intent: readStripeString(paymentIntent, "id"),
            },
          },
        },
        campaignId,
        lookupRequest.serviceFeeStatus,
      );
    }
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const signatureHeader = req.headers.get("stripe-signature");

  if (!webhookSecret) {
    return jsonResponse({ error: "Stripe webhook secret is not configured" }, 500);
  }

  if (!signatureHeader) {
    return jsonResponse({ error: "Missing Stripe signature" }, 400);
  }

  const payload = await req.text();

  try {
    await verifyStripeWebhookSignature({
      payload,
      secret: webhookSecret,
      signatureHeader,
    });
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Invalid Stripe signature" },
      400,
    );
  }

  let event: StripeWebhookEvent;
  try {
    event = JSON.parse(payload) as StripeWebhookEvent;
  } catch {
    return jsonResponse({ error: "Invalid JSON payload" }, 400);
  }

  let statusUpdate: CampaignServiceFeeStatusUpdate | null;
  try {
    statusUpdate = await resolveCampaignServiceFeeStatusUpdate(event);
  } catch (error) {
    return jsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : "Stripe campaign service fee lookup failed",
      },
      500,
    );
  }

  if (statusUpdate) {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Supabase service credentials are not configured" }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    const now = new Date().toISOString();
    const { campaignUpdate, paymentEvent } = buildCampaignServiceFeePersistence(
      statusUpdate,
      now,
    );

    const { error: eventError } = await supabase
      .from("campaign_payment_events")
      .upsert(paymentEvent, { ignoreDuplicates: true, onConflict: "provider,event_id" });

    if (eventError) {
      return jsonResponse({ error: eventError.message }, 500);
    }

    const { data: currentCampaign, error: currentCampaignError } = await supabase
      .from("campaigns")
      .select(
        "service_fee_cents,service_fee_charge_id,service_fee_checkout_session_id,service_fee_payment_intent_id,service_fee_status,service_package_snapshot",
      )
      .eq("id", statusUpdate.campaignId)
      .single();

    if (currentCampaignError) {
      return jsonResponse({ error: currentCampaignError.message }, 500);
    }

    if (
      !shouldApplyCampaignServiceFeeWebhookUpdate(
        currentCampaign,
        statusUpdate,
      )
    ) {
      return jsonResponse({ received: true, ignored: "stale_paid_retry" });
    }

    const { data: paymentEvents, error: paymentEventsError } = await supabase
      .from("campaign_payment_events")
      .select("amount_cents,checkout_session_id,service_fee_status,event_summary")
      .eq("campaign_id", statusUpdate.campaignId);

    if (paymentEventsError) {
      return jsonResponse({ error: paymentEventsError.message }, 500);
    }

    const { error } = await supabase
      .from("campaigns")
      .update({
        ...campaignUpdate,
        service_package_snapshot: buildCampaignServiceFeeSnapshotWithLedger({
          paymentEvents: paymentEvents ?? [],
          serviceFeeCents: currentCampaign.service_fee_cents,
          servicePackageSnapshot: currentCampaign.service_package_snapshot,
        }),
      })
      .eq("id", statusUpdate.campaignId);

    if (error) {
      return jsonResponse({ error: error.message }, 500);
    }
  }

  return jsonResponse({ received: true });
});
