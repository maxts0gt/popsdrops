export const DEV_LOGIN_ROLES = ["creator", "brand", "admin"] as const;
export const DEV_BRAND_TEAM_ROLES = ["owner", "admin", "manager", "viewer"] as const;

export type DevLoginRole = (typeof DEV_LOGIN_ROLES)[number];
export type DevBrandTeamRole = (typeof DEV_BRAND_TEAM_ROLES)[number];

export function getDevLoginRole(role: string | null | undefined): DevLoginRole {
  return DEV_LOGIN_ROLES.includes(role as DevLoginRole)
    ? (role as DevLoginRole)
    : "creator";
}

export function getDevUserEmail(role: string | null | undefined): string {
  return `${getDevLoginRole(role)}@dev.popsdrops.com`;
}

export function getDevBrandTeamRole(
  role: string | null | undefined,
): DevBrandTeamRole {
  return DEV_BRAND_TEAM_ROLES.includes(role as DevBrandTeamRole)
    ? (role as DevBrandTeamRole)
    : "owner";
}

export function getDevBrandTeamEmail(
  role: string | null | undefined,
): string {
  const safeRole = getDevBrandTeamRole(role);
  if (safeRole === "owner") return getDevUserEmail("brand");
  return `brand-${safeRole}@dev.popsdrops.com`;
}

export function getDevBrandTeamDisplayName(
  role: string | null | undefined,
): string {
  const safeRole = getDevBrandTeamRole(role);
  return `Dev Brand ${safeRole.charAt(0).toUpperCase()}${safeRole.slice(1)}`;
}

export function getDevBrandCompanyName(): string {
  return process.env.SMOKE_BRAND_COMPANY_NAME?.trim() || "Dev Brand Co.";
}

export function getDevDisplayName(role: string | null | undefined): string {
  const safeRole = getDevLoginRole(role);
  if (safeRole === "creator") {
    return process.env.SMOKE_CREATOR_DISPLAY_NAME?.trim() || "Dev Creator";
  }
  return `Dev ${safeRole.charAt(0).toUpperCase()}${safeRole.slice(1)}`;
}

export function getDevCreatorSlug(userId: string): string {
  return `dev-creator-${userId.slice(0, 8)}`;
}

export function getDevLoginRedirectOrigin({
  requestUrl,
  host,
  forwardedProto,
}: {
  requestUrl: string;
  host: string | null | undefined;
  forwardedProto?: string | null | undefined;
}): string {
  const url = new URL(requestUrl);
  const safeHost = host?.trim();
  if (!safeHost) {
    return url.origin;
  }

  const protocol = forwardedProto?.split(",")[0]?.trim() || url.protocol.replace(":", "");
  return `${protocol}://${safeHost}`;
}
