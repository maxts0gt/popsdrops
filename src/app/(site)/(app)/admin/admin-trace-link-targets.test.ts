import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("admin trace-link targets", () => {
  it("lands audit trace links on the exact audit row", () => {
    const source = read("./audit/page.tsx");
    const adminActions = read("../../../actions/admin.ts");

    expect(source).toContain("useSearchParams");
    expect(source).toContain("highlightedAuditEntryId");
    expect(source).toContain("fetchAdminAuditEntries");
    expect(source).not.toContain(".from(\"admin_audit_log\")");
    expect(adminActions).toContain("export async function fetchAdminAuditEntries");
    expect(adminActions).toContain("createAdminClient()");
    expect(adminActions).toContain("requireAdmin()");
    expect(source).toContain('data-testid={`admin-audit-row-${entry.id}`}');
    expect(source).toContain('id={`audit-entry-${entry.id}`}');
    expect(source).toContain('aria-current={isHighlighted ? "true" : undefined}');
    expect(source).toContain("scrollIntoView");
  });

  it("lands notification queue trace links on the exact delivery row", () => {
    const source = read("./communications/page.tsx");

    expect(source).toContain("highlightedQueueId");
    expect(source).toContain("fetchHighlightedQueueRow");
    expect(source).toContain("visibleDeliveryRows");
    expect(source).toContain('id={`notification-queue-${row.id}`}');
    expect(source).toContain("data-queue-id={row.id}");
    expect(source).toContain('aria-current={isHighlighted ? "true" : undefined}');
    expect(source).toContain("highlightedNotificationQueueRowClassName");
  });

  it("lands data-rights trace links on the exact privacy request", () => {
    const source = read("./settings/page.tsx");

    expect(source).toContain("useSearchParams");
    expect(source).toContain("highlightedDataRightsRequestId");
    expect(source).toContain("dataRightsRequestSelectColumns");
    expect(source).toContain('data-testid={`admin-data-rights-row-${request.id}`}');
    expect(source).toContain('id={`data-rights-request-${request.id}`}');
    expect(source).toContain('aria-current={isHighlighted ? "true" : undefined}');
    expect(source).toContain("scrollIntoView");
  });

  it("uses row anchors from the user detail trace links", () => {
    const source = read("./users/page.tsx");

    expect(source).toContain("#audit-entry-${entry.id}");
    expect(source).toContain("#notification-queue-${item.id}");
    expect(source).toContain("#data-rights-request-${request.id}");
  });

  it("uses human operator labels for admin audit actions", () => {
    const usersSource = read("./users/page.tsx");
    const auditSource = read("./audit/page.tsx");
    const campaignDetailSource = read("./campaigns/[id]/page.tsx");

    expect(usersSource).toContain("getAdminAuditActionLabel(entry.action)");
    expect(usersSource).not.toContain("titleize(entry.action)");

    expect(auditSource).toContain("@/lib/admin/audit-action-labels");
    expect(auditSource).toContain("@/lib/admin/audit-entry-display");
    expect(auditSource).toContain("getAdminAuditActionLabel(e.action)");
    expect(auditSource).toContain("getAdminAuditActionLabel(entry.action)");
    expect(auditSource).toContain("getAdminAuditTargetLabel(entry)");
    expect(auditSource).toContain("getAdminAuditDetailsLabel(entry)");
    expect(auditSource).not.toContain("ACTION_LABELS");

    expect(campaignDetailSource).toContain("getAdminAuditActionLabel(entry.action)");
    expect(campaignDetailSource).not.toContain("labelFromValue(entry.action)");
  });

  it("lets admins filter audit entries to brand team access history", () => {
    const auditSource = read("./audit/page.tsx");
    const adminActions = read("../../../actions/admin.ts");

    expect(auditSource).toContain(
      'type AuditActionFilter = "all" | "approvals" | "suspensions" | "campaigns" | "team";',
    );
    expect(auditSource).toContain('<SelectItem value="team">Team Access</SelectItem>');
    expect(adminActions).toContain(
      "brand_team_invitation_created",
    );
    expect(adminActions).toContain(
      "brand_team_member_role_updated",
    );
    expect(adminActions).toContain(
      "brand_team_member_removed",
    );
  });
});
