import { describe, expect, it } from "vitest";

import {
  createCampaignSchema,
  submitPerformanceSchema,
  updateCreatorProfileSchema,
  waitlistSchema,
} from "./validations";
import {
  createCampaignSchema as sharedCreateCampaignSchema,
  submitPerformanceSchema as mobileSubmitPerformanceSchema,
} from "../../shared/validations";

const validCampaignInput = {
  title: "Launch Campaign",
  campaign_mode: "private",
  brief_description: "A clear campaign brief for creators.",
  platforms: ["tiktok"],
  markets: ["kr"],
  niches: ["beauty"],
  budget_min: 100,
  budget_max: 500,
  max_creators: 3,
  application_deadline: "2026-06-01",
  content_due_date: "2026-06-15",
  performance_due_date: "2026-06-20",
  usage_rights_paid_ads: false,
  max_revisions: 2,
  deliverables: [{ platform: "tiktok", content_type: "short_video", quantity: 1 }],
};

describe("createCampaignSchema campaign mode", () => {
  it("accepts a valid campaign mode", () => {
    expect(createCampaignSchema.safeParse(validCampaignInput).success).toBe(true);
  });

  it("defaults new campaigns to private invite-only work", () => {
    const result = createCampaignSchema.safeParse({
      ...validCampaignInput,
      campaign_mode: undefined,
      recruitment_visibility: undefined,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.campaign_mode).toBe("private");
      expect(result.data.recruitment_visibility).toBe("private_invite");
    }
  });

  it("accepts explicit open applications when the brand chooses public recruitment", () => {
    const result = createCampaignSchema.safeParse({
      ...validCampaignInput,
      recruitment_visibility: "open_applications",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.recruitment_visibility).toBe("open_applications");
    }
  });

  it("rejects unknown campaign modes", () => {
    const result = createCampaignSchema.safeParse({
      ...validCampaignInput,
      campaign_mode: "marketplace",
    });

    expect(result.success).toBe(false);
  });

  it("accepts ISO markets and custom campaign platforms", () => {
    const result = createCampaignSchema.safeParse({
      ...validCampaignInput,
      platforms: ["tiktok", "xiaohongshu"],
      markets: ["kr"],
      deliverables: [
        { platform: "xiaohongshu", content_type: "short_video", quantity: 1 },
      ],
    });

    expect(result.success).toBe(true);
  });

  it("accepts campaign market scopes while keeping creator profile markets country-only", () => {
    const campaign = createCampaignSchema.safeParse({
      ...validCampaignInput,
      markets: ["global", "region:apac"],
    });

    expect(campaign.success).toBe(true);

    const creatorProfile = updateCreatorProfileSchema.safeParse({
      markets: ["global"],
    });

    expect(creatorProfile.success).toBe(false);
  });

  it("accepts a campaign performance due date", () => {
    const result = createCampaignSchema.safeParse(validCampaignInput);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.performance_due_date).toBe("2026-06-20");
    }
  });

  it("accepts optional report framing when the brand wants builder context in exports", () => {
    const result = createCampaignSchema.safeParse({
      ...validCampaignInput,
      report_block_ids: ["report_framing", "executive_summary", "report_trust"],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.report_block_ids).toContain("report_framing");
    }
  });

  it("allows private campaign workspaces up to 100 creators", () => {
    const oneHundredCreators = createCampaignSchema.safeParse({
      ...validCampaignInput,
      max_creators: 100,
    });
    const oneHundredOneCreators = createCampaignSchema.safeParse({
      ...validCampaignInput,
      max_creators: 101,
    });

    expect(oneHundredCreators.success).toBe(true);
    expect(oneHundredOneCreators.success).toBe(false);
  });

  it("keeps shared campaign validation aligned with the 100 creator self-serve limit", () => {
    const oneHundredCreators = sharedCreateCampaignSchema.safeParse({
      ...validCampaignInput,
      markets: ["south_korea"],
      max_creators: 100,
    });
    const oneHundredOneCreators = sharedCreateCampaignSchema.safeParse({
      ...validCampaignInput,
      markets: ["south_korea"],
      max_creators: 101,
    });

    expect(oneHundredCreators.success).toBe(true);
    expect(oneHundredOneCreators.success).toBe(false);
  });

  it("rejects impossible campaign timeline dates", () => {
    const applicationsAfterContent = createCampaignSchema.safeParse({
      ...validCampaignInput,
      application_deadline: "2026-06-16",
      content_due_date: "2026-06-15",
    });
    expect(applicationsAfterContent.success).toBe(false);
    if (!applicationsAfterContent.success) {
      expect(applicationsAfterContent.error.issues[0].path).toEqual([
        "application_deadline",
      ]);
    }

    const postingEndsBeforeItStarts = createCampaignSchema.safeParse({
      ...validCampaignInput,
      posting_window_start: "2026-06-20",
      posting_window_end: "2026-06-18",
    });
    expect(postingEndsBeforeItStarts.success).toBe(false);
    if (!postingEndsBeforeItStarts.success) {
      expect(postingEndsBeforeItStarts.error.issues[0].path).toEqual([
        "posting_window_end",
      ]);
    }

    const reportingBeforePostingEnds = createCampaignSchema.safeParse({
      ...validCampaignInput,
      posting_window_end: "2026-06-18",
      performance_due_date: "2026-06-17",
    });
    expect(reportingBeforePostingEnds.success).toBe(false);
    if (!reportingBeforePostingEnds.success) {
      expect(reportingBeforePostingEnds.error.issues[0].path).toEqual([
        "performance_due_date",
      ]);
    }
  });

  it("accepts reviewed creator-language brief translations", () => {
    const result = createCampaignSchema.safeParse({
      ...validCampaignInput,
      brief_translated: {
        ja: {
          description: "日本のクリエイター向けのキャンペーン説明です。",
          requirements: "商品の特徴を正確に紹介してください。",
          dos: "自然な使用シーンを見せてください。",
          donts: "誇張した効能表現は避けてください。",
        },
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.brief_translated?.ja.description).toContain("日本");
    }
  });

  it("preserves compliance notes for the public creator invite", () => {
    const result = createCampaignSchema.safeParse({
      ...validCampaignInput,
      compliance_notes:
        "Use clear sponsored disclosure and avoid unapproved skin-care efficacy claims.",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.compliance_notes).toBe(
        "Use clear sponsored disclosure and avoid unapproved skin-care efficacy claims.",
      );
    }
  });
});

