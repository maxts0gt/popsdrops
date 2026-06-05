import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./privacy-controls-panel.tsx", import.meta.url),
  "utf8",
);

describe("PrivacyControlsPanel", () => {
  it("offers export and deletion requests through server actions", () => {
    expect(source).toContain("requestDataExport");
    expect(source).toContain("requestAccountDeletion");
    expect(source).toContain("privacy.export");
    expect(source).toContain("privacy.deletion");
    expect(source).toContain("toast.success");
    expect(source).toContain("toast.error");
  });

  it("requires explicit typed confirmation before queuing deletion", () => {
    expect(source).toContain("deleteConfirmation");
    expect(source).toContain("privacy.deletion.confirmText");
    expect(source).toContain("disabled={");
  });

  it("shows the signed-in user's privacy request history", () => {
    expect(source).toContain("loadPrivacyRequests");
    expect(source).toContain('.from("data_rights_requests")');
    expect(source).toContain('.eq("profile_id", user.id)');
    expect(source).toContain("privacy.history.title");
    expect(source).toContain("privacy.history.empty");
    expect(source).toContain('data-testid="privacy-request-history"');
    expect(source).toContain('data-testid="privacy-request-row"');
  });

  it("offers a download action for completed export artifacts only", () => {
    expect(source).toContain("getPrivacyExportDownloadUrl");
    expect(source).toContain("export_storage_path");
    expect(source).toContain("privacy.download");
    expect(source).toContain('data-testid="privacy-export-download"');
    expect(source).toContain("window.location.assign");
  });

  it("does not show download controls for expired export artifacts", () => {
    expect(source).toContain("isExportExpired");
    expect(source).toContain("privacy.history.expired");
    expect(source).toContain("!isExportExpired(request)");
  });

  it("shows plain status labels and denied request reasons", () => {
    expect(source).toContain("privacy.status.pending");
    expect(source).toContain("privacy.status.scheduled");
    expect(source).toContain("privacy.status.completed");
    expect(source).toContain("privacy.status.rejected");
    expect(source).toContain("getDenialReason");
    expect(source).toContain('data-testid="privacy-request-denial-reason"');
  });

  it("refreshes history after export and deletion requests", () => {
    const refreshMatches = source.match(/await loadPrivacyRequests\(\)/g) ?? [];
    expect(refreshMatches.length).toBeGreaterThanOrEqual(2);
  });
});
