import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(
  fileURLToPath(new URL("./page.tsx", import.meta.url)),
  "utf8",
);

describe("/admin/communications queue health", () => {
  it("keeps delivery health inside the existing communications admin page", () => {
    expect(pageSource).toContain("Queue health");
    expect(pageSource).toContain("notification_queue");
    expect(pageSource).toContain("Failed deliveries");
    expect(pageSource).toContain("sendOrRetryNotificationEmail");
  });

  it("keeps queue recovery manual and sortable", () => {
    expect(pageSource).toContain("QueueSortableHead");
    expect(pageSource).toContain("getNotificationQueueRecoveryLabel");
    expect(pageSource).toContain('data-testid="notification-queue-sort-header"');
    expect(pageSource).toContain('data-testid="admin-delivery-recovery-action"');
    expect(pageSource).not.toContain("cron");
    expect(pageSource).not.toContain("token refresh");
  });

  it("shows a recent delivery log tied to notification queue state", () => {
    expect(pageSource).toContain("Delivery log");
    expect(pageSource).toContain("fetchRecentDeliveryRows");
    expect(pageSource).toContain("fetchQueueAuditLinks");
    expect(pageSource).toContain("admin_audit_log");
    expect(pageSource).toContain("formatNotificationDeliveryReason");
    expect(pageSource).toContain("getNotificationQueueCampaignContext");
    expect(pageSource).toContain('row.status === "failed"');
    expect(pageSource).toContain('row.status === "pending"');
    expect(pageSource).toContain('data-testid="admin-delivery-log-row"');
    expect(pageSource).toContain('data-testid="admin-delivery-audit-link"');
    expect(pageSource).toContain("/admin/audit?entry=${auditId}#audit-entry-${auditId}");
    expect(pageSource).toContain("processed_reason");
    expect(pageSource).toContain("delivered_at");
  });

  it("puts admin attention before the delivery tables", () => {
    expect(pageSource).toContain("Needs attention");
    expect(pageSource).toContain("buildNotificationQueueAttentionItems");
    expect(pageSource).toContain("fetchActiveQueueStatusCounts");
    expect(pageSource).toContain("activeQueueCounts");
    expect(pageSource).toContain('data-testid="admin-communications-attention"');
    expect(pageSource).toContain('id="recent-notifications"');
  });
});
