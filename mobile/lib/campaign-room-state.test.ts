import { describe, expect, it } from "vitest";

import {
  getDeliverableSubmission,
  getSelectedDeliverableId,
} from "./campaign-room-state";
import type { ContentSubmission, Deliverable } from "./campaign-room";

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
