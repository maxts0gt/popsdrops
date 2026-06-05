import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const applicationsSource = readFileSync(
  new URL("./applications.ts", import.meta.url),
  "utf8",
);
const lifecycleSource = readFileSync(
  new URL("../../lib/campaigns/lifecycle.ts", import.meta.url),
  "utf8",
);

describe("campaign application lifecycle guard", () => {
  it("guards creator application submission before profile work or inserts", () => {
    const submitSource = applicationsSource.slice(
      applicationsSource.indexOf("export async function submitApplication"),
      applicationsSource.indexOf("export async function acceptApplication"),
    );

    expect(applicationsSource).toContain("type CampaignApplicationSubmissionLifecycle");
    expect(applicationsSource).toContain("assertCampaignAllowsApplicationSubmission");
    expect(lifecycleSource).toContain(
      'throw new Error("This campaign is not open for applications.")',
    );
    expect(applicationsSource).toContain(
      'throw new Error("This campaign is not accepting applications yet.")',
    );
    expect(lifecycleSource).toContain(
      'throw new Error("The application deadline has already passed.")',
    );

    expect(submitSource).toContain("assertCampaignAllowsApplicationSubmission(campaign);");
    expect(
      submitSource.indexOf("assertCampaignAllowsApplicationSubmission(campaign);"),
    ).toBeLessThan(submitSource.indexOf("const ["));
    expect(
      submitSource.indexOf("assertCampaignAllowsApplicationSubmission(campaign);"),
    ).toBeLessThan(submitSource.indexOf('.from("campaign_applications")'));
  });

  it("exposes a creator invite context check without trusting the raw query string", () => {
    const inviteContextSource = applicationsSource.slice(
      applicationsSource.indexOf("export async function getCreatorCampaignInviteContext"),
      applicationsSource.indexOf("export async function submitApplication"),
    );

    expect(applicationsSource).toContain(
      "const creatorCampaignInviteContextSchema = submitApplicationSchema.pick",
    );
    expect(inviteContextSource).toContain("getMatchedSourceInvite({");
    expect(inviteContextSource).toContain("creatorAccountProfile");
    expect(inviteContextSource).toContain("userEmail: user.email");
    expect(inviteContextSource).toContain("valid: Boolean(matchedSourceInvite?.id)");
    expect(inviteContextSource).toContain("inviteId: matchedSourceInvite?.id ?? null");
    expect(inviteContextSource).not.toContain("return { valid: Boolean(parsed.data.invite_id)");
  });

  it("guards every brand-side application decision behind the recruiting stage without closing selection at the application deadline", () => {
    const decisionSource = lifecycleSource.slice(
      lifecycleSource.indexOf("export function assertCampaignAllowsApplicationDecision"),
      lifecycleSource.indexOf("export function assertCampaignAllowsApplicationSubmission"),
    );
    const submissionSource = lifecycleSource.slice(
      lifecycleSource.indexOf("export function assertCampaignAllowsApplicationSubmission"),
      lifecycleSource.indexOf("export function assertCampaignAllowsApplicationDeadlineUpdate"),
    );

    expect(applicationsSource).toContain("assertCampaignAllowsApplicationDecision");
    expect(lifecycleSource).toContain('campaign.status !== "recruiting"');
    expect(lifecycleSource).toContain(
      'throw new Error("Application decisions are closed for this campaign stage.")',
    );
    expect(decisionSource).not.toContain("isCampaignApplicationDeadlinePassed");
    expect(decisionSource).not.toContain("The application deadline has already passed.");
    expect(submissionSource).toContain("The application deadline has already passed.");

    const guardedFunctions = [
      "export async function acceptApplication",
      "export async function acceptApplicationsBatch",
      "export async function rejectApplicationsBatch",
      "export async function rejectApplication",
      "export async function counterOffer",
    ];

    for (const functionName of guardedFunctions) {
      const functionSource = applicationsSource.slice(
        applicationsSource.indexOf(functionName),
        applicationsSource.indexOf("export async function", applicationsSource.indexOf(functionName) + 1),
      );
      expect(functionSource).toContain("assertCampaignAllowsApplicationDecision(campaign);");
      expect(functionSource).toContain("updatePrivilegedCampaignApplicationStatus");
    }
  });

  it("guards creator counter-offer acceptance before member creation", () => {
    const counterResponseSource = applicationsSource.slice(
      applicationsSource.indexOf("export async function respondToCounterOffer"),
      applicationsSource.indexOf("export async function withdrawApplication"),
    );

    expect(counterResponseSource).toContain("assertCampaignAllowsApplicationDecision(campaign);");
    expect(counterResponseSource.indexOf("assertCampaignAllowsApplicationDecision(campaign);")).toBeLessThan(
      counterResponseSource.indexOf("upsertPrivilegedCampaignMember({"),
    );
  });

  it("lets creators withdraw before work starts while preventing closed-stage mutations", () => {
    const withdrawalSource = applicationsSource.slice(
      applicationsSource.indexOf("export async function withdrawApplication"),
    );

    expect(withdrawalSource).toContain("campaigns(status, application_deadline)");
    expect(withdrawalSource).toContain("assertCampaignAllowsApplicationDecision(campaign);");
    expect(
      withdrawalSource.indexOf("assertCampaignAllowsApplicationDecision(campaign);"),
    ).toBeLessThan(withdrawalSource.indexOf('.update({ status: "withdrawn" })'));
  });
});
