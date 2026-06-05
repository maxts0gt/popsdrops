"use server";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getUser } from "@/app/actions/auth";
import {
  DATA_DELETION_GRACE_DAYS,
  DATA_DELETION_RESPONSE_DAYS,
  getScheduledDeletionAt,
  getVerificationDueAt,
} from "@/lib/compliance/data-rights-policy";
import { createClient } from "@/lib/supabase/server";

const PRIVACY_EXPORT_BUCKET = "privacy-exports";
const PRIVACY_EXPORT_SIGNED_URL_SECONDS = 300;

const LEGAL_POLICY_VERSIONS = {
  terms: "2026-05-18",
  privacy: "2026-05-18",
  retention: "2026-05-18",
} as const;

const legalConsentSchema = z.object({
  email: z.string().email().optional(),
  source: z
    .enum(["login", "request_invite", "settings", "policy_update"])
    .default("settings"),
  consent_type: z
    .enum(["terms_privacy_retention", "privacy_request"])
    .default("terms_privacy_retention"),
  locale: z.string().min(2).max(12).default("en"),
});

const dataRightsRequestSchema = z.object({
  details: z.string().max(1000).optional(),
});

type LegalConsentInput = z.input<typeof legalConsentSchema>;
type DataRightsRequestInput = z.input<typeof dataRightsRequestSchema>;

const DATA_RIGHTS_RETENTION_NOTE =
  `Deletion is scheduled automatically after ${DATA_DELETION_GRACE_DAYS} days, and the compliance response is due within ${DATA_DELETION_RESPONSE_DAYS} days. Legal, tax, fraud, reporting, and contractual records are retained or anonymized only where required.`;

const privacyExportDownloadSchema = z.object({
  requestId: z.string().uuid(),
});

function hashHeader(value: string | null) {
  if (!value) return null;
  return createHash("sha256").update(value).digest("hex");
}

async function getRequestHashes() {
  const headerStore = await headers();
  const forwardedFor = headerStore.get("x-forwarded-for");
  const ip = forwardedFor?.split(",")[0]?.trim() ?? headerStore.get("x-real-ip");

  return {
    ip_hash: hashHeader(ip),
    user_agent_hash: hashHeader(headerStore.get("user-agent")),
  };
}

function revalidateComplianceSurfaces() {
  revalidatePath("/b/settings");
  revalidatePath("/i/profile");
  revalidatePath("/admin/approvals");
}

async function generatePrivacyExportArtifact(requestId: string, profileId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Privacy export service is not configured.");
  }

  const response = await fetch(
    `${supabaseUrl}/functions/v1/generate-privacy-export`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ requestId, profileId }),
      cache: "no-store",
    },
  );

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(payload?.error ?? "Privacy export could not be generated.");
  }
}

export async function recordLegalConsent(input: LegalConsentInput = {}) {
  const parsed = legalConsentSchema.parse(input);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const hashes = await getRequestHashes();
  const email = parsed.email ?? user?.email ?? null;

  const { error } = await supabase.from("legal_consents").insert({
    profile_id: user?.id ?? null,
    email,
    consent_type: parsed.consent_type,
    source: parsed.source,
    terms_version: LEGAL_POLICY_VERSIONS.terms,
    privacy_version: LEGAL_POLICY_VERSIONS.privacy,
    retention_version: LEGAL_POLICY_VERSIONS.retention,
    locale: parsed.locale,
    ip_hash: hashes.ip_hash,
    user_agent_hash: hashes.user_agent_hash,
  });

  if (error) throw new Error(error.message);

  revalidateComplianceSurfaces();
  return { success: true };
}

async function queueDataRightsRequest(
  requestType: "export" | "deletion",
  input: DataRightsRequestInput = {},
) {
  const user = await getUser();
  const parsed = dataRightsRequestSchema.parse(input);
  const supabase = await createClient();
  const now = new Date();

  if (requestType === "export") {
    const { data: request, error } = await supabase
      .from("data_rights_requests")
      .insert({
        profile_id: user.id,
        email: user.email ?? "",
        request_type: "export",
        status: "pending",
        details: parsed.details ?? null,
        retention_note: DATA_RIGHTS_RETENTION_NOTE,
        export_storage_bucket: PRIVACY_EXPORT_BUCKET,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    await recordLegalConsent({
      email: user.email ?? undefined,
      source: "settings",
      consent_type: "privacy_request",
    });

    await generatePrivacyExportArtifact(request.id, user.id);

    revalidateComplianceSurfaces();
    return {
      success: true,
      request_id: request.id,
    };
  }

  const { error } = await supabase.from("data_rights_requests").insert({
    profile_id: user.id,
    email: user.email ?? "",
    request_type: "deletion",
    status: "scheduled",
    details: parsed.details ?? null,
    retention_note: DATA_RIGHTS_RETENTION_NOTE,
    scheduled_for: getScheduledDeletionAt(now).toISOString(),
    verification_due_at: getVerificationDueAt(now).toISOString(),
  });

  if (error) throw new Error(error.message);

  await recordLegalConsent({
    email: user.email ?? undefined,
    source: "settings",
    consent_type: "privacy_request",
  });

  revalidateComplianceSurfaces();
  return {
    success: true,
    scheduled_for: getScheduledDeletionAt(now).toISOString(),
    verification_due_at: getVerificationDueAt(now).toISOString(),
    grace_days: DATA_DELETION_GRACE_DAYS,
    response_days: DATA_DELETION_RESPONSE_DAYS,
  };
}

export async function requestDataExport(input: DataRightsRequestInput = {}) {
  return queueDataRightsRequest("export", input);
}

export async function requestAccountDeletion(input: DataRightsRequestInput = {}) {
  return queueDataRightsRequest("deletion", input);
}

export async function getPrivacyExportDownloadUrl(input: { requestId: string }) {
  const parsed = privacyExportDownloadSchema.parse(input);
  const user = await getUser();
  const supabase = await createClient();

  const { data: request, error } = await supabase
    .from("data_rights_requests")
    .select(
      "id, profile_id, request_type, status, export_storage_bucket, export_storage_path, export_file_name, export_expires_at",
    )
    .eq("id", parsed.requestId)
    .eq("profile_id", user.id)
    .eq("request_type", "export")
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!request) throw new Error("Privacy export was not found.");
  if (request.status !== "completed" || !request.export_storage_path) {
    throw new Error("Privacy export is not ready yet.");
  }
  if (
    request.export_expires_at &&
    new Date(request.export_expires_at).getTime() <= Date.now()
  ) {
    throw new Error("Privacy export has expired.");
  }

  const storageBucket = request.export_storage_bucket ?? PRIVACY_EXPORT_BUCKET;
  const fileName = request.export_file_name ?? "popsdrops-data-export.json";
  const { data: signed, error: signedUrlError } = await supabase.storage
    .from(storageBucket)
    .createSignedUrl(request.export_storage_path, PRIVACY_EXPORT_SIGNED_URL_SECONDS, {
      download: fileName,
    });

  if (signedUrlError || !signed?.signedUrl) {
    throw new Error(signedUrlError?.message ?? "Download link could not be created.");
  }

  return {
    signedUrl: signed.signedUrl,
    expiresIn: PRIVACY_EXPORT_SIGNED_URL_SECONDS,
  };
}
