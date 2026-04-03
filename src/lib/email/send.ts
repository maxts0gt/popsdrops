import { render } from "@react-email/components";
import type { ReactElement } from "react";

// ---------------------------------------------------------------------------
// Supabase Edge Function endpoint
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ---------------------------------------------------------------------------
// Send Email — renders React Email template then delegates to Supabase
// ---------------------------------------------------------------------------

const FROM_ADDRESS =
  process.env.EMAIL_FROM ?? "PopsDrops <notifications@popsdrops.com>";

interface SendEmailOptions {
  to: string;
  subject: string;
  template: ReactElement;
}

export async function sendEmail({ to, subject, template }: SendEmailOptions) {
  const html = await render(template);

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    // Dev fallback — log to console
    console.log("\n📧 EMAIL (dev mode — no Supabase service role key)");
    console.log(`   To: ${to}`);
    console.log(`   From: ${FROM_ADDRESS}`);
    console.log(`   Subject: ${subject}`);
    console.log(`   Preview: ${html.slice(0, 200)}...`);
    console.log("");
    return;
  }

  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/send-email`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify({ to, subject, html }),
      },
    );

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`send-email function error: ${response.status} — ${body}`);
    }
  } catch (error) {
    // Log but don't throw — email should never break the main action
    console.error("Failed to send email:", error);
  }
}
