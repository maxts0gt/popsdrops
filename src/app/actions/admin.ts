"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "./auth";
import { sendNotificationEmail } from "@/lib/email/notify";

type PlatformSettingValue =
  | string
  | number
  | boolean
  | null
  | PlatformSettingValue[]
  | { [key: string]: PlatformSettingValue };

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const idSchema = z.string().uuid();
const reasonSchema = z.string().min(1).max(500).trim();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function requireAdmin() {
  const user = await getUser();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") throw new Error("Admin access required");
  return { user, supabase };
}

// ---------------------------------------------------------------------------
// Profile actions
// ---------------------------------------------------------------------------

export async function approveProfile(profileId: string) {
  const validId = idSchema.parse(profileId);
  const { user, supabase } = await requireAdmin();

  const { data: rows, error } = await supabase
    .from("profiles")
    .update({ status: "approved" })
    .eq("id", validId)
    .eq("status", "pending")
    .select("id, email, full_name, role");

  if (error) throw new Error(error.message);
  if (!rows || rows.length === 0)
    throw new Error("Profile is not in pending status");

  const profile = rows[0];

  // Notify user
  await supabase.from("notifications").insert({
    user_id: validId,
    type: "account_approved",
    title: "Account Approved!",
    body: "Your account has been approved. You can now access the platform.",
  });

  // Email user
  if (profile.email) {
    sendNotificationEmail({
      type: "account_approved",
      recipientEmail: profile.email,
      recipientName: profile.full_name ?? "User",
      data: { role: profile.role },
    });
  }

  // Audit log
  await supabase.from("admin_audit_log").insert({
    admin_id: user.id,
    action: "approve_profile",
    target_type: "profile",
    target_id: validId,
    metadata: {
      target_name: profile.full_name,
      target_role: profile.role,
    },
  });

  revalidatePath("/admin/approvals");
}

export async function rejectProfile(profileId: string, reason: string) {
  const validId = idSchema.parse(profileId);
  const validReason = reasonSchema.parse(reason);
  const { user, supabase } = await requireAdmin();

  const { data: rows, error } = await supabase
    .from("profiles")
    .update({ status: "rejected" })
    .eq("id", validId)
    .eq("status", "pending")
    .select("id, email, full_name, role");

  if (error) throw new Error(error.message);
  if (!rows || rows.length === 0)
    throw new Error("Profile is not in pending status");

  const profile = rows[0];

  // Notify user
  await supabase.from("notifications").insert({
    user_id: validId,
    type: "account_rejected",
    title: "Account Update",
    body: validReason,
  });

  // Email user
  if (profile.email) {
    sendNotificationEmail({
      type: "account_rejected",
      recipientEmail: profile.email,
      recipientName: profile.full_name ?? "User",
      data: { reason: validReason, role: profile.role },
    });
  }

  // Audit log
  await supabase.from("admin_audit_log").insert({
    admin_id: user.id,
    action: "reject_profile",
    target_type: "profile",
    target_id: validId,
    metadata: {
      reason: validReason,
      target_name: profile.full_name,
      target_role: profile.role,
    },
  });

  revalidatePath("/admin/approvals");
}

export async function suspendUser(profileId: string, reason: string) {
  const validId = idSchema.parse(profileId);
  const validReason = reasonSchema.parse(reason);
  const { user, supabase } = await requireAdmin();

  const { data: rows, error } = await supabase
    .from("profiles")
    .update({ status: "suspended" })
    .eq("id", validId)
    .eq("status", "approved")
    .select("id, full_name, role");

  if (error) throw new Error(error.message);
  if (!rows || rows.length === 0)
    throw new Error("User is not in approved status");

  const profile = rows[0];

  // Notify suspended user
  await supabase.from("notifications").insert({
    user_id: validId,
    type: "account_rejected" as const,
    title: "Account Suspended",
    body:
      validReason ||
      "Your account has been suspended. Please contact support for more information.",
  });

  // Suspension cascades
  if (profile.role === "creator") {
    // Withdraw pending campaign applications
    await supabase
      .from("campaign_applications")
      .delete()
      .eq("creator_id", validId)
      .eq("status", "pending");

    // Notify brands of active campaigns this creator is in
    const { data: memberships } = await supabase
      .from("campaign_members")
      .select("campaign_id, campaigns(brand_id, title)")
      .eq("creator_id", validId);

    if (memberships && memberships.length > 0) {
      const brandNotifications = memberships
        .filter((m) => m.campaigns)
        .map((m) => {
          const campaign = m.campaigns as unknown as {
            brand_id: string;
            title: string;
          };
          return {
            user_id: campaign.brand_id,
            type: "account_rejected" as const,
            title: "Creator Suspended",
            body: `A creator in "${campaign.title}" has been suspended by admin.`,
            data: { campaign_id: m.campaign_id, creator_id: validId },
          };
        });

      if (brandNotifications.length > 0) {
        await supabase.from("notifications").insert(brandNotifications);
      }
    }
  } else if (profile.role === "brand") {
    // Pause all active campaigns
    const { data: campaigns } = await supabase
      .from("campaigns")
      .update({ status: "paused" })
      .eq("brand_id", validId)
      .not("status", "in", '("draft","completed","cancelled","paused")')
      .select("id, title");

    // Notify all campaign members
    if (campaigns && campaigns.length > 0) {
      for (const campaign of campaigns) {
        const { data: members } = await supabase
          .from("campaign_members")
          .select("creator_id")
          .eq("campaign_id", campaign.id);

        if (members && members.length > 0) {
          await supabase.from("notifications").insert(
            members.map((m) => ({
              user_id: m.creator_id,
              type: "campaign_paused" as const,
              title: "Campaign Paused",
              body: `"${campaign.title}" has been paused because the brand has been suspended.`,
              data: { campaign_id: campaign.id },
            }))
          );
        }
      }
    }
  }

  // Audit log
  await supabase.from("admin_audit_log").insert({
    admin_id: user.id,
    action: "suspend_user",
    target_type: "profile",
    target_id: validId,
    metadata: {
      reason: validReason,
      target_name: profile.full_name,
      target_role: profile.role,
    },
  });

  revalidatePath("/admin/users");
}

