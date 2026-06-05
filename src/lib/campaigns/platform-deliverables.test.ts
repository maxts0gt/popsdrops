import { describe, expect, it } from "vitest";

import {
  buildCampaignPlatformDeliverables,
  getCampaignDeliverablePlatforms,
} from "./platform-deliverables";

describe("campaign platform deliverables", () => {
  it("expands each requested content format across every selected publishing platform", () => {
    expect(
      buildCampaignPlatformDeliverables({
        platforms: ["tiktok", "instagram"],
        deliverables: [
          { format: "short_video", quantity: 1 },
          { format: "story", quantity: 2 },
        ],
      }),
    ).toEqual([
      { platform: "tiktok", content_type: "short_video", quantity: 1 },
      { platform: "tiktok", content_type: "story", quantity: 2 },
      { platform: "instagram", content_type: "short_video", quantity: 1 },
      { platform: "instagram", content_type: "story", quantity: 2 },
    ]);
  });

  it("keeps custom proof channels out of enum-backed campaign deliverables", () => {
    expect(getCampaignDeliverablePlatforms(["x", "instagram", "brand_blog"])).toEqual([
      "instagram",
    ]);
  });
});
