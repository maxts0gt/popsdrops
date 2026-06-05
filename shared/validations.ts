// ---------------------------------------------------------------------------
// Zod validation schemas shared between web and mobile
// ---------------------------------------------------------------------------

import { z } from "zod";

import {
  CONTENT_FORMATS,
  INDUSTRIES,
  LANGUAGES,
  MARKETS,
  NICHES,
  PLATFORMS,
} from "./types";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const platformEnum = z.enum(PLATFORMS);
const nicheEnum = z.enum(NICHES);
const marketEnum = z.enum(MARKETS);
const industryEnum = z.enum(INDUSTRIES);
const languageEnum = z.enum(LANGUAGES);
const contentFormatEnum = z.enum(CONTENT_FORMATS);
const reportingPlatformEnum = z.enum([
  "instagram",
  "tiktok",
  "youtube",
  "facebook",
  "snapchat",
  "x",
  "generic",
]);
const reportingEvidenceTypeEnum = z.enum([
  "public_url",
  "manual_metrics",
  "screenshot",
  "analytics_export",
  "csv",
  "document",
]);
const reportingAccountRequirementEnum = z.enum([
  "public_post_ok",
  "native_insights_required",
  "business_or_creator_account_required",
  "brand_defined",
]);
const campaignRecruitmentVisibilityEnum = z.enum([
  "private_invite",
  "shortlist_invite",
  "open_applications",
]);
const PRIVATE_CAMPAIGN_MAX_SELF_SERVE_CREATORS = 100;
const agreementGateModeEnum = z.enum([
  "rules_acknowledgement",
  "typed_signature",
  "brand_agreement",
  "rules_and_brand_agreement",
]);

const slugRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;

// Zod v4 .uuid() enforces RFC 4122 version/variant bits.
// Our seed data uses non-standard UUIDs, so we use a relaxed pattern.
const uuidLike = z
  .string()
  .regex(
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
    "Invalid ID format",
  );

const socialUrlRegex =
  /^https?:\/\/(www\.)?(tiktok\.com|instagram\.com|snapchat\.com|youtube\.com|facebook\.com)\/.+$/i;

// ---------------------------------------------------------------------------
// 1. Login
// ---------------------------------------------------------------------------

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
});

export type LoginInput = z.infer<typeof loginSchema>;

// ---------------------------------------------------------------------------
// 2. Creator Onboarding (two steps combined)
// ---------------------------------------------------------------------------

export const creatorOnboardingStep1Schema = z.object({
  full_name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be 100 characters or less"),
  primary_market: marketEnum,
  social_url: z
    .string()
    .url("Enter a valid URL")
    .regex(
      socialUrlRegex,
      "URL must be from TikTok, Instagram, Snapchat, YouTube, or Facebook",
    ),
  social_platform: platformEnum,
});

export const creatorOnboardingStep2Schema = z.object({
  niches: z
    .array(nicheEnum)
    .min(1, "Select at least 1 niche")
    .max(5, "Select up to 5 niches"),
  base_rate: z.coerce
    .number()
    .min(10, "Minimum rate is $10")
    .max(50_000, "Maximum rate is $50,000"),
  slug: z
    .string()
    .min(3, "Slug must be at least 3 characters")
    .max(50, "Slug must be 50 characters or less")
    .regex(
      slugRegex,
      "Slug must be lowercase, alphanumeric with hyphens, and start/end with a letter or number",
    ),
});

export const creatorOnboardingSchema = creatorOnboardingStep1Schema.merge(
  creatorOnboardingStep2Schema,
);

export type CreatorOnboardingInput = z.infer<typeof creatorOnboardingSchema>;

// ---------------------------------------------------------------------------
// 3. Brand Onboarding (two steps combined)
// ---------------------------------------------------------------------------

export const brandOnboardingStep1Schema = z.object({
  company_name: z
    .string()
    .min(2, "Company name must be at least 2 characters")
    .max(100, "Company name must be 100 characters or less"),
  industry: industryEnum,
  primary_market: marketEnum,
});

