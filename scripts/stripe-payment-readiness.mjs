#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CHECKOUT_FUNCTION_SLUG = "create-stripe-checkout-session";
const REQUIRED_FUNCTION_SLUG = "stripe-webhook";
const NEXT_WEBHOOK_ROUTE = "src/app/api/stripe/webhook/route.ts";
const STRIPE_CHECKOUT_SMOKE_SCRIPT =
  "node scripts/smoke-stripe-checkout-webhook.mjs";
const PAYMENT_SPINE_SMOKE_SCRIPT =
  "npm run check:stripe-payments && npm run smoke:service-fee-gate && npm run smoke:large-campaign-creation && npm run smoke:large-campaign-capacity && npm run smoke:stripe-checkout && npm run smoke:stripe-negative && npm run smoke:stripe-cancelled && npm run smoke:stripe-recovery && npm run smoke:admin-service-fee-override";

function parseEnvLine(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) return null;
  const index = trimmed.indexOf("=");
  if (index === -1) return null;
  const key = trimmed.slice(0, index).trim();
  const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
  return [key, value];
}

export function readLocalEnv(envPaths = [".env", ".env.local"], baseEnv = process.env) {
  const paths = Array.isArray(envPaths) ? envPaths : [envPaths];
  const env = { ...baseEnv };

  for (const envPath of paths) {
    if (!existsSync(envPath)) continue;

    for (const line of readFileSync(envPath, "utf8").split(/\r?\n/u)) {
      const parsed = parseEnvLine(line);
      if (!parsed) continue;
      const [key, value] = parsed;
      env[key] ??= value;
    }
  }

  return env;
}

export function parseProjectRefFromSupabaseUrl(url) {
  if (!url) return null;
  try {
    const host = new URL(url).hostname;
    const [projectRef] = host.split(".");
    return projectRef || null;
  } catch {
    return null;
  }
}

export function parseSupabaseJsonOutput(output) {
  const start = output.indexOf("[");
  if (start === -1) {
    throw new Error("Supabase CLI did not return a JSON array.");
  }

  return JSON.parse(output.slice(start));
}

function readPackageScripts() {
  const packageJson = JSON.parse(
    readFileSync(resolve(process.cwd(), "package.json"), "utf8"),
  );
  return packageJson.scripts ?? {};
}

