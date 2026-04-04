import { supabase } from "./supabase";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type EarningRecord = {
  campaignId: string;
  campaignTitle: string;
  brandName: string;
  acceptedRate: number;
  paymentStatus: string;
  completedAt: string | null;
  status: string;
};

export type EarningsSummary = {
  totalEarned: number;
  thisMonthEarned: number;
  pendingPayments: number;
  campaigns: EarningRecord[];
};

// ---------------------------------------------------------------------------
// Load earnings
// ---------------------------------------------------------------------------

export async function loadEarnings(userId: string): Promise<EarningsSummary> {
  const { data, error } = await supabase
    .from("campaign_members")
    .select(
      `accepted_rate, payment_status,
       campaigns (
         id, title, status, completed_at,
         profiles!campaigns_brand_id_fkey ( full_name, brand_profiles ( company_name ) )
       )`,
    )
    .eq("creator_id", userId)
    .order("joined_at", { ascending: false });

  if (error) throw new Error(error.message);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  let totalEarned = 0;
  let thisMonthEarned = 0;
  let pendingPayments = 0;

  const campaigns: EarningRecord[] = (data ?? []).flatMap((row) => {
    const campaign = Array.isArray(row.campaigns)
      ? row.campaigns[0]
      : row.campaigns;
    if (!campaign) return [];

    const brandOwner = Array.isArray(campaign.profiles)
      ? campaign.profiles[0]
      : campaign.profiles;
    const brandProfile = brandOwner?.brand_profiles;
    const brandData = Array.isArray(brandProfile)
      ? brandProfile[0]
      : brandProfile;
    const brandName =
      brandData?.company_name ?? brandOwner?.full_name ?? "Brand";

    const rate = row.accepted_rate ?? 0;
    const paymentStatus = row.payment_status ?? "pending";
    const isCompleted =
      campaign.status === "completed" || campaign.status === "monitoring";

    if (isCompleted && paymentStatus === "paid") {
      totalEarned += rate;
      if (
        campaign.completed_at &&
        new Date(campaign.completed_at) >= monthStart
      ) {
        thisMonthEarned += rate;
      }
    }

    if (isCompleted && paymentStatus !== "paid") {
      pendingPayments += rate;
    }

    return [
      {
        campaignId: campaign.id,
        campaignTitle: campaign.title,
        brandName,
        acceptedRate: rate,
        paymentStatus,
        completedAt: campaign.completed_at,
        status: campaign.status,
      },
    ];
  });

  return { totalEarned, thisMonthEarned, pendingPayments, campaigns };
}
