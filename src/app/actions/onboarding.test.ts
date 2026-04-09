import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readOnboardingActionSource() {
  return readFileSync(
    path.join(process.cwd(), "src", "app", "actions", "onboarding.ts"),
    "utf8",
  );
}

describe("onboarding actions source", () => {
  it("upserts creator profiles by profile_id", () => {
    const source = readOnboardingActionSource();

    expect(source).toContain('.from("creator_profiles")');
    expect(source).toContain(".upsert({");
    expect(source).toContain('{ onConflict: "profile_id" }');
  });

  it("upserts brand profiles by profile_id", () => {
    const source = readOnboardingActionSource();

    expect(source).toContain('.from("brand_profiles")');
    expect(source).toContain('{ onConflict: "profile_id" }');
  });
});
