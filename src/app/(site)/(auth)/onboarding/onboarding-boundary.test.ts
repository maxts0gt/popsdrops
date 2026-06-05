import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readOnboardingPageSource(page?: "creator" | "brand") {
  return readFileSync(
    path.join(
      process.cwd(),
      "src",
      "app",
      "(site)",
      "(auth)",
      "onboarding",
      ...(page ? [page] : []),
      "page.tsx"
    ),
    "utf8"
  );
}

function readSource(...parts: string[]) {
  return readFileSync(path.join(process.cwd(), ...parts), "utf8");
}

describe("closed launch onboarding boundary", () => {
  it("removes public role choice from the onboarding entry route", () => {
    const source = readOnboardingPageSource();

    expect(source).toContain("Closed launch");
    expect(source).toContain("/request-invite");
    expect(source).not.toContain("How do you want to use PopsDrops?");
    expect(source).not.toContain("selectedRole");
    expect(source).not.toContain("router.push(`/onboarding/${selectedRole}`)");
    expect(source).not.toContain("Users");
    expect(source).not.toContain("Building2");
  });

  it("retires the legacy creator profile form from direct routing", () => {
    const source = readOnboardingPageSource("creator");

    expect(source).toContain('redirect("/pending-approval")');
    expect(source).not.toContain("submitCreatorOnboarding");
    expect(source).not.toContain("baseRate");
    expect(source).not.toContain("selectedNiches");
    expect(source).not.toContain("socialAccounts");
  });

  it("retires the legacy brand profile form from direct routing", () => {
    const source = readOnboardingPageSource("brand");

    expect(source).toContain('redirect("/pending-approval")');
    expect(source).not.toContain("submitBrandOnboarding");
    expect(source).not.toContain("companyName");
    expect(source).not.toContain("targetMarket");
    expect(source).not.toContain("description");
  });

  it("removes the legacy role-selection server action", () => {
    const actionsSource = readSource("src", "app", "actions", "onboarding.ts");
    const indexSource = readSource("src", "app", "actions", "index.ts");

    expect(actionsSource).not.toContain("selectRole");
    expect(actionsSource).not.toContain('redirect(`/onboarding/${role}`)');
    expect(indexSource).not.toContain("selectRole");
    expect(actionsSource).toContain("submitCreatorOnboarding");
    expect(actionsSource).toContain("submitBrandOnboarding");
  });
});
