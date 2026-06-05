import { describe, expect, it } from "vitest";

import { getCreatorReportingEligibility } from "./eligibility";
import { getCreatorDeclaredPlatforms } from "./eligibility";

describe("creator reporting eligibility", () => {
  it("marks creator eligible when required platform is declared", () => {
    expect(
      getCreatorReportingEligibility({
        creatorPlatforms: ["instagram"],
        requirements: [
          {
            platform: "instagram",
            platformLabel: null,
            accountRequirement: "public_post_ok",
            evidenceTypes: ["public_url", "manual_metrics"],
            requiredMetricKeys: ["views", "likes"],
            contentFormat: "reel",
          },
        ],
      }),
    ).toMatchObject({ status: "eligible" });
  });

  it("asks for confirmation when native insights are required", () => {
    expect(
      getCreatorReportingEligibility({
        creatorPlatforms: ["instagram"],
        requirements: [
          {
            platform: "instagram",
            platformLabel: null,
            accountRequirement: "native_insights_required",
            evidenceTypes: ["screenshot"],
            requiredMetricKeys: ["reach"],
            contentFormat: "reel",
          },
        ],
      }),
    ).toMatchObject({
      status: "needs_confirmation",
      missingPlatforms: [],
    });
  });

  it("blocks application when a required named platform is missing", () => {
    expect(
      getCreatorReportingEligibility({
        creatorPlatforms: ["tiktok"],
        requirements: [
          {
            platform: "instagram",
            platformLabel: null,
            accountRequirement: "public_post_ok",
            evidenceTypes: ["public_url"],
            requiredMetricKeys: ["views"],
            contentFormat: "reel",
          },
        ],
      }),
    ).toMatchObject({
      status: "not_eligible",
      missingPlatforms: ["instagram"],
    });
  });

  it("lets generic requirements proceed with confirmation", () => {
    expect(
      getCreatorReportingEligibility({
        creatorPlatforms: [],
        requirements: [
          {
            platform: "generic",
            platformLabel: "Retail partner dashboard",
            accountRequirement: "brand_defined",
            evidenceTypes: ["screenshot"],
            requiredMetricKeys: ["views"],
            contentFormat: "dashboard",
          },
        ],
      }),
    ).toMatchObject({ status: "needs_confirmation" });
  });

  it("lets reporting-only X proof proceed without a profile account gate", () => {
    expect(
      getCreatorReportingEligibility({
        creatorPlatforms: ["tiktok"],
        requirements: [
          {
            platform: "x",
            platformLabel: null,
            accountRequirement: "native_insights_required",
            evidenceTypes: ["screenshot"],
            requiredMetricKeys: ["replies"],
            contentFormat: "short_video",
          },
        ],
      }),
    ).toMatchObject({
      status: "needs_confirmation",
      missingPlatforms: [],
    });
  });

  it("derives declared platforms from profile lists and connected account fields", () => {
    expect(
      getCreatorDeclaredPlatforms({
        platforms: ["tiktok", "instagram"],
        instagram: null,
        tiktok: { handle: "@creator" },
        youtube: { channel: "Creator Studio" },
        facebook: null,
        snapchat: null,
      }),
    ).toEqual(["instagram", "tiktok", "youtube"]);
  });
});
