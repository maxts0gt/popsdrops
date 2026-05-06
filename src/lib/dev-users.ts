export const DEV_LOGIN_ROLES = ["creator", "brand", "admin"] as const;

export type DevLoginRole = (typeof DEV_LOGIN_ROLES)[number];

export function getDevLoginRole(role: string | null | undefined): DevLoginRole {
  return DEV_LOGIN_ROLES.includes(role as DevLoginRole)
    ? (role as DevLoginRole)
    : "creator";
}

export function getDevUserEmail(role: string | null | undefined): string {
  return `${getDevLoginRole(role)}@dev.popsdrops.com`;
}

export function getDevDisplayName(role: string | null | undefined): string {
  const safeRole = getDevLoginRole(role);
  return `Dev ${safeRole.charAt(0).toUpperCase()}${safeRole.slice(1)}`;
}

export function getDevCreatorSlug(userId: string): string {
  return `dev-creator-${userId.slice(0, 8)}`;
}
