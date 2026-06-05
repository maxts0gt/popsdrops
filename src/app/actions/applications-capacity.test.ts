import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const applicationsSource = readFileSync(
  new URL("./applications.ts", import.meta.url),
  "utf8",
);
const capacityHelperSource = applicationsSource.slice(
  applicationsSource.indexOf("async function assertCampaignHasCreatorCapacity"),
  applicationsSource.indexOf("function normalizeInviteContact"),
);

describe("application acceptance capacity guard", () => {
  it("checks paid creator capacity before a brand accepts an application", () => {
    expect(applicationsSource).toContain("assertCampaignCreatorCapacity");
    expect(applicationsSource).toContain("max_creators");
    expect(applicationsSource).toContain("getCampaignPaidCreatorCapacity");
    expect(applicationsSource).toContain("campaign_payment_events");
    expect(applicationsSource).toContain("event_summary");
    expect(applicationsSource).toContain('.from("campaign_members")');
    expect(applicationsSource).toContain('count: "exact"');

    const capacityIndex = applicationsSource.indexOf(
      "assertCampaignCreatorCapacity",
    );
    const acceptUpsertIndex = applicationsSource.indexOf(
      "upsertPrivilegedCampaignMember({",
      applicationsSource.indexOf("export async function acceptApplication"),
    );

    expect(capacityIndex).toBeGreaterThan(-1);
    expect(acceptUpsertIndex).toBeGreaterThan(capacityIndex);
  });

  it("also guards creator counter-offer acceptance against capacity races", () => {
    const counterOfferSource = applicationsSource.slice(
      applicationsSource.indexOf("export async function respondToCounterOffer"),
    );

    expect(counterOfferSource).toContain("assertCampaignHasCreatorCapacity");
    expect(counterOfferSource).toContain("max_creators");
    expect(capacityHelperSource).toContain("getCampaignPaidCreatorCapacity");
    expect(applicationsSource).toContain('.from("campaign_members")');

    const capacityIndex = counterOfferSource.indexOf(
      "assertCampaignHasCreatorCapacity",
    );
    const statusIndex = counterOfferSource.indexOf(
      "updatePrivilegedCampaignApplicationStatus({",
    );
    expect(statusIndex).toBeGreaterThan(capacityIndex);
  });

  it("guards bulk applicant acceptance before creating campaign members", () => {
    const bulkSource = applicationsSource.slice(
      applicationsSource.indexOf("export async function acceptApplicationsBatch"),
    );

    expect(bulkSource).toContain("acceptApplicationBatchSchema");
    expect(bulkSource).toContain("new Set(parsed.data.application_ids)");
    expect(bulkSource).toContain("assertCampaignCreatorBatchCapacity");
    expect(bulkSource).toContain("getCampaignPaidCreatorCapacity");
    expect(bulkSource).toContain("requestedCreatorCount: applications.length");
    expect(bulkSource).toContain("const campaignIds = new Set");
    expect(bulkSource).toContain("const brandIds = new Set");
    expect(bulkSource).toContain("createPrivilegedReportTasksForMember");
    expect(bulkSource).toContain("return { acceptedCount: applications.length");

    const capacityIndex = bulkSource.indexOf("assertCampaignCreatorBatchCapacity");
    const memberIndex = bulkSource.indexOf(
      "upsertPrivilegedCampaignMember({",
    );

    expect(capacityIndex).toBeGreaterThan(-1);
    expect(memberIndex).toBeGreaterThan(capacityIndex);
  });
});
