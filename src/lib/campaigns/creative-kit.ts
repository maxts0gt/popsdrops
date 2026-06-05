import type {
  CampaignAssetStatus,
  CampaignAssetType,
  CampaignAssetVisibility,
} from "@/types/database";

export type CampaignCreativeAsset = {
  id: string;
  campaignId: string;
  title: string;
  description: string | null;
  assetType: CampaignAssetType;
  bucketId: "campaign-assets";
  storagePath: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  visibility: CampaignAssetVisibility;
  status: CampaignAssetStatus;
  createdAt: string;
  signedUrl?: string | null;
};

export type CampaignCreativeKitReadiness = {
  hasCreatorImage: boolean;
  isDiscoverReady: boolean;
  missing: string[];
};

const IMAGE_ASSET_TYPES: CampaignAssetType[] = ["product_image", "logo"];

function isCreatorFacingImage(asset: CampaignCreativeAsset) {
  return (
    asset.status === "ready" &&
    asset.visibility === "public" &&
    asset.mimeType.startsWith("image/") &&
    Boolean(asset.signedUrl)
  );
}

export function pickCreatorFacingHeroAsset(
  assets: CampaignCreativeAsset[],
): CampaignCreativeAsset | null {
  const publicImages = assets.filter(isCreatorFacingImage);
  if (publicImages.length === 0) return null;

  return (
    publicImages.find((asset) => asset.assetType === "product_image") ??
    publicImages.find((asset) => IMAGE_ASSET_TYPES.includes(asset.assetType)) ??
    publicImages[0]
  );
}

export function getCreativeKitReadiness(
  assets: CampaignCreativeAsset[],
): CampaignCreativeKitReadiness {
  const hasCreatorImage = pickCreatorFacingHeroAsset(assets) !== null;
  return {
    hasCreatorImage,
    isDiscoverReady: hasCreatorImage,
    missing: hasCreatorImage ? [] : ["creator-facing campaign image"],
  };
}

export function mapCampaignAssetRow(
  row: {
    id: string;
    campaign_id: string;
    title: string;
    description: string | null;
    asset_type: CampaignAssetType;
    bucket_id: "campaign-assets";
    storage_path: string;
    file_name: string;
    mime_type: string;
    size_bytes: number;
    visibility: CampaignAssetVisibility;
    status: CampaignAssetStatus;
    created_at: string;
  },
  signedUrl?: string | null,
): CampaignCreativeAsset {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    title: row.title,
    description: row.description,
    assetType: row.asset_type,
    bucketId: row.bucket_id,
    storagePath: row.storage_path,
    fileName: row.file_name,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    visibility: row.visibility,
    status: row.status,
    createdAt: row.created_at,
    signedUrl: signedUrl ?? null,
  };
}