function runSupabaseJson(args) {
  const output = execFileSync("supabase", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  return parseSupabaseJsonOutput(output);
}

export function summarizeStripePaymentReadiness({
  env,
  functions,
  packageScripts,
  routeFiles,
  secrets,
}) {
  const secretNames = new Set(secrets.map((secret) => secret.name));
  const checkoutFunction = functions.find(
    (supabaseFunction) => supabaseFunction.slug === CHECKOUT_FUNCTION_SLUG,
  );
  const stripeWebhook = functions.find(
    (supabaseFunction) => supabaseFunction.slug === REQUIRED_FUNCTION_SLUG,
  );
  const blockers = [];

  if (env.STRIPE_SECRET_KEY) {
    blockers.push(
      "Remove STRIPE_SECRET_KEY from app env. Stripe payment secrets belong in Supabase only.",
    );
  }

  if (!env.NEXT_PUBLIC_APP_URL && !env.NEXT_PUBLIC_SITE_URL) {
    blockers.push(
      "Set NEXT_PUBLIC_APP_URL or NEXT_PUBLIC_SITE_URL so Stripe redirects to the canonical app URL.",
    );
  }

  if (!secretNames.has("STRIPE_SECRET_KEY")) {
    blockers.push("Set STRIPE_SECRET_KEY in Supabase Edge Function secrets.");
  }

  if (!secretNames.has("STRIPE_WEBHOOK_SECRET")) {
    blockers.push("Set STRIPE_WEBHOOK_SECRET in Supabase Edge Function secrets.");
  }

  if (
    !secretNames.has("APP_BASE_URL") &&
    !secretNames.has("CHECKOUT_ALLOWED_APP_URLS")
  ) {
    blockers.push(
      "Set APP_BASE_URL or CHECKOUT_ALLOWED_APP_URLS in Supabase Edge Function secrets.",
    );
  }

  if (
    !checkoutFunction ||
    checkoutFunction.status !== "ACTIVE" ||
    checkoutFunction.verify_jwt !== true
  ) {
    blockers.push("Deploy create-stripe-checkout-session with verify_jwt=true.");
  }

  if (
    !stripeWebhook ||
    stripeWebhook.status !== "ACTIVE" ||
    stripeWebhook.verify_jwt !== false
  ) {
    blockers.push(
      "Deploy stripe-webhook with verify_jwt=false because Stripe cannot send a Supabase JWT.",
    );
  }

  if (routeFiles.includes(NEXT_WEBHOOK_ROUTE)) {
    blockers.push(
      "Remove the Next.js /api/stripe/webhook route. Stripe webhooks belong in Supabase Edge Functions.",
    );
  }

  if (!packageScripts["smoke:critical"]?.includes("smoke:service-fee-gate")) {
    blockers.push("Include smoke:service-fee-gate in smoke:critical.");
  }

  if (packageScripts["smoke:stripe-checkout"] !== STRIPE_CHECKOUT_SMOKE_SCRIPT) {
    blockers.push(
      "Add smoke:stripe-checkout for the real Stripe Checkout and webhook path.",
    );
  }

  if (packageScripts["smoke:payment-spine"] !== PAYMENT_SPINE_SMOKE_SCRIPT) {
    blockers.push(
      "Add smoke:payment-spine so payment readiness, checkout, bad states, recovery, and manual override run as one release gate.",
    );
  }

  if (!packageScripts["smoke:release-bad-paths"]?.startsWith("npm run smoke:payment-spine")) {
    blockers.push(
      "Use smoke:payment-spine inside smoke:release-bad-paths before other bad-path checks.",
    );
  }

  if (!packageScripts["smoke:release"]?.includes("npm run smoke:release-bad-paths")) {
    blockers.push(
      "Run smoke:release-bad-paths from smoke:release so large campaign payment proof is part of the release gate.",
    );
  }

  return {
    ok: blockers.length === 0,
    blockers,
    checks: {
      appCheckoutSecretAbsent: !env.STRIPE_SECRET_KEY,
      canonicalAppUrlConfigured: Boolean(
        env.NEXT_PUBLIC_APP_URL || env.NEXT_PUBLIC_SITE_URL,
      ),
      checkoutFunctionActive: Boolean(
        checkoutFunction &&
          checkoutFunction.status === "ACTIVE" &&
          checkoutFunction.verify_jwt === true,
      ),
      checkoutSecretInSupabase: secretNames.has("STRIPE_SECRET_KEY"),
      checkoutReturnUrlAllowListConfigured:
        secretNames.has("APP_BASE_URL") ||
        secretNames.has("CHECKOUT_ALLOWED_APP_URLS"),
      serviceFeeSmokeInCritical: Boolean(
        packageScripts["smoke:critical"]?.includes("smoke:service-fee-gate"),
      ),
      externalStripeCheckoutSmokeAvailable:
        packageScripts["smoke:stripe-checkout"] === STRIPE_CHECKOUT_SMOKE_SCRIPT,
      paymentSpineSmokeAvailable:
        packageScripts["smoke:payment-spine"] === PAYMENT_SPINE_SMOKE_SCRIPT,
      paymentSpineIncludesLargeCampaignCapacity:
        packageScripts["smoke:payment-spine"] === PAYMENT_SPINE_SMOKE_SCRIPT &&
        packageScripts["smoke:payment-spine"]?.includes(
          "npm run smoke:large-campaign-creation",
        ) &&
        packageScripts["smoke:payment-spine"]?.includes(
          "npm run smoke:large-campaign-capacity",
        ),
      releaseBadPathsIncludesPaymentSpine:
        packageScripts["smoke:release-bad-paths"]?.startsWith(
          "npm run smoke:payment-spine",
        ) === true,
      releaseIncludesPaymentBadPaths: Boolean(
        packageScripts["smoke:release"]?.includes("npm run smoke:release-bad-paths"),
      ),
      stripeWebhookActive: Boolean(
        stripeWebhook &&
          stripeWebhook.status === "ACTIVE" &&
          stripeWebhook.verify_jwt === false,
      ),
      stripeWebhookSecretConfigured: secretNames.has("STRIPE_WEBHOOK_SECRET"),
      vercelWebhookRouteAbsent: !routeFiles.includes(NEXT_WEBHOOK_ROUTE),
    },
  };
}

export function formatReadinessSummary(summary) {
  const lines = [
    `Stripe payment readiness: ${summary.ok ? "ready" : "blocked"}`,
    "",
    "Checks:",
  ];

  for (const [key, value] of Object.entries(summary.checks)) {
    lines.push(`- ${key}: ${value ? "pass" : "fail"}`);
  }

  if (summary.blockers.length > 0) {
    lines.push("", "Blockers:");
    for (const blocker of summary.blockers) {
      lines.push(`- ${blocker}`);
    }
  }

  return lines.join("\n");
}

export function collectRouteFiles() {
  return existsSync(resolve(process.cwd(), NEXT_WEBHOOK_ROUTE))
    ? [NEXT_WEBHOOK_ROUTE]
    : [];
}

export function collectStripePaymentReadiness() {
  const env = readLocalEnv();
  const projectRef =
    process.env.SUPABASE_PROJECT_ID ||
    parseProjectRefFromSupabaseUrl(env.NEXT_PUBLIC_SUPABASE_URL);

  if (!projectRef) {
    throw new Error(
      "Unable to resolve Supabase project ref from SUPABASE_PROJECT_ID or NEXT_PUBLIC_SUPABASE_URL.",
    );
  }

  return summarizeStripePaymentReadiness({
    env,
    functions: runSupabaseJson([
      "functions",
      "list",
      "--project-ref",
      projectRef,
      "--output",
      "json",
    ]),
    packageScripts: readPackageScripts(),
    routeFiles: collectRouteFiles(),
    secrets: runSupabaseJson([
      "secrets",
      "list",
      "--project-ref",
      projectRef,
      "--output",
      "json",
    ]),
  });
}

const currentFile = fileURLToPath(import.meta.url);

if (process.argv[1] === currentFile) {
  try {
    const summary = collectStripePaymentReadiness();
    console.log(formatReadinessSummary(summary));
    process.exitCode = summary.ok ? 0 : 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
