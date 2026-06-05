import { describe, expect, it } from "vitest";

import { getCreatorReportSubmissionState } from "./creator-report-submission-state";

describe("creator report submission state", () => {
  const activeCorrectionTask = {
    id: "task-tiktok-correction",
    due_at: "2026-05-18T00:00:00+00:00",
    status: "needs_revision",
  };

  it("shows correction only on the submission whose proof was rejected", () => {
    const instagramState = getCreatorReportSubmissionState({
      activeReportTask: activeCorrectionTask,
      isReportCorrection: true,
      submission: {
        status: "published",
        platform: "instagram",
        content_performance: [
          {
            report_task_id: "task-instagram-final",
            verification_status: "brand_verified",
          },
        ],
      },
    });
    const tiktokState = getCreatorReportSubmissionState({
      activeReportTask: activeCorrectionTask,
      isReportCorrection: true,
      submission: {
        status: "published",
        platform: "tiktok",
        content_performance: [
          {
            report_task_id: "task-tiktok-correction",
            verification_status: "rejected",
          },
        ],
      },
    });

    expect(instagramState).toMatchObject({
      dueAt: null,
      isSubmitted: true,
      shouldShowForm: false,
      statusKey: "submitted",
    });
    expect(tiktokState).toMatchObject({
      dueAt: "2026-05-18T00:00:00+00:00",
      isSubmitted: false,
      shouldShowForm: true,
      statusKey: "correction",
    });
  });

  it("clears correction mode after the creator submits a newer report for the same task", () => {
    const state = getCreatorReportSubmissionState({
      activeReportTask: activeCorrectionTask,
      isReportCorrection: true,
      submission: {
        status: "published",
        platform: "tiktok",
        content_performance: [
          {
            report_task_id: "task-tiktok-correction",
            verification_status: "rejected",
            reported_at: "2026-05-18T09:00:00.000Z",
          },
          {
            report_task_id: "task-tiktok-correction",
            verification_status: "submitted",
            reported_at: "2026-05-18T10:00:00.000Z",
          },
        ],
      },
    });

    expect(state).toMatchObject({
      dueAt: null,
      isSubmitted: true,
      shouldShowForm: false,
      statusKey: "submitted",
    });
  });

  it("returns the brand correction note from the rejected proof row", () => {
    const state = getCreatorReportSubmissionState({
      activeReportTask: activeCorrectionTask,
      isReportCorrection: true,
      submission: {
        status: "published",
        platform: "instagram",
        content_performance: [
          {
            report_task_id: "task-tiktok-correction",
            verification_status: "rejected",
            reported_at: "2026-05-18T09:00:00.000Z",
            evidence_review_note: "The screenshot is cropped. Upload the full analytics view.",
          },
        ],
      },
    });

    expect(state).toMatchObject({
      correctionNote: "The screenshot is cropped. Upload the full analytics view.",
      statusKey: "correction",
    });
  });

  it("uses submitted task status when the report task is already complete", () => {
    const state = getCreatorReportSubmissionState({
      activeReportTask: {
        id: "task-final-7d",
        due_at: "2026-05-18T00:00:00+00:00",
        status: "submitted",
      },
      isReportCorrection: false,
      submission: {
        status: "published",
        platform: "instagram",
        content_performance: [
          {
            report_task_id: "older-task",
            verification_status: "submitted",
            reported_at: "2026-05-18T10:00:00.000Z",
          },
        ],
      },
    });

    expect(state).toMatchObject({
      dueAt: null,
      isSubmitted: true,
      shouldShowForm: false,
      statusKey: "submitted",
    });
  });

  it("treats excused report tasks as closed so creators cannot reopen them", () => {
    const state = getCreatorReportSubmissionState({
      activeReportTask: {
        id: "task-excused-final",
        due_at: "2026-05-18T00:00:00+00:00",
        status: "excused",
      },
      isReportCorrection: false,
      submission: {
        status: "published",
        platform: "instagram",
        content_performance: null,
      },
    });

    expect(state).toMatchObject({
      dueAt: null,
      isSubmitted: true,
      shouldShowForm: false,
      statusKey: "submitted",
    });
  });
});
