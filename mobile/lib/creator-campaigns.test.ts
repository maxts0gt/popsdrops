import { describe, expect, it } from "vitest";
import {
  buildCampaignBuckets,
  buildDiscoverFeed,
  buildHomeSnapshot,
  filterDiscoverFeed,
  scoreCampaignFit,
  type CreatorCampaignSignals,
  type DiscoverCampaignRecord,
} from "./creator-campaigns";

const creatorSignals: CreatorCampaignSignals = {
  platforms: ["instagram", "tiktok"],
  niches: ["beauty", "lifestyle"],
  markets: ["france", "uae"],
};

const campaigns: DiscoverCampaignRecord[] = [
  {
    id: "campaign-perfect",
    title: "Luxury skincare launch",
    brandName: "Maison Luxe",
    platforms: ["instagram"],
    niches: ["beauty"],
    markets: ["france"],
    budgetMin: 600,
    budgetMax: 900,
    budgetCurrency: "USD",
    applicationDeadline: "2026-04-20T00:00:00.000Z",
    status: "recruiting",
  },
  {
    id: "campaign-platform-only",
    title: "Resort reels",
    brandName: "Voyage House",
    platforms: ["tiktok"],
    niches: ["travel"],
    markets: ["japan"],
    budgetMin: 400,
    budgetMax: 550,
    budgetCurrency: "USD",
    applicationDeadline: "2026-04-10T00:00:00.000Z",
    status: "recruiting",
  },
  {
    id: "campaign-member",
    title: "Already joined",
    brandName: "Existing Brand",
    platforms: ["instagram"],
    niches: ["beauty"],
    markets: ["france"],
    budgetMin: 300,
    budgetMax: 450,
    budgetCurrency: "USD",
    applicationDeadline: "2026-04-08T00:00:00.000Z",
    status: "recruiting",
  },
];

describe("scoreCampaignFit", () => {
  it("scores campaigns by platform, niche, and market overlap", () => {
    const perfect = scoreCampaignFit(creatorSignals, campaigns[0]);
    // 40 (platform) + 18 (1 niche) + 15 (1 market) = 73
    expect(perfect.score).toBeGreaterThanOrEqual(70);
    expect(perfect.reasons).toContain("platform");
    expect(perfect.reasons).toContain("niche");
    expect(perfect.reasons).toContain("market");

    const platformOnly = scoreCampaignFit(creatorSignals, campaigns[1]);
    // 40 (platform) + possible recency boost
    expect(platformOnly.score).toBeGreaterThanOrEqual(40);
    expect(platformOnly.score).toBeLessThanOrEqual(45);
    expect(platformOnly.reasons).toEqual(["platform"]);

    const noMatch = scoreCampaignFit(creatorSignals, {
      ...campaigns[1],
      platforms: ["youtube"],
    });
    expect(noMatch.score).toBe(0);
    expect(noMatch.reasons).toEqual([]);
  });
});

describe("buildDiscoverFeed", () => {
  it("builds the for-you feed with match sorting and member exclusion", () => {
    const feed = buildDiscoverFeed({
      mode: "forYou",
      creatorSignals,
      campaigns,
      applicationStatuses: {
        "campaign-platform-only": "pending",
      },
      memberCampaignIds: new Set(["campaign-member"]),
    });

    expect(feed.map((campaign) => campaign.id)).toEqual([
      "campaign-perfect",
      "campaign-platform-only",
    ]);
    expect(feed[0]?.matchScore).toBeGreaterThan(feed[1]?.matchScore ?? 0);
    expect(feed[0]?.matchReasons).toContain("platform");
    expect(feed[1]?.applicationStatus).toBe("pending");
  });

  it("builds browse-all feed ordered by nearest deadline", () => {
    const feed = buildDiscoverFeed({
      mode: "browseAll",
      creatorSignals,
      campaigns,
      applicationStatuses: {},
      memberCampaignIds: new Set(),
    });

    expect(feed.map((campaign) => campaign.id)).toEqual([
      "campaign-member",
      "campaign-platform-only",
      "campaign-perfect",
    ]);
  });
});

