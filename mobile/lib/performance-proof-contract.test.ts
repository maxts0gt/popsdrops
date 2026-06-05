import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const roomScreenSource = readFileSync(
  join(currentDir, "../app/campaign-room/[id].tsx"),
  "utf8",
);
const campaignRoomSource = readFileSync(
  join(currentDir, "./campaign-room.ts"),
  "utf8",
);
const campaignActionsSource = readFileSync(
  join(currentDir, "./campaign-actions.ts"),
  "utf8",
);
const sharedValidationsSource = readFileSync(
  join(currentDir, "../../shared/validations.ts"),
  "utf8",
);

describe("mobile performance proof contract", () => {
  it("keeps report-task metrics evidence-first on native mobile", () => {
    expect(roomScreenSource).toContain("expo-document-picker");
    expect(roomScreenSource).toContain("proofFile");
    expect(roomScreenSource).toContain("room.attachProofFile");
    expect(roomScreenSource).toContain("uploadPerformanceEvidenceFile");
    expect(roomScreenSource).toContain("evidence_id: uploadedEvidence?.id");
    expect(roomScreenSource).toContain("room.proofUrlLabel");
    expect(roomScreenSource).toContain("room.performanceProofRequired");
    expect(roomScreenSource).toContain("room.performanceCorrectionRequested");
    expect(roomScreenSource).toContain("openReportTask.reviewNote");
    expect(roomScreenSource).toContain("!proofFile && !proofUrl.trim()");
    expect(roomScreenSource).toContain("text/comma-separated-values");
    expect(roomScreenSource).toContain("application/vnd.ms-excel");
    expect(roomScreenSource).toContain("min-w-[132px] flex-1");
    expect(roomScreenSource).toContain("mt-4 flex-row flex-wrap gap-2");
    expect(roomScreenSource).toContain(
      "screenshot_url: (uploadedEvidence?.storageUri ?? proofUrl.trim()) || undefined",
    );
    expect(campaignRoomSource).toContain("review_note");
    expect(campaignRoomSource).toContain("reviewNote: task.review_note");
    expect(campaignActionsSource).toContain(
      'onConflict: "performance_id,platform,metric_key"',
    );
    expect(campaignActionsSource).not.toContain(
      'onConflict: "performance_id,metric_key"',
    );
    expect(sharedValidationsSource).toContain("Proof link or evidence file is required");
  });
});