export async function unsuspendUser(profileId: string) {
  const validId = idSchema.parse(profileId);
  const { user, supabase } = await requireAdmin();

  const { data: rows, error } = await supabase
    .from("profiles")
    .update({ status: "approved" })
    .eq("id", validId)
    .eq("status", "suspended")
    .select("id, full_name, role");

  if (error) throw new Error(error.message);
  if (!rows || rows.length === 0)
    throw new Error("User is not in suspended status");

  const profile = rows[0];

  // Audit log
  await supabase.from("admin_audit_log").insert({
    admin_id: user.id,
    action: "unsuspend_user",
    target_type: "profile",
    target_id: validId,
    metadata: {
      target_name: profile.full_name,
      target_role: profile.role,
    },
  });

  revalidatePath("/admin/users");
}

export async function reReviewProfile(profileId: string, reason: string) {
  const validId = idSchema.parse(profileId);
  const validReason = reasonSchema.parse(reason);
  const { user, supabase } = await requireAdmin();

  const { data: rows, error } = await supabase
    .from("profiles")
    .update({ status: "pending" })
    .eq("id", validId)
    .in("status", ["approved", "rejected"])
    .select("id, full_name, role");

  if (error) throw new Error(error.message);
  if (!rows || rows.length === 0)
    throw new Error(
      "Profile must be in approved or rejected status to re-review"
    );

  const profile = rows[0];

  // Audit log
  await supabase.from("admin_audit_log").insert({
    admin_id: user.id,
    action: "re_review_profile",
    target_type: "profile",
    target_id: validId,
    metadata: {
      reason: validReason,
      target_name: profile.full_name,
      target_role: profile.role,
    },
  });

  revalidatePath("/admin/users");
}

// ---------------------------------------------------------------------------
// Campaign actions
// ---------------------------------------------------------------------------

export async function pauseCampaign(campaignId: string, reason: string) {
  const validId = idSchema.parse(campaignId);
  const validReason = reasonSchema.parse(reason);
  const { user, supabase } = await requireAdmin();

  const { data: rows, error } = await supabase
    .from("campaigns")
    .update({ status: "paused" })
    .eq("id", validId)
    .not("status", "in", '("draft","completed","cancelled","paused")')
    .select("id, brand_id, title");

  if (error) throw new Error(error.message);
  if (!rows || rows.length === 0)
    throw new Error("Campaign cannot be paused in its current state");

  const campaign = rows[0];

  // Notify brand and all members
  const { data: members } = await supabase
    .from("campaign_members")
    .select("creator_id")
    .eq("campaign_id", validId);

  const recipientIds = [
    campaign.brand_id,
    ...(members?.map((m) => m.creator_id) ?? []),
  ];

  await supabase.from("notifications").insert(
    recipientIds.map((uid) => ({
      user_id: uid,
      type: "campaign_paused" as const,
      title: "Campaign Paused",
      body: `"${campaign.title}" has been paused by admin: ${validReason}`,
      data: { campaign_id: validId },
    }))
  );

  // Audit log
  await supabase.from("admin_audit_log").insert({
    admin_id: user.id,
    action: "pause_campaign",
    target_type: "campaign",
    target_id: validId,
    metadata: {
      reason: validReason,
      target_name: campaign.title,
    },
  });

  revalidatePath("/admin/campaigns");
}

