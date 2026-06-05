import { describe, expect, it } from "vitest";

import {
  buildCampaignServiceFeeSnapshotWithLedger,
  buildCampaignServiceFeePersistence,
  createStripeWebhookSignature,
  extractCampaignServiceFeeStatusUpdate,
  extractCampaignServiceFeeLookupRequest,
  shouldApplyCampaignServiceFeeWebhookUpdate,
  verifyStripeWebhookSignature,
} from "./stripe-webhook";

describe("stripe webhook helpers", () => {
  it("verifies a valid Stripe v1 signature", async () => {
    const payload = JSON.stringify({ id: "evt_test" });
    const timestamp = 1_800_000_000;
    const secret = "whsec_test";
    const signature = await createStripeWebhookSignature(secret, timestamp, payload);

    await expect(
      verifyStripeWebhookSignature({
        nowSeconds: timestamp,
        payload,
        secret,
        signatureHeader: `t=${timestamp},v1=${signature}`,
      }),
    ).resolves.toBeUndefined();
  });

  it("rejects invalid signatures and stale timestamps", async () => {
    const payload = JSON.stringify({ id: "evt_test" });
    const timestamp = 1_800_000_000;
    const secret = "whsec_test";
    const signature = await createStripeWebhookSignature(secret, timestamp, payload);

    await expect(
      verifyStripeWebhookSignature({
        nowSeconds: timestamp,
        payload,
        secret,
        signatureHeader: `t=${timestamp},v1=bad`,
      }),
    ).rejects.toThrow("Stripe signature verification failed");

    await expect(
      verifyStripeWebhookSignature({
        nowSeconds: timestamp + 301,
        payload,
        secret,
        signatureHeader: `t=${timestamp},v1=${signature}`,
      }),
    ).rejects.toThrow("outside tolerance");
  });

  it("extracts paid campaign service fee checkout completions", () => {
    expect(
      extractCampaignServiceFeeStatusUpdate({
        id: "evt_paid",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_paid",
            amount_total: 14900,
            currency: "usd",
            metadata: {
              campaignId: "campaign-1",
              kind: "campaign_service_fee",
            },
            mode: "payment",
            payment_intent: "pi_paid",
            payment_status: "paid",
          },
        },
      }),
    ).toMatchObject({
      amountCents: 14900,
      campaignId: "campaign-1",
      checkoutSessionId: "cs_paid",
      currency: "usd",
      paymentIntentId: "pi_paid",
      serviceFeeStatus: "paid",
      stripeEventId: "evt_paid",
      stripeEventType: "checkout.session.completed",
    });

    expect(
      extractCampaignServiceFeeStatusUpdate({
        type: "checkout.session.completed",
        data: {
          object: {
            metadata: {
              campaignId: "campaign-1",
              kind: "campaign_service_fee",
            },
            mode: "payment",
            payment_status: "unpaid",
          },
        },
      }),
    ).toBeNull();
  });

  it("extracts asynchronous payment success and failure updates", () => {
    expect(
      extractCampaignServiceFeeStatusUpdate({
        id: "evt_async_paid",
        type: "checkout.session.async_payment_succeeded",
        data: {
          object: {
            id: "cs_async_paid",
            metadata: {
              campaignId: "campaign-1",
              kind: "campaign_service_fee",
            },
            mode: "payment",
            payment_intent: "pi_async_paid",
          },
        },
      }),
    ).toMatchObject({
      campaignId: "campaign-1",
      checkoutSessionId: "cs_async_paid",
      paymentIntentId: "pi_async_paid",
      serviceFeeStatus: "paid",
      stripeEventId: "evt_async_paid",
      stripeEventType: "checkout.session.async_payment_succeeded",
    });

    expect(
      extractCampaignServiceFeeStatusUpdate({
        id: "evt_async_failed",
        type: "checkout.session.async_payment_failed",
        data: {
          object: {
            id: "cs_async_failed",
            metadata: {
              campaignId: "campaign-1",
              kind: "campaign_service_fee",
            },
            mode: "payment",
            payment_intent: "pi_async_failed",
          },
        },
      }),
    ).toMatchObject({
      campaignId: "campaign-1",
      checkoutSessionId: "cs_async_failed",
      paymentIntentId: "pi_async_failed",
      serviceFeeStatus: "failed",
      stripeEventId: "evt_async_failed",
      stripeEventType: "checkout.session.async_payment_failed",
    });
  });

  it("extracts refund and dispute updates from campaign service fee charges", () => {
    expect(
      extractCampaignServiceFeeStatusUpdate({
        id: "evt_refunded",
        type: "charge.refunded",
        data: {
          object: {
            id: "ch_refunded",
            amount: 14900,
            currency: "usd",
            metadata: {
              campaignId: "campaign-1",
              kind: "campaign_service_fee",
            },
            payment_intent: "pi_refunded",
          },
        },
      }),
    ).toMatchObject({
      amountCents: 14900,
      campaignId: "campaign-1",
      chargeId: "ch_refunded",
      currency: "usd",
      paymentIntentId: "pi_refunded",
      serviceFeeStatus: "refunded",
      stripeEventId: "evt_refunded",
      stripeEventType: "charge.refunded",
    });

    expect(
      extractCampaignServiceFeeStatusUpdate({
        id: "evt_disputed",
        type: "charge.dispute.created",
        data: {
          object: {
            charge: "ch_disputed",
            metadata: {
              campaignId: "campaign-1",
              kind: "campaign_service_fee",
            },
            payment_intent: "pi_disputed",
          },
        },
      }),
    ).toMatchObject({
      campaignId: "campaign-1",
      chargeId: "ch_disputed",
      paymentIntentId: "pi_disputed",
      serviceFeeStatus: "disputed",
      stripeEventId: "evt_disputed",
      stripeEventType: "charge.dispute.created",
    });
  });

  it("ignores Stripe events that are not PopsDrops campaign service fees", () => {
    expect(
      extractCampaignServiceFeeStatusUpdate({
        type: "charge.refunded",
        data: {
          object: {
            metadata: {
              campaignId: "campaign-1",
              kind: "other_product",
            },
          },
        },
      }),
    ).toBeNull();

    expect(
      extractCampaignServiceFeeStatusUpdate({
        type: "checkout.session.async_payment_failed",
        data: {
          object: {
            metadata: {
              campaignId: "campaign-1",
              kind: "campaign_service_fee",
            },
            mode: "subscription",
          },
        },
      }),
    ).toBeNull();
  });

  it("asks the webhook handler to resolve charge metadata when Stripe omits it", () => {
    expect(
      extractCampaignServiceFeeLookupRequest({
        type: "charge.refunded",
        data: {
          object: {
            id: "ch_123",
            payment_intent: "pi_123",
          },
        },
      }),
    ).toEqual({
      chargeId: "ch_123",
      paymentIntentId: "pi_123",
      serviceFeeStatus: "refunded",
    });

    expect(
      extractCampaignServiceFeeLookupRequest({
        type: "charge.dispute.created",
        data: {
          object: {
            charge: "ch_456",
            payment_intent: "pi_456",
          },
        },
      }),
    ).toEqual({
      chargeId: "ch_456",
      paymentIntentId: "pi_456",
      serviceFeeStatus: "disputed",
    });

    expect(
      extractCampaignServiceFeeLookupRequest({
        type: "checkout.session.async_payment_failed",
        data: {
          object: {
            metadata: {
              kind: "campaign_service_fee",
            },
            mode: "payment",
          },
        },
      }),
    ).toBeNull();
  });

  it("builds idempotent persistence rows for webhook status changes", () => {
    const receivedAt = "2026-05-16T16:15:00.000Z";
    const paid = buildCampaignServiceFeePersistence(
      {
        amountCents: 14900,
        campaignId: "campaign-1",
        chargeId: "ch_paid",
        checkoutSessionId: "cs_paid",
        currency: "usd",
        eventSummary: { objectId: "cs_paid" },
        paymentIntentId: "pi_paid",
        serviceFeeStatus: "paid",
        stripeEventId: "evt_paid",
        stripeEventType: "checkout.session.completed",
      },
      receivedAt,
    );

    expect(paid.campaignUpdate).toMatchObject({
      service_fee_checkout_session_id: "cs_paid",
      service_fee_last_event_id: "evt_paid",
      service_fee_last_event_type: "checkout.session.completed",
      service_fee_paid_at: receivedAt,
      service_fee_payment_intent_id: "pi_paid",
      service_fee_status: "paid",
      updated_at: receivedAt,
    });
    expect(paid.paymentEvent).toMatchObject({
      amount_cents: 14900,
      campaign_id: "campaign-1",
      event_id: "evt_paid",
      event_type: "checkout.session.completed",
      provider: "stripe",
      received_at: receivedAt,
      service_fee_status: "paid",
    });
  });

  it("refreshes the campaign service snapshot from incremental paid events", () => {
    expect(
      buildCampaignServiceFeeSnapshotWithLedger({
        paymentEvents: [
          { amount_cents: 14_900, service_fee_status: "paid" },
          { amount_cents: 19_600, service_fee_status: "paid" },
          { amount_cents: 24_500, service_fee_status: "invoiced" },
        ],
        serviceFeeCents: 59_000,
        servicePackageSnapshot: {
          balanceDueCents: 19_600,
          estimatedMaxCreators: 50,
          paidCents: 14_900,
          tierKey: "workspace",
        },
      }),
    ).toEqual({
      balanceDueCents: 24_500,
      estimatedMaxCreators: 50,
      paidCents: 34_500,
      tierKey: "workspace",
    });
  });

  it("promotes paid creator capacity from the matching invoiced checkout event", () => {
    expect(
      buildCampaignServiceFeeSnapshotWithLedger({
        paymentEvents: [
          {
            amount_cents: 14_900,
            event_summary: { startingCapacity: 10 },
            service_fee_status: "paid",
          },
          {
            amount_cents: 19_600,
            checkout_session_id: "cs_50",
            event_summary: { creatorCapacity: 50 },
            service_fee_status: "invoiced",
          },
          {
            amount_cents: 19_600,
            checkout_session_id: "cs_50",
            event_summary: {},
            service_fee_status: "paid",
          },
          {
            amount_cents: 32_300,
            checkout_session_id: "cs_100",
            event_summary: { creatorCapacity: 100 },
            service_fee_status: "invoiced",
          },
        ],
        serviceFeeCents: 66_800,
        servicePackageSnapshot: {
          balanceDueCents: 19_600,
          estimatedMaxCreators: 100,
          paidCents: 14_900,
          paidCreatorCapacity: 10,
          tierKey: "workspace",
        },
      }),
    ).toMatchObject({
      balanceDueCents: 32_300,
      estimatedMaxCreators: 100,
      paidCents: 34_500,
      paidCreatorCapacity: 50,
      tierKey: "workspace",
    });
  });

  it("uses a deterministic event id fallback for Stripe events without ids", () => {
    const disputed = buildCampaignServiceFeePersistence(
      {
        amountCents: null,
        campaignId: "campaign-1",
        chargeId: "ch_dispute",
        checkoutSessionId: null,
        currency: null,
        eventSummary: {},
        paymentIntentId: "pi_dispute",
        serviceFeeStatus: "disputed",
        stripeEventId: null,
        stripeEventType: "charge.dispute.created",
      },
      "2026-05-16T16:20:00.000Z",
    );

    expect(disputed.stripeEventId).toBe(
      "charge.dispute.created:campaign-1:pi_dispute",
    );
    expect(disputed.campaignUpdate).toMatchObject({
      service_fee_charge_id: "ch_dispute",
      service_fee_disputed_at: "2026-05-16T16:20:00.000Z",
      service_fee_last_event_id: "charge.dispute.created:campaign-1:pi_dispute",
      service_fee_status: "disputed",
    });
    expect(disputed.paymentEvent.event_id).toBe(
      "charge.dispute.created:campaign-1:pi_dispute",
    );
  });

  it("does not let stale paid retries unlock refunded or disputed service fees", () => {
    const stalePaidUpdate = {
      amountCents: 14900,
      campaignId: "campaign-1",
      chargeId: "ch_paid",
      checkoutSessionId: "cs_paid",
      currency: "usd",
      eventSummary: { objectId: "cs_paid" },
      paymentIntentId: "pi_paid",
      serviceFeeStatus: "paid" as const,
      stripeEventId: "evt_paid_retry",
      stripeEventType: "checkout.session.completed",
    };

    expect(
      shouldApplyCampaignServiceFeeWebhookUpdate(
        {
          service_fee_checkout_session_id: "cs_paid",
          service_fee_payment_intent_id: "pi_paid",
          service_fee_status: "disputed",
        },
        stalePaidUpdate,
      ),
    ).toBe(false);

    expect(
      shouldApplyCampaignServiceFeeWebhookUpdate(
        {
          service_fee_charge_id: "ch_paid",
          service_fee_status: "refunded",
        },
        stalePaidUpdate,
      ),
    ).toBe(false);

    expect(
      shouldApplyCampaignServiceFeeWebhookUpdate(
        {
          service_fee_checkout_session_id: "cs_recovery",
          service_fee_payment_intent_id: "pi_recovery",
          service_fee_status: "disputed",
        },
        stalePaidUpdate,
      ),
    ).toBe(true);
  });
});
