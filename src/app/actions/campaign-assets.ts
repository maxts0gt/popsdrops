"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import {
  createCampaignAssetUploadSchema,
  markCampaignAssetReadySchema,
} from "@/lib/validations";
import { assertBrandWorkspacePermission } from "@/lib/brand-workspace";
import {
  buildCampaignAssetStoragePath,
  CAMPAIGN_ASSET_BUCKET_ID,
  getCampaignAssetFileValidationError,
} from "@/lib/campaigns/creative-kit-upload";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "./auth";

async function getOwnedCampaign(campaignId: string, user: { id: string }) {
  const supabase = await createClient();
  const workspace = await assertBrandWorkspacePermission(
    supabase,
    user.id,
    "manage_campaigns",
  );

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, brand_id")
    .eq("id", campaignId)
    .eq("brand_id", workspace.brandId)
    .single();

  if (!campaign) throw new Error("Campaign not found or not authorized");
  return campaign;
}

function revalidateCampaignAssetPaths(campaignId: string) {
  revalidatePath(`/b/campaigns/${campaignId}`);
  revalidatePath(`/i/discover`);
  revalidatePath(`/i/discover/${campaignId}`);
  revalidatePath(`/apply/${campaignId}`);
}

export async function createCampaignAssetUpload(input: unknown) {
  const parsed = createCampaignAssetUploadSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const validationError = getCampaignAssetFileValidationError({
    mimeType: parsed.data.mimeType,
    sizeBytes: parsed.data.sizeBytes,
    assetType: parsed.data.assetType,
  });
  if (validationError) throw new Error(validationError);

  const user = await getUser();
  await getOwnedCampaign(parsed.data.campaignId, user);

  const assetId = randomUUID();
  const storagePath = buildCampaignAssetStoragePath({
    campaignId: parsed.data.campaignId,
    assetId,
    fileName: parsed.data.fileName,
  });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("campaign_assets")
    .insert({
      id: assetId,
      campaign_id: parsed.data.campaignId,
      uploaded_by: user.id,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      asset_type: parsed.data.assetType,
      bucket_id: CAMPAIGN_ASSET_BUCKET_ID,
      storage_path: storagePath,
      file_name: parsed.data.fileName,
      mime_type: parsed.data.mimeType,
      size_bytes: parsed.data.sizeBytes,
      visibility: parsed.data.visibility,
      status: "uploading",
    })
    .select("id, bucket_id, storage_path")
    .single();

  if (error) throw new Error(error.message);

  return {
    assetId: data.id,
    bucket: data.bucket_id,
    storagePath: data.storage_path,
  };
}

export async function markCampaignAssetReady(input: unknown) {
  const parsed = markCampaignAssetReadySchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const user = await getUser();
  await getOwnedCampaign(parsed.data.campaignId, user);

  const admin = createAdminClient();
  const { error } = await admin
    .from("campaign_assets")
    .update({
      status: "ready",
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.assetId)
    .eq("campaign_id", parsed.data.campaignId);

  if (error) throw new Error(error.message);
  revalidateCampaignAssetPaths(parsed.data.campaignId);
  return { ok: true };
}