describe("filterDiscoverFeed", () => {
  it("matches discover campaigns by title, brand, and niche", () => {
    const feed = buildDiscoverFeed({
      mode: "browseAll",
      creatorSignals,
      campaigns,
      applicationStatuses: {},
      memberCampaignIds: new Set(),
    });

    expect(
      filterDiscoverFeed(feed, "voyage").map((campaign) => campaign.id),
    ).toEqual(["campaign-platform-only"]);
    expect(
      filterDiscoverFeed(feed, "beauty").map((campaign) => campaign.id),
    ).toEqual(["campaign-member", "campaign-perfect"]);
    expect(
      filterDiscoverFeed(feed, "launch").map((campaign) => campaign.id),
    ).toEqual(["campaign-perfect"]);
  });
});

describe("buildCampaignBuckets", () => {
  it("splits memberships and applications into active, completed, and application buckets", () => {
    const buckets = buildCampaignBuckets({
      memberships: [
        {
          campaignId: "active-1",
          title: "Ongoing campaign",
          brandName: "Maison Luxe",
          platforms: ["instagram"],
          status: "in_progress",
          acceptedRate: 700,
          contentDueDate: "2026-04-12T00:00:00.000Z",
          completedAt: null,
        },
        {
          campaignId: "complete-1",
          title: "Completed campaign",
          brandName: "Voyage House",
          platforms: ["tiktok"],
          status: "completed",
          acceptedRate: 500,
          contentDueDate: null,
          completedAt: "2026-03-20T00:00:00.000Z",
        },
      ],
      applications: [
        {
          id: "application-1",
          campaignId: "campaign-platform-only",
          campaignTitle: "Resort reels",
          brandName: "Voyage House",
          platforms: ["tiktok"],
          status: "pending",
          proposedRate: 450,
          counterRate: null,
          createdAt: "2026-04-01T00:00:00.000Z",
        },
      ],
    });

    expect(buckets.active.map((campaign) => campaign.campaignId)).toEqual([
      "active-1",
    ]);
    expect(buckets.completed.map((campaign) => campaign.campaignId)).toEqual([
      "complete-1",
    ]);
    expect(buckets.applications.map((application) => application.id)).toEqual([
      "application-1",
    ]);
  });
});

describe("buildHomeSnapshot", () => {
  it("summarizes the creator workspace using campaigns and applications", () => {
    const discoverFeed = buildDiscoverFeed({
      mode: "forYou",
      creatorSignals,
      campaigns,
      applicationStatuses: {},
      memberCampaignIds: new Set(["campaign-member"]),
    });

    const snapshot = buildHomeSnapshot({
      memberships: [
        {
          campaignId: "active-1",
          title: "Ongoing campaign",
          brandName: "Maison Luxe",
          platforms: ["instagram"],
          status: "publishing",
          acceptedRate: 700,
          contentDueDate: "2026-04-12T00:00:00.000Z",
          completedAt: null,
        },
      ],
      applications: [
        {
          id: "application-1",
          campaignId: "campaign-platform-only",
          campaignTitle: "Resort reels",
          brandName: "Voyage House",
          platforms: ["tiktok"],
          status: "pending",
          proposedRate: 450,
          counterRate: null,
          createdAt: "2026-04-01T00:00:00.000Z",
        },
        {
          id: "application-2",
          campaignId: "counter-1",
          campaignTitle: "Counter offer",
          brandName: "Maison Luxe",
          platforms: ["instagram"],
          status: "counter_offer",
          proposedRate: 600,
          counterRate: 700,
          createdAt: "2026-04-02T00:00:00.000Z",
        },
      ],
      discoverFeed,
    });

    expect(snapshot.activeCampaignCount).toBe(1);
    expect(snapshot.pendingApplicationCount).toBe(1);
    expect(snapshot.counterOfferCount).toBe(1);
    expect(snapshot.topMatches.map((campaign) => campaign.id)).toEqual([
      "campaign-perfect",
      "campaign-platform-only",
    ]);
  });
});
