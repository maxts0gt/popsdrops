import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readPageSource() {
  return readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
}

describe("admin revenue quality contract", () => {
  it("shows current service fee operations instead of a future placeholder", () => {
    const source = readPageSource();

    expect(source).not.toContain("available when subscription plans launch");
    expect(source).not.toContain("Planned Features");
    expect(source).not.toContain("Future:");

    expect(source).toContain("async function fetchRevenueMetrics");
    expect(source).toContain("Booked service fees");
    expect(source).toContain("Revenue by package");
    expect(source).toContain("Payment status");
  });

  it("keeps revenue operations filterable, sortable, and directly actionable", () => {
    const source = readPageSource();

    expect(source).toContain("type RevenueSortKey");
    expect(source).toContain("function RevenueSortableHead");
    expect(source).toContain('data-testid="admin-revenue-sort-header"');
    expect(source).toContain("parsePaymentStatusFilter");
    expect(source).toContain("focusedCampaignId");
    expect(source).toContain('data-testid="admin-revenue-focused-campaign"');
    expect(source).toContain('data-testid="admin-revenue-service-fee-row"');
    expect(source).toContain("data-service-fee-status={campaign.service_fee_status}");
    expect(source).toContain("data-stripe-reference={stripeReference.value ?? undefined}");
    expect(source).toContain('id={`service-fee-${campaign.id}`}');
    expect(source).toContain("campaign.id === focusedCampaignId");
    expect(source).toContain(
      'data-testid="admin-revenue-service-fee-update-form"',
    );
    expect(source).toContain(
      'data-testid="admin-revenue-service-fee-status-select"',
    );
    expect(source).toContain(
      'data-testid="admin-revenue-service-fee-note-input"',
    );
    expect(source).toContain(
      'data-testid="admin-revenue-service-fee-update-action"',
    );
    expect(source).toContain("updateCampaignServiceFeeStatus");
    expect(source).toContain('name="note"');
    expect(source).toContain("Payment note");
    expect(source).toContain("Apply status");
  });

  it("shows the brand owner beside each service fee so finance knows who owes it", () => {
    const source = readPageSource();

    expect(source).toContain("brand: {");
    expect(source).toContain('"brand"');
    expect(source).toContain('brand:profiles!campaigns_brand_id_fkey(full_name,email)');
    expect(source).toContain('brand: "Brand"');
    expect(source).toContain('label="Brand"');
    expect(source).toContain('campaign.brand?.full_name ?? "Unknown brand"');
    expect(source).toContain("campaign.brand?.email");
  });

  it("keeps payment status controls compact enough for the default admin viewport", () => {
    const source = readPageSource();

    expect(source).not.toContain("min-w-96 grid-cols-[8.5rem_1fr_auto]");
    expect(source).toContain("max-w-7xl");
    expect(source).not.toContain("min-w-[22rem]");
    expect(source).toContain("grid-cols-[6.5rem_minmax(6.5rem,1fr)_auto]");
    expect(source).toContain("min-w-[18rem]");
    expect(source).toContain('aria-label="Apply status"');
    expect(source).toContain('placeholder="Reason"');
  });

  it("surfaces Stripe reconciliation details without opening Stripe first", () => {
    const source = readPageSource();

    expect(source).toContain("type RevenuePaymentEventRow");
    expect(source).toContain(".from(\"campaign_payment_events\")");
    expect(source).toContain("amount_cents: number | null");
    expect(source).toContain("payment_events: RevenuePaymentEventRow[]");
    expect(source).toContain("latestPaymentEventByCampaign");
    expect(source).toContain("paymentEventsByCampaign");
    expect(source).toContain("service_fee_checkout_session_id");
    expect(source).toContain("service_fee_payment_intent_id");
    expect(source).toContain("service_fee_last_event_id");
    expect(source).toContain("service_fee_last_event_type");
    expect(source).toContain("Recent Stripe events");
    expect(source).toContain('data-testid="admin-revenue-payment-event"');
    expect(source).toContain('data-testid="admin-revenue-stripe-reference"');
    expect(source).toContain("Payment intent");
    expect(source).toContain("Last event");
  });

  it("shows paid credit and balance due for upgraded campaign service fees", () => {
    const source = readPageSource();

    expect(source).toContain("function getRevenueServiceFeeMoney");
    expect(source).toContain("function getRevenueServiceFeePaidCents");
    expect(source).toContain('"paidCents"');
    expect(source).toContain('"balanceDueCents"');
    expect(source).toContain("const money = getRevenueServiceFeeMoney(campaign)");
    expect(source).toContain("paidCents = campaigns.reduce(");
    expect(source).toContain("openCents = campaigns.reduce(");
    expect(source).toContain('data-testid="admin-revenue-service-fee-money"');
    expect(source).toContain('data-testid="admin-revenue-service-fee-paid-credit"');
    expect(source).toContain('data-testid="admin-revenue-service-fee-balance"');
    expect(source).toContain("Paid credit");
    expect(source).toContain("Balance due");
  });

  it("shows paid campaign scope beside each service fee so finance understands the charge", () => {
    const source = readPageSource();

    expect(source).toContain("service_package_snapshot");
    expect(source).toContain("function getRevenueCampaignScope");
    expect(source).toContain("estimatedMaxCreators");
    expect(source).toContain("Creator capacity");
    expect(source).toContain('data-testid="admin-revenue-service-fee-scope"');
  });

  it("shows the finance next action in each service fee row", () => {
    const source = readPageSource();

    expect(source).toContain("function getRevenueServiceFeeNextAction");
    expect(source).toContain("Retry checkout");
    expect(source).toContain("Confirm refund");
    expect(source).toContain("Review Stripe dispute");
    expect(source).toContain(
      "Resolve the Stripe case before unlocking the campaign.",
    );
    expect(source).toContain(
      'data-testid="admin-revenue-service-fee-next-action"',
    );
    expect(source).toContain(
      "data-service-fee-next-action={serviceFeeNextAction.label}",
    );
    expect(source).toContain("serviceFeeNextAction.detail");
  });

  it("uses compact service fee cards before the desktop table gets too cramped", () => {
    const source = readPageSource();

    expect(source).toContain("function ServiceFeeUpdateForm");
    expect(source).toContain("function ServiceFeeNextActionBlock");
    expect(source).toContain("function ServiceFeeCompactCard");
    expect(source).toContain('data-testid="admin-revenue-service-fee-cards"');
    expect(source).toContain('data-testid="admin-revenue-service-fee-card"');
    expect(source).toContain("xl:hidden");
    expect(source).toContain("hidden xl:block");
    expect(source).toContain("data-campaign-id={campaign.id}");
    expect(source).toContain("serviceFeeNextAction={serviceFeeNextAction}");
  });
});
