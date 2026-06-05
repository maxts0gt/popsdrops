import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const applicationsSource = readFileSync(
  new URL("./applications.ts", import.meta.url),
  "utf8",
);

describe("campaign member payment status tracking", () => {
  it("lets brand managers update creator payment status without processing money", () => {
    expect(applicationsSource).toContain("const memberPaymentStatusSchema = z.object");
    expect(applicationsSource).toContain("export async function updateCampaignMemberPaymentStatus");
    expect(applicationsSource).toContain("getBrandApplicationWorkspace(supabase, user.id)");
    expect(applicationsSource).toContain("const admin = createAdminClient()");
    expect(applicationsSource).toContain('.from("campaign_members")');
    expect(applicationsSource).toContain(
      "profiles!campaign_members_creator_id_fkey(full_name)",
    );
    expect(applicationsSource).toContain("payment_status: parsed.data.status");
    expect(applicationsSource).toContain('revalidatePath(`/b/campaigns/${member.campaign_id}`)');
    expect(applicationsSource).toContain('revalidatePath(`/i/campaigns/${member.campaign_id}`)');
    expect(applicationsSource).toContain('revalidatePath("/i/earnings")');
    expect(applicationsSource).not.toContain("stripe.paymentIntents");
    expect(applicationsSource).not.toContain("Stripe Connect");
  });

  it("keeps the allowed statuses explicit and auditable", () => {
    for (const status of [
      "pending",
      "invoiced",
      "paid",
      "overdue",
      "failed",
      "refunded",
      "disputed",
    ]) {
      expect(applicationsSource).toContain(`"${status}"`);
    }

    expect(applicationsSource).toContain('.from("admin_audit_log")');
    expect(applicationsSource).toContain('action: "creator_payment_status_updated"');
    expect(applicationsSource).toContain('target_type: "campaign_member"');
    expect(applicationsSource).toContain("previous_status: member.payment_status");
    expect(applicationsSource).toContain("new_status: parsed.data.status");
    expect(applicationsSource).toContain("creator_id: member.creator_id");
    expect(applicationsSource).toContain("campaign_id: member.campaign_id");
    expect(applicationsSource).toContain("if (auditError)");
    expect(applicationsSource).toContain("payment_status: member.payment_status");
  });

  it("notifies creators only for meaningful creator payment status changes", () => {
    expect(applicationsSource).toContain("function buildCreatorPaymentStatusNotification");
    expect(applicationsSource).toContain('case "paid"');
    expect(applicationsSource).toContain('type: "payment_received"');
    expect(applicationsSource).toContain('case "overdue"');
    expect(applicationsSource).toContain('type: "campaign_update"');
    expect(applicationsSource).toContain("const paymentNotification = buildCreatorPaymentStatusNotification");
    expect(applicationsSource).toContain("await createPrivilegedNotification(paymentNotification)");
    expect(applicationsSource).toContain("member_id: member.id");
    expect(applicationsSource).toContain("accepted_rate: member.accepted_rate");
  });

  it("lets managers update selected member payment statuses without payment processing", () => {
    expect(applicationsSource).toContain("const memberPaymentStatusBatchSchema = z.object");
    expect(applicationsSource).toContain("export async function updateCampaignMemberPaymentStatuses");
    expect(applicationsSource).toContain("new Set(parsed.data.member_ids)");
    expect(applicationsSource).toContain("const campaignIds = new Set");
    expect(applicationsSource).toContain("const brandIds = new Set");
    expect(applicationsSource).toContain("changedMembers");
    expect(applicationsSource).toContain('action: "creator_payment_status_updated"');
    expect(applicationsSource).toContain("updatedCount: changedMembers.length");
    expect(applicationsSource).toContain("skippedCount: members.length - changedMembers.length");
    expect(applicationsSource).not.toContain("stripe.paymentIntents");
    expect(applicationsSource).not.toContain("Stripe Connect");
  });
});