export const brandOnboardingStep2Schema = z.object({
  description: z
    .string()
    .max(500, "Description must be 500 characters or less")
    .optional(),
  website: z.string().url("Enter a valid URL").optional().or(z.literal("")),
});

export const brandOnboardingSchema = brandOnboardingStep1Schema.merge(
  brandOnboardingStep2Schema,
);

export type BrandOnboardingInput = z.infer<typeof brandOnboardingSchema>;

// ---------------------------------------------------------------------------
// 4. Social Account
// ---------------------------------------------------------------------------

export const socialAccountSchema = z
  .object({
    url: z.string().url().optional(),
    handle: z.string().optional(),
    followers: z.coerce.number().int().nonnegative().optional(),
  })
  .optional();

// ---------------------------------------------------------------------------
// 5. Create Campaign
// ---------------------------------------------------------------------------

const deliverableSchema = z.object({
  platform: platformEnum,
  content_type: contentFormatEnum,
  quantity: z.coerce.number().int().min(1).max(100),
  notes: z.string().max(500).optional(),
});

export const campaignReportingRequirementSchema = z.object({
  platform: reportingPlatformEnum,
  platformLabel: z.string().trim().max(80).nullable(),
  contentFormat: z.string().trim().min(1).max(80),
  accountRequirement: reportingAccountRequirementEnum,
  evidenceTypes: z.array(reportingEvidenceTypeEnum).min(1).max(6),
  requiredMetricKeys: z.array(z.string().trim().min(1).max(80)).min(1).max(20),
  aiExtractionAllowed: z.boolean().default(true),
  creatorConfirmationRequired: z.boolean().default(true),
});

export const performanceMetricValueSchema = z
  .object({
    platform: reportingPlatformEnum,
    metricKey: z.string().trim().min(1).max(80),
    metricLabel: z.string().trim().min(1).max(120),
    metricValue: z.coerce.number().nonnegative().optional(),
    metricText: z.string().trim().max(500).optional(),
  })
  .refine(
    (value) => value.metricValue != null || Boolean(value.metricText),
    {
      message: "Enter a metric value",
      path: ["metricValue"],
    },
  );

