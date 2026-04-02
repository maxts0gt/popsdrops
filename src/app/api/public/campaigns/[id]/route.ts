import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSingleRelation } from "@/lib/supabase/relations";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data: campaignData } = await admin
    .from("campaigns")
    .select(
      `id, title, status, brief_description, brief_requirements,
       brief_dos, brief_donts, platforms, markets, niches,
       budget_min, budget_max, budget_currency, max_creators,
       application_deadline,
       campaign_deliverables (platform, content_type, quantity),
       profiles!campaigns_brand_id_fkey (
         full_name,
         brand_profiles (
           company_name, website, rating, review_count
         )
       )`,
    )
    .eq("id", id)
    .neq("status", "draft")
    .single();

  if (!campaignData) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const profile = getSingleRelation(
    (campaignData as Record<string, unknown>).profiles as
      | Record<string, unknown>
      | Record<string, unknown>[]
      | null,
  );
  const brandProfile = getSingleRelation(
    profile?.brand_profiles as
      | Record<string, unknown>
      | Record<string, unknown>[]
      | null,
  );

  const payload = {
    ...campaignData,
    brand: brandProfile
      ? {
          company_name: brandProfile.company_name,
          website: brandProfile.website,
          rating: brandProfile.rating,
          review_count: brandProfile.review_count,
        }
      : {
          company_name: (profile?.full_name as string) || "Brand",
          website: null,
          rating: 0,
          review_count: 0,
        },
  };

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    },
  });
}
