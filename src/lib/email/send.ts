import "server-only";

import { render } from "@react-email/components";
import type { ReactElement } from "react";

// ---------------------------------------------------------------------------
// Supabase Edge Function endpoint
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ---------------------------------------------------------------------------
// Send Email - renders React Email template then delegates to Supabase
// ---------------------------------------------------------------------------

const FROM_ADDRESS =
  process.env.EMAIL_FROM ?? "PopsDrops <notifications@popsdrops.com>";

interface SendEmailOptions {
  to: string;
  subject: string;
  template: ReactElement;
}

const SEND_EMAIL_MAX_ATTEMPTS = 8;

function isTransientSupabaseFunctionNotFound(status: number, body: string) {
  if (status !== 404) return false;

  try {
    const payload = JSON.parse(body) as { code?: unknown; message?: unknown };
    return (
      payload.code === "NOT_FOUND" &&
      payload.message === "Requested function was not found"
    );
  } catch {
    return body.includes("Requested function was not found");
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function sendEmail({ to, subject, template }: SendEmailOptions) {
  const html = await render(template);
  const text = await render(template, { plainText: true });

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    // Dev fallback - log to console
    console.log("\n📧 EMAIL (dev mode - no Supabase service role key)");
    console.log(`   To: ${to}`);
    console.log(`   From: ${FROM_ADDRESS}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   Preview: ${html.slice(0, 200)}...`);
    console.log("");
    return;
  }

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= SEND_EMAIL_MAX_ATTEMPTS; attempt += 1) {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ to, subject, html, text }),
    });

    if (response.ok) return;

    const body = await response.text();
    lastError = new Error(
      `send-email function error: ${response.status} - ${body}`,
    );

    if (
      !isTransientSupabaseFunctionNotFound(response.status, body) ||
      attempt === SEND_EMAIL_MAX_ATTEMPTS
    ) {
      throw lastError;
    }

    await sleep(125 * attempt);
  }

  throw lastError ?? new Error("send-email function failed");
}
