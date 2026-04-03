import "server-only";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { createHash } from "crypto";
import { headers } from "next/headers";

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000; // 10 minutes
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW = "10 m";
const FALLBACK_RATE_LIMIT_MAX_KEYS = 5000;

let waitlistRatelimit: Ratelimit | null | undefined;

function cleanupRateLimitMap(now: number) {
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now > entry.resetAt) {
      rateLimitMap.delete(key);
    }
  }

  if (rateLimitMap.size <= FALLBACK_RATE_LIMIT_MAX_KEYS) {
    return;
  }

  const overflow = rateLimitMap.size - FALLBACK_RATE_LIMIT_MAX_KEYS;
  let removed = 0;
  for (const key of rateLimitMap.keys()) {
    rateLimitMap.delete(key);
    removed++;
    if (removed >= overflow) {
      break;
    }
  }
}

function getWaitlistRatelimit(): Ratelimit | null {
  if (waitlistRatelimit !== undefined) {
    return waitlistRatelimit;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    waitlistRatelimit = null;
    return waitlistRatelimit;
  }

  const redis = new Redis({ url, token });
  waitlistRatelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(RATE_LIMIT_MAX, RATE_LIMIT_WINDOW),
    prefix: "waitlist",
  });

  return waitlistRatelimit;
}

function checkRateLimit(identifier: string): boolean {
  const now = Date.now();
  cleanupRateLimitMap(now);
  const entry = rateLimitMap.get(identifier);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(identifier, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count++;
  return true;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function getRequestIp() {
  const requestHeaders = await headers();
  const forwardedFor = requestHeaders.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? null;
  }

  return requestHeaders.get("x-real-ip");
}

function hashIdentifier(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 24);
}

// ---------------------------------------------------------------------------
// Turnstile verification
// ---------------------------------------------------------------------------

async function verifyTurnstileToken(token?: string | null) {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    // Turnstile is optional — skip verification if not configured
    return;
  }

  if (!token) {
    throw new Error("Complete the verification challenge and try again.");
  }

  const body = new URLSearchParams({
    secret,
    response: token,
  });

  const requestIp = await getRequestIp();
  if (requestIp) {
    body.set("remoteip", requestIp);
  }

  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error("Verification failed. Please try again.");
  }

  const result = (await response.json()) as {
    success?: boolean;
    "error-codes"?: string[];
  };

  if (!result.success) {
    console.warn("Turnstile verification failed:", result["error-codes"]);
    throw new Error("Verification failed. Please refresh and try again.");
  }
}

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

async function enforceWaitlistRateLimit(email: string) {
  const identifiers = [
    email.trim().toLowerCase(),
    await getRequestIp(),
  ].filter(Boolean) as string[];

  const ratelimit = getWaitlistRatelimit();

  // Falls back to in-memory rate limiting if Upstash isn't configured

  for (const identifier of identifiers) {
    const key = hashIdentifier(identifier);

    if (ratelimit) {
      const result = await ratelimit.limit(key);
      if (!result.success) {
        throw new Error("Too many requests. Please try again in a few minutes.");
      }
      continue;
    }

    if (!checkRateLimit(key)) {
      throw new Error("Too many requests. Please try again in a few minutes.");
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function protectWaitlistSubmission(
  email: string,
  turnstileToken?: string | null,
) {
  await verifyTurnstileToken(turnstileToken);
  await enforceWaitlistRateLimit(email);
}
