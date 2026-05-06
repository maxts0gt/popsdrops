import { describe, expect, it } from "vitest";

import {
  EVIDENCE_BUCKET_ID,
  EVIDENCE_MAX_FILE_BYTES,
  buildEvidenceStoragePath,
  getEvidenceFileValidationError,
  getEvidenceStorageUri,
  getEvidenceTypeFromMime,
  sanitizeEvidenceFileName,
} from "./evidence-upload";

const ids = {
  campaignId: "11111111-1111-4111-8111-111111111111",
  campaignMemberId: "22222222-2222-4222-8222-222222222222",
  reportTaskId: "33333333-3333-4333-8333-333333333333",
  evidenceId: "44444444-4444-4444-8444-444444444444",
};

describe("reporting evidence upload helpers", () => {
  it("builds storage paths that match the Supabase RLS path contract", () => {
    const storagePath = buildEvidenceStoragePath({
      ...ids,
      fileName: "Instagram Analytics May 18.png",
    });

    expect(storagePath.split("/").slice(0, 4)).toEqual([
      ids.campaignId,
      ids.campaignMemberId,
      ids.reportTaskId,
      ids.evidenceId,
    ]);
    expect(storagePath).toBe(
      `${ids.campaignId}/${ids.campaignMemberId}/${ids.reportTaskId}/${ids.evidenceId}/instagram-analytics-may-18.png`,
    );
    expect(getEvidenceStorageUri(storagePath)).toBe(
      `${EVIDENCE_BUCKET_ID}/${storagePath}`,
    );
  });

  it("sanitizes file names without losing the extension", () => {
    expect(sanitizeEvidenceFileName("TikTok: analytics proof (final).WEBP")).toBe(
      "tiktok-analytics-proof-final.webp",
    );
    expect(sanitizeEvidenceFileName("..")).toBe("evidence");
  });

  it("keeps evidence type tied to the actual uploaded file type", () => {
    expect(getEvidenceTypeFromMime("image/png")).toBe("screenshot");
    expect(getEvidenceTypeFromMime("text/csv")).toBe("analytics_export");
    expect(getEvidenceTypeFromMime("application/pdf")).toBe("document");
  });

  it("validates evidence files before the browser attempts upload", () => {
    expect(
      getEvidenceFileValidationError({
        mimeType: "image/jpeg",
        sizeBytes: EVIDENCE_MAX_FILE_BYTES,
      }),
    ).toBeNull();

    expect(
      getEvidenceFileValidationError({
        mimeType: "image/gif",
        sizeBytes: 42,
      }),
    ).toContain("PNG, JPG, WEBP, PDF, or CSV");

    expect(
      getEvidenceFileValidationError({
        mimeType: "image/png",
        sizeBytes: EVIDENCE_MAX_FILE_BYTES + 1,
      }),
    ).toContain("15MB");
  });
});
