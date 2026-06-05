import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const adminActionsSource = readFileSync(
  fileURLToPath(new URL("./admin.ts", import.meta.url)),
  "utf8",
);

const adminApprovalsPageSource = readFileSync(
  fileURLToPath(
    new URL("../(site)/(app)/admin/approvals/page.tsx", import.meta.url),
  ),
  "utf8",
);

describe("admin waitlist access loop", () => {
  it("turns an approved waitlist request into an approved user without onboarding", () => {
    expect(adminActionsSource).toContain(
      "export async function approveWaitlistRequest",
    );
    expect(adminActionsSource).toContain("createAdminClient()");
    expect(adminActionsSource).toContain("auth.admin.createUser");
    expect(adminActionsSource).toContain('status: "approved"');
    expect(adminActionsSource).toContain("onboarding_completed: true");
    expect(adminActionsSource).toContain('.from("brand_profiles")');
    expect(adminActionsSource).toContain('.from("creator_profiles")');
    expect(adminActionsSource).toContain('action: "approve_waitlist_request"');
    expect(adminActionsSource).toContain('revalidatePath("/admin/approvals")');
    expect(adminActionsSource).not.toContain('redirect("/onboarding');
  });

  it("lets admins reject waitlist requests with a recorded reason", () => {
    const waitlistRejectSource = adminActionsSource.slice(
      adminActionsSource.indexOf("export async function rejectWaitlistRequest"),
      adminActionsSource.indexOf("// ---------------------------------------------------------------------------\n// Profile actions"),
    );

    expect(adminActionsSource).toContain(
      "export async function rejectWaitlistRequest",
    );
    expect(waitlistRejectSource).toContain('status: "rejected"');
    expect(waitlistRejectSource).toContain("rejection_reason: validReason");
    expect(waitlistRejectSource).toContain('.from("notification_queue")');
    expect(waitlistRejectSource).toContain("email: request.email");
    expect(waitlistRejectSource).toContain('template: "account_rejected"');
    expect(waitlistRejectSource).toContain("body: validReason");
    expect(waitlistRejectSource).toContain("target_email: request.email");
    expect(waitlistRejectSource).toContain('action: "reject_waitlist_request"');
    expect(waitlistRejectSource).toContain('revalidatePath("/admin/approvals")');
  });

  it("records the approving admin and timestamp for profile approvals", () => {
    const profileApprovalSource = adminActionsSource.slice(
      adminActionsSource.indexOf("export async function approveProfile"),
      adminActionsSource.indexOf("export async function rejectProfile"),
    );

    expect(profileApprovalSource).toContain("const now = new Date().toISOString()");
    expect(profileApprovalSource).toContain("approved_at: now");
    expect(profileApprovalSource).toContain("approved_by: user.id");
  });

  it("shows pending access requests in the admin approval queue", () => {
    expect(adminApprovalsPageSource).toContain(
      "approveWaitlistRequest,",
    );
    expect(adminApprovalsPageSource).toContain(
      "rejectWaitlistRequest,",
    );
    expect(adminApprovalsPageSource).toContain(
      "fetchPendingAccessRequests",
    );
    expect(adminApprovalsPageSource).toContain("AccessRequestList");
    expect(adminApprovalsPageSource).toContain("Access requests");
  });

  it("renders admin approvals as sortable operational tables", () => {
    expect(adminApprovalsPageSource).toContain(
      'data-testid="admin-access-requests-table"',
    );
    expect(adminApprovalsPageSource).toContain(
      'data-testid="admin-profile-approvals-table"',
    );
    expect(adminApprovalsPageSource).toContain("aria-sort");
    expect(adminApprovalsPageSource).toContain("function toggleSort");
    expect(adminApprovalsPageSource).toContain(
      'data-testid="admin-access-row-actions"',
    );
    expect(adminApprovalsPageSource).toContain(
      'data-testid="admin-profile-row-actions"',
    );
  });
});
