import { describe, expect, it } from "vitest";

import {
  getMissingRequiredProofMetrics,
  getRequiredProofMetricGroupsForSubmission,
} from "./required-proof-metrics";

describe("required proof metrics", () => {
  it("requires the submission platform and reporting-only channels, not sibling publishing platforms", () => {
    const groups = getRequiredProofMetricGroupsForSubmission({
      campaignPlatforms: ["instagram", "tiktok"],
      submissionPlatform: "instagram",
      submissionContentFormat: "reel",
      requirements: [
        {
          platform: "instagram",
          content_format: "reel",
          required_metric_keys: ["views", "comments"],
        },
        {
          platform: "tiktok",
          content_format: "short_video",
          required_metric_keys: ["views", "shares"],
        },
        {
          platform: "x",
          content_format: "reel",
          required_metric_keys: ["impressions"],
        },
        {
          platform: "generic",
          content_format: "reel",
          required_metric_keys: ["clicks"],
        },
      ],
    });

    expect(groups).toEqual([
      { platform: "instagram", requiredMetricKeys: ["views", "comments"] },
      { platform: "x", requiredMetricKeys: ["impressions"] },
      { platform: "generic", requiredMetricKeys: ["clicks"] },
    ]);
  });

  it("spots missing metrics by reporting platform", () => {
    expect(
      getMissingRequiredProofMetrics({
        primaryPlatform: "instagram",
        requiredGroups: [
          { platform: "instagram", requiredMetricKeys: ["views"] },
          { platform: "x", requiredMetricKeys: ["impressions"] },
          { platform: "generic", requiredMetricKeys: ["clicks"] },
        ],
        metricValues: [
          { platform: "instagram", metricKey: "views", metricValue: 1200 },
          { platform: "x", metricKey: "impressions", metricValue: 9000 },
        ],
        sparseMetrics: {},
      }),
    ).toEqual(["generic:clicks"]);
  });
});
