import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const callbackSource = readFileSync(new URL("./route.ts", import.meta.url), "utf8");

describe("auth callback closed launch contract", () => {
  it("sends authenticated users without profiles to pending access instead of onboarding", () => {
    expect(callbackSource).toContain("New user - closed launch access is pending");
    expect(callbackSource).toContain('`${origin}/pending-approval`');
    expect(callbackSource).not.toContain('`${origin}/onboarding`');
  });

  it("keeps privacy-deleted accounts out of role home redirects", () => {
    expect(callbackSource).toContain('profile.status === "suspended"');
    expect(callbackSource).toContain('`${origin}/account-deleted`');
  });
});
