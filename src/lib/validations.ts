import { z } from "zod";

import {
  CONTENT_FORMATS,
  CAMPAIGN_MARKETS,
  INDUSTRIES,
  LANGUAGES,
  MARKETS,
  NICHES,
  PLATFORMS,
} from "./constants";
import {
  hasDuplicatePlatforms,
  normalizeCreatorSocialAccount,
} from "./creator-socials";
import {
  CAMPAIGN_MODES,
  PRIVATE_CAMPAIGN_MAX_SELF_SERVE_CREATORS,
} from "./campaign-service-packages";
import { CAMPAIGN_RECRUITMENT_VISIBILITIES } from "./campaigns/recruitment-visibility";
import { REPORTING_PLATFORMS } from "./reporting/platform-templates";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const platformEnum = z.enum(PLATFORMS);
const nicheEnum = z.enum(NICHES);
const marketEnum = z.enum(MARKETS);
const campaignMarketEnum = z.enum(CAMPAIGN_MARKETS);
const industryEnum = z.enum(INDUSTRIES);
const languageEnum = z.enum(LANGUAGES);
const contentFormatEnum = z.enum(CONTENT_FORMATS);
const campaignModeEnum = z.enum(CAMPAIGN_MODES);
const campaignRecruitmentVisibilityEnum = z.enum(CAMPAIGN_RECRUITMENT_VISIBILITIES);
const reportingPlatformEnum = z.enum(REPORTING_PLATFORMS);
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
const reportBuilderPresetSelectionEnum = z.enum([
  "leadership",
  "proof_audit",
  "creator_performance",
  "custom",
]);
const reportBuilderChartModeEnum = z.enum(["trend", "comparison", "proof"]);
const reportBuilderBlockIdEnum = z.enum([
  "report_framing",
  "executive_summary",
  "channel_story",
  "proof_sources",
  "report_trust",
  "creator_table",
  "recommendations",
]);
const agreementGateModeEnum = z.enum([
  "rules_acknowledgement",
  "typed_signature",
  "brand_agreement",
  "rules_and_brand_agreement",
]);
const campaignAssetTypeEnum = z.enum([
  "product_image",
  "brand_guideline",
  "reference_video",
  "sell_sheet",
  "logo",
  "document",
  "other",
]);
const campaignAssetVisibilityEnum = z.enum(["public", "member", "brand"]);

const slugRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
const campaignPlatformSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Platform is required")
  .max(50, "Platform must be 50 characters or less")
  .regex(
    /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/,
    "Use lowercase letters, numbers, hyphens, or underscores",
  );

// Zod v4 .uuid() enforces RFC 4122 version/variant bits.
// Our seed data uses non-standard UUIDs, so we use a relaxed pattern.
const uuidLike = z
  .string()
  .regex(
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
    "Invalid ID format",
  );

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

const creatorSocialAccountSchema = z
  .object({
    platform: platformEnum,
    value: z
      .string()
      .trim()
      .min(1, "Enter a social handle or profile link")
      .max(200, "Social handle or profile link is too long"),
  })
  .superRefine((account, ctx) => {
    try {
      normalizeCreatorSocialAccount(account);
    } catch (error) {
      ctx.addIssue({
        code: "custom",
        path: ["value"],
        message:
          error instanceof Error
            ? error.message
            : "Enter a valid social handle or profile link",
      });
    }
  });

