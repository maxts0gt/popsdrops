import type { MobileStatus } from "./access-policy";

export type CreatorHomeState = "setup" | "workspace" | "blocked";

export function decideCreatorHomeState(
  status: MobileStatus,
): CreatorHomeState {
  if (status === "approved") {
    return "workspace";
  }

  if (status === "rejected" || status === "suspended") {
    return "blocked";
  }

  return "setup";
}
