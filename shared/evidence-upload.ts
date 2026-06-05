export const EVIDENCE_BUCKET_ID = "campaign-evidence" as const;
export const EVIDENCE_MAX_FILE_BYTES = 15 * 1024 * 1024;

export const EVIDENCE_ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
  "text/csv",
] as const;

export type EvidenceAllowedMimeType =
  (typeof EVIDENCE_ALLOWED_MIME_TYPES)[number];

export type EvidenceType =
  | "screenshot"
  | "csv"
  | "analytics_export"
  | "document"
  | "other";

export function sanitizeEvidenceFileName(fileName: string): string {
  const normalized = fileName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/-+\./g, ".")
    .replace(/\.-+/g, ".")
    .replace(/^[.-]+|[.-]+$/g, "");

  return normalized || "evidence";
}

export function buildEvidenceStoragePath(input: {
  campaignId: string;
  campaignMemberId: string;
  reportTaskId: string;
  evidenceId: string;
  fileName: string;
}): string {
  return [
    input.campaignId,
    input.campaignMemberId,
    input.reportTaskId,
    input.evidenceId,
    sanitizeEvidenceFileName(input.fileName),
  ].join("/");
}

export function getEvidenceStorageUri(storagePath: string): string {
  return `${EVIDENCE_BUCKET_ID}/${storagePath}`;
}

export function parseEvidenceStorageReference(
  value: string | null | undefined,
): { bucket: typeof EVIDENCE_BUCKET_ID; path: string } | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const bucketPrefix = `${EVIDENCE_BUCKET_ID}/`;
  const protocolPrefix = `supabase://${bucketPrefix}`;
  const path = trimmed.startsWith(protocolPrefix)
    ? trimmed.slice(protocolPrefix.length)
    : trimmed.startsWith(bucketPrefix)
      ? trimmed.slice(bucketPrefix.length)
      : null;

  if (!path) return null;

  return {
    bucket: EVIDENCE_BUCKET_ID,
    path,
  };
}

export function isEvidenceAllowedMimeType(
  mimeType: string,
): mimeType is EvidenceAllowedMimeType {
  return EVIDENCE_ALLOWED_MIME_TYPES.includes(
    mimeType as EvidenceAllowedMimeType,
  );
}

export function resolveEvidenceMimeType(input: {
  fileName: string;
  mimeType?: string | null;
}): string {
  const normalized = input.mimeType?.split(";")[0]?.trim().toLowerCase();
  if (normalized && normalized !== "application/octet-stream") {
    if (normalized === "image/jpg") return "image/jpeg";
    if (normalized === "text/comma-separated-values") return "text/csv";
    return normalized;
  }

  const extension = input.fileName.toLowerCase().split(".").pop();
  if (extension === "jpg" || extension === "jpeg") return "image/jpeg";
  if (extension === "png") return "image/png";
  if (extension === "webp") return "image/webp";
  if (extension === "pdf") return "application/pdf";
  if (extension === "csv") return "text/csv";

  return "application/octet-stream";
}

export function getEvidenceTypeFromMime(mimeType: string): EvidenceType {
  if (mimeType.startsWith("image/")) return "screenshot";
  if (mimeType === "text/csv") return "analytics_export";
  if (mimeType === "application/pdf") return "document";
  return "other";
}

export function getEvidenceFileValidationError(input: {
  mimeType: string;
  sizeBytes: number;
}): string | null {
  if (input.sizeBytes <= 0) return "Choose a non-empty evidence file.";
  if (input.sizeBytes > EVIDENCE_MAX_FILE_BYTES) {
    return "Evidence files must be 15MB or smaller.";
  }
  if (!isEvidenceAllowedMimeType(input.mimeType)) {
    return "Upload a PNG, JPG, WEBP, PDF, or CSV evidence file.";
  }

  return null;
}