export async function cancelCampaign(campaignId: string, reason: string) {
  const validId = idSchema.parse(campaignId);
  const validReason = reasonSchema.parse(reason);
  const { user, supabase } = await requireAdmin();

  const { data: rows, error } = await supabase
    .from("campaigns")
    .update({ status: "cancelled" })
    .eq("id", validId)
    .not("status", "in", '("draft","completed","cancelled","paused")')
    .select("id, brand_id, title");

  if (error) throw new Error(error.message);
  if (!rows || rows.length === 0)
    throw new Error("Campaign cannot be cancelled in its current state");

  const campaign = rows[0];

  // Notify brand and all members
  const { data: members } = await supabase
    .from("campaign_members")
    .select("creator_id")
    .eq("campaign_id", validId);

  const recipientIds = [
    campaign.brand_id,
    ...(members?.map((m) => m.creator_id) ?? []),
  ];

  await supabase.from("notifications").insert(
    recipientIds.map((uid) => ({
      user_id: uid,
      type: "campaign_cancelled" as const,
      title: "Campaign Cancelled",
      body: `"${campaign.title}" has been cancelled by admin: ${validReason}`,
      data: { campaign_id: validId },
    }))
  );

  // Audit log
  await supabase.from("admin_audit_log").insert({
    admin_id: user.id,
    action: "cancel_campaign",
    target_type: "campaign",
    target_id: validId,
    metadata: {
      reason: validReason,
      target_name: campaign.title,
    },
  });

  revalidatePath("/admin/campaigns");
}

export async function resumeCampaign(campaignId: string) {
  const validId = idSchema.parse(campaignId);
  const { user, supabase } = await requireAdmin();

  const { data: rows, error } = await supabase
    .from("campaigns")
    .update({ status: "in_progress" })
    .eq("id", validId)
    .eq("status", "paused")
    .select("id, brand_id, title");

  if (error) throw new Error(error.message);
  if (!rows || rows.length === 0)
    throw new Error("Campaign is not in paused status");

  const campaign = rows[0];

  // Notify brand and all members
  const { data: members } = await supabase
    .from("campaign_members")
    .select("creator_id")
    .eq("campaign_id", validId);

  const recipientIds = [
    campaign.brand_id,
    ...(members?.map((m) => m.creator_id) ?? []),
  ];

  await supabase.from("notifications").insert(
    recipientIds.map((uid) => ({
      user_id: uid,
      type: "campaign_match" as const,
      title: "Campaign Resumed",
      body: `"${campaign.title}" has been resumed by admin.`,
      data: { campaign_id: validId },
    }))
  );

  // Audit log
  await supabase.from("admin_audit_log").insert({
    admin_id: user.id,
    action: "resume_campaign",
    target_type: "campaign",
    target_id: validId,
    metadata: {
      target_name: campaign.title,
    },
  });

  revalidatePath("/admin/campaigns");
}

// ---------------------------------------------------------------------------
// Campaign deadline (admin override)
// ---------------------------------------------------------------------------

export async function extendContentDeadline(
  campaignId: string,
  newDeadline: string
) {
  const validId = idSchema.parse(campaignId);
  const { user, supabase } = await requireAdmin();

  const date = new Date(newDeadline);
  if (isNaN(date.getTime()) || date < new Date()) {
    throw new Error("Deadline must be a valid future date");
  }

  const { data: rows, error } = await supabase
    .from("campaigns")
    .update({ content_due_date: newDeadline })
    .eq("id", validId)
    .select("id, title, brand_id, content_due_date");

  if (error) throw new Error(error.message);
  if (!rows || rows.length === 0)
    throw new Error("Campaign not found");

  const campaign = rows[0];

  // Notify brand
  await supabase.from("notifications").insert({
    user_id: campaign.brand_id,
    type: "campaign_match" as const,
    title: "Content Deadline Extended",
    body: `The content deadline for "${campaign.title}" has been extended to ${date.toLocaleDateString()} by admin.`,
    data: { campaign_id: validId },
  });

  // Audit log
  await supabase.from("admin_audit_log").insert({
    admin_id: user.id,
    action: "extend_content_deadline",
    target_type: "campaign",
    target_id: validId,
    metadata: {
      target_name: campaign.title,
      new_deadline: newDeadline,
    },
  });

  revalidatePath("/admin/reports");
}

// ---------------------------------------------------------------------------
// Platform settings actions
// ---------------------------------------------------------------------------

export async function updatePlatformSetting(key: string, value: unknown) {
  const validKey = z.string().min(1).max(100).parse(key);
  const { user, supabase } = await requireAdmin();
  const serializedValue =
    value === undefined
      ? null
      : (JSON.parse(JSON.stringify(value)) as PlatformSettingValue);

  const { error } = await supabase.from("platform_settings").upsert({
    key: validKey,
    value: serializedValue,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  });

  if (error) throw new Error(error.message);

  // Audit log
  await supabase.from("admin_audit_log").insert({
    admin_id: user.id,
    action: "update_setting",
    target_type: "setting",
    target_id: validKey,
    metadata: { key: validKey, value: serializedValue },
  });

  revalidatePath("/admin/settings");
}

export async function getPlatformSettings() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase
    .from("platform_settings")
    .select("key, value");
  const settings: Record<string, unknown> = {};
  for (const row of data ?? []) {
    settings[row.key] = row.value;
  }
  return settings;
}
