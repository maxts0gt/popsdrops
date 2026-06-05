import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const adminActionsSource = readFileSync(
  fileURLToPath(new URL("./admin.ts", import.meta.url)),
  "utf8",
);

const adminUsersPageSource = readFileSync(
  fileURLToPath(
    new URL("../(site)/(app)/admin/users/page.tsx", import.meta.url),
  ),
  "utf8",
);

describe("admin user lifecycle controls", () => {
  it("requires a visible admin reason before suspending a user", () => {
    expect(adminUsersPageSource).toContain("suspendTarget");
    expect(adminUsersPageSource).toContain("suspendReason.trim()");
    expect(adminUsersPageSource).toContain("Suspend access");
    expect(adminUsersPageSource).not.toContain("Suspended by admin");
  });

  it("keeps admin lifecycle actions from locking the platform owner out", () => {
    const suspendSource = adminActionsSource.slice(
      adminActionsSource.indexOf("export async function suspendUser"),
      adminActionsSource.indexOf("export async function unsuspendUser"),
    );

    expect(suspendSource).toContain("validId === user.id");
    expect(suspendSource).toContain("You cannot suspend your own admin account");
    expect(suspendSource).toContain('.eq("role", "admin")');
    expect(suspendSource).toContain('.eq("status", "approved")');
    expect(suspendSource).toContain("At least one approved admin must remain");
    expect(suspendSource).toContain("previous_status");
    expect(suspendSource).toContain("new_status");
  });

  it("keeps re-review scoped to brand and creator profiles", () => {
    const reReviewSource = adminActionsSource.slice(
      adminActionsSource.indexOf("export async function reReviewProfile"),
      adminActionsSource.indexOf("// ---------------------------------------------------------------------------\n// Campaign actions"),
    );

    expect(adminActionsSource).toContain('role: "creator" | "brand" | "admin"');
    expect(reReviewSource).toContain('if (profile.role === "admin")');
    expect(reReviewSource).toContain("Admin profiles do not use profile re-review");
  });

  it("leaves email evidence for restore and re-review account actions", () => {
    const restoreSource = adminActionsSource.slice(
      adminActionsSource.indexOf("export async function unsuspendUser"),
      adminActionsSource.indexOf("export async function reReviewProfile"),
    );
    const reReviewSource = adminActionsSource.slice(
      adminActionsSource.indexOf("export async function reReviewProfile"),
      adminActionsSource.indexOf("// ---------------------------------------------------------------------------\n// Campaign actions"),
    );

    expect(restoreSource).toContain("createPrivilegedNotification");
    expect(restoreSource).toContain('type: "account_restored"');
    expect(restoreSource).toContain("Access restored");
    expect(reReviewSource).toContain("createPrivilegedNotification");
    expect(reReviewSource).toContain('type: "account_review_reopened"');
    expect(reReviewSource).toContain("Account review reopened");
    expect(reReviewSource).toContain("reason: validReason");
  });

  it("refreshes the open user detail panel after every lifecycle action", () => {
    const suspendHandlerSource = adminUsersPageSource.slice(
      adminUsersPageSource.indexOf("async function handleSuspend"),
      adminUsersPageSource.indexOf("async function handleUnsuspend"),
    );
    const restoreHandlerSource = adminUsersPageSource.slice(
      adminUsersPageSource.indexOf("async function handleUnsuspend"),
      adminUsersPageSource.indexOf("async function handleReReview"),
    );
    const reReviewHandlerSource = adminUsersPageSource.slice(
      adminUsersPageSource.indexOf("async function handleReReview"),
      adminUsersPageSource.indexOf("async function handleExportUsers"),
    );

    expect(suspendHandlerSource).toContain("await loadUserDetail(target.id)");
    expect(restoreHandlerSource).toContain("await loadUserDetail(userId)");
    expect(reReviewHandlerSource).toContain("await loadUserDetail(target.id)");
    expect(reReviewHandlerSource).toContain('status: "pending"');
  });

  it("loads a single admin user detail record with operational history", () => {
    expect(adminActionsSource).toContain(
      "export async function fetchAdminUserDetail",
    );
    expect(adminActionsSource).toContain('.from("admin_audit_log")');
    expect(adminActionsSource).toContain('.from("notifications")');
    expect(adminActionsSource).toContain('.from("notification_queue")');
    expect(adminActionsSource).toContain('.from("data_rights_requests")');
    expect(adminActionsSource).toContain('.from("campaigns")');
    expect(adminActionsSource).toContain('.from("campaign_members")');
    expect(adminActionsSource).toContain('.from("campaign_applications")');
    expect(adminActionsSource).toContain("return {");
    expect(adminActionsSource).toContain("auditEntries");
    expect(adminActionsSource).toContain("notificationQueue");
    expect(adminActionsSource).toContain("dataRightsRequests");
    expect(adminActionsSource).toContain("relatedCampaigns");
  });

  it("opens user detail from the admin users table without leaving the page", () => {
    expect(adminUsersPageSource).toContain("fetchAdminUserDetail");
    expect(adminUsersPageSource).toContain("selectedUserDetail");
    expect(adminUsersPageSource).toContain('data-testid="admin-user-detail-panel"');
    expect(adminUsersPageSource).toContain("Related campaigns");
    expect(adminUsersPageSource).toContain("Access history");
    expect(adminUsersPageSource).toContain("Emails");
    expect(adminUsersPageSource).toContain("Privacy requests");
    expect(adminUsersPageSource).not.toContain("Data rights");
    expect(adminUsersPageSource).toContain("View user");
    expect(adminUsersPageSource).toContain("Open campaign");
    expect(adminUsersPageSource).toContain("/admin/campaigns/${campaign.id}");
    expect(adminUsersPageSource).toContain("/admin/audit?entry=${entry.id}");
    expect(adminUsersPageSource).toContain("/admin/communications?queue=${item.id}");
    expect(adminUsersPageSource).toContain("/admin/settings?data_rights=${request.id}");
  });
});
