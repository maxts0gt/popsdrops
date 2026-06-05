import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  buildStripeLargeCampaignScopeUpdate,
  STRIPE_UPGRADE_BALANCE_DUE_CENTS,
} from "./smoke-stripe-checkout-webhook.mjs";
import {
  getCampaignServicePricingDays,
} from "../src/lib/campaign-service-packages";
import {
  parseSupabaseJsonOutput,
  readLocalEnv,
  summarizeStripePaymentReadiness,
} from "./stripe-payment-readiness.mjs";

describe("stripe payment readiness", () => {
  it("parses Supabase JSON output even when the CLI prints update notices", () => {
    const output = `A new version of Supabase CLI is available\n[\n  { "slug": "stripe-webhook", "status": "ACTIVE", "verify_jwt": false }\n]\n`;

    expect(parseSupabaseJsonOutput(output)).toEqual([
      { slug: "stripe-webhook", status: "ACTIVE", verify_jwt: false },
    ]);
  });

  it("passes only when payment secrets and payment functions live in Supabase", () => {
    const ready = summarizeStripePaymentReadiness({
      env: {
        NEXT_PUBLIC_APP_URL: "https://popsdrops.com",
      },
      functions: [
        {
          slug: "create-stripe-checkout-session",
          status: "ACTIVE",
          verify_jwt: true,
        },
        {
          slug: "stripe-webhook",
          status: "ACTIVE",
          verify_jwt: false,
        },
      ],
      packageScripts: {
        "smoke:critical": "npm run smoke:service-fee-gate",
        "smoke:payment-spine":
          "npm run check:stripe-payments && npm run smoke:service-fee-gate && npm run smoke:large-campaign-creation && npm run smoke:large-campaign-capacity && npm run smoke:stripe-checkout && npm run smoke:stripe-negative && npm run smoke:stripe-cancelled && npm run smoke:stripe-recovery && npm run smoke:admin-service-fee-override",
        "smoke:release-bad-paths":
          "npm run smoke:payment-spine && npm run smoke:content-report-recovery && npm run smoke:report-share-revoke",
        "smoke:release": "npm run smoke:critical && npm run smoke:release-bad-paths",
        "smoke:service-fee-gate": "node scripts/smoke-campaign-service-fee-gate.mjs",
        "smoke:stripe-checkout": "node scripts/smoke-stripe-checkout-webhook.mjs",
      },
      routeFiles: [],
      secrets: [
        { name: "APP_BASE_URL" },
        { name: "STRIPE_SECRET_KEY" },
        { name: "STRIPE_WEBHOOK_SECRET" },
      ],
    });

    expect(ready.ok).toBe(true);
    expect(ready.blockers).toEqual([]);
    expect(ready.checks.externalStripeCheckoutSmokeAvailable).toBe(true);
    expect(ready.checks.paymentSpineSmokeAvailable).toBe(true);
    expect(ready.checks.paymentSpineIncludesLargeCampaignCapacity).toBe(true);
    expect(ready.checks.releaseBadPathsIncludesPaymentSpine).toBe(true);
    expect(ready.checks.releaseIncludesPaymentBadPaths).toBe(true);
  });

  it("keeps the Stripe checkout smoke fixture aligned with the saved campaign fee snapshot", () => {
    const scope = buildStripeLargeCampaignScopeUpdate();
    const pricingDays = getCampaignServicePricingDays({
      performanceDueDate: scope.performance_due_date,
      postingWindowEnd: scope.posting_window_end,
      postingWindowStart: scope.posting_window_start,
    });

    expect(scope.max_creators).toBe(scope.service_package_snapshot.estimatedMaxCreators);
    expect(scope.recruitment_visibility).toBe("open_applications");
    expect(pricingDays.activeDays).toBe(
      scope.service_package_snapshot.estimatedActiveDays,
    );
    expect(pricingDays.reportingDays).toBe(
      scope.service_package_snapshot.estimatedReportingDays,
    );
    expect(scope.service_package_snapshot.balanceDueCents).toBe(
      STRIPE_UPGRADE_BALANCE_DUE_CENTS,
    );
  });

  it("treats STRIPE_SECRET_KEY in any loaded app env file as a blocker", () => {
    const dir = mkdtempSync(join(tmpdir(), "popsdrops-stripe-env-"));
    try {
      const safeEnvPath = join(dir, ".env.local");
      const unsafeEnvPath = join(dir, ".env");
      writeFileSync(safeEnvPath, "NEXT_PUBLIC_APP_URL=https://popsdrops.com\n");
      writeFileSync(unsafeEnvPath, "STRIPE_SECRET_KEY=sk_test_do_not_print\n");

      const env = readLocalEnv([safeEnvPath, unsafeEnvPath], {});
      const summary = summarizeStripePaymentReadiness({
        env,
        functions: [
          {
            slug: "create-stripe-checkout-session",
            status: "ACTIVE",
            verify_jwt: true,
          },
          {
            slug: "stripe-webhook",
            status: "ACTIVE",
            verify_jwt: false,
          },
        ],
        packageScripts: {
          "smoke:critical": "npm run smoke:service-fee-gate",
          "smoke:payment-spine":
            "npm run check:stripe-payments && npm run smoke:service-fee-gate && npm run smoke:large-campaign-creation && npm run smoke:large-campaign-capacity && npm run smoke:stripe-checkout && npm run smoke:stripe-negative && npm run smoke:stripe-cancelled && npm run smoke:stripe-recovery && npm run smoke:admin-service-fee-override",
          "smoke:release-bad-paths":
            "npm run smoke:payment-spine && npm run smoke:content-report-recovery && npm run smoke:report-share-revoke",
          "smoke:release":
            "npm run smoke:critical && npm run smoke:release-bad-paths",
          "smoke:stripe-checkout": "node scripts/smoke-stripe-checkout-webhook.mjs",
        },
        routeFiles: [],
        secrets: [
          { name: "CHECKOUT_ALLOWED_APP_URLS" },
          { name: "STRIPE_SECRET_KEY" },
          { name: "STRIPE_WEBHOOK_SECRET" },
        ],
      });

      expect(summary.ok).toBe(false);
      expect(summary.blockers).toContain(
        "Remove STRIPE_SECRET_KEY from app env. Stripe payment secrets belong in Supabase only.",
      );
      expect(JSON.stringify(summary)).not.toContain("sk_test");
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });

  it("reports actionable blockers without exposing secret values", () => {
    const summary = summarizeStripePaymentReadiness({
      env: {
        STRIPE_SECRET_KEY: "sk_test_do_not_print",
      },
      functions: [
        {
          slug: "stripe-webhook",
          status: "ACTIVE",
          verify_jwt: true,
        },
      ],
      packageScripts: {
        "smoke:critical": "npm run smoke:campaign-detail",
      },
      routeFiles: ["src/app/api/stripe/webhook/route.ts"],
      secrets: [],
    });

    expect(summary.ok).toBe(false);
    expect(summary.blockers).toContain(
      "Remove STRIPE_SECRET_KEY from app env. Stripe payment secrets belong in Supabase only.",
    );
    expect(summary.blockers).toContain(
      "Deploy create-stripe-checkout-session with verify_jwt=true.",
    );
    expect(summary.blockers).toContain(
      "Set NEXT_PUBLIC_APP_URL or NEXT_PUBLIC_SITE_URL so Stripe redirects to the canonical app URL.",
    );
    expect(summary.blockers).toContain(
      "Set STRIPE_SECRET_KEY in Supabase Edge Function secrets.",
    );
    expect(summary.blockers).toContain(
      "Set APP_BASE_URL or CHECKOUT_ALLOWED_APP_URLS in Supabase Edge Function secrets.",
    );
    expect(summary.blockers).toContain(
      "Remove the Next.js /api/stripe/webhook route. Stripe webhooks belong in Supabase Edge Functions.",
    );
    expect(summary.blockers).toContain(
      "Add smoke:stripe-checkout for the real Stripe Checkout and webhook path.",
    );
    expect(summary.blockers).toContain(
      "Add smoke:payment-spine so payment readiness, checkout, bad states, recovery, and manual override run as one release gate.",
    );
    expect(summary.blockers).toContain(
      "Use smoke:payment-spine inside smoke:release-bad-paths before other bad-path checks.",
    );
    expect(summary.blockers).toContain(
      "Run smoke:release-bad-paths from smoke:release so large campaign payment proof is part of the release gate.",
    );
    expect(JSON.stringify(summary)).not.toContain("sk_test");
    expect(JSON.stringify(summary)).not.toContain("whsec");
  });
});
