import { describe, expect, it } from "vitest";
import { decideMobileAccess, type MobileAccessInput } from "./access-policy";

function makeInput(
  overrides: Partial<MobileAccessInput> = {},
): MobileAccessInput {
  return {
    loading: false,
    hasSession: false,
    profileReady: false,
    role: null,
    status: null,
    ...overrides,
  };
}

describe("decideMobileAccess", () => {
  it("returns loading while auth is still resolving", () => {
    expect(decideMobileAccess(makeInput({ loading: true }))).toEqual({
      kind: "loading",
    });
  });

  it("sends unauthenticated users to login", () => {
    expect(decideMobileAccess(makeInput())).toEqual({
      kind: "redirect",
      href: "/(auth)/login",
    });
  });

  it("stays loading while an authenticated session is waiting on profile data", () => {
    expect(
      decideMobileAccess(
        makeInput({
          hasSession: true,
          profileReady: false,
        }),
      ),
    ).toEqual({
      kind: "loading",
    });
  });

  it("lets approved creators into the creator shell", () => {
    expect(
      decideMobileAccess(
        makeInput({
          hasSession: true,
          profileReady: true,
          role: "creator",
          status: "approved",
        }),
      ),
    ).toEqual({
      kind: "redirect",
      href: "/(tabs)/home",
    });
  });

  it("lets pending creators into the creator shell for setup-first flows", () => {
    expect(
      decideMobileAccess(
        makeInput({
          hasSession: true,
          profileReady: true,
          role: "creator",
          status: "pending",
        }),
      ),
    ).toEqual({
      kind: "redirect",
      href: "/(tabs)/home",
    });
  });

  it("blocks non-creator roles from entering the creator shell", () => {
    expect(
      decideMobileAccess(
        makeInput({
          hasSession: true,
          profileReady: true,
          role: "brand",
          status: "approved",
        }),
      ),
    ).toEqual({
      kind: "blocked",
      reason: "unsupported_role",
    });

    expect(
      decideMobileAccess(
        makeInput({
          hasSession: true,
          profileReady: true,
          role: "admin",
          status: "approved",
        }),
      ),
    ).toEqual({
      kind: "blocked",
      reason: "unsupported_role",
    });
  });

  it("blocks rejected and suspended creator accounts", () => {
    expect(
      decideMobileAccess(
        makeInput({
          hasSession: true,
          profileReady: true,
          role: "creator",
          status: "rejected",
        }),
      ),
    ).toEqual({
      kind: "blocked",
      reason: "account_unavailable",
    });

    expect(
      decideMobileAccess(
        makeInput({
          hasSession: true,
          profileReady: true,
          role: "creator",
          status: "suspended",
        }),
      ),
    ).toEqual({
      kind: "blocked",
      reason: "account_unavailable",
    });
  });

  it("shows invitation required when authenticated but no profile exists", () => {
    expect(
      decideMobileAccess(
        makeInput({
          hasSession: true,
          profileReady: true,
        }),
      ),
    ).toEqual({
      kind: "blocked",
      reason: "invitation_required",
    });
  });
});
