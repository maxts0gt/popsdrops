import { describe, expect, it } from "vitest";
import {
  AGREEMENT_BUCKET_ID,
  buildAgreementStoragePath,
  getAgreementFileValidationError,
  sanitizeAgreementFileName,
} from "./agreement-upload";

describe("agreement upload helpers", () => {
  it("sanitizes PDF filenames", () => {
    expect(sanitizeAgreementFileName(" Brand NDA Final!!.PDF ")).toBe("brand-nda-final.pdf");
    expect(sanitizeAgreementFileName("...")).toBe("agreement.pdf");
  });

  it("builds scoped agreement storage paths", () => {
    expect(
      buildAgreementStoragePath({
        campaignId: "4707edb5-dcab-4b2d-b5eb-7e79f0e1f010",
        agreementId: "11111111-2222-4333-8444-555555555555",
        fileName: "Brand NDA.pdf",
      }),
    ).toBe(
      "4707edb5-dcab-4b2d-b5eb-7e79f0e1f010/11111111-2222-4333-8444-555555555555/brand-nda.pdf",
    );
  });

  it("allows only non-empty PDF files up to 20MB", () => {
    expect(AGREEMENT_BUCKET_ID).toBe("campaign-agreements");
    expect(getAgreementFileValidationError({ mimeType: "application/pdf", sizeBytes: 1024 })).toBeNull();
    expect(getAgreementFileValidationError({ mimeType: "image/png", sizeBytes: 1024 })).toBe("Upload a PDF agreement file.");
    expect(getAgreementFileValidationError({ mimeType: "application/pdf", sizeBytes: 0 })).toBe("Choose a non-empty agreement file.");
    expect(getAgreementFileValidationError({ mimeType: "application/pdf", sizeBytes: 21 * 1024 * 1024 })).toBe("Agreement files must be 20MB or smaller.");
  });
});
