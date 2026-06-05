import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./mfa-settings-panel.tsx", import.meta.url),
  "utf8",
);

describe("MfaSettingsPanel", () => {
  it("uses Supabase TOTP MFA APIs without password auth", () => {
    expect(source).toContain("auth.mfa.listFactors");
    expect(source).toContain("auth.mfa.enroll");
    expect(source).toContain('factorType: "totp"');
    expect(source).toContain("auth.mfa.challenge");
    expect(source).toContain("auth.mfa.verify");
    expect(source).toContain("auth.mfa.unenroll");
    expect(source).not.toContain("signInWithPassword");
  });

  it("shows a short, explicit setup flow with recovery feedback", () => {
    expect(source).toContain("security.mfa");
    expect(source).toContain("mfa.factorEnabled");
    expect(source).toContain("mfa.enrollError");
    expect(source).toContain("mfa.verifyError");
    expect(source).toContain("toast.success");
    expect(source).toContain("toast.error");
  });
});
