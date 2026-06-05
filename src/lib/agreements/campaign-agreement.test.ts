import { describe, expect, it } from "vitest";
import {
  buildDefaultAgreementRules,
  getOrderedAgreementRuleEntries,
  getAgreementStatusLabelKey,
  hashAgreementContent,
  normalizeAgreementRules,
} from "./campaign-agreement";

describe("campaign agreement helpers", () => {
  it("builds default rules from campaign dates, usage rights, and reporting requirements", () => {
    const rules = buildDefaultAgreementRules({
      campaignTitle: "K-Beauty Retail Launch",
      platforms: ["instagram", "tiktok"],
      usageRightsDuration: "6 months",
      usageRightsTerritory: "worldwide",
      usageRightsPaidAds: true,
      applicationDeadline: "2026-05-08T00:00:00.000Z",
      contentDueDate: "2026-05-14T00:00:00.000Z",
      postingWindowStart: "2026-05-07T00:00:00.000Z",
      postingWindowEnd: "2026-05-15T00:00:00.000Z",
      performanceDueDate: "2026-05-18T00:00:00.000Z",
      requiredEvidence: ["public_url", "screenshot", "manual_metrics"],
    });

    expect(rules.disclosure.body).toContain("paid partnership");
    expect(rules.role.body).toContain("Follow the brief");
    expect(rules.claims.body).toContain("comparison");
    expect(rules.usageRights.body).toContain("6 months");
    expect(rules.reporting.title).toBe("Reporting proof");
    expect(rules.reporting.body).toContain("confirm the numbers");
    expect(rules.timeline.body).toContain("2026/05/14");
  });

  it("normalizes rule sections for stable hashing", () => {
    const first = normalizeAgreementRules({
      disclosure: { title: " Disclosure ", body: "  Use #ad.  " },
      reporting: { title: "Reporting", body: "Upload proof." },
    });
    const second = normalizeAgreementRules({
      reporting: { body: "Upload proof.", title: "Reporting" },
      disclosure: { body: "Use #ad.", title: "Disclosure" },
    });

    expect(first).toEqual(second);
  });

  it("renders agreement rules in the intentional campaign flow", () => {
    const entries = getOrderedAgreementRuleEntries({
      reporting: { title: "Reporting", body: "Upload proof." },
      role: { title: "Campaign role", body: "Join the campaign." },
      confidentiality: { title: "Confidentiality", body: "Keep assets private." },
      custom: { title: "Custom", body: "Extra rule." },
      disclosure: { title: "Disclosure", body: "Use #ad." },
    });

    expect(entries.map(([key]) => key)).toEqual([
      "role",
      "disclosure",
      "confidentiality",
      "reporting",
      "custom",
    ]);
  });

  it("hashes agreement content deterministically", () => {
    const hash = hashAgreementContent({
      campaignId: "4707edb5-dcab-4b2d-b5eb-7e79f0e1f010",
      version: 1,
      gateMode: "rules_and_brand_agreement",
      title: "Campaign Rules",
      rules: { disclosure: { title: "Disclosure", body: "Use #ad." } },
      agreementBody: "Brand agreement text",
      fileSha256: "abc123",
    });

    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).toBe(
      hashAgreementContent({
        campaignId: "4707edb5-dcab-4b2d-b5eb-7e79f0e1f010",
        version: 1,
        gateMode: "rules_and_brand_agreement",
        title: "Campaign Rules",
        rules: { disclosure: { title: "Disclosure", body: "Use #ad." } },
        agreementBody: "Brand agreement text",
        fileSha256: "abc123",
      }),
    );
  });

  it("maps agreement status to i18n label keys", () => {
    expect(getAgreementStatusLabelKey("not_required")).toBe("agreement.status.notRequired");
    expect(getAgreementStatusLabelKey("pending")).toBe("agreement.status.pending");
    expect(getAgreementStatusLabelKey("signed")).toBe("agreement.status.signed");
    expect(getAgreementStatusLabelKey("needs_reacceptance")).toBe("agreement.status.needsSignature");
  });
});
