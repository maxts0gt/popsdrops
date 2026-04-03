export type MobileRole = "creator" | "brand" | "admin";

export type MobileStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "suspended"
  | null;

export type MobileAccessInput = {
  loading: boolean;
  hasSession: boolean;
  profileReady: boolean;
  role: MobileRole | null;
  status: MobileStatus;
};

export type MobileAccessDecision =
  | { kind: "loading" }
  | { kind: "redirect"; href: "/(auth)/login" | "/(tabs)/home" }
  | { kind: "blocked"; reason: "unsupported_role" | "account_unavailable" | "invitation_required" };

export function decideMobileAccess(
  input: MobileAccessInput,
): MobileAccessDecision {
  if (input.loading) {
    return { kind: "loading" };
  }

  if (!input.hasSession) {
    return { kind: "redirect", href: "/(auth)/login" };
  }

  if (!input.profileReady) {
    return { kind: "loading" };
  }

  if (!input.role) {
    return { kind: "blocked", reason: "invitation_required" };
  }

  if (input.role !== "creator") {
    return { kind: "blocked", reason: "unsupported_role" };
  }

  if (!input.status) {
    return { kind: "loading" };
  }

  if (input.status === "approved" || input.status === "pending") {
    return { kind: "redirect", href: "/(tabs)/home" };
  }

  return { kind: "blocked", reason: "account_unavailable" };
}
