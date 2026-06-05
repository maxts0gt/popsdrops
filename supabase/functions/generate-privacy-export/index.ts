import { z } from "npm:zod@4.3.6";
import { createAdminClient, requireServiceRole } from "../_shared/auth.ts";
import { corsHeaders, json, methodNotAllowed } from "../_shared/json.ts";

const PRIVACY_EXPORT_BUCKET = "privacy-exports";
const PRIVACY_EXPORT_MIME_TYPE = "application/json";
const PRIVACY_EXPORT_RETENTION_DAYS = 14;

const uuidLike = z
  .string()
  .regex(
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
    "Invalid ID format",
  );

const requestSchema = z.object({
  requestId: uuidLike,
  profileId: uuidLike,
});

type SupabaseAdminClient = ReturnType<typeof createAdminClient>;

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function buildExportFileName(generatedAt: Date) {
  return `popsdrops-data-export-${generatedAt.toISOString().slice(0, 10)}.json`;
}

async function readSingle(
  admin: SupabaseAdminClient,
  table: string,
  column: string,
  value: string,
) {
  const { data, error } = await admin
    .from(table)
    .select("*")
    .eq(column, value)
    .maybeSingle();

  if (error) throw new Error(`${table}: ${error.message}`);
  return data;
}

async function readRows(
  admin: SupabaseAdminClient,
  table: string,
  column: string,
  value: string,
  limit = 250,
) {
  const { data, error } = await admin
    .from(table)
    .select("*")
    .eq(column, value)
    .limit(limit);

  if (error) throw new Error(`${table}: ${error.message}`);
  return data ?? [];
}

async function buildPrivacyExport(admin: SupabaseAdminClient, profileId: string) {
  const [
    profile,
    brandProfile,
    creatorProfile,
    legalConsents,
    dataRightsRequests,
    brandTeamMemberships,
    brandTeamInvitations,
    brandCampaigns,
    creatorApplications,
    creatorCampaigns,
  ] = await Promise.all([
    readSingle(admin, "profiles", "id", profileId),
    readSingle(admin, "brand_profiles", "profile_id", profileId),
    readSingle(admin, "creator_profiles", "profile_id", profileId),
    readRows(admin, "legal_consents", "profile_id", profileId),
    readRows(admin, "data_rights_requests", "profile_id", profileId),
    readRows(admin, "brand_team_members", "user_id", profileId),
    readRows(admin, "brand_team_invitations", "invited_by", profileId),
    readRows(admin, "campaigns", "brand_id", profileId),
    readRows(admin, "campaign_applications", "creator_id", profileId),
    readRows(admin, "campaign_members", "creator_id", profileId),
  ]);

  return {
    format: "popsdrops.privacy_export.v1",
    generated_at: new Date().toISOString(),
    profile_id: profileId,
    account: {
      profile,
      brand_profile: brandProfile,
      creator_profile: creatorProfile,
    },
    workspace: {
      brand_team_memberships: brandTeamMemberships,
      brand_team_invitations: brandTeamInvitations,
    },
    campaigns: {
      owned: brandCampaigns,
      applications: creatorApplications,
      memberships: creatorCampaigns,
    },
    compliance: {
      legal_consents: legalConsents,
      privacy_requests: dataRightsRequests,
    },
  };
}

async function queueDataExportReadyEmail({
  admin,
  email,
  requestId,
  fileName,
  expiresAt,
}: {
  admin: SupabaseAdminClient;
  email: string;
  requestId: string;
  fileName: string;
  expiresAt: Date;
}) {
  const { error } = await admin.from("notification_queue").insert({
    email,
    template: "data_export_ready",
    priority: "immediate",
    data: {
      title: "Data export ready",
      body: "Your PopsDrops data export is ready in privacy settings.",
      data: {
        request_id: requestId,
        file_name: fileName,
        download_expires_at: expiresAt.toISOString(),
      },
    },
  });

  if (error) throw new Error(`notification_queue: ${error.message}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return methodNotAllowed();
  }

  let requestId: string | null = null;
  const admin = createAdminClient();

  try {
    requireServiceRole(req);

    const parsed = requestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return json(
        { error: "Invalid privacy export request", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    requestId = parsed.data.requestId;
    const { profileId } = parsed.data;
    const { data: request, error: requestError } = await admin
      .from("data_rights_requests")
      .select("id, profile_id, request_type, status, email")
      .eq("id", requestId)
      .maybeSingle();

    if (requestError) throw new Error(requestError.message);
    if (!request) throw new Error("Privacy request was not found.");
    if (request.profile_id !== profileId) {
      throw new Error("Privacy request profile mismatch.");
    }
    if (request.request_type !== "export") {
      throw new Error("Privacy request is not an export request.");
    }

    const startedAt = new Date();
    await admin
      .from("data_rights_requests")
      .update({
        status: "processing",
        processed_at: startedAt.toISOString(),
        processing_error: null,
        export_storage_bucket: PRIVACY_EXPORT_BUCKET,
      })
      .eq("id", requestId);

    const fileName = buildExportFileName(startedAt);
    const storagePath = `${profileId}/${requestId}/${fileName}`;
    const exportData = await buildPrivacyExport(admin, profileId);
    const artifact = new Blob([JSON.stringify(exportData, null, 2)], {
      type: PRIVACY_EXPORT_MIME_TYPE,
    });

    const { error: uploadError } = await admin.storage
      .from(PRIVACY_EXPORT_BUCKET)
      .upload(storagePath, artifact, {
        contentType: PRIVACY_EXPORT_MIME_TYPE,
        upsert: false,
      });

    if (uploadError) throw new Error(uploadError.message);

    const completedAt = new Date();
    const expiresAt = addDays(completedAt, PRIVACY_EXPORT_RETENTION_DAYS);
    const { error: updateError } = await admin
      .from("data_rights_requests")
      .update({
        status: "completed",
        processed_at: completedAt.toISOString(),
        completed_at: completedAt.toISOString(),
        export_storage_bucket: PRIVACY_EXPORT_BUCKET,
        export_storage_path: storagePath,
        export_file_name: fileName,
        export_mime_type: PRIVACY_EXPORT_MIME_TYPE,
        export_expires_at: expiresAt.toISOString(),
        processing_error: null,
      })
      .eq("id", requestId);

    if (updateError) throw new Error(updateError.message);

    await queueDataExportReadyEmail({
      admin,
      email: request.email,
      requestId,
      fileName,
      expiresAt,
    });

    return json({
      requestId,
      storageBucket: PRIVACY_EXPORT_BUCKET,
      storagePath,
      fileName,
      mimeType: PRIVACY_EXPORT_MIME_TYPE,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    if (requestId) {
      await admin
        .from("data_rights_requests")
        .update({
          status: "failed",
          processed_at: new Date().toISOString(),
          processing_error:
            error instanceof Error ? error.message : "Privacy export failed.",
        })
        .eq("id", requestId);
    }

    const message = error instanceof Error ? error.message : "Privacy export failed.";
    return json(
      { error: message },
      { status: message === "Unauthorized" ? 401 : 500 },
    );
  }
});
