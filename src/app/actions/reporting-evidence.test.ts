import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./reporting-evidence.ts", import.meta.url),
  "utf8",
);

describe("reporting evidence actions", () => {
  it("creates scoped upload metadata before the browser uploads to Storage", () => {
    expect(source).toContain("export async function createPerformanceEvidenceUpload");
    expect(source).toContain(".from(\"content_performance_evidence\")");
    expect(source).toContain("buildEvidenceStoragePath");
    expect(source).toContain("bucket: EVIDENCE_BUCKET_ID");
    expect(source).toContain("storagePath");
  });

  it("downloads private evidence with the service-role client before AI extraction", () => {
    expect(source).toContain("export async function analyzePerformanceEvidence");
    expect(source).toContain("createAdminClient");
    expect(source).toContain(".storage.from(EVIDENCE_BUCKET_ID)");
    expect(source).toContain(".download(evidence.storage_path)");
    expect(source).toContain("GEMINI_API_KEY");
    expect(source).toContain("pending_confirmation");
  });

  it("keeps AI extraction separate until creator confirmation", () => {
    expect(source).toContain("content_performance_ai_extractions");
    expect(source).toContain("pending_confirmation");
    expect(source).toContain("creator_confirmed");
    expect(source).toContain("accepted_by_creator");
  });

  it("upserts confirmed values by performance and metric key", () => {
    expect(source).toContain(".from(\"content_performance_metric_values\")");
    expect(source).toContain("onConflict: \"performance_id,metric_key\"");
  });
});
