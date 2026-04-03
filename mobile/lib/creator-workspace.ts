import { supabase } from "./supabase";
import {
  buildCampaignBuckets,
  buildDiscoverFeed,
  buildHomeSnapshot,
  type ApplicationRecord,
  type CreatorCampaignSignals,
  type DiscoverCampaignRecord,
  type MembershipRecord,
} from "./creator-campaigns";

function getSingleRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

type CreatorProfileQuery = {
  platforms: string[] | null;
  niches: string[] | null;
  markets: string[] | null;
};

type MembershipQuery = {
  accepted_rate: number | null;
  campaigns:
    | {
        id: string;
        title: string;
        platforms: string[] | null;
        status: string;
        content_due_date: string | null;
        completed_at: string | null;
        profiles:
          | {
              full_name: string | null;
            }
          | {
              full_name: string | null;
            }[]
          | null;
      }
    | {
        id: string;
        title: string;
        platforms: string[] | null;
        status: string;
        content_due_date: string | null;
        completed_at: string | null;
        profiles:
          | {
              full_name: string | null;
            }
          | {
              full_name: string | null;
            }[]
          | null;
      }[]
    | null;
};

type ApplicationQuery = {
  id: string;
  campaign_id: string;
  status: string;
  proposed_rate: number | null;
  counter_rate: number | null;
  created_at: string;
  campaigns:
    | {
        title: string;
        platforms: string[] | null;
        profiles:
          | {
              full_name: string | null;
            }
          | {
              full_name: string | null;
            }[]
          | null;
      }
    | {
        title: string;
        platforms: string[] | null;
        profiles:
          | {
              full_name: string | null;
            }
          | {
              full_name: string | null;
            }[]
          | null;
      }[]
    | null;
};

type DiscoverCampaignQuery = {
  id: string;
  title: string;
  platforms: string[] | null;
  markets: string[] | null;
  niches: string[] | null;
  budget_min: number | null;
  budget_max: number | null;
  budget_currency: string | null;
  application_deadline: string | null;
  status: string;
  profiles:
    | {
        full_name: string | null;
        brand_profiles:
          | {
              company_name: string | null;
            }
          | {
              company_name: string | null;
            }[]
          | null;
      }
    | {
        full_name: string | null;
        brand_profiles:
          | {
              company_name: string | null;
            }
          | {
              company_name: string | null;
            }[]
          | null;
      }[]
    | null;
};

export type CreatorWorkspaceSnapshot = {
  discover: {
    forYou: ReturnType<typeof buildDiscoverFeed>;
    browseAll: ReturnType<typeof buildDiscoverFeed>;
  };
  campaigns: ReturnType<typeof buildCampaignBuckets>;
  home: ReturnType<typeof buildHomeSnapshot>;
};

