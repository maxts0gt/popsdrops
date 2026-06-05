import { z } from "npm:zod@4.3.6";
import type { SupabaseClient } from "npm:@supabase/supabase-js@2.100.1";

import { createAdminClient, requireUser } from "../_shared/auth.ts";
import { json, methodNotAllowed, corsHeaders } from "../_shared/json.ts";
import {
  buildStripeCheckoutSessionBody,
  createStripeCheckoutSession,
  getCampaignServiceFeeBalance,
  normalizeAllowedAppBaseUrls,
  resolveAllowedAppBaseUrl,
} from "../_shared/stripe-checkout.ts";

type CampaignServiceFeeRecord = {
  id: string;
  max_creators: number | null;
  performance_due_date: string | null;
  posting_window_end: string | null;
  posting_window_start: string | null;
  title: string;
  status: string;
  service_fee_cents: number | null;
  service_fee_currency: string | null;
  service_fee_status: string | null;
  service_package_snapshot: Record<string, unknown> | null;
};

const uuidLike = z.string().regex(
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
  "Invalid campaign ID",
);

const checkoutRequestSchema = z.object({
  appBaseUrl: z.string().trim().url().max(2048),
  campaignId: uuidLike,
});

function getCheckoutAllowedAppBaseUrls() {
  const raw =
    Deno.env.get("CHECKOUT_ALLOWED_APP_URLS") ?? Deno.env.get("APP_BASE_URL");
  return normalizeAllowedAppBaseUrls(raw);
}

function formatCampaignServiceFee(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    currency: currency.toUpperCase(),
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
    style: "currency",
  }).format(cents / 100);
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

function getCampaignCheckoutPricingDays(campaign: CampaignServiceFeeRecord) {
  const startDay = dateStringToUtcDay(campaign.posting_window_start);
  const endDay = dateStringToUtcDay(campaign.posting_window_end);
  const performanceDay = dateStringToUtcDay(campaign.performance_due_date);
  const activeDays =
    startDay === null || endDay === null ? 0 : Math.max(1, endDay - startDay + 1);
  const reportingDays =
    endDay === null || performanceDay === null ? 0 : Math.max(0, performanceDay - endDay);

  return { activeDays, reportingDays };
}

function assertCampaignHasServiceFeeObligation(
  campaign: CampaignServiceFeeRecord | null,
): asserts campaign is CampaignServiceFeeRecord & {
  service_fee_cents: number;
  service_fee_currency: "usd";
  service_fee_status: string;
  service_package_snapshot: Record<string, unknown>;
} {
  const snapshot = campaign?.service_package_snapshot;
  const snapshotFeeCents = snapshot?.feeCents;
  const snapshotCreatorCapacity = snapshot?.estimatedMaxCreators;
  const snapshotActiveDays = snapshot?.estimatedActiveDays;
  const snapshotReportingDays = snapshot?.estimatedReportingDays;

  if (
    !campaign ||
    !Number.isFinite(campaign.service_fee_cents) ||
    Number(campaign.service_fee_cents) <= 0 ||
    campaign.service_fee_currency !== "usd" ||
    !campaign.service_fee_status ||
    !snapshot ||
    snapshot.mode !== "private" ||
    snapshot.requiresCustomPricing === true ||
    snapshotFeeCents !== campaign.service_fee_cents
  ) {
    throw new Error("Campaign service fee is missing. Save a fresh draft before publishing.");
  }

  const checkoutPricingDays = getCampaignCheckoutPricingDays(campaign);
  if (
    !Number.isFinite(campaign.max_creators) ||
    Number(snapshotCreatorCapacity) !== campaign.max_creators ||
    Number(snapshotActiveDays) !== checkoutPricingDays.activeDays ||
    Number(snapshotReportingDays) !== checkoutPricingDays.reportingDays
  ) {
    throw new Error("Campaign service fee is out of sync. Save the campaign scope before paying.");
  }
}

function errorStatus(message: string) {
  if (message === "Unauthorized") return 401;
  if (message.includes("not configured")) return 500;
  if (message.includes("not found")) return 404;
  return 400;
}

