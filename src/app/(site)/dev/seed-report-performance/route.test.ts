import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./route.ts", import.meta.url), "utf8");

describe("dev report performance seed route", () => {
  it("seeds openable Storage-backed evidence for report proof smoke tests", () => {
    expect(source).toContain("EVIDENCE_BUCKET_ID");
    expect(source).toContain("buildEvidenceStoragePath");
    expect(source).toContain("getEvidenceStorageUri");
    expect(source).toContain("DEV_EVIDENCE_PNG");
    expect(source).toContain("supabase.storage");
    expect(source).toContain(".from(EVIDENCE_BUCKET_ID)");
    expect(source).toContain(".upload(");
    expect(source).toContain(".delete()");
    expect(source).not.toContain(".upsert(performanceRows");
    expect(source).toContain("content_performance_evidence");
    expect(source).toContain("performance_id");
    expect(source).toContain("uploaded_by: member.creator_id");
    expect(source).toContain('verification_status: "verified"');
    expect(source).toContain("screenshot_url: evidence.storageUri");
  });

  it("can seed operations-alert report states for campaign manager smoke tests", () => {
    expect(source).toContain('const scenario = url.searchParams.get("scenario") || "verified";');
    expect(source).toContain('seedScenario === "operations-alerts"');
    expect(source).toContain('task_key: "dev-seeded-missed"');
    expect(source).toContain('status: "missed"');
    expect(source).toContain('status: "needs_revision"');
    expect(source).toContain('? "rejected" : "verified"');
  });

  it("can seed a missing live URL handoff state for brand room smoke tests", () => {
    expect(source).toContain('scenario === "handoff-blockers"');
    expect(source).toContain('seedScenario === "handoff-blockers"');
    expect(source).toContain('status: "approved"');
    expect(source).toContain('status: "pending"');
    expect(source).toContain("published_url: null");
    expect(source).toContain("published_at: null");
    expect(source).toContain("handoffPerformanceRows");
  });

  it("resets stale handoff report tasks so creator proof smoke tests use one active task", () => {
    expect(source).toContain("staleReportTaskIds");
    expect(source).toContain(".neq(\"id\", reportTaskId)");
    expect(source).toContain("stalePerformanceIds");
    expect(source).toContain("content_performance_metric_values");
    expect(source).toContain("staleReportTaskDeleteError");
  });

  it("can seed a campaign agreement gate for smoke testing", () => {
    expect(source).toContain('scenario === "agreement-gate"');
    expect(source).toContain("campaign_agreements");
    expect(source).toContain("campaign_agreement_acceptances");
    expect(source).toContain("content_hash");
  });
});
