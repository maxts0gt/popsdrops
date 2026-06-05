import { describe, expect, it } from "vitest";

import { getBrandCampaignHandoffSummary } from "./brand-campaign-handoff";

describe("brand campaign handoff summary", () => {
  it("shows a clear handoff when content, live URLs, and proof are complete", () => {
    const summary = getBrandCampaignHandoffSummary({
      submissions: [
        { status: "published", publishedUrl: "https://www.tiktok.com/@creator/video/1" },
        { status: "published", publishedUrl: "https://www.instagram.com/reel/1/" },
      ],
      reportTasks: [
        { status: "verified" },
        { status: "verified" },
      ],
    });

    expect(summary.blockedCount).toBe(0);
    expect(summary.stages.map((stage) => stage.key)).toEqual([
      "content",
      "liveUrl",
      "proof",
    ]);
    expect(summary.stages.map((stage) => stage.value)).toEqual([
      "2/2",
      "2/2",
      "2/2",
    ]);
    expect(summary.stages.every((stage) => stage.tone === "done")).toBe(true);
  });

  it("counts missing live URLs and proof review as blockers", () => {
    const summary = getBrandCampaignHandoffSummary({
      submissions: [
        { status: "approved", publishedUrl: null },
        { status: "published", publishedUrl: "https://www.tiktok.com/@creator/video/1" },
      ],
      reportTasks: [
        { status: "submitted" },
        { status: "missed" },
      ],
    });

    expect(summary.blockedCount).toBe(3);
    expect(summary.stages.find((stage) => stage.key === "liveUrl")).toMatchObject({
      tone: "attention",
      blockedCount: 1,
      value: "1/2",
    });
    expect(summary.stages.find((stage) => stage.key === "proof")).toMatchObject({
      tone: "attention",
      blockedCount: 2,
      value: "0/2",
    });
  });
});
