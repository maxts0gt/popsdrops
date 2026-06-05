import { describe, expect, it } from "vitest";

import {
  buildStripeCheckoutSessionBody,
  getCampaignServiceFeeBalance,
  normalizeAllowedAppBaseUrls,
  resolveAllowedAppBaseUrl,
} from "./stripe-checkout";

describe("stripe checkout helpers", () => {
  it("normalizes explicit checkout return URL allow-list values", () => {
    expect(
      normalizeAllowedAppBaseUrls(
        " https://popsdrops.com/ , http://127.0.0.1:4000 ",
      ),
    ).toEqual(["https://popsdrops.com", "http://127.0.0.1:4000"]);
  });

  it("only accepts requested app base URLs from the allow-list", () => {
    expect(
      resolveAllowedAppBaseUrl({
        allowedAppBaseUrls: ["https://popsdrops.com", "http://127.0.0.1:4000"],
        requestedAppBaseUrl: "http://127.0.0.1:4000/",
      }),
    ).toBe("http://127.0.0.1:4000");

    expect(() =>
      resolveAllowedAppBaseUrl({
        allowedAppBaseUrls: ["https://popsdrops.com"],
        requestedAppBaseUrl: "https://evil.example",
      }),
    ).toThrow("Checkout return URL is not allowed.");
  });

  it("builds a Stripe Checkout request body without leaking app secrets", () => {
    const body = buildStripeCheckoutSessionBody({
      appBaseUrl: "https://popsdrops.com",
      brandId: "brand-123",
      campaignId: "campaign-123",
      campaignTitle: "Paris Launch",
      creatorCapacity: 100,
      customerEmail: "max@popsdrops.com",
      includedActiveDays: 45,
      includedReportingDays: 14,
      feeCents: 14900,
      feeCurrency: "usd",
      feeLabel: "$149",
    });

    expect(body.get("mode")).toBe("payment");
    expect(body.get("client_reference_id")).toBe("campaign-123");
    expect(body.get("customer_email")).toBe("max@popsdrops.com");
    expect(body.get("metadata[kind]")).toBe("campaign_service_fee");
    expect(body.get("metadata[campaignId]")).toBe("campaign-123");
    expect(body.get("metadata[brandId]")).toBe("brand-123");
    expect(body.get("metadata[creatorCapacity]")).toBe("100");
    expect(body.get("metadata[includedActiveDays]")).toBe("45");
    expect(body.get("metadata[includedReportingDays]")).toBe("14");
    expect(body.get("line_items[0][price_data][unit_amount]")).toBe("14900");
    expect(body.get("line_items[0][price_data][currency]")).toBe("usd");
    expect(
      body.get("line_items[0][price_data][product_data][description]"),
    ).toBe("Paris Launch - 100 creator capacity, 45 active days, 14 reporting days - $149");
    expect(body.get("success_url")).toBe(
      "https://popsdrops.com/b/campaigns/campaign-123?tab=brief&checkout=success",
    );
    expect(body.toString()).not.toContain("sk_test");
    expect(body.toString()).not.toContain("whsec");
  });

  it("charges only the remaining campaign service fee balance after a capacity upgrade", () => {
    expect(
      getCampaignServiceFeeBalance({
        feeCents: 59000,
        paymentEvents: [
          { amount_cents: 14900, service_fee_status: "paid" },
          { amount_cents: 44100, service_fee_status: "invoiced" },
        ],
      }),
    ).toEqual({
      balanceDueCents: 44100,
      paidCents: 14900,
      totalFeeCents: 59000,
    });
  });

  it("requires Checkout Session responses to include both id and hosted URL", async () => {
    const fetchStub = async () =>
      new Response(
        JSON.stringify({
          id: "cs_test_123",
          object: "checkout.session",
          payment_intent: "pi_test_123",
          url: "https://checkout.stripe.com/c/pay/cs_test_123",
        }),
        { status: 200 },
      );

    const { createStripeCheckoutSession } = await import("./stripe-checkout");
    const session = await createStripeCheckoutSession({
      body: new URLSearchParams(),
      fetcher: fetchStub,
      secretKey: "sk_test_no_print",
    });

    expect(session).toEqual({
      id: "cs_test_123",
      paymentIntentId: "pi_test_123",
      url: "https://checkout.stripe.com/c/pay/cs_test_123",
    });
  });
});
