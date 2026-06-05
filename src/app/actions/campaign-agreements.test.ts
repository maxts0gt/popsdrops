import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./campaign-agreements.ts", import.meta.url), "utf8");
const contentSource = readFileSync(new URL("./content.ts", import.meta.url), "utf8");
const evidenceSource = readFileSync(new URL("./reporting-evidence.ts", import.meta.url), "utf8");

describe("campaign agreement actions", () => {
  it("lets brands create draft agreement metadata after campaign ownership verification", () => {
    expect(source).toContain("export async function upsertCampaignAgreementDraft");
    expect(source).toContain("upsertCampaignAgreementDraftSchema");
    expect(source).toContain(".from(\"campaigns\")");
    expect(source).toContain("getBrandWorkspaceForCurrentUser");
    expect(source).toContain(".eq(\"brand_id\", workspace.brandId)");
    expect(source).toContain("hashAgreementContent");
  });

  it("prepares scoped private PDF uploads", () => {
    expect(source).toContain("export async function createCampaignAgreementUpload");
    expect(source).toContain("getAgreementFileValidationError");
    expect(source).toContain("buildAgreementStoragePath");
    expect(source).toContain("bucket: AGREEMENT_BUCKET_ID");
  });

  it("publishes immutable agreement versions and archives prior published versions", () => {
    expect(source).toContain("export async function publishCampaignAgreement");
    expect(source).toContain("status: \"archived\"");
    expect(source).toContain("status: \"published\"");
    expect(source).toContain("published_at");
  });

  it("allows accepted creators to sign the published agreement", () => {
    expect(source).toContain("export async function acceptCampaignAgreement");
    expect(source).toContain("acceptCampaignAgreementSchema");
    expect(source).toContain(".from(\"campaign_members\")");
    expect(source).toContain(".from(\"campaign_agreement_acceptances\")");
    expect(source).toContain("accepted_content_hash: agreement.content_hash");
  });

  it("blocks protected creator actions while the gate is pending", () => {
    expect(contentSource).toContain("assertCampaignMemberAgreementAccess");
    expect(contentSource).toContain("await assertCampaignMemberAgreementAccess(member.id)");
    expect(evidenceSource).toContain("assertCampaignMemberAgreementAccess");
  });

  it("locks brand agreement edits and publishing to pre-work campaign stages", () => {
    expect(source).toContain("assertCampaignAllowsAgreementUpdate");
    expect(source).toContain('.select("id, brand_id, status, application_deadline")');
    expect(source).toContain("assertCampaignAllowsAgreementUpdate(campaign);");

    const ownershipHelperSource = source.slice(
      source.indexOf("async function getOwnedCampaign"),
      source.indexOf("export async function assertCampaignMemberAgreementAccess"),
    );
    expect(ownershipHelperSource.indexOf("assertCampaignAllowsAgreementUpdate(campaign);")).toBeLessThan(
      ownershipHelperSource.indexOf("return campaign;"),
    );

    const publishSource = source.slice(
      source.indexOf("export async function publishCampaignAgreement"),
      source.indexOf("export async function acceptCampaignAgreement"),
    );
    expect(publishSource.indexOf("await getOwnedCampaign")).toBeLessThan(
      publishSource.indexOf("status: \"archived\""),
    );
  });
});