export const creatorOnboardingStep1Schema = z.object({
  full_name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be 100 characters or less"),
  primary_market: marketEnum,
  social_accounts: z
    .array(creatorSocialAccountSchema)
    .min(1, "Add at least 1 social account")
    .max(PLATFORMS.length, `Add up to ${PLATFORMS.length} social accounts`)
    .refine((accounts) => !hasDuplicatePlatforms(accounts), {
      message: "Each platform can only be added once",
    }),
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
// 4. Create Campaign
// ---------------------------------------------------------------------------

const deliverableSchema = z.object({
  platform: campaignPlatformSchema,
  content_type: contentFormatEnum,
  quantity: z.coerce.number().int().min(1).max(100),
  notes: z.string().max(500).optional(),
});

const briefTranslationSchema = z.object({
  description: z.string().trim().max(5000).optional().default(""),
  requirements: z.string().trim().max(3000).optional().default(""),
  dos: z.string().trim().max(2000).optional().default(""),
  donts: z.string().trim().max(2000).optional().default(""),
});

const briefTranslationsSchema = z.record(
  z.string().trim().regex(/^[a-z]{2,3}(?:-[A-Z]{2})?$/, "Invalid locale"),
  briefTranslationSchema,
);

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
    campaign_mode: campaignModeEnum.default("private"),
    recruitment_visibility: campaignRecruitmentVisibilityEnum.default("private_invite"),
    brief_description: z
      .string()
      .min(10, "Brief must be at least 10 characters")
      .max(5000, "Brief must be 5,000 characters or less"),
    brief_requirements: z.string().max(3000).optional(),
    brief_dos: z.string().max(2000).optional(),
    brief_donts: z.string().max(2000).optional(),
    brief_translated: briefTranslationsSchema.optional(),
    compliance_notes: z.string().max(3000).optional(),
    platforms: z
      .array(campaignPlatformSchema)
      .min(1, "Select at least 1 platform")
      .max(10, "Select up to 10 platforms"),
    markets: z.array(campaignMarketEnum).min(1, "Select at least 1 market"),
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
    report_template_id: uuidLike.nullish(),
    report_preset_id: reportBuilderPresetSelectionEnum
      .default("creator_performance"),
    report_chart_mode_id: reportBuilderChartModeEnum.default("comparison"),
    report_block_ids: z
      .array(reportBuilderBlockIdEnum)
      .min(1)
      .max(12)
      .optional(),
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

export const enterpriseConciergeRequestSchema = z.object({
  campaign_title: z
    .string()
    .trim()
    .min(3, "Campaign title must be at least 3 characters")
    .max(200, "Campaign title must be 200 characters or less"),
  campaign_mode: campaignModeEnum,
  requestReason: z.enum(["private_capacity", "sourcing"]).optional(),
  requested_creator_count: z.coerce.number().int().min(1).max(5000),
  market_count: z.coerce.number().int().min(1).max(250),
  markets: z.array(campaignMarketEnum).min(1).max(250),
  platforms: z.array(campaignPlatformSchema).min(1).max(10),
  creator_budget_cents: z.coerce.number().int().nonnegative(),
  product_value_cents: z.coerce.number().int().nonnegative(),
  fulfillment_budget_cents: z.coerce.number().int().nonnegative(),
  note: z.string().trim().max(1000).optional(),
});

export type EnterpriseConciergeRequestInput = z.infer<
  typeof enterpriseConciergeRequestSchema
>;

// ---------------------------------------------------------------------------
// 5. Campaign Agreement Gate
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

export const createCampaignAssetUploadSchema = z.object({
  campaignId: uuidLike,
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional().nullable(),
  assetType: campaignAssetTypeEnum,
  visibility: campaignAssetVisibilityEnum,
  fileName: z.string().trim().min(1).max(220),
  mimeType: z.string().trim().min(1).max(120),
  sizeBytes: z.coerce.number().int().positive(),
});

export const markCampaignAssetReadySchema = z.object({
  campaignId: uuidLike,
  assetId: uuidLike,
});

export type CreateCampaignAssetUploadInput = z.infer<
  typeof createCampaignAssetUploadSchema
>;

// ---------------------------------------------------------------------------
// 6. Submit Application
// ---------------------------------------------------------------------------

export const submitApplicationSchema = z.object({
  campaign_id: uuidLike,
  invite_id: uuidLike.optional(),
  proposed_rate: z.coerce.number().min(1, "Rate must be at least $1"),
  pitch: z
    .string()
    .min(10, "Pitch must be at least 10 characters")
    .max(500, "Pitch must be 500 characters or less"),
});

export type SubmitApplicationInput = z.infer<typeof submitApplicationSchema>;

// ---------------------------------------------------------------------------
// 7. Counter Offer
// ---------------------------------------------------------------------------

export const counterOfferSchema = z.object({
  application_id: uuidLike,
  counter_rate: z.coerce.number().min(1, "Rate must be at least $1"),
  counter_message: z.string().max(500).optional(),
});

export type CounterOfferInput = z.infer<typeof counterOfferSchema>;

// ---------------------------------------------------------------------------
// 8. Submit Content
// ---------------------------------------------------------------------------

export const submitContentSchema = z.object({
  campaign_member_id: uuidLike,
  content_url: z.string().url("Enter a valid URL"),
  caption: z.string().max(2000).optional(),
  platform: platformEnum,
});

export type SubmitContentInput = z.infer<typeof submitContentSchema>;

// ---------------------------------------------------------------------------
// 9. Content Feedback
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
// 10. Submit Performance
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
// 11. Submit Review
// ---------------------------------------------------------------------------

export const submitReviewSchema = z.object({
  campaign_id: uuidLike,
  reviewee_id: uuidLike,
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

export type SubmitReviewInput = z.infer<typeof submitReviewSchema>;

// ---------------------------------------------------------------------------
// 12. Update Creator Profile
// ---------------------------------------------------------------------------

const socialAccountSchema = z
  .object({
    url: z.string().url().optional(),
    handle: z.string().optional(),
    followers: z.coerce.number().int().nonnegative().optional(),
  })
  .optional();

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
// 14. Update Brand Profile
// ---------------------------------------------------------------------------

export const updateBrandProfileSchema = z.object({
  company_name: z.string().min(2).max(100).optional(),
  industry: industryEnum.optional(),
  description: z.string().max(500).optional(),
  website: z.string().url().optional().or(z.literal("")),
  target_markets: z.array(campaignMarketEnum).min(1).optional(),
  logo_url: z.string().url().optional(),
  contact_name: z.string().max(100).optional(),
  contact_email: z.string().email().optional(),
  contact_phone: z.string().max(20).optional(),
});

export type UpdateBrandProfileInput = z.infer<typeof updateBrandProfileSchema>;

// ---------------------------------------------------------------------------
// 15. Approve Profile (Admin)
// ---------------------------------------------------------------------------

export const approveProfileSchema = z.object({
  profile_id: uuidLike,
});

export type ApproveProfileInput = z.infer<typeof approveProfileSchema>;

// ---------------------------------------------------------------------------
// 16. Reject Profile (Admin)
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
// 17. Waitlist Request (pre-auth, public form)
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
  markets: z
    .array(campaignMarketEnum)
    .min(1, "Select at least 1 target market")
    .max(10, "Select up to 10 target markets"),
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

// ---------------------------------------------------------------------------
// 18. Partner Inquiry (public form)
// ---------------------------------------------------------------------------

const partnerInquiryBaseSchema = z.object({
  full_name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be 100 characters or less"),
  email: z.string().email("Enter a valid email address"),
  company_name: z
    .string()
    .min(2, "Company name must be at least 2 characters")
    .max(100, "Company name must be 100 characters or less"),
  website: z.string().url("Enter a valid URL").optional().or(z.literal("")),
  market: z
    .string()
    .min(2, "Market must be at least 2 characters")
    .max(100, "Market must be 100 characters or less"),
  reason: z
    .string()
    .min(10, "Tell us a bit more so we can route this properly")
    .max(1000, "Keep it under 1,000 characters"),
});

export const partnerBrandInquirySchema = partnerInquiryBaseSchema.extend({
  type: z.literal("brand"),
});

export const partnerDistributorInquirySchema = partnerInquiryBaseSchema.extend({
  type: z.literal("distributor"),
});

export const partnerInquirySchema = z.discriminatedUnion("type", [
  partnerBrandInquirySchema,
  partnerDistributorInquirySchema,
]);

export type PartnerInquiryInput = z.infer<typeof partnerInquirySchema>;