async function getBrandWorkspaceForUser(admin: SupabaseClient, userId: string) {
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role, status, email")
    .eq("id", userId)
    .single();

  if (profileError || profile?.role !== "brand" || profile.status !== "approved") {
    throw new Error("Only brands can pay campaign service fees.");
  }

  const { data: ownedBrand, error: ownedBrandError } = await admin
    .from("brand_profiles")
    .select("profile_id")
    .eq("profile_id", userId)
    .maybeSingle();

  if (ownedBrandError) throw new Error(ownedBrandError.message);
  if (ownedBrand) {
    return {
      brandId: userId,
      email: profile.email as string | null,
      role: "owner",
    };
  }

  const { data: member, error: memberError } = await admin
    .from("brand_team_members")
    .select("brand_id, role, accepted_at")
    .eq("user_id", userId)
    .not("accepted_at", "is", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (memberError) throw new Error(memberError.message);
  if (!member || !["owner", "admin", "manager"].includes(String(member.role))) {
    throw new Error("Only brands can pay campaign service fees.");
  }

  return {
    brandId: member.brand_id as string,
    email: profile.email as string | null,
    role: member.role as string,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return methodNotAllowed();
  }

  try {
    const { user } = await requireUser(req);
    const parsed = checkoutRequestSchema.safeParse(await req.json());

    if (!parsed.success) {
      return json(
        { error: "Invalid checkout request", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      throw new Error("Stripe secret key is not configured.");
    }

    const appBaseUrl = resolveAllowedAppBaseUrl({
      allowedAppBaseUrls: getCheckoutAllowedAppBaseUrls(),
      requestedAppBaseUrl: parsed.data.appBaseUrl,
    });
    const admin = createAdminClient();
    const workspace = await getBrandWorkspaceForUser(admin, user.id);

    const { data: campaign, error: campaignError } = await admin
      .from("campaigns")
      .select(
        "id, title, status, max_creators, posting_window_start, posting_window_end, performance_due_date, service_fee_cents, service_fee_currency, service_fee_status, service_package_snapshot",
      )
      .eq("id", parsed.data.campaignId)
      .eq("brand_id", workspace.brandId)
      .single();

    if (campaignError || !campaign) {
      throw new Error("Campaign not found.");
    }

    assertCampaignHasServiceFeeObligation(campaign);

    if (campaign.status === "completed" || campaign.status === "cancelled") {
      throw new Error("This campaign is closed.");
    }

    const { data: paymentEvents, error: paymentEventsError } = await admin
      .from("campaign_payment_events")
      .select("amount_cents, service_fee_status")
      .eq("campaign_id", campaign.id);

    if (paymentEventsError) {
      throw new Error(paymentEventsError.message);
    }

    const balance = getCampaignServiceFeeBalance({
      feeCents: campaign.service_fee_cents,
      paymentEvents: paymentEvents ?? [],
    });

    if (balance.balanceDueCents === 0) {
      return json({
        alreadyPaid: true,
        url: `${appBaseUrl}/b/campaigns/${campaign.id}?tab=brief`,
      });
    }

    const session = await createStripeCheckoutSession({
      secretKey: stripeSecretKey,
      body: buildStripeCheckoutSessionBody({
        appBaseUrl,
        brandId: workspace.brandId,
        campaignId: campaign.id,
        campaignTitle: campaign.title,
        creatorCapacity: Number(campaign.service_package_snapshot.estimatedMaxCreators),
        customerEmail: user.email ?? workspace.email ?? null,
        includedActiveDays: Number(campaign.service_package_snapshot.estimatedActiveDays),
        includedReportingDays: Number(campaign.service_package_snapshot.estimatedReportingDays),
        feeCents: balance.balanceDueCents,
        feeCurrency: campaign.service_fee_currency,
        feeLabel: formatCampaignServiceFee(
          balance.balanceDueCents,
          campaign.service_fee_currency,
        ),
      }),
    });

    const now = new Date().toISOString();
    const { error: updateError } = await admin
      .from("campaigns")
      .update({
        service_fee_checkout_session_id: session.id,
        service_fee_last_event_at: now,
        service_fee_last_event_id: session.id,
        service_fee_last_event_type: "checkout.session.created",
        service_fee_payment_intent_id: session.paymentIntentId,
        service_fee_status: "invoiced",
      })
      .eq("id", campaign.id)
      .eq("brand_id", workspace.brandId);

    if (updateError) throw new Error(updateError.message);

    const { error: eventError } = await admin
      .from("campaign_payment_events")
      .upsert(
        {
          amount_cents: balance.balanceDueCents,
          campaign_id: campaign.id,
          checkout_session_id: session.id,
          currency: campaign.service_fee_currency,
          event_id: session.id,
          event_summary: {
            creatorCapacity: Number(campaign.service_package_snapshot.estimatedMaxCreators),
            includedActiveDays: Number(campaign.service_package_snapshot.estimatedActiveDays),
            includedReportingDays: Number(campaign.service_package_snapshot.estimatedReportingDays),
            source: "create-stripe-checkout-session",
          },
          event_type: "checkout.session.created",
          payment_intent_id: session.paymentIntentId,
          provider: "stripe",
          received_at: now,
          service_fee_status: "invoiced",
        },
        { ignoreDuplicates: true, onConflict: "provider,event_id" },
      );

    if (eventError) throw new Error(eventError.message);

    return json({
      alreadyPaid: false,
      url: session.url,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Checkout could not be created.";
    return json({ error: message }, { status: errorStatus(message) });
  }
});
