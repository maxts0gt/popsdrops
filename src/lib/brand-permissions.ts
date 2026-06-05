import type { BrandTeamRole } from "@/types/database";

export type BrandWorkspacePermission =
  | "view_campaigns"
  | "create_campaigns"
  | "manage_campaigns"
  | "review_content"
  | "share_reports"
  | "manage_team"
  | "manage_billing"
  | "manage_profile";

export const brandWorkspacePermissions: Record<
  BrandTeamRole,
  BrandWorkspacePermission[]
> = {
  owner: [
    "view_campaigns",
    "create_campaigns",
    "manage_campaigns",
    "review_content",
    "share_reports",
    "manage_team",
    "manage_billing",
    "manage_profile",
  ],
  admin: [
    "view_campaigns",
    "create_campaigns",
    "manage_campaigns",
    "review_content",
    "share_reports",
    "manage_team",
    "manage_profile",
  ],
  manager: [
    "view_campaigns",
    "create_campaigns",
    "manage_campaigns",
    "review_content",
    "share_reports",
  ],
  viewer: ["view_campaigns"],
};

export function hasBrandWorkspacePermission(
  role: BrandTeamRole | null | undefined,
  permission: BrandWorkspacePermission,
): boolean {
  if (!role) return false;
  return brandWorkspacePermissions[role]?.includes(permission) ?? false;
}