export async function loadCreatorWorkspace(
  userId: string,
): Promise<CreatorWorkspaceSnapshot> {
  const [creatorRes, membershipsRes, applicationsRes, campaignsRes] =
    await Promise.all([
      supabase
        .from("creator_profiles")
        .select("platforms, niches, markets")
        .eq("profile_id", userId)
        .maybeSingle(),
      supabase
        .from("campaign_members")
        .select(
          `accepted_rate,
           campaigns (
             id, title, platforms, status, content_due_date, completed_at,
             profiles!campaigns_brand_id_fkey ( full_name )
           )`,
        )
        .eq("creator_id", userId),
      supabase
        .from("campaign_applications")
        .select(
          `id, campaign_id, status, proposed_rate, counter_rate, created_at,
           campaigns (
             title, platforms,
             profiles!campaigns_brand_id_fkey ( full_name )
           )`,
        )
        .eq("creator_id", userId)
        .order("created_at", { ascending: false }),
      supabase
        .from("campaigns")
        .select(
          `id, title, platforms, markets, niches, budget_min, budget_max,
           budget_currency, application_deadline, status,
           profiles!campaigns_brand_id_fkey (
             full_name,
             brand_profiles ( company_name )
           )`,
        )
        .eq("status", "recruiting")
        .order("application_deadline", { ascending: true }),
    ]);

  if (creatorRes.error) {
    throw creatorRes.error;
  }

  if (membershipsRes.error) {
    throw membershipsRes.error;
  }

  if (applicationsRes.error) {
    throw applicationsRes.error;
  }

  if (campaignsRes.error) {
    throw campaignsRes.error;
  }

  const creator = (creatorRes.data ?? null) as CreatorProfileQuery | null;
  const creatorSignals: CreatorCampaignSignals = {
    platforms: creator?.platforms ?? [],
    niches: creator?.niches ?? [],
    markets: creator?.markets ?? [],
  };

  const memberships: MembershipRecord[] = ((membershipsRes.data ??
    []) as MembershipQuery[]).flatMap((membership) => {
    const campaign = getSingleRelation(membership.campaigns);
    if (!campaign) {
      return [];
    }

    const brand = getSingleRelation(campaign.profiles);

    return [
      {
        campaignId: campaign.id,
        title: campaign.title,
        brandName: brand?.full_name ?? "Brand",
        platforms: campaign.platforms ?? [],
        status: campaign.status,
        acceptedRate: membership.accepted_rate,
        contentDueDate: campaign.content_due_date,
        completedAt: campaign.completed_at,
      },
    ];
  });

  const applications: ApplicationRecord[] = ((applicationsRes.data ??
    []) as ApplicationQuery[]).flatMap((application) => {
    const campaign = getSingleRelation(application.campaigns);
    if (!campaign) {
      return [];
    }

    const brand = getSingleRelation(campaign.profiles);

    return [
      {
        id: application.id,
        campaignId: application.campaign_id,
        campaignTitle: campaign.title,
        brandName: brand?.full_name ?? "Brand",
        platforms: campaign.platforms ?? [],
        status: application.status,
        proposedRate: application.proposed_rate,
        counterRate: application.counter_rate,
        createdAt: application.created_at,
      },
    ];
  });

  const discoverCampaigns: DiscoverCampaignRecord[] = ((campaignsRes.data ??
    []) as DiscoverCampaignQuery[]).map((campaign) => {
    const brandProfileOwner = getSingleRelation(campaign.profiles);
    const brandProfile = getSingleRelation(brandProfileOwner?.brand_profiles);

    return {
      id: campaign.id,
      title: campaign.title,
      brandName:
        brandProfile?.company_name ??
        brandProfileOwner?.full_name ??
        "Brand",
      platforms: campaign.platforms ?? [],
      niches: campaign.niches ?? [],
      markets: campaign.markets ?? [],
      budgetMin: campaign.budget_min,
      budgetMax: campaign.budget_max,
      budgetCurrency: campaign.budget_currency ?? "USD",
      applicationDeadline: campaign.application_deadline,
      status: campaign.status,
    };
  });

  const applicationStatuses = Object.fromEntries(
    applications.map((application) => [application.campaignId, application.status]),
  );
  const memberCampaignIds = new Set(
    memberships.map((membership) => membership.campaignId),
  );

  const forYou = buildDiscoverFeed({
    mode: "forYou",
    creatorSignals,
    campaigns: discoverCampaigns,
    applicationStatuses,
    memberCampaignIds,
  });
  const browseAll = buildDiscoverFeed({
    mode: "browseAll",
    creatorSignals,
    campaigns: discoverCampaigns,
    applicationStatuses,
    memberCampaignIds,
  });
  const campaignBuckets = buildCampaignBuckets({
    memberships,
    applications,
  });
  const home = buildHomeSnapshot({
    memberships,
    applications,
    discoverFeed: forYou,
  });

  return {
    discover: {
      forYou,
      browseAll,
    },
    campaigns: campaignBuckets,
    home,
  };
}
