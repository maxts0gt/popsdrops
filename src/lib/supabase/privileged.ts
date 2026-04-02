import "server-only";

import type { Database } from "@/types/database";
import { createAdminClient } from "./admin";

type CampaignMemberInsert =
  Database["public"]["Tables"]["campaign_members"]["Insert"];
type NotificationInsert =
  Database["public"]["Tables"]["notifications"]["Insert"];

export async function upsertPrivilegedCampaignMember(
  member: CampaignMemberInsert,
) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("campaign_members")
    .upsert(member, { onConflict: "campaign_id,creator_id" });

  if (error) {
    throw new Error(error.message);
  }
}

export async function createPrivilegedNotification(
  notification: NotificationInsert,
) {
  const admin = createAdminClient();
  const { error } = await admin.from("notifications").insert(notification);

  if (error) {
    console.error("Failed to create notification:", error);
  }
}

export async function createPrivilegedNotifications(
  notifications: NotificationInsert[],
) {
  if (notifications.length === 0) return;

  const admin = createAdminClient();
  const { error } = await admin.from("notifications").insert(notifications);

  if (error) {
    console.error("Failed to create notifications:", error);
  }
}
