import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  fileURLToPath(new URL("./campaigns.ts", import.meta.url)),
  "utf8",
);
const lifecycleSource = readFileSync(
  fileURLToPath(new URL("../../lib/campaigns/lifecycle.ts", import.meta.url)),
  "utf8",
);

describe("campaign creator invite import action", () => {
  it("saves imported creator contacts as manual audit rows before queueing unlocked email invites", () => {
    expect(source).toContain("export async function importCampaignCreatorInvites");
    expect(source).toContain("campaignCreatorInviteImportSchema.safeParse(input)");
    expect(source).toContain("assertBrandWorkspacePermission(");
    expect(source).toContain('"manage_campaigns"');
    expect(source).toContain("assertCampaignAllowsCreatorInviteManagement(campaign);");
    expect(source).toContain("assertCampaignAllowsCreatorInviteSending(campaign);");
    expect(source).toContain("parseCreatorInviteImport({");
    expect(source).toContain('.from("campaign_creator_invites")');
    expect(source).toContain('.select("normalized_contact, status")');
    expect(source).toContain("existingContacts");
    expect(source).toContain("reservedContacts");
    expect(source).toContain('invite.status !== "sent"');
    expect(source).toContain('status: "manual"');
    expect(source).not.toContain(
      'status: row.type === "email" && canSendCreatorInvites ? "queued" : "manual"',
    );
    expect(source).toContain('.from("notification_queue")');
    expect(source).toContain('template: "campaign_update"');
    expect(source).toContain("dispatchNotificationEmailByQueueId");
    expect(source).toContain("shouldDispatchCampaignInviteEmail");
    expect(source).toContain("POPSDROPS_SMOKE_QUEUE_ONLY");
    expect(source).toContain("process.env.NODE_ENV === \"production\"");
    expect(source).toContain('status: "queued"');
    expect(source).toContain("queued_email_id: queueItem?.id ?? null");
    expect(source).toContain("invited_at: queuedAt");
    expect(source).toContain('revalidatePath(`/b/campaigns/${parsed.data.campaignId}`)');
  });

  it("lets managers send or remove saved invite contacts without creating a CRM", () => {
    expect(source).toContain("export async function sendCampaignCreatorInvite");
    expect(source).toContain("export async function removeCampaignCreatorInvite");
    expect(source).toContain("campaignCreatorInviteMutationSchema.safeParse(input)");
    expect(source).toContain(".select(\"id, brand_id, status, application_deadline\")");
    expect(source).toContain("assertCampaignAllowsCreatorInviteManagement(campaign);");
    expect(source).toContain(".eq(\"campaign_id\", parsed.data.campaignId)");
    expect(source).toContain(".eq(\"id\", parsed.data.inviteId)");
    expect(source).toContain('invite.contact_type !== "email"');
    expect(source).toContain("canSendCreatorInvites");
    expect(source).toContain('throw new Error("Invite link is locked.")');
    expect(source).toContain('.from("notification_queue")');
    expect(source).toContain('template: "campaign_update"');
    expect(source).toContain('status: "queued"');
    expect(source).toContain('if (invite.status === "sent")');
    expect(source).toContain(
      'throw new Error("This creator has already used this invite.")',
    );
    expect(source).toContain('status: "archived"');
    expect(source).toContain('processed_reason: "campaign_invite_removed"');
    expect(source).toContain(".delete()");
    expect(source).toContain('revalidatePath(`/b/campaigns/${parsed.data.campaignId}`)');
  });

  it("blocks late creator outreach after recruiting closes", () => {
    expect(source).toContain("assertCampaignAllowsCreatorInviteManagement");
    expect(source).toContain("assertCampaignAllowsCreatorInviteSending");
    expect(lifecycleSource).toContain(
      'const preWorkEditableStatuses = new Set(["draft", "recruiting"])',
    );
    expect(lifecycleSource).toContain('campaign.status === "recruiting"');
    expect(lifecycleSource).toContain(
      "isCampaignApplicationDeadlinePassed(\n      getApplicationDeadline(campaign)",
    );
    expect(lifecycleSource).toContain(
      'throw new Error("Creator invites can only be managed before launch or while recruiting.")',
    );
    expect(lifecycleSource).toContain(
      'throw new Error("Creator invites can only be sent while the campaign is recruiting.")',
    );
    expect(lifecycleSource).toContain(
      'throw new Error("The application deadline has already passed.")',
    );
  });

  it("uses paid creator capacity for invite imports, not unpaid requested scope", () => {
    const importSource = source.slice(
      source.indexOf("export async function importCampaignCreatorInvites"),
      source.indexOf("export async function sendCampaignCreatorInvite"),
    );

    expect(importSource).toContain("campaign_payment_events");
    expect(importSource).toContain("getCampaignPaidCreatorCapacity({");
    expect(importSource).toContain("paymentEvents: paymentEvents ?? []");
    expect(importSource).toContain("serviceFeeCents: campaign.service_fee_cents");
    expect(importSource).toContain("reservedContacts");
    expect(importSource).not.toContain('"estimatedMaxCreators"');
  });

  it("rechecks paid creator capacity before sending a saved invite", () => {
    const sendSource = source.slice(
      source.indexOf("export async function sendCampaignCreatorInvite"),
      source.indexOf("export async function removeCampaignCreatorInvite"),
    );

    expect(source).toContain("assertCampaignCreatorInviteSendCapacity");
    expect(sendSource).toContain("campaign_payment_events");
    expect(sendSource).toContain("getCampaignPaidCreatorCapacity({");
    expect(sendSource).toContain("assertCampaignCreatorInviteSendCapacity({");
    expect(sendSource).toContain("invite.normalized_contact");
    expect(sendSource).toContain("savedInvites");
  });

  it("keeps campaign invite emails queue-only by default outside production", () => {
    expect(source).toContain("function shouldDispatchCampaignInviteEmail()");
    expect(source).toContain('process.env.POPSDROPS_SMOKE_QUEUE_ONLY === "1"');
    expect(source).toContain('process.env.NODE_ENV !== "production"');
    expect(source).toContain('process.env.POPSDROPS_SEND_DEV_EMAILS !== "1"');
  });
});