export const createCampaignSchema = z
  .object({
    title: z
      .string()
      .min(3, "Title must be at least 3 characters")
      .max(200, "Title must be 200 characters or less"),
    recruitment_visibility: campaignRecruitmentVisibilityEnum.default("private_invite"),
    brief_description: z
      .string()
      .min(10, "Brief must be at least 10 characters")
      .max(5000, "Brief must be 5,000 characters or less"),
    brief_requirements: z.string().max(3000).optional(),
    brief_dos: z.string().max(2000).optional(),
    brief_donts: z.string().max(2000).optional(),
    compliance_notes: z.string().max(3000).optional(),
    platforms: z
      .array(platformEnum)
      .min(1, "Select at least 1 platform")
      .max(5, "Select up to 5 platforms"),
    markets: z.array(marketEnum).min(1, "Select at least 1 market"),
    niches: z
      .array(nicheEnum)
      .min(1, "Select at least 1 niche")
      .max(5, "Select up to 5 niches"),
    budget_min: z.coerce.number().min(0, "Budget cannot be negative"),
    budget_max: z.coerce.number().min(0, "Budget cannot be negative"),
    max_creators: z.coerce
      .number()
      .int()
      .min(1)
      .max(PRIVATE_CAMPAIGN_MAX_SELF_SERVE_CREATORS),
    application_deadline: z.string().date("Enter a valid date (YYYY-MM-DD)"),
    content_due_date: z.string().date("Enter a valid date (YYYY-MM-DD)"),
    performance_due_date: z.string().date("Enter a valid date (YYYY-MM-DD)").optional(),
    posting_window_start: z.string().date().optional(),
    posting_window_end: z.string().date().optional(),
    usage_rights_duration: z.string().optional(),
    usage_rights_territory: z.string().optional(),
    usage_rights_paid_ads: z.boolean().default(false),
    max_revisions: z.coerce.number().int().min(1).max(10).default(3),
    playbook_id: uuidLike.optional(),
    deliverables: z.array(deliverableSchema).min(1, "Add at least 1 deliverable"),
    reporting_requirements: z
      .array(campaignReportingRequirementSchema)
      .max(30)
      .optional(),
    reporting_cadence: z
      .enum(["final_only", "weekly", "daily_launch_window", "custom", "per_post"])
      .default("final_only"),
  })
  .refine((data) => data.budget_max >= data.budget_min, {
    message: "Maximum budget must be greater than or equal to minimum budget",
    path: ["budget_max"],
  })
  .superRefine((data, ctx) => {
    if (data.application_deadline > data.content_due_date) {
      ctx.addIssue({
        code: "custom",
        message: "Applications must close on or before the content due date",
        path: ["application_deadline"],
      });
    }

    if (
      data.posting_window_start &&
      data.posting_window_end &&
      data.posting_window_start > data.posting_window_end
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Posting end date must be on or after posting start date",
        path: ["posting_window_end"],
      });
    }

    if (data.posting_window_end && data.content_due_date > data.posting_window_end) {
      ctx.addIssue({
        code: "custom",
        message: "Content due date must be on or before posting ends",
        path: ["content_due_date"],
      });
    }

    if (
      data.performance_due_date &&
      data.posting_window_end &&
      data.performance_due_date < data.posting_window_end
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Performance data must be due on or after posting ends",
        path: ["performance_due_date"],
      });
    }

    if (
      data.performance_due_date &&
      !data.posting_window_end &&
      data.performance_due_date < data.content_due_date
    ) {
      ctx.addIssue({
        code: "custom",
        message: "Performance data must be due on or after content is due",
        path: ["performance_due_date"],
      });
    }
  });

export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;

// ---------------------------------------------------------------------------
// 6. Campaign Agreement Gate
// ---------------------------------------------------------------------------

export const agreementRuleSectionSchema = z.object({
  title: z.string().trim().min(1).max(80),
  body: z.string().trim().min(1).max(1200),
});

export const upsertCampaignAgreementDraftSchema = z.object({
  campaignId: uuidLike,
  gateMode: agreementGateModeEnum,
  title: z.string().trim().min(3).max(120),
  rules: z.record(
    z.string().trim().min(1).max(60),
    agreementRuleSectionSchema,
  ),
  agreementBody: z.string().trim().max(20_000).optional().nullable(),
  previewEnabled: z.boolean().default(false),
  previewSummary: z.record(z.string(), z.string()).default({}),
  requiresTypedName: z.boolean().default(true),
  fileName: z.string().trim().max(220).optional().nullable(),
  fileMimeType: z.literal("application/pdf").optional().nullable(),
  fileSizeBytes: z.coerce.number().int().positive().optional().nullable(),
  fileSha256: z.string().regex(/^[a-f0-9]{64}$/).optional().nullable(),
});

export const publishCampaignAgreementSchema = z.object({
  agreementId: uuidLike,
});

export const acceptCampaignAgreementSchema = z.object({
  agreementId: uuidLike,
  campaignId: uuidLike,
  typedName: z.string().trim().min(2).max(120),
  acceptedRules: z.record(z.string(), z.boolean()).default({}),
});

export type UpsertCampaignAgreementDraftInput = z.infer<
  typeof upsertCampaignAgreementDraftSchema
>;
export type AcceptCampaignAgreementInput = z.infer<
  typeof acceptCampaignAgreementSchema
>;

// ---------------------------------------------------------------------------
// 7. Submit Application
// ---------------------------------------------------------------------------

export const submitApplicationSchema = z.object({
  campaign_id: uuidLike,
  proposed_rate: z.coerce.number().min(1, "Rate must be at least $1"),
  pitch: z
    .string()
    .min(10, "Pitch must be at least 10 characters")
    .max(500, "Pitch must be 500 characters or less"),
});

