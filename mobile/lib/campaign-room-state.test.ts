import { describe, expect, it } from "vitest";

import {
  getDeliverableSubmission,
  getInitialRoomTab,
  getLatestPerformanceRead,
  getOpenReportTask,
  getSelectedDeliverableId,
  hasAtLeastOneMetric,
  parseOptionalMetric,
} from "./campaign-room-state";
import type {
  CampaignReportTask,
  ContentPerformance,
  ContentSubmission,
  Deliverable,
} from "./campaign-room";

const deliverables: Deliverable[] = [
  {
    id: "deliverable-ig-reel",
    platform: "instagram",
    contentType: "reel",
    quantity: 1,
    notes: null,
  },
  {
    id: "deliverable-ig-story",
    platform: "instagram",
    contentType: "story",
    quantity: 3,
    notes: null,
  },
];

describe("getDeliverableSubmission", () => {
  it("prefers an exact deliverable_id match over platform-only matches", () => {
    const submissions: ContentSubmission[] = [
      {
        id: "submission-platform",
        campaignMemberId: "member-1",
        deliverableId: null,
        contentUrl: "https://example.com/platform",
        caption: null,
        publishedUrl: null,
        publishedAt: null,
        platform: "instagram",
        status: "submitted",
        version: 1,
        feedback: null,
        revisionCount: 0,
        parentSubmissionId: null,
        submittedAt: "2026-04-02T00:00:00.000Z",
      },
      {
        id: "submission-exact",
        campaignMemberId: "member-1",
        deliverableId: "deliverable-ig-story",
        contentUrl: "https://example.com/exact",
        caption: null,
        publishedUrl: null,
        publishedAt: null,
        platform: "instagram",
        status: "approved",
        version: 2,
        feedback: null,
        revisionCount: 0,
        parentSubmissionId: null,
        submittedAt: "2026-04-03T00:00:00.000Z",
      },
    ];

    expect(
      getDeliverableSubmission(deliverables[1], submissions)?.id,
    ).toBe("submission-exact");
  });

  it("falls back to a platform-only submission when legacy rows do not have deliverable_id", () => {
    const submissions: ContentSubmission[] = [
      {
        id: "submission-platform",
        campaignMemberId: "member-1",
        deliverableId: null,
        contentUrl: "https://example.com/platform",
        caption: null,
        publishedUrl: null,
        publishedAt: null,
        platform: "instagram",
        status: "submitted",
        version: 1,
        feedback: null,
        revisionCount: 0,
        parentSubmissionId: null,
        submittedAt: "2026-04-02T00:00:00.000Z",
      },
    ];

    expect(
      getDeliverableSubmission(deliverables[0], submissions)?.id,
    ).toBe("submission-platform");
  });
});

describe("getSelectedDeliverableId", () => {
  it("keeps the current deliverable when it still exists", () => {
    expect(
      getSelectedDeliverableId(deliverables, "deliverable-ig-story"),
    ).toBe("deliverable-ig-story");
  });

  it("falls back to the first deliverable when the current one is missing", () => {
    expect(
      getSelectedDeliverableId(deliverables, "missing-deliverable"),
    ).toBe("deliverable-ig-reel");
  });
});

describe("getInitialRoomTab", () => {
  it("opens supported deep-link tabs", () => {
    expect(getInitialRoomTab("submit")).toBe("submit");
    expect(getInitialRoomTab("tasks")).toBe("tasks");
  });

  it("uses the first repeated tab param from Expo Router", () => {
    expect(getInitialRoomTab(["submit", "brief"])).toBe("submit");
  });

  it("defaults to brief for missing or unknown tab params", () => {
    expect(getInitialRoomTab(undefined)).toBe("brief");
    expect(getInitialRoomTab("reporting")).toBe("brief");
  });
});

describe("getLatestPerformanceRead", () => {
  it("uses the newest read for the selected submission", () => {
    const performance: ContentPerformance[] = [
      {
        id: "read-old",
        submissionId: "submission-1",
        reportTaskId: "task-1",
        measurementType: "final_7d",
        views: 100,
        likes: 10,
        comments: 1,
        shares: 2,
        saves: 3,
        screenshotUrl: null,
        verificationStatus: "submitted",
        reportedAt: "2026-05-18T08:00:00.000Z",
      },
      {
        id: "read-new",
        submissionId: "submission-1",
        reportTaskId: "task-2",
        measurementType: "final_7d",
        views: 200,
        likes: 20,
        comments: 2,
        shares: 4,
        saves: 6,
        screenshotUrl: "https://example.com/proof.png",
        verificationStatus: "submitted",
        reportedAt: "2026-05-19T08:00:00.000Z",
      },
    ];

    expect(getLatestPerformanceRead("submission-1", performance)?.id).toBe(
      "read-new",
    );
  });
});

describe("getOpenReportTask", () => {
  it("chooses the earliest creator action task", () => {
    const tasks: CampaignReportTask[] = [
      {
        id: "verified",
        campaignId: "campaign-1",
        campaignMemberId: "member-1",
        taskKey: "final",
        dueAt: "2026-05-20T00:00:00.000Z",
        status: "verified",
        submittedAt: "2026-05-19T00:00:00.000Z",
        reviewNote: null,
      },
      {
        id: "missed-earlier",
        campaignId: "campaign-1",
        campaignMemberId: "member-1",
        taskKey: "daily:missed",
        dueAt: "2026-05-16T00:00:00.000Z",
        status: "missed",
        submittedAt: null,
        reviewNote: null,
      },
      {
        id: "pending-later",
        campaignId: "campaign-1",
        campaignMemberId: "member-1",
        taskKey: "weekly:2",
        dueAt: "2026-05-22T00:00:00.000Z",
        status: "pending",
        submittedAt: null,
        reviewNote: null,
      },
      {
        id: "pending-earlier",
        campaignId: "campaign-1",
        campaignMemberId: "member-1",
        taskKey: "weekly:1",
        dueAt: "2026-05-18T00:00:00.000Z",
        status: "pending",
        submittedAt: null,
        reviewNote: null,
      },
    ];

    expect(getOpenReportTask(tasks)?.id).toBe("pending-earlier");
  });

  it("prioritizes correction requests before normal pending proof tasks", () => {
    const tasks: CampaignReportTask[] = [
      {
        id: "pending-earlier",
        campaignId: "campaign-1",
        campaignMemberId: "member-1",
        taskKey: "weekly:1",
        dueAt: "2026-05-18T00:00:00.000Z",
        status: "pending",
        submittedAt: null,
        reviewNote: null,
      },
      {
        id: "correction-later",
        campaignId: "campaign-1",
        campaignMemberId: "member-1",
        taskKey: "weekly:2",
        dueAt: "2026-05-22T00:00:00.000Z",
        status: "needs_revision",
        submittedAt: "2026-05-21T00:00:00.000Z",
        reviewNote: "Views screenshot is cropped. Please upload the full analytics screen.",
      },
    ];

    expect(getOpenReportTask(tasks)).toMatchObject({
      id: "correction-later",
      reviewNote: "Views screenshot is cropped. Please upload the full analytics screen.",
    });
  });
});

describe("performance metric helpers", () => {
  it("parses compact number inputs", () => {
    expect(parseOptionalMetric("1,240")).toBe(1240);
    expect(parseOptionalMetric("")).toBeUndefined();
  });

  it("requires at least one visible metric before submission", () => {
    expect(hasAtLeastOneMetric({ views: "", likes: "" })).toBe(false);
    expect(hasAtLeastOneMetric({ views: "1200", likes: "" })).toBe(true);
  });
});
