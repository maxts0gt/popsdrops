type AuditDisplayEntry = {
  action?: string;
  target_id?: string;
  metadata: Record<string, unknown> | null;
};

function getMetadataString(
  metadata: Record<string, unknown> | null,
  key: string,
) {
  const value = metadata?.[key];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function formatRole(role: string | null) {
  if (!role) return null;

  return formatWords(role);
}

function formatWords(value: string | null) {
  if (!value) return null;

  return value
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function getAdminAuditTargetLabel(entry: AuditDisplayEntry) {
  return (
    getMetadataString(entry.metadata, "target_email") ??
    getMetadataString(entry.metadata, "target_name") ??
    getMetadataString(entry.metadata, "creator_name") ??
    getMetadataString(entry.metadata, "target_user_id") ??
    entry.target_id ??
    "Unknown"
  );
}

export function getAdminAuditDetailsLabel(entry: AuditDisplayEntry) {
  const reason = getMetadataString(entry.metadata, "reason");
  if (reason) return reason;

  const targetRole = formatRole(
    getMetadataString(entry.metadata, "target_role"),
  );
  const previousRole = formatRole(
    getMetadataString(entry.metadata, "previous_role"),
  );

  if (
    entry.action === "brand_team_member_role_updated" &&
    previousRole &&
    targetRole
  ) {
    return `${previousRole} to ${targetRole}`;
  }

  if (
    entry.action?.startsWith("brand_team_") &&
    targetRole
  ) {
    return `Role: ${targetRole}`;
  }

  if (entry.action === "creator_payment_status_updated") {
    const previousStatus = formatWords(
      getMetadataString(entry.metadata, "previous_status"),
    );
    const newStatus = formatWords(getMetadataString(entry.metadata, "new_status"));
    const campaignTitle = getMetadataString(entry.metadata, "campaign_title");

    if (previousStatus && newStatus && campaignTitle) {
      return `${previousStatus} to ${newStatus} for ${campaignTitle}`;
    }

    if (previousStatus && newStatus) {
      return `${previousStatus} to ${newStatus}`;
    }
  }

  return "";
}
