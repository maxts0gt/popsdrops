import { createClient } from "@/lib/supabase/server";

export async function getCampaign(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select("*, brand:brand_profiles(*, profile:profiles(*))")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

export async function getCampaignWithDetails(id: string) {
  const supabase = await createClient();

  const [campaignResult, deliverablesResult, membersResult, applicationsResult] =
    await Promise.all([
      supabase
        .from("campaigns")
        .select("*, brand:brand_profiles(*, profile:profiles(*))")
        .eq("id", id)
        .single(),
      supabase
        .from("campaign_deliverables")
        .select("*")
        .eq("campaign_id", id),
      supabase
        .from("campaign_members")
        .select("*, creator:creator_profiles(*, profile:profiles(*))")
        .eq("campaign_id", id),
      supabase
        .from("campaign_applications")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", id),
    ]);

  if (campaignResult.error) throw campaignResult.error;
  if (deliverablesResult.error) throw deliverablesResult.error;
  if (membersResult.error) throw membersResult.error;
  if (applicationsResult.error) throw applicationsResult.error;

  return {
    ...campaignResult.data,
    deliverables: deliverablesResult.data,
    members: membersResult.data,
    applications_count: applicationsResult.count ?? 0,
  };
}

export async function listCampaigns(
  filters: {
    status?: string;
    brandId?: string;
    platform?: string;
    market?: string;
    niche?: string;
    page?: number;
    limit?: number;
  } = {}
) {
  const { status, brandId, platform, market, niche, page = 1, limit = 20 } = filters;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const supabase = await createClient();
  let query = supabase
    .from("campaigns")
    .select("*, brand:brand_profiles(*, profile:profiles(*))", { count: "exact" });

  if (status) query = query.eq("status", status);
  if (brandId) query = query.eq("brand_id", brandId);
  if (platform) query = query.contains("platforms", [platform]);
  if (market) query = query.contains("target_markets", [market]);
  if (niche) query = query.contains("niches", [niche]);

  query = query.order("created_at", { ascending: false }).range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data, count };
}

export async function listBrandCampaigns(brandId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select("*, deliverables:campaign_deliverables(*)")
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function listCreatorCampaigns(creatorId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaign_members")
    .select("*, campaign:campaigns(*, brand:brand_profiles(*, profile:profiles(*)))")
    .eq("creator_id", creatorId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function createCampaign(
  brandId: string,
  data: {
    title: string;
    description?: string;
    requirements?: string;
    dos?: string[];
    donts?: string[];
    platforms?: string[];
    target_markets?: string[];
    niches?: string[];
    budget?: number;
    usage_rights?: string;
    deliverables?: Array<{
      platform: string;
      format: string;
      quantity: number;
      deadline?: string;
    }>;
    [key: string]: unknown;
  }
) {
  const supabase = await createClient();
  const { deliverables, ...campaignData } = data;

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .insert({ ...campaignData, brand_id: brandId, status: "draft" })
    .select()
    .single();

  if (campaignError) throw campaignError;

  if (deliverables && deliverables.length > 0) {
    const { error: deliverableError } = await supabase
      .from("campaign_deliverables")
      .insert(
        deliverables.map((d) => ({ ...d, campaign_id: campaign.id }))
      );

    if (deliverableError) throw deliverableError;
  }

  return campaign;
}

export async function updateCampaign(
  id: string,
  data: Record<string, unknown>
) {
  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("campaigns")
    .update(data)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return updated;
}

export async function updateCampaignStatus(id: string, status: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaigns")
    .update({ status })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getMatchingCampaigns(creatorId: string) {
  const supabase = await createClient();

  // First get the creator's profile to know their niches, markets, platforms
  const { data: creator, error: creatorError } = await supabase
    .from("creator_profiles")
    .select("niches, markets, platforms")
    .eq("profile_id", creatorId)
    .single();

  if (creatorError) throw creatorError;

  let query = supabase
    .from("campaigns")
    .select("*, brand:brand_profiles(*, profile:profiles(*))")
    .eq("status", "recruiting");

  if (creator.platforms && creator.platforms.length > 0) {
    query = query.overlaps("platforms", creator.platforms);
  }
  if (creator.markets && creator.markets.length > 0) {
    query = query.overlaps("target_markets", creator.markets);
  }
  if (creator.niches && creator.niches.length > 0) {
    query = query.overlaps("niches", creator.niches);
  }

  query = query.order("created_at", { ascending: false }).limit(50);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}
