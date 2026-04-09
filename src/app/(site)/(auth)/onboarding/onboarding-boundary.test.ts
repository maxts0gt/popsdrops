import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readOnboardingPageSource(page: "creator" | "brand") {
  return readFileSync(
    path.join(
      process.cwd(),
      "src",
      "app",
      "(site)",
      "(auth)",
      "onboarding",
      page,
      "page.tsx"
    ),
    "utf8"
  );
}

describe("onboarding client boundaries", () => {
  it("keeps creator onboarding persistence on the server", () => {
    const source = readOnboardingPageSource("creator");

    expect(source).toContain("submitCreatorOnboarding");
    expect(source).not.toContain('createClient');
    expect(source).not.toContain('from("profiles")');
    expect(source).not.toContain('from("creator_profiles")');
  });

  it("keeps brand onboarding persistence on the server", () => {
    const source = readOnboardingPageSource("brand");

    expect(source).toContain("submitBrandOnboarding");
    expect(source).not.toContain('createClient');
    expect(source).not.toContain('from("profiles")');
    expect(source).not.toContain('from("brand_profiles")');
  });
});
