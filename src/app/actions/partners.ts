"use server";

import { buildPartnerInquirySlackMessage } from "@/lib/partner-inquiries";
import { protectWaitlistSubmission } from "@/lib/security/public-forms";
import {
  partnerInquirySchema,
  type PartnerInquiryInput,
} from "@/lib/validations";

export type PartnerInquiryResult =
  | { success: true }
  | { success: false; error: string };

export async function submitPartnerInquiry(
  input: PartnerInquiryInput,
  turnstileToken?: string | null,
): Promise<PartnerInquiryResult> {
  const parsed = partnerInquirySchema.safeParse(input);
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

  const webhookUrl = process.env.SLACK_WAITLIST_WEBHOOK_URL;
  if (!webhookUrl) {
    return {
      success: false,
      error: "Partner inquiries are not configured yet.",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: buildPartnerInquirySlackMessage(data),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Slack webhook failed with status ${response.status}`);
    }

    return { success: true };
  } catch (error) {
    console.error("Partner inquiry failed:", error);
    return {
      success: false,
      error: "Something went wrong. Please try again.",
    };
  } finally {
    clearTimeout(timeout);
  }
}
