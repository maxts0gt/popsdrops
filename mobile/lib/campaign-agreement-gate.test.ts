import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = dirname(fileURLToPath(import.meta.url));
const roomLoaderSource = readFileSync(join(currentDir, "campaign-room.ts"), "utf8");
const actionsSource = readFileSync(join(currentDir, "campaign-actions.ts"), "utf8");
const roomScreenSource = readFileSync(
  join(currentDir, "../app/campaign-room/[id].tsx"),
  "utf8",
);

describe("mobile campaign agreement gate", () => {
  it("loads agreement status and published rules with the campaign room", () => {
    expect(roomLoaderSource).toContain("CampaignAgreementStatus");
    expect(roomLoaderSource).toContain("CampaignAgreementMemberStatus");
    expect(roomLoaderSource).toContain("agreementStatus");
    expect(roomLoaderSource).toContain(".from(\"campaign_member_agreement_status\")");
    expect(roomLoaderSource).toContain(".from(\"campaign_agreements\")");
  });

  it("blocks creator actions until the required agreement is signed", () => {
    expect(actionsSource).toContain("assertCampaignMemberAgreementAccess");
    expect(actionsSource).toContain(".from(\"campaign_member_agreement_status\")");
    expect(actionsSource).toContain("submitContent");
    expect(actionsSource).toContain("publishContent");
    expect(actionsSource).toContain("submitPerformance");
    expect(actionsSource).toContain("Sign the campaign rules before continuing.");
  });

  it("renders the mobile agreement gate before room tabs", () => {
    expect(roomScreenSource).toContain("AgreementGateCard");
    expect(roomScreenSource).toContain("isAgreementLocked");
    expect(roomScreenSource).toContain('data.agreementStatus.status !== "signed"');
    expect(roomScreenSource).toContain('data.agreementStatus.status !== "not_required"');
    expect(roomScreenSource.indexOf("AgreementGateCard")).toBeLessThan(
      roomScreenSource.indexOf("tabs.map"),
    );
  });

  it("renders agreement rules in an intentional order", () => {
    expect(roomScreenSource).toContain("AGREEMENT_RULE_ORDER");
    expect(roomScreenSource.indexOf("\"role\"")).toBeLessThan(
      roomScreenSource.indexOf("\"disclosure\""),
    );
    expect(roomScreenSource.indexOf("\"disclosure\"")).toBeLessThan(
      roomScreenSource.indexOf("\"timeline\""),
    );
    expect(roomScreenSource).toContain("getAgreementRuleEntries");
  });
});
