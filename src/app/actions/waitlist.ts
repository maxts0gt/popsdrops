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

  return { success: true };
}
