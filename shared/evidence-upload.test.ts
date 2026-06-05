import { describe, expect, it } from "vitest";

import {
  EVIDENCE_BUCKET_ID,
  EVIDENCE_MAX_FILE_BYTES,
  buildEvidenceStoragePath,
  getEvidenceFileValidationError,
  getEvidenceStorageUri,
  getEvidenceTypeFromMime,
  resolveEvidenceMimeType,
  sanitizeEvidenceFileName,
} from "./evidence-upload";

const ids = {
  campaignId: "11111111-1111-4111-8111-111111111111",
  campaignMemberId: "22222222-2222-4222-8222-222222222222",
  reportTaskId: "33333333-3333-4333-8333-333333333333",
  evidenceId: "44444444-4444-4444-8444-444444444444",
};

describe("shared evidence upload helpers", () => {
  it("builds the storage path Supabase RLS expects", () => {
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

  it("validates creator evidence files before upload", () => {
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

  it("maps file MIME type to evidence type", () => {
    expect(getEvidenceTypeFromMime("image/png")).toBe("screenshot");
    expect(getEvidenceTypeFromMime("text/csv")).toBe("analytics_export");
    expect(getEvidenceTypeFromMime("application/pdf")).toBe("document");
    expect(sanitizeEvidenceFileName("TikTok: analytics proof (final).WEBP")).toBe(
      "tiktok-analytics-proof-final.webp",
    );
  });

  it("falls back to file extension when mobile pickers omit a useful MIME type", () => {
    expect(
      resolveEvidenceMimeType({
        fileName: "instagram-proof.JPG",
        mimeType: "image/jpg",
      }),
    ).toBe("image/jpeg");
    expect(
      resolveEvidenceMimeType({
        fileName: "platform-export.csv",
        mimeType: "application/octet-stream",
      }),
    ).toBe("text/csv");
    expect(
      resolveEvidenceMimeType({
        fileName: "analytics.pdf",
        mimeType: null,
      }),
    ).toBe("application/pdf");
  });
});
