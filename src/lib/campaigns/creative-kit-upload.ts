import type { CampaignAssetType } from "@/types/database";

export const CAMPAIGN_ASSET_BUCKET_ID = "campaign-assets" as const;

export const CAMPAIGN_ASSET_MAX_BYTES = 20 * 1024 * 1024;

export const CAMPAIGN_ASSET_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "video/mp4",
  "video/quicktime",
] as const;

export function getCampaignAssetFileValidationError(input: {
  mimeType: string;
  sizeBytes: number;
  assetType: CampaignAssetType;
}): string | null {
  if (!CAMPAIGN_ASSET_MIME_TYPES.includes(input.mimeType as never)) {
    return "Use JPG, PNG, WEBP, PDF, MP4, or MOV.";
  }

  if (input.assetType === "product_image" && !input.mimeType.startsWith("image/")) {
    return "Campaign images must be JPG, PNG, or WEBP.";
  }

  if (input.sizeBytes <= 0) return "Choose a file to upload.";
  if (input.sizeBytes > CAMPAIGN_ASSET_MAX_BYTES) {
    return "Files must be 20 MB or smaller.";
  }

  return null;
}

function cleanFileName(fileName: string) {
  const trimmed = fileName.trim() || "campaign-asset";
  return trimmed
    .replace(/[/\\]/g, "-")
    .replace(/[^a-zA-Z0-9._ -]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 180);
}

export function buildCampaignAssetStoragePath(input: {
  campaignId: string;
  assetId: string;
  fileName: string;
}) {
  return `${input.campaignId}/${input.assetId}/${cleanFileName(input.fileName)}`;
}