export type SubmitApplicationInput = z.infer<typeof submitApplicationSchema>;

// ---------------------------------------------------------------------------
// 8. Counter Offer
// ---------------------------------------------------------------------------

export const counterOfferSchema = z.object({
  application_id: uuidLike,
  counter_rate: z.coerce.number().min(1, "Rate must be at least $1"),
  counter_message: z.string().max(500).optional(),
});

export type CounterOfferInput = z.infer<typeof counterOfferSchema>;

// ---------------------------------------------------------------------------
// 9. Submit Content
// ---------------------------------------------------------------------------

export const submitContentSchema = z.object({
  campaign_member_id: uuidLike,
  deliverable_id: uuidLike.optional(),
  content_url: z.string().url("Enter a valid URL"),
  caption: z.string().max(2000).optional(),
  platform: platformEnum,
});

export type SubmitContentInput = z.infer<typeof submitContentSchema>;

// ---------------------------------------------------------------------------
// 10. Content Feedback
// ---------------------------------------------------------------------------

export const contentFeedbackSchema = z.object({
  submission_id: uuidLike,
  feedback: z
    .string()
    .min(5, "Feedback must be at least 5 characters")
    .max(2000, "Feedback must be 2,000 characters or less"),
});

export type ContentFeedbackInput = z.infer<typeof contentFeedbackSchema>;

// ---------------------------------------------------------------------------
// 11. Submit Performance
// ---------------------------------------------------------------------------

export const submitPerformanceSchema = z
  .object({
    submission_id: uuidLike,
    report_task_id: uuidLike.optional(),
    evidence_id: uuidLike.optional(),
    ai_extraction_id: uuidLike.optional(),
    ai_extraction_edited: z.boolean().optional(),
    measurement_type: z.enum(["initial_48h", "final_7d", "extended_30d"]),
    views: z.coerce.number().int().nonnegative().optional(),
    reach: z.coerce.number().int().nonnegative().optional(),
    impressions: z.coerce.number().int().nonnegative().optional(),
    likes: z.coerce.number().int().nonnegative().optional(),
    comments: z.coerce.number().int().nonnegative().optional(),
    shares: z.coerce.number().int().nonnegative().optional(),
    saves: z.coerce.number().int().nonnegative().optional(),
    sends: z.coerce.number().int().nonnegative().optional(),
    screenshots: z.coerce.number().int().nonnegative().optional(),
    replies: z.coerce.number().int().nonnegative().optional(),
    clicks: z.coerce.number().int().nonnegative().optional(),
    completion_rate: z.coerce.number().min(0).max(100).optional(),
    avg_watch_time_seconds: z.coerce.number().nonnegative().optional(),
    subscriber_gains: z.coerce.number().int().nonnegative().optional(),
    screenshot_url: z
      .string()
      .refine(
        (value) =>
          value === "" ||
          value.startsWith("campaign-evidence/") ||
          z.string().url().safeParse(value).success,
        "Enter a valid evidence URL",
      )
      .optional(),
    metric_values: z.array(performanceMetricValueSchema).max(40).optional(),
  })
  .superRefine((value, ctx) => {
    const hasProofLink = Boolean(value.screenshot_url?.trim());
    if (value.report_task_id && !value.evidence_id && !hasProofLink) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["screenshot_url"],
        message: "Proof link or evidence file is required",
      });
    }
  });

export type SubmitPerformanceInput = z.infer<typeof submitPerformanceSchema>;

// ---------------------------------------------------------------------------
// 12. Submit Review
// ---------------------------------------------------------------------------

