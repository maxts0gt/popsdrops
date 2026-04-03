export type CreatorCampaignSignals = {
  platforms: string[];
  niches: string[];
  markets: string[];
};

export type DiscoverCampaignRecord = {
  id: string;
  title: string;
  brandName: string;
  platforms: string[];
  niches: string[];
  markets: string[];
  budgetMin: number | null;
  budgetMax: number | null;
  budgetCurrency: string;
  applicationDeadline: string | null;
  status: string;
};

export type DiscoverCampaignCard = DiscoverCampaignRecord & {
  matchScore: number;
  matchReasons: MatchReason[];
  applicationStatus: string | null;
};

export type MembershipRecord = {
  campaignId: string;
  title: string;
  brandName: string;
  platforms: string[];
  status: string;
  acceptedRate: number | null;
  contentDueDate: string | null;
  completedAt: string | null;
};

export type ApplicationRecord = {
  id: string;
  campaignId: string;
  campaignTitle: string;
  brandName: string;
  platforms: string[];
  status: string;
  proposedRate: number | null;
  counterRate: number | null;
  createdAt: string;
};

function hasOverlap(source: string[], target: string[]): boolean {
  if (source.length === 0 || target.length === 0) {
    return false;
  }

  const sourceSet = new Set(source.map((value) => value.toLowerCase()));
  return target.some((value) => sourceSet.has(value.toLowerCase()));
}

function compareDatesAscending(left: string | null, right: string | null): number {
  if (!left && !right) {
    return 0;
  }

  if (!left) {
    return 1;
  }

  if (!right) {
    return -1;
  }

  return new Date(left).getTime() - new Date(right).getTime();
}

export type MatchReason = "niche" | "platform" | "market";

export function scoreCampaignFit(
  signals: CreatorCampaignSignals,
  campaign: DiscoverCampaignRecord,
): { score: number; reasons: MatchReason[] } {
  let score = 0;
  const reasons: MatchReason[] = [];

  // Platform match (40 pts) — binary qualifier, most important
  if (hasOverlap(signals.platforms, campaign.platforms)) {
    score += 40;
    reasons.push("platform");
  }

  // Niche match (35 pts) — scaled by overlap depth
  const nicheOverlapCount = countOverlap(signals.niches, campaign.niches);
  if (nicheOverlapCount > 0) {
    // More overlapping niches = stronger fit (up to 35)
    const nicheScore = Math.min(nicheOverlapCount * 18, 35);
    score += nicheScore;
    reasons.push("niche");
  }

  // Market match (25 pts) — scaled by overlap
  const marketOverlapCount = countOverlap(signals.markets, campaign.markets);
  if (marketOverlapCount > 0) {
    const marketScore = Math.min(marketOverlapCount * 15, 25);
    score += marketScore;
    reasons.push("market");
  }

  // Recency boost: only if there's at least one signal match
  if (score > 0 && campaign.applicationDeadline) {
    const daysLeft =
      (new Date(campaign.applicationDeadline).getTime() - Date.now()) /
      (1000 * 60 * 60 * 24);
    if (daysLeft > 0 && daysLeft <= 7) {
      score += 5;
    }
  }

  return { score: Math.min(score, 100), reasons };
}

function countOverlap(source: string[], target: string[]): number {
  if (source.length === 0 || target.length === 0) {
    return 0;
  }
  const sourceSet = new Set(source.map((v) => v.toLowerCase()));
  return target.filter((v) => sourceSet.has(v.toLowerCase())).length;
}

export type SortMode = "recommended" | "newest" | "highestPaying" | "deadline";

export type DiscoverFilters = {
  platforms: string[];
  niches: string[];
  markets: string[];
  budgetRange: "any" | "under500" | "500to1k" | "1kPlus";
};

export const EMPTY_FILTERS: DiscoverFilters = {
  platforms: [],
  niches: [],
  markets: [],
  budgetRange: "any",
};

export function countActiveFilters(filters: DiscoverFilters): number {
  let count = 0;
  if (filters.platforms.length > 0) count++;
  if (filters.niches.length > 0) count++;
  if (filters.markets.length > 0) count++;
  if (filters.budgetRange !== "any") count++;
  return count;
}

function matchesBudgetRange(
  campaign: DiscoverCampaignRecord,
  range: DiscoverFilters["budgetRange"],
): boolean {
  if (range === "any") return true;
  const budget = campaign.budgetMax ?? campaign.budgetMin;
  if (budget == null) return false;
  switch (range) {
    case "under500":
      return budget < 500;
    case "500to1k":
      return budget >= 500 && budget <= 1000;
    case "1kPlus":
      return budget > 1000;
  }
}

