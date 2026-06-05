import { NextResponse } from "next/server";
import { ACTIVE_CAMPAIGN_CREATOR_INVITE_STATUSES } from "@/lib/campaigns/creator-invite-status";
import { isCampaignServiceFeeUnlocked } from "@/lib/campaigns/service-fee-visibility";
import { isCampaignVisibleForPublicApply } from "@/lib/campaigns/recruitment-visibility";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSingleRelation } from "@/lib/supabase/relations";

const CAMPAIGN_ASSET_SIGNED_URL_TTL_SECONDS = 600;

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const inviteId = new URL(request.url).searchParams.get("invite");
  const admin = createAdminClient();

  const { data: campaignData } = await admin
    .from("campaigns")
    .select(
      `id, title, status, brief_description, brief_requirements,
       brief_dos, brief_donts, brief_translated, platforms, markets, niches,
       budget_min, budget_max, budget_currency, max_creators,
       service_fee_cents, service_fee_status, recruitment_visibility,
       application_deadline, content_due_date, performance_due_date,
       posting_window_start, posting_window_end,
       usage_rights_duration, usage_rights_territory, usage_rights_paid_ads,
       max_revisions, compliance_notes,
       campaign_assets (
         id,
         campaign_id,
         title,
         description,
         asset_type,
         bucket_id,
         storage_path,
         file_name,
         mime_type,
         size_bytes,
         visibility,
         status,
         created_at
       ),
       campaign_deliverables (platform, content_type, quantity),
       campaign_reporting_requirements (
         platform,
         platform_label,
         content_format,
         account_requirement,
         evidence_types,
         required_metric_keys,
         ai_extraction_allowed,
         creator_confirmation_required,
         sort_order
       ),
       campaign_reporting_plans (
         cadence,
         starts_at,
         ends_at
       ),
       campaign_agreements (
         id,
         status,
         gate_mode,
         title,
         preview_enabled,
         preview_summary,
         version
       ),
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

  const campaignRecord = campaignData as Record<string, unknown>;
  if (!isCampaignServiceFeeUnlocked(campaignRecord)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const hasInviteToken = inviteId
    ? Boolean(
        await admin
          .from("campaign_creator_invites")
          .select("id")
          .eq("id", inviteId)
          .eq("campaign_id", id)
          .in("status", [...ACTIVE_CAMPAIGN_CREATOR_INVITE_STATUSES])
          .maybeSingle()
          .then(({ data }) => data?.id),
      )
    : false;

  if (!isCampaignVisibleForPublicApply(campaignRecord, { hasInviteToken })) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const profile = getSingleRelation(
    campaignRecord.profiles as
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
  const reportingRequirements = Array.isArray(
    campaignRecord.campaign_reporting_requirements,
  )
    ? (
        campaignRecord.campaign_reporting_requirements as Array<
          Record<string, unknown>
        >
      ).toSorted((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))
    : [];
  const agreementRows = Array.isArray(campaignRecord.campaign_agreements)
    ? (campaignRecord.campaign_agreements as Array<Record<string, unknown>>)
    : [];
  const reportingPlan = getSingleRelation(
    campaignRecord.campaign_reporting_plans as
      | Record<string, unknown>
      | Record<string, unknown>[]
      | null,
  );
  const publicCreativeAssets = Array.isArray(campaignRecord.campaign_assets)
    ? (campaignRecord.campaign_assets as Array<Record<string, unknown>>).filter(
        (asset) =>
          asset.visibility === "public" &&
          asset.status === "ready" &&
          typeof asset.storage_path === "string" &&
          typeof asset.mime_type === "string",
      )
    : [];
  const signedAssetUrls =
    publicCreativeAssets.length > 0
      ? await admin.storage
          .from("campaign-assets")
          .createSignedUrls(
            publicCreativeAssets.map((asset) => asset.storage_path as string),
            CAMPAIGN_ASSET_SIGNED_URL_TTL_SECONDS,
          )
      : { data: [] };
  const publicCampaignAssets = publicCreativeAssets.map((asset, index) => ({
    id: asset.id,
    campaign_id: asset.campaign_id,
    title: asset.title,
    description: asset.description,
    asset_type: asset.asset_type,
    bucket_id: asset.bucket_id,
    storage_path: asset.storage_path,
    file_name: asset.file_name,
    mime_type: asset.mime_type,
    size_bytes: asset.size_bytes,
    visibility: asset.visibility,
    status: asset.status,
    created_at: asset.created_at,
    signed_url: signedAssetUrls.data?.[index]?.signedUrl ?? null,
  }));
  const publishedAgreement = agreementRows.find(
    (row) => row.status === "published",
  );
  const agreementPreview = publishedAgreement
    ? {
        required: true,
        gate_mode: publishedAgreement.gate_mode,
        title: publishedAgreement.title,
        version: publishedAgreement.version,
        preview_enabled: publishedAgreement.preview_enabled,
        preview_summary: publishedAgreement.preview_enabled
          ? publishedAgreement.preview_summary
          : {},
      }
    : {
        required: false,
        gate_mode: null,
        title: null,
        version: null,
        preview_enabled: false,
        preview_summary: {},
      };
  const safeCampaignData = { ...campaignRecord };
  delete safeCampaignData.campaign_agreements;
  delete safeCampaignData.campaign_assets;
  delete safeCampaignData.campaign_reporting_plans;
  delete safeCampaignData.service_fee_cents;
  delete safeCampaignData.service_fee_status;

  const payload = {
    ...safeCampaignData,
    campaign_assets: publicCampaignAssets,
    agreement_preview: agreementPreview,
    reporting_requirements: reportingRequirements,
    reporting_plan: reportingPlan
      ? {
          cadence: reportingPlan.cadence,
          starts_at: reportingPlan.starts_at,
          ends_at: reportingPlan.ends_at,
        }
      : null,
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
