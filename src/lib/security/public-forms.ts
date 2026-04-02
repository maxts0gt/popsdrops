import "server-only";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { createHash } from "crypto";
import { headers } from "next/headers";

let redisClient: Redis | null | undefined;
let waitlistRatelimit: Ratelimit | null | undefined;

function getRedisClient() {
  if (redisClient !== undefined) {
    return redisClient;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    redisClient = null;
    return redisClient;
  }

  redisClient = new Redis({ url, token });
  return redisClient;
}

function getWaitlistRatelimit() {
  if (waitlistRatelimit !== undefined) {
    return waitlistRatelimit;
  }

  const redis = getRedisClient();
  if (!redis) {
    waitlistRatelimit = null;
    return waitlistRatelimit;
  }

  waitlistRatelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "10 m"),
    prefix: "ratelimit:waitlist",
  });

  return waitlistRatelimit;
}

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

async function verifyTurnstileToken(token?: string | null) {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Bot protection is not configured.");
    }
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

async function enforceWaitlistRateLimit(email: string) {
  const ratelimit = getWaitlistRatelimit();

  if (!ratelimit) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("Rate limiting is not configured.");
    }
    return;
  }

  const identifiers = [
    email.trim().toLowerCase(),
    await getRequestIp(),
  ].filter(Boolean) as string[];

  for (const identifier of identifiers) {
    const result = await ratelimit.limit(hashIdentifier(identifier));
    if (!result.success) {
      throw new Error("Too many requests. Please try again in a few minutes.");
    }
  }
}

export async function protectWaitlistSubmission(
  email: string,
  turnstileToken?: string | null,
) {
  await verifyTurnstileToken(turnstileToken);
  await enforceWaitlistRateLimit(email);
}
