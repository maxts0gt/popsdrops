import { describe, expect, it } from "vitest";

import { partnerInquirySchema } from "./validations";
import { buildPartnerInquirySlackMessage } from "./partner-inquiries";

describe("partnerInquirySchema", () => {
  it("accepts brand-side partner inquiries", () => {
    const parsed = partnerInquirySchema.safeParse({
      type: "brand",
      full_name: "Jane Doe",
      email: "jane@example.com",
      company_name: "Maison Luxe",
      website: "https://maisonluxe.example.com",
      market: "South Korea",
      reason: "We need a local distributor for a launch this quarter.",
    });

    expect(parsed.success).toBe(true);
  });

  it("accepts distributor-side partner inquiries", () => {
    const parsed = partnerInquirySchema.safeParse({
      type: "distributor",
      full_name: "John Kim",
      email: "john@example.com",
      company_name: "Seoul Retail Group",
      website: "https://seoulretail.example.com",
      market: "South Korea",
      reason: "We want to represent premium beauty and wellness brands.",
    });

    expect(parsed.success).toBe(true);
  });
});

describe("buildPartnerInquirySlackMessage", () => {
  it("formats structured brand inquiries for the shared Slack webhook", () => {
    const text = buildPartnerInquirySlackMessage({
      type: "brand",
      full_name: "Jane Doe",
      email: "jane@example.com",
      company_name: "Maison Luxe",
      website: "https://maisonluxe.example.com",
      market: "South Korea",
      reason: "We need a local distributor for a launch this quarter.",
    });

    expect(text).toContain("*New partner inquiry*");
    expect(text).toContain("*Track:* Brand market entry");
    expect(text).toContain("*Target market:* South Korea");
    expect(text).toContain("*Company:* Maison Luxe");
  });
});
