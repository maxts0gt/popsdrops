export const AGREEMENT_BUCKET_ID = "campaign-agreements" as const;
export const AGREEMENT_MAX_FILE_BYTES = 20 * 1024 * 1024;
export const AGREEMENT_ALLOWED_MIME_TYPES = ["application/pdf"] as const;

export function sanitizeAgreementFileName(fileName: string): string {
  const normalized = fileName
    .trim()
    .toLowerCase()
    .replace(/\.pdf$/i, "")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "");

  return `${normalized || "agreement"}.pdf`;
}

export function buildAgreementStoragePath(input: {
  campaignId: string;
  agreementId: string;
  fileName: string;
}): string {
  return [
    input.campaignId,
    input.agreementId,
    sanitizeAgreementFileName(input.fileName),
  ].join("/");
}

export function getAgreementStorageUri(storagePath: string): string {
  return `${AGREEMENT_BUCKET_ID}/${storagePath}`;
}

export function getAgreementFileValidationError(input: {
  mimeType: string;
  sizeBytes: number;
}): string | null {
  if (input.sizeBytes <= 0) return "Choose a non-empty agreement file.";
  if (input.sizeBytes > AGREEMENT_MAX_FILE_BYTES) {
    return "Agreement files must be 20MB or smaller.";
  }
  if (!AGREEMENT_ALLOWED_MIME_TYPES.includes(input.mimeType as "application/pdf")) {
    return "Upload a PDF agreement file.";
  }
  return null;
}
