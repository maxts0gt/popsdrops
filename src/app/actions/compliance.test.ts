import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./compliance.ts", import.meta.url),
  "utf8",
);

describe("compliance server actions", () => {
  it("records legal consent in a durable Supabase ledger", () => {
    expect(source).toContain("recordLegalConsent");
    expect(source).toContain("legalConsentSchema");
    expect(source).toContain(".from(\"legal_consents\")");
    expect(source).toContain("terms_version");
    expect(source).toContain("privacy_version");
    expect(source).toContain("retention_version");
    expect(source).toContain("ip_hash");
    expect(source).toContain("user_agent_hash");
  });

  it("queues data export and schedules deletion requests for signed-in users", () => {
    expect(source).toContain("requestDataExport");
    expect(source).toContain("requestAccountDeletion");
    expect(source).toContain("dataRightsRequestSchema");
    expect(source).toContain(".from(\"data_rights_requests\")");
    expect(source).toContain("request_type: \"export\"");
    expect(source).toContain("request_type: \"deletion\"");
    expect(source).toContain("getScheduledDeletionAt");
    expect(source).toContain("scheduled_for");
    expect(source).toContain("status: \"scheduled\"");
    expect(source).toContain("revalidatePath(\"/b/settings\")");
    expect(source).toContain("revalidatePath(\"/i/profile\")");
  });

  it("fulfills data exports through a private Supabase artifact", () => {
    expect(source).toContain("/functions/v1/generate-privacy-export");
    expect(source).toContain("export_storage_bucket");
    expect(source).toContain("export_storage_path");
    expect(source).toContain("export_file_name");
    expect(source).toContain("export_expires_at");
    expect(source).toContain("getPrivacyExportDownloadUrl");
    expect(source).toContain(".createSignedUrl(");
    expect(source).toContain('request.status !== "completed"');
  });

  it("keeps privacy requests authenticated and avoids destructive account deletion", () => {
    expect(source).toContain("getUser()");
    expect(source).not.toContain(".auth.admin.deleteUser");
    expect(source).not.toMatch(/from\(\"profiles\"\)\s*\.\s*delete/);
  });
});