describe("waitlistSchema brand access requests", () => {
  const validBrandAccessRequest = {
    type: "brand" as const,
    full_name: "Max Brand",
    email: "max@example.com",
    company_name: "Maison Smoke",
    industry: "beauty_skincare" as const,
    website: "https://example.com",
    budget_range: "25k_100k" as const,
    markets: ["global", "region:apac"],
    reason: "Run private creator campaigns in Japan and Korea.",
  };

  it("requires target markets for brand access requests", () => {
    const missingMarket = waitlistSchema.safeParse({
      ...validBrandAccessRequest,
      markets: [],
    });

    expect(missingMarket.success).toBe(false);
  });

  it("accepts global and regional market scopes for brand access requests", () => {
    const result = waitlistSchema.safeParse(validBrandAccessRequest);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe("brand");
      if (result.data.type === "brand") {
        expect(result.data.markets).toEqual(["global", "region:apac"]);
      }
    }
  });
});

describe("submitPerformanceSchema", () => {
  it("requires proof material when a performance read is tied to a report task", () => {
    const input = {
      submission_id: "11111111-1111-4111-8111-111111111111",
      report_task_id: "22222222-2222-4222-8222-222222222222",
      measurement_type: "final_7d",
      views: 1200,
    };

    expect(submitPerformanceSchema.safeParse(input).success).toBe(false);
    expect(mobileSubmitPerformanceSchema.safeParse(input).success).toBe(false);
  });

  it("accepts a report task performance read when proof material is present", () => {
    const input = {
      submission_id: "11111111-1111-4111-8111-111111111111",
      report_task_id: "22222222-2222-4222-8222-222222222222",
      measurement_type: "final_7d",
      views: 1200,
      screenshot_url: "https://example.com/instagram-insights.png",
    };

    expect(submitPerformanceSchema.safeParse(input).success).toBe(true);
    expect(mobileSubmitPerformanceSchema.safeParse(input).success).toBe(true);
  });

  it("accepts a pending AI extraction id with creator-confirmed metric values", () => {
    const result = submitPerformanceSchema.safeParse({
      submission_id: "11111111-1111-4111-8111-111111111111",
      report_task_id: "22222222-2222-4222-8222-222222222222",
      evidence_id: "33333333-3333-4333-8333-333333333333",
      ai_extraction_id: "44444444-4444-4444-8444-444444444444",
      ai_extraction_edited: true,
      measurement_type: "final_7d",
      metric_values: [
        {
          platform: "instagram",
          metricKey: "views",
          metricLabel: "Views",
          metricValue: 1200,
        },
      ],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.ai_extraction_id).toBe(
        "44444444-4444-4444-8444-444444444444",
      );
      expect(result.data.ai_extraction_edited).toBe(true);
    }
  });
});
