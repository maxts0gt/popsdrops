import { describe, expect, it } from "vitest";

import {
  assertCampaignAllowsCreatorWork,
  assertCampaignAllowsAgreementUpdate,
  assertCampaignAllowsMetricSubmission,
  canCampaignAcceptApplicationDecision,
  canCampaignAcceptApplicationSubmission,
  canCampaignAcceptAgreementUpdate,
  canCampaignAcceptCreatorInviteManagement,
  canCampaignAcceptCreatorInviteSending,
  canCampaignAcceptCreatorWork,
  canCampaignAcceptMetricSubmission,
  canCampaignAcceptProofDecision,
  canCampaignAcceptProofSubmission,
  getCampaignApplicationClosedReason,
  type CampaignLifecycleStatus,
} from "./lifecycle";

const future = "2026-06-01T23:59:59.999Z";
const past = "2026-05-01T23:59:59.999Z";
const now = new Date("2026-05-30T12:00:00.000Z").getTime();

describe("campaign lifecycle matrix", () => {
  it("keeps private invite management before work starts and email sending only while recruiting is open", () => {
    expect(
      canCampaignAcceptCreatorInviteManagement({
        status: "draft",
        applicationDeadline: past,
        now,
      }),
    ).toBe(true);
    expect(
      canCampaignAcceptCreatorInviteManagement({
        status: "recruiting",
        applicationDeadline: future,
        now,
      }),
    ).toBe(true);
    expect(
      canCampaignAcceptCreatorInviteManagement({
        status: "recruiting",
        applicationDeadline: past,
        now,
      }),
    ).toBe(false);

    expect(
      canCampaignAcceptCreatorInviteSending({
        status: "draft",
        applicationDeadline: future,
        now,
      }),
    ).toBe(false);
    expect(
      canCampaignAcceptCreatorInviteSending({
        status: "recruiting",
        applicationDeadline: future,
        now,
      }),
    ).toBe(true);
  });

  it("closes creator intake at the deadline but keeps brand decisions open while recruiting", () => {
    expect(
      getCampaignApplicationClosedReason({
        status: "recruiting",
        applicationDeadline: future,
        now,
      }),
    ).toBeNull();
    expect(
      getCampaignApplicationClosedReason({
        status: "in_progress",
        applicationDeadline: future,
        now,
      }),
    ).toBe("work_started");
    expect(
      canCampaignAcceptApplicationSubmission({
        status: "recruiting",
        applicationDeadline: future,
        now,
      }),
    ).toBe(true);
    expect(
      canCampaignAcceptApplicationSubmission({
        status: "recruiting",
        applicationDeadline: past,
        now,
      }),
    ).toBe(false);
    expect(
      canCampaignAcceptApplicationDecision({
        status: "recruiting",
        applicationDeadline: future,
        now,
      }),
    ).toBe(true);
    expect(
      canCampaignAcceptApplicationDecision({
        status: "recruiting",
        applicationDeadline: past,
        now,
      }),
    ).toBe(true);
    expect(
      canCampaignAcceptApplicationDecision({
        status: "completed",
        applicationDeadline: future,
        now,
      }),
    ).toBe(false);
  });

  it("allows creator work and proof review only during active work phases", () => {
    const activeStatuses: CampaignLifecycleStatus[] = [
      "in_progress",
      "publishing",
      "monitoring",
    ];
    const closedStatuses: CampaignLifecycleStatus[] = [
      "draft",
      "recruiting",
      "paused",
      "cancelled",
      "completed",
    ];

    for (const status of activeStatuses) {
      expect(canCampaignAcceptCreatorWork({ status })).toBe(true);
      expect(canCampaignAcceptProofSubmission({ status })).toBe(true);
      expect(canCampaignAcceptProofDecision({ status })).toBe(true);
    }

    for (const status of closedStatuses) {
      expect(canCampaignAcceptCreatorWork({ status })).toBe(false);
      expect(canCampaignAcceptProofSubmission({ status })).toBe(false);
      expect(canCampaignAcceptProofDecision({ status })).toBe(false);
    }

    expect(() => assertCampaignAllowsCreatorWork({ status: "completed" })).toThrow(
      "Creator work is closed for this campaign stage.",
    );
  });

  it("requires published content before performance metrics can enter the report", () => {
    expect(
      canCampaignAcceptMetricSubmission({
        status: "monitoring",
        submissionStatus: "published",
      }),
    ).toBe(true);
    expect(
      canCampaignAcceptMetricSubmission({
        status: "monitoring",
        submissionStatus: "approved",
      }),
    ).toBe(false);
    expect(
      canCampaignAcceptMetricSubmission({
        status: "completed",
        submissionStatus: "published",
      }),
    ).toBe(false);

    expect(() =>
      assertCampaignAllowsMetricSubmission({
        status: "monitoring",
        submissionStatus: "approved",
      }),
    ).toThrow("Performance metrics can only be submitted after content is published.");
  });

  it("locks campaign rules after recruiting closes so signed terms stay stable", () => {
    expect(
      canCampaignAcceptAgreementUpdate({
        status: "draft",
        applicationDeadline: past,
        now,
      }),
    ).toBe(true);
    expect(
      canCampaignAcceptAgreementUpdate({
        status: "recruiting",
        applicationDeadline: future,
        now,
      }),
    ).toBe(true);
    expect(
      canCampaignAcceptAgreementUpdate({
        status: "recruiting",
        applicationDeadline: past,
        now,
      }),
    ).toBe(false);

    for (const status of [
      "in_progress",
      "publishing",
      "monitoring",
      "paused",
      "cancelled",
      "completed",
    ] satisfies CampaignLifecycleStatus[]) {
      expect(canCampaignAcceptAgreementUpdate({ status })).toBe(false);
    }

    expect(() =>
      assertCampaignAllowsAgreementUpdate({
        status: "completed",
        applicationDeadline: future,
        now,
      }),
    ).toThrow("Campaign rules can only be changed before recruiting closes.");
    expect(() =>
      assertCampaignAllowsAgreementUpdate({
        status: "recruiting",
        applicationDeadline: past,
        now,
      }),
    ).toThrow("Campaign rules lock after recruiting closes.");
  });
});