export const submitReviewSchema = z.object({
  campaign_id: uuidLike,
  reviewee_id: uuidLike,
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

export type SubmitReviewInput = z.infer<typeof submitReviewSchema>;

// ---------------------------------------------------------------------------
// 13. Update Creator Profile
// ---------------------------------------------------------------------------

export const updateCreatorProfileSchema = z.object({
  bio: z.string().max(500).optional(),
  slug: z
    .string()
    .min(3)
    .max(50)
    .regex(slugRegex)
    .optional(),
  niches: z.array(nicheEnum).min(1).max(5).optional(),
  markets: z.array(marketEnum).min(1).optional(),
  languages: z.array(languageEnum).min(1).optional(),
  content_formats: z.array(contentFormatEnum).min(1).optional(),
  rate_card: z.record(z.string(), z.record(z.string(), z.coerce.number().nonnegative())).optional(),
  primary_market: marketEnum.optional(),
  tiktok: socialAccountSchema,
  instagram: socialAccountSchema,
  snapchat: socialAccountSchema,
  youtube: socialAccountSchema,
  facebook: socialAccountSchema,
});

export type UpdateCreatorProfileInput = z.infer<
  typeof updateCreatorProfileSchema
>;

// ---------------------------------------------------------------------------
// 15. Update Brand Profile
// ---------------------------------------------------------------------------

export const updateBrandProfileSchema = z.object({
  company_name: z.string().min(2).max(100).optional(),
  industry: industryEnum.optional(),
  description: z.string().max(500).optional(),
  website: z.string().url().optional().or(z.literal("")),
  target_markets: z.array(marketEnum).min(1).optional(),
  logo_url: z.string().url().optional(),
  contact_name: z.string().max(100).optional(),
  contact_email: z.string().email().optional(),
  contact_phone: z.string().max(20).optional(),
});

export type UpdateBrandProfileInput = z.infer<typeof updateBrandProfileSchema>;

// ---------------------------------------------------------------------------
// 16. Approve Profile (Admin)
// ---------------------------------------------------------------------------

export const approveProfileSchema = z.object({
  profile_id: uuidLike,
});

export type ApproveProfileInput = z.infer<typeof approveProfileSchema>;

// ---------------------------------------------------------------------------
// 17. Reject Profile (Admin)
// ---------------------------------------------------------------------------

export const rejectProfileSchema = z.object({
  profile_id: uuidLike,
  reason: z
    .string()
    .min(5, "Reason must be at least 5 characters")
    .max(500, "Reason must be 500 characters or less"),
});

export type RejectProfileInput = z.infer<typeof rejectProfileSchema>;

// ---------------------------------------------------------------------------
// 18. Waitlist Request (pre-auth, public form)
// ---------------------------------------------------------------------------

const waitlistBaseSchema = z.object({
  type: z.enum(["brand", "creator"]),
  email: z.string().email("Enter a valid email address"),
  full_name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be 100 characters or less"),
  reason: z.string().max(500, "Keep it under 500 characters").optional(),
  referral_source: z.string().max(100).optional(),
});

export const waitlistBrandSchema = waitlistBaseSchema.extend({
  type: z.literal("brand"),
  company_name: z
    .string()
    .min(2, "Company name must be at least 2 characters")
    .max(100),
  industry: industryEnum.optional(),
  website: z.string().url("Enter a valid URL").optional().or(z.literal("")),
  budget_range: z
    .enum(["under_5k", "5k_25k", "25k_100k", "100k_plus"])
    .optional(),
});

export const waitlistCreatorSchema = waitlistBaseSchema.extend({
  type: z.literal("creator"),
  social_url: z.string().url("Enter a valid URL"),
  social_platform: platformEnum,
  follower_range: z
    .enum(["under_10k", "10k_50k", "50k_100k", "100k_500k", "500k_plus"])
    .optional(),
  market: z.string().min(1, "Select your location").optional(),
});

export const waitlistSchema = z.discriminatedUnion("type", [
  waitlistBrandSchema,
  waitlistCreatorSchema,
]);

export type WaitlistInput = z.infer<typeof waitlistSchema>;
export type WaitlistBrandInput = z.infer<typeof waitlistBrandSchema>;
export type WaitlistCreatorInput = z.infer<typeof waitlistCreatorSchema>;
