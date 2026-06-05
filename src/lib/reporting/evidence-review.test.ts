import { describe, expect, it } from "vitest";

import {
  buildReportTaskReviewUpdate,
  getCurrentEvidenceReviewRows,
  getCurrentEvidenceReviewStatuses,
} from "./evidence-review";

describe("evidence review task rollup", () => {
  const reviewedAt = "2026-05-08T10:00:00.000Z";

  it("keeps a report task in correction when any linked proof is rejected", () => {
    expect(
      buildReportTaskReviewUpdate({
        evidenceStatuses: ["verified", "rejected"],
        currentTaskStatus: "submitted",
        reviewedAt,
      }),
    ).toEqual({
      status: "needs_revision",
      verified_at: null,
      review_note: "Correction requested",
    });
  });

  it("uses the brand correction note when a proof needs revision", () => {
    expect(
      buildReportTaskReviewUpdate({
        evidenceStatuses: ["verified", "rejected"],
        currentTaskStatus: "submitted",
        correctionNote: "Views do not match the analytics screenshot.",
        reviewedAt,
      }),
    ).toEqual({
      status: "needs_revision",
      verified_at: null,
      review_note: "Views do not match the analytics screenshot.",
    });
  });

  it("keeps the task in review until every linked proof is verified", () => {
    expect(
      buildReportTaskReviewUpdate({
        evidenceStatuses: ["verified", "submitted"],
        currentTaskStatus: "submitted_late",
        reviewedAt,
      }),
    ).toEqual({
      status: "submitted_late",
      verified_at: null,
      review_note: null,
    });
  });

  it("marks the task verified only when all linked proof is verified", () => {
    expect(
      buildReportTaskReviewUpdate({
        evidenceStatuses: ["verified", "verified"],
        currentTaskStatus: "submitted",
        reviewedAt,
      }),
    ).toEqual({
      status: "verified",
      verified_at: reviewedAt,
      review_note: null,
    });
  });

  it("rolls up only the latest proof per submission and measurement", () => {
    expect(
      getCurrentEvidenceReviewStatuses([
        {
          status: "rejected",
          submissionId: "submission-1",
          measurementType: "final_7d",
          createdAt: "2026-05-08T09:00:00.000Z",
        },
        {
          status: "verified",
          submissionId: "submission-1",
          measurementType: "final_7d",
          createdAt: "2026-05-08T10:00:00.000Z",
        },
        {
          status: "submitted",
          submissionId: "submission-1",
          measurementType: "extended_30d",
          createdAt: "2026-05-08T10:05:00.000Z",
        },
      ]),
    ).toEqual(["verified", "submitted"]);
  });

  it("rolls up corrected proof without a submission by measurement", () => {
    expect(
      getCurrentEvidenceReviewStatuses([
        {
          status: "rejected",
          submissionId: null,
          measurementType: "final_7d",
          createdAt: "2026-05-08T09:00:00.000Z",
        },
        {
          status: "verified",
          submissionId: null,
          measurementType: "final_7d",
          createdAt: "2026-05-08T10:00:00.000Z",
        },
      ]),
    ).toEqual(["verified"]);
  });

  it("uses the newest proof state for each admin review group", () => {
    expect(
      getCurrentEvidenceReviewRows([
        {
          id: "older-submitted-proof",
          status: "submitted",
          groupId: "task-1:member-1",
          createdAt: "2026-05-08T09:00:00.000Z",
        },
        {
          id: "newer-rejected-proof",
          status: "rejected",
          groupId: "task-1:member-1",
          createdAt: "2026-05-08T10:00:00.000Z",
        },
      ]),
    ).toEqual([
      {
        hasReturnedCorrection: false,
        row: {
          id: "newer-rejected-proof",
          status: "rejected",
          groupId: "task-1:member-1",
          createdAt: "2026-05-08T10:00:00.000Z",
        },
        status: "correction",
      },
    ]);
  });

  it("marks a submitted proof after rejection as a returned correction", () => {
    expect(
      getCurrentEvidenceReviewRows([
        {
          id: "older-rejected-proof",
          status: "rejected",
          groupId: "task-1:member-1",
          createdAt: "2026-05-08T09:00:00.000Z",
        },
        {
          id: "newer-submitted-proof",
          status: "submitted",
          groupId: "task-1:member-1",
          createdAt: "2026-05-08T10:00:00.000Z",
        },
      ]),
    ).toEqual([
      {
        hasReturnedCorrection: true,
        row: {
          id: "newer-submitted-proof",
          status: "submitted",
          groupId: "task-1:member-1",
          createdAt: "2026-05-08T10:00:00.000Z",
        },
        status: "correction_returned",
      },
    ]);
  });

  it("uses database created_at timestamps when admin evidence rows are not camel-cased", () => {
    expect(
      getCurrentEvidenceReviewRows([
        {
          id: "newer-submitted-proof",
          status: "submitted",
          groupId: "task-1:member-1",
          created_at: "2026-05-08T10:00:00.000Z",
        },
        {
          id: "older-rejected-proof",
          status: "rejected",
          groupId: "task-1:member-1",
          created_at: "2026-05-08T09:00:00.000Z",
        },
      ]),
    ).toEqual([
      {
        hasReturnedCorrection: true,
        row: {
          id: "newer-submitted-proof",
          status: "submitted",
          groupId: "task-1:member-1",
          created_at: "2026-05-08T10:00:00.000Z",
        },
        status: "correction_returned",
      },
    ]);
  });
});
