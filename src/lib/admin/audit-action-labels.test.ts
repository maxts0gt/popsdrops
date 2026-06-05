import { describe, expect, it } from "vitest";

import { getAdminAuditActionLabel } from "./audit-action-labels";

describe("admin audit action labels", () => {
  it("uses operator intent instead of database action names", () => {
    expect(getAdminAuditActionLabel("suspend_user")).toBe("Suspend access");
    expect(getAdminAuditActionLabel("unsuspend_user")).toBe("Restore access");
    expect(getAdminAuditActionLabel("re_review_profile")).toBe("Send to review");
    expect(getAdminAuditActionLabel("approve_waitlist_request")).toBe("Approve access");
    expect(getAdminAuditActionLabel("reject_waitlist_request")).toBe("Reject access");
    expect(getAdminAuditActionLabel("send_notification_email")).toBe("Send email");
    expect(getAdminAuditActionLabel("retry_notification_email")).toBe("Retry email");
    expect(getAdminAuditActionLabel("update_data_rights_request_status")).toBe(
      "Update privacy request",
    );
    expect(getAdminAuditActionLabel("creator_payment_status_updated")).toBe(
      "Track creator payment",
    );
  });

  it("labels brand team access changes as operator actions", () => {
    expect(getAdminAuditActionLabel("brand_team_invitation_created")).toBe(
      "Invite teammate",
    );
    expect(getAdminAuditActionLabel("brand_team_invitation_revoked")).toBe(
      "Revoke invite",
    );
    expect(getAdminAuditActionLabel("brand_team_invitation_accepted")).toBe(
      "Accept invite",
    );
    expect(getAdminAuditActionLabel("brand_team_member_role_updated")).toBe(
      "Change team role",
    );
    expect(getAdminAuditActionLabel("brand_team_member_removed")).toBe(
      "Remove teammate",
    );
  });

  it("falls back to readable sentence case for new audit actions", () => {
    expect(getAdminAuditActionLabel("custom_admin_action")).toBe(
      "Custom admin action",
    );
  });
});
