"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import {
  acceptCampaignAgreementSchema,
  publishCampaignAgreementSchema,
  upsertCampaignAgreementDraftSchema,
} from "@/lib/validations";
import {
  assertBrandWorkspacePermission,
  getBrandWorkspaceForCurrentUser,
} from "@/lib/brand-workspace";
import {
  AGREEMENT_BUCKET_ID,
  buildAgreementStoragePath,
  getAgreementFileValidationError,
} from "@/lib/agreements/agreement-upload";
import { hashAgreementContent } from "@/lib/agreements/campaign-agreement";
import { assertCampaignAllowsAgreementUpdate } from "@/lib/campaigns/lifecycle";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "./auth";

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

async function getOwnedCampaign(campaignId: string, user: { id: string }) {
  const supabase = await createClient();
  const workspace = await assertBrandWorkspacePermission(
    supabase,
    user.id,
    "manage_campaigns",
  );

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, brand_id, status, application_deadline")
    .eq("id", campaignId)
    .eq("brand_id", workspace.brandId)
    .single();

  if (!campaign) throw new Error("Campaign not found or not authorized");
  assertCampaignAllowsAgreementUpdate(campaign);
  return campaign;
}

export async function assertCampaignMemberAgreementAccess(memberId: string) {
  const admin = createAdminClient();
  const { data: status } = await admin
    .from("campaign_member_agreement_status")
    .select("status")
    .eq("campaign_member_id", memberId)
    .maybeSingle();

  if (status && !["not_required", "signed"].includes(status.status)) {
    throw new Error("Sign the campaign rules before continuing.");
  }
}