export function applyDiscoverFilters(
  feed: DiscoverCampaignCard[],
  filters: DiscoverFilters,
): DiscoverCampaignCard[] {
  return feed.filter((campaign) => {
    if (
      filters.platforms.length > 0 &&
      !hasOverlap(filters.platforms, campaign.platforms)
    ) {
      return false;
    }
    if (
      filters.niches.length > 0 &&
      !hasOverlap(filters.niches, campaign.niches)
    ) {
      return false;
    }
    if (
      filters.markets.length > 0 &&
      !hasOverlap(filters.markets, campaign.markets)
    ) {
      return false;
    }
    if (!matchesBudgetRange(campaign, filters.budgetRange)) {
      return false;
    }
    return true;
  });
}

export function sortDiscoverFeed(
  feed: DiscoverCampaignCard[],
  mode: SortMode,
): DiscoverCampaignCard[] {
  const sorted = [...feed];
  switch (mode) {
    case "recommended":
      return sorted.sort((a, b) => {
        if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
        return compareDatesAscending(a.applicationDeadline, b.applicationDeadline);
      });
    case "newest":
      return sorted.sort((a, b) =>
        compareDatesAscending(b.applicationDeadline, a.applicationDeadline),
      );
    case "highestPaying":
      return sorted.sort(
        (a, b) => (b.budgetMax ?? b.budgetMin ?? 0) - (a.budgetMax ?? a.budgetMin ?? 0),
      );
    case "deadline":
      return sorted.sort((a, b) =>
        compareDatesAscending(a.applicationDeadline, b.applicationDeadline),
      );
  }
}

export function buildDiscoverFeed(input: {
  mode: "forYou" | "browseAll";
  creatorSignals: CreatorCampaignSignals;
  campaigns: DiscoverCampaignRecord[];
  applicationStatuses: Record<string, string>;
  memberCampaignIds: Set<string>;
}): DiscoverCampaignCard[] {
  const feed = input.campaigns
    .filter(
      (campaign) =>
        campaign.status === "recruiting" &&
        !input.memberCampaignIds.has(campaign.id),
    )
    .map((campaign) => {
      const { score, reasons } = scoreCampaignFit(input.creatorSignals, campaign);
      return {
        ...campaign,
        matchScore: score,
        matchReasons: reasons,
        applicationStatus: input.applicationStatuses[campaign.id] ?? null,
      };
    });

  if (input.mode === "forYou") {
    return feed.sort((left, right) => {
      if (right.matchScore !== left.matchScore) {
        return right.matchScore - left.matchScore;
      }

      return compareDatesAscending(
        left.applicationDeadline,
        right.applicationDeadline,
      );
    });
  }

  return feed.sort((left, right) =>
    compareDatesAscending(left.applicationDeadline, right.applicationDeadline),
  );
}

export function buildCampaignBuckets(input: {
  memberships: MembershipRecord[];
  applications: ApplicationRecord[];
}): {
  active: MembershipRecord[];
  completed: MembershipRecord[];
  applications: ApplicationRecord[];
} {
  const completedStatuses = new Set(["completed", "cancelled"]);

  return {
    active: input.memberships
      .filter((membership) => !completedStatuses.has(membership.status))
      .sort((left, right) =>
        compareDatesAscending(left.contentDueDate, right.contentDueDate),
      ),
    completed: input.memberships
      .filter((membership) => completedStatuses.has(membership.status))
      .sort(
        (left, right) =>
          new Date(right.completedAt ?? 0).getTime() -
          new Date(left.completedAt ?? 0).getTime(),
      ),
    applications: [...input.applications].sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    ),
  };
}

export function filterDiscoverFeed(
  feed: DiscoverCampaignCard[],
  search: string,
): DiscoverCampaignCard[] {
  const normalizedSearch = search.trim().toLowerCase();

  if (!normalizedSearch) {
    return feed;
  }

  return feed.filter((campaign) => {
    if (campaign.title.toLowerCase().includes(normalizedSearch)) {
      return true;
    }

    if (campaign.brandName.toLowerCase().includes(normalizedSearch)) {
      return true;
    }

    return campaign.niches.some((niche) =>
      niche.toLowerCase().includes(normalizedSearch),
    );
  });
}

export function buildHomeSnapshot(input: {
  memberships: MembershipRecord[];
  applications: ApplicationRecord[];
  discoverFeed: DiscoverCampaignCard[];
}): {
  activeCampaignCount: number;
  pendingApplicationCount: number;
  counterOfferCount: number;
  topMatches: DiscoverCampaignCard[];
} {
  const activeCampaignCount = input.memberships.filter(
    (membership) =>
      membership.status !== "completed" && membership.status !== "cancelled",
  ).length;

  return {
    activeCampaignCount,
    pendingApplicationCount: input.applications.filter(
      (application) => application.status === "pending",
    ).length,
    counterOfferCount: input.applications.filter(
      (application) => application.status === "counter_offer",
    ).length,
    topMatches: input.discoverFeed.slice(0, 3),
  };
}
