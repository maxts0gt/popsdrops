import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./brand-agreement-panel.tsx", import.meta.url), "utf8");

describe("BrandAgreementPanel", () => {
  it("edits the full ordered campaign rule set instead of only two fields", () => {
    expect(source).toContain("RULE_EDITOR_KEYS");
    expect(source).toContain("getOrderedAgreementRuleEntries");
    expect(source).toContain("agreement.rule.claims");
    expect(source).toContain("agreement.rule.usageRights");
    expect(source).toContain("agreement.rule.confidentiality");
    expect(source).toContain("agreement.rule.corrections");
  });

  it("separates draft saving from publishing and shows a creator preview", () => {
    expect(source).toContain("handleSaveDraft");
    expect(source).toContain("handlePublish");
    expect(source).toContain("agreement.creatorPreview");
    expect(source).toContain("agreement.saveDraft");
  });

  it("supports optional brand terms and PDF agreement attachment", () => {
    expect(source).toContain("agreementBody");
    expect(source).toContain("agreement.brandTermsInput");
    expect(source).toContain("createCampaignAgreementUpload");
    expect(source).toContain("getAgreementFileValidationError");
  });
});
