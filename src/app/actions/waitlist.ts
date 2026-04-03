"use server";

import { protectWaitlistSubmission } from "@/lib/security/public-forms";
import { createClient } from "@/lib/supabase/server";
import { waitlistSchema, type WaitlistInput } from "@/lib/validations";

export type WaitlistResult =
  | { success: true }
  | { success: false; error: string };

export async function submitWaitlistRequest(
  input: WaitlistInput,
  turnstileToken?: string | null,
): Promise<WaitlistResult> {
  // Server-side validation
  const parsed = waitlistSchema.safeParse(input);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0];
    return { success: false, error: firstError?.message ?? "Invalid input" };
  }

  const data = parsed.data;

  try {
    await protectWaitlistSubmission(data.email, turnstileToken);
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not verify your submission.",
    };
  }

  const supabase = await createClient();

  // Build the insert payload — only include fields relevant to the type
  const row: Record<string, unknown> = {
    type: data.type,
    email: data.email,
    full_name: data.full_name,
    reason: data.reason || null,
    referral_source: data.referral_source || null,
  };

  if (data.type === "brand") {
    row.company_name = data.company_name;
    row.industry = data.industry || null;
    row.website = data.website || null;
    row.budget_range = data.budget_range || null;
  } else {
    row.social_url = data.social_url;
    row.social_platform = data.social_platform;
    row.follower_range = data.follower_range || null;
    row.markets = data.market ? [data.market] : [];
  }

  const { error } = await supabase.from("waitlist").insert(row);

  if (error) {
    // Unique constraint on email
    if (error.code === "23505") {
      return {
        success: false,
        error: "This email is already on our waitlist. We'll be in touch soon.",
      };
    }
    console.error("Waitlist insert error:", error);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
    };
  }

  try {
    await notifySlack(data);
  } catch (err) {
    console.error("Slack notification failed:", err);
  }

  return { success: true };
}

// ---------------------------------------------------------------------------
// Slack notification
// ---------------------------------------------------------------------------

function sanitizeSlackText(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("@", "@\u200B");
}

async function notifySlack(data: WaitlistInput) {
  const webhookUrl = process.env.SLACK_WAITLIST_WEBHOOK_URL;
  if (!webhookUrl) return;

  const lines = [
    `*New ${data.type} request* :wave:`,
    `*Name:* ${sanitizeSlackText(data.full_name)}`,
    `*Email:* ${sanitizeSlackText(data.email)}`,
  ];

  if (data.type === "brand") {
    lines.push(`*Company:* ${sanitizeSlackText(data.company_name)}`);
    if (data.industry) lines.push(`*Industry:* ${sanitizeSlackText(data.industry)}`);
    if (data.budget_range) {
      lines.push(`*Budget:* ${sanitizeSlackText(data.budget_range)}`);
    }
    if (data.website) lines.push(`*Website:* ${sanitizeSlackText(data.website)}`);
  } else {
    lines.push(`*Platform:* ${sanitizeSlackText(data.social_platform)}`);
    lines.push(`*Profile:* ${sanitizeSlackText(data.social_url)}`);
    if (data.follower_range) {
      lines.push(`*Followers:* ${sanitizeSlackText(data.follower_range)}`);
    }
    if (data.market) lines.push(`*Location:* ${sanitizeSlackText(data.market)}`);
  }

  if (data.reason) lines.push(`*Why PopsDrops:* ${sanitizeSlackText(data.reason)}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: lines.join("\n") }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Slack webhook failed with status ${response.status}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}
