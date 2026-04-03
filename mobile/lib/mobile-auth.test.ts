import { describe, expect, it, vi } from "vitest";
import {
  completeMobileAuthSession,
  getMobileAuthRedirectUrl,
  parseMobileAuthCallback,
} from "./mobile-auth";

describe("getMobileAuthRedirectUrl", () => {
  it("builds the Expo callback path used by mobile auth flows", () => {
    expect(getMobileAuthRedirectUrl((path) => `popsdrops://${path}`)).toBe(
      "popsdrops://auth/callback",
    );
  });
});

describe("parseMobileAuthCallback", () => {
  it("parses access and refresh tokens from URL fragments", () => {
    expect(
      parseMobileAuthCallback(
        "popsdrops://auth/callback#access_token=access-123&refresh_token=refresh-123",
      ),
    ).toEqual({
      kind: "success",
      accessToken: "access-123",
      refreshToken: "refresh-123",
    });
  });

  it("parses access and refresh tokens from query params", () => {
    expect(
      parseMobileAuthCallback(
        "popsdrops://auth/callback?access_token=access-123&refresh_token=refresh-123",
      ),
    ).toEqual({
      kind: "success",
      accessToken: "access-123",
      refreshToken: "refresh-123",
    });
  });

  it("surfaces auth errors from the callback URL", () => {
    expect(
      parseMobileAuthCallback(
        "popsdrops://auth/callback#error=access_denied&error_description=Link%20expired",
      ),
    ).toEqual({
      kind: "error",
      message: "Link expired",
    });
  });

  it("returns empty when no usable auth payload exists", () => {
    expect(
      parseMobileAuthCallback("popsdrops://auth/callback?foo=bar"),
    ).toEqual({
      kind: "empty",
    });

    expect(
      parseMobileAuthCallback(
        "popsdrops://auth/callback#access_token=access-only",
      ),
    ).toEqual({
      kind: "empty",
    });
  });
});

describe("completeMobileAuthSession", () => {
  it("sets the Supabase session when the callback contains tokens", async () => {
    const setSession = vi.fn().mockResolvedValue({ error: null });

    await expect(
      completeMobileAuthSession(
        "popsdrops://auth/callback#access_token=access-123&refresh_token=refresh-123",
        setSession,
      ),
    ).resolves.toEqual({
      kind: "success",
    });

    expect(setSession).toHaveBeenCalledWith({
      access_token: "access-123",
      refresh_token: "refresh-123",
    });
  });

  it("returns callback errors without trying to set a session", async () => {
    const setSession = vi.fn();

    await expect(
      completeMobileAuthSession(
        "popsdrops://auth/callback#error=access_denied&error_description=Link%20expired",
        setSession,
      ),
    ).resolves.toEqual({
      kind: "error",
      message: "Link expired",
    });

    expect(setSession).not.toHaveBeenCalled();
  });

  it("returns an error when Supabase rejects the session tokens", async () => {
    const setSession = vi
      .fn()
      .mockResolvedValue({ error: { message: "Session invalid" } });

    await expect(
      completeMobileAuthSession(
        "popsdrops://auth/callback?access_token=access-123&refresh_token=refresh-123",
        setSession,
      ),
    ).resolves.toEqual({
      kind: "error",
      message: "Session invalid",
    });
  });

  it("returns empty when the callback has no usable auth payload", async () => {
    const setSession = vi.fn();

    await expect(
      completeMobileAuthSession(
        "popsdrops://auth/callback?foo=bar",
        setSession,
      ),
    ).resolves.toEqual({
      kind: "empty",
    });

    expect(setSession).not.toHaveBeenCalled();
  });
});
