import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const adminActionSource = readFileSync(
  new URL("./admin.ts", import.meta.url),
  "utf8",
);

const adminSettingsSource = readFileSync(
  new URL("../(site)/(app)/admin/settings/page.tsx", import.meta.url),
  "utf8",
);

function getActionSource(name: string) {
  const start = adminActionSource.indexOf(`export async function ${name}`);
  expect(start).toBeGreaterThanOrEqual(0);

  const next = adminActionSource.indexOf(
    "export async function",
    start + 1,
  );

  return adminActionSource.slice(start, next === -1 ? undefined : next);
}

describe("admin data rights operations", () => {
  it("lets admins move data-rights requests through review states", () => {
    const source = getActionSource("updateDataRightsRequestStatus");

    expect(source).toContain(".from(\"data_rights_requests\")");
    expect(source).toContain("dataRightsRequestStatusSchema");
    expect(source).toContain("validReason");
    expect(source).toContain("Admin denial reason:");
    expect(source).toContain("privacy_request_denied");
    expect(source).toContain(".from(\"notification_queue\")");
    expect(source).toContain("reviewed_by");
    expect(source).toContain("completed_at");
    expect(source).toContain("reason: validReason");
    expect(source).toContain(
      "Deletion requests are completed by the automated retention processor",
    );
  });

  it("surfaces the queue in admin settings without making scheduled deletion manual work", () => {
    expect(adminSettingsSource).toContain("data_rights_requests");
    expect(adminSettingsSource).toContain("Privacy Requests");
    expect(adminSettingsSource).toContain("Export and deletion requests stay automatic when possible.");
    expect(adminSettingsSource).not.toContain("Data Rights Requests");
    expect(adminSettingsSource).toContain("updateDataRightsRequestStatus");
    expect(adminSettingsSource).toContain("handleDataRightsStatus");
    expect(adminSettingsSource).toContain("canAdminActOnPrivacyRequest");
    expect(adminSettingsSource).toContain("Self-serve queue");
    expect(adminSettingsSource).toContain("Review exception");
    expect(adminSettingsSource).toContain("Mark resolved");
    expect(adminSettingsSource).toContain("Deny with reason");
    expect(adminSettingsSource).toContain("Confirm denial");
    expect(adminSettingsSource).toContain('data-testid="admin-data-rights-deny-reason"');
    expect(adminSettingsSource).not.toContain("Cancel request");
    expect(adminSettingsSource).toContain("fetchDataRightsAuditLinks");
    expect(adminSettingsSource).toContain("admin_audit_log");
    expect(adminSettingsSource).toContain('data-testid="admin-data-rights-audit-link"');
    expect(adminSettingsSource).toContain("/admin/audit?entry=${auditId}#audit-entry-${auditId}");
    expect(adminSettingsSource).toContain("scheduled_for");
    expect(adminSettingsSource).toContain("Automatic deletion");
    expect(adminSettingsSource).toContain("request.request_type === \"deletion\"");
    expect(adminSettingsSource).toContain("request.status === \"scheduled\"");
    expect(adminSettingsSource).not.toContain(">Reviewing<");
    expect(adminSettingsSource).not.toContain(">Reject<");
    expect(adminSettingsSource).not.toContain(">Complete<");
  });

  it("writes platform setting audit rows with a UUID target and checked errors", () => {
    const source = getActionSource("updatePlatformSetting");

    expect(source).toContain("target_type: \"platform_setting\"");
    expect(source).toContain("target_id: user.id");
    expect(source).toContain("const { error: auditError }");
    expect(source).toContain("if (auditError) throw new Error(auditError.message)");
    expect(source).toContain("metadata: { key: validKey, value: serializedValue }");
    expect(source).not.toContain("target_id: validKey");
  });
});