export async function upsertCampaignAgreementDraft(input: unknown) {
  const parsed = upsertCampaignAgreementDraftSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const user = await getUser();
  await getOwnedCampaign(parsed.data.campaignId, user);

  const admin = createAdminClient();
  const { data: latest } = await admin
    .from("campaign_agreements")
    .select("id, version, status")
    .eq("campaign_id", parsed.data.campaignId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const version = latest?.status === "draft" ? latest.version : (latest?.version ?? 0) + 1;
  const agreementId = latest?.status === "draft" ? latest.id : randomUUID();
  const contentHash = hashAgreementContent({
    campaignId: parsed.data.campaignId,
    version,
    gateMode: parsed.data.gateMode,
    title: parsed.data.title,
    rules: parsed.data.rules,
    agreementBody: parsed.data.agreementBody,
    fileSha256: parsed.data.fileSha256,
  });
  const filePath = parsed.data.fileName
    ? buildAgreementStoragePath({
        campaignId: parsed.data.campaignId,
        agreementId,
        fileName: parsed.data.fileName,
      })
    : null;

  const { data, error } = await admin
    .from("campaign_agreements")
    .upsert(
      {
        id: agreementId,
        campaign_id: parsed.data.campaignId,
        created_by: user.id,
        version,
        status: "draft",
        gate_mode: parsed.data.gateMode,
        title: parsed.data.title,
        rules: parsed.data.rules,
        agreement_body: parsed.data.agreementBody ?? null,
        preview_enabled: parsed.data.previewEnabled,
        preview_summary: parsed.data.previewSummary,
        file_bucket: filePath ? AGREEMENT_BUCKET_ID : null,
        file_path: filePath,
        file_name: parsed.data.fileName ?? null,
        file_mime_type: parsed.data.fileMimeType ?? null,
        file_size_bytes: parsed.data.fileSizeBytes ?? null,
        file_sha256: parsed.data.fileSha256 ?? null,
        content_hash: contentHash,
        requires_typed_name: parsed.data.requiresTypedName,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    )
    .select("id, campaign_id, file_path")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath(`/b/campaigns/${parsed.data.campaignId}`);
  return data;
}

export async function createCampaignAgreementUpload(input: {
  agreementId: string;
  campaignId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}) {
  const validationError = getAgreementFileValidationError({
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
  });
  if (validationError) throw new Error(validationError);

  const user = await getUser();
  await getOwnedCampaign(input.campaignId, user);

  const storagePath = buildAgreementStoragePath({
    campaignId: input.campaignId,
    agreementId: input.agreementId,
    fileName: input.fileName,
  });

  const admin = createAdminClient();
  const { data: agreement } = await admin
    .from("campaign_agreements")
    .select("id, file_path, status")
    .eq("id", input.agreementId)
    .eq("campaign_id", input.campaignId)
    .eq("status", "draft")
    .maybeSingle();

  if (!agreement || agreement.file_path !== storagePath) {
    throw new Error("Agreement upload is not prepared");
  }

  return {
    bucket: AGREEMENT_BUCKET_ID,
    storagePath,
  };
}

export async function publishCampaignAgreement(input: { agreementId: string }) {
  const parsed = publishCampaignAgreementSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const user = await getUser();
  const supabase = await createClient();
  const { data: agreement } = await supabase
    .from("campaign_agreements")
    .select("id, campaign_id, status")
    .eq("id", parsed.data.agreementId)
    .single();

  if (!agreement) throw new Error("Agreement not found");
  if (agreement.status !== "draft") {
    throw new Error("Only draft agreements can be published");
  }
  await getOwnedCampaign(agreement.campaign_id, user);

  const admin = createAdminClient();
  const publishedAt = new Date().toISOString();
  const { error: archiveError } = await admin
    .from("campaign_agreements")
    .update({ status: "archived", updated_at: publishedAt })
    .eq("campaign_id", agreement.campaign_id)
    .eq("status", "published");
  if (archiveError) throw new Error(archiveError.message);

  const { error } = await admin
    .from("campaign_agreements")
    .update({
      status: "published",
      published_at: publishedAt,
      updated_at: publishedAt,
    })
    .eq("id", agreement.id);
  if (error) throw new Error(error.message);

  revalidatePath(`/b/campaigns/${agreement.campaign_id}`);
  revalidatePath(`/i/campaigns/${agreement.campaign_id}`);
  return { ok: true };
}

export async function acceptCampaignAgreement(input: unknown) {
  const parsed = acceptCampaignAgreementSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const user = await getUser();
  const supabase = await createClient();
  const { data: agreement } = await supabase
    .from("campaign_agreements")
    .select("id, campaign_id, version, status, rules, content_hash")
    .eq("id", parsed.data.agreementId)
    .eq("campaign_id", parsed.data.campaignId)
    .single();

  if (!agreement || agreement.status !== "published") {
    throw new Error("Agreement is not available for signature");
  }

  const { data: member } = await supabase
    .from("campaign_members")
    .select("id, campaign_id, creator_id")
    .eq("campaign_id", parsed.data.campaignId)
    .eq("creator_id", user.id)
    .single();

  if (!member) throw new Error("Campaign membership not found");

  const admin = createAdminClient();
  const { data: existingAcceptance } = await admin
    .from("campaign_agreement_acceptances")
    .select("id, accepted_content_hash")
    .eq("agreement_id", agreement.id)
    .eq("campaign_member_id", member.id)
    .eq("creator_id", user.id)
    .is("revoked_at", null)
    .maybeSingle();

  if (existingAcceptance?.accepted_content_hash === agreement.content_hash) {
    return { ok: true };
  }

  const { error } = await admin
    .from("campaign_agreement_acceptances")
    .insert({
      agreement_id: agreement.id,
      campaign_id: agreement.campaign_id,
      campaign_member_id: member.id,
      creator_id: user.id,
      typed_name: parsed.data.typedName,
      accepted_rules: parsed.data.acceptedRules,
      accepted_content_hash: agreement.content_hash,
      accepted_version: agreement.version,
      user_agent: null,
    });

  if (error) throw new Error(error.message);

  revalidatePath(`/i/campaigns/${agreement.campaign_id}`);
  revalidatePath(`/b/campaigns/${agreement.campaign_id}`);
  return { ok: true };
}

export async function getCampaignAgreementSignedUrl(input: {
  agreementId: string;
}) {
  const user = await getUser();
  const supabase = await createClient();
  const { data: agreement } = await supabase
    .from("campaign_agreements")
    .select("id, campaign_id, file_bucket, file_path, campaigns(brand_id)")
    .eq("id", input.agreementId)
    .single();

  if (!agreement?.file_bucket || !agreement.file_path) {
    throw new Error("Agreement file not found");
  }

  const campaign = firstRelation(
    agreement.campaigns as { brand_id: string } | { brand_id: string }[] | null,
  );
  const workspace = await getBrandWorkspaceForCurrentUser(supabase, user.id);
  const isBrand = campaign?.brand_id === workspace?.brandId;

  const { data: member } = await supabase
    .from("campaign_members")
    .select("id")
    .eq("campaign_id", agreement.campaign_id)
    .eq("creator_id", user.id)
    .maybeSingle();

  if (!isBrand && !member) throw new Error("Not authorized");

  const { data, error } = await supabase.storage
    .from(agreement.file_bucket)
    .createSignedUrl(agreement.file_path, 600);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message ?? "Signed URL could not be created");
  }
  return { signedUrl: data.signedUrl };
}
