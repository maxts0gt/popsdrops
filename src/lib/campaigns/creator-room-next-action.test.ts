import { describe, expect, it } from "vitest";
import { getCreatorRoomNextAction } from "./creator-room-next-action";

describe("creator room next action", () => {
  it("prioritizes a report correction over every other creator task", () => {
    const action = getCreatorRoomNextAction({
      submissions: [{ status: "revision_requested", publishedUrl: null }],
      reportTasks: [{ status: "needs_revision", dueAt: "2026-05-18" }],
    });

    expect(action.key).toBe("reportCorrection");
    expect(action.targetTab).toBe("submit");
    expect(action.dueAt).toBe("2026-05-18");
  });

  it("asks for revised content when the brand requested a content revision", () => {
    const action = getCreatorRoomNextAction({
      submissions: [{ status: "revision_requested", publishedUrl: null }],
      reportTasks: [],
    });

    expect(action.key).toBe("contentRevision");
    expect(action.targetTab).toBe("submit");
  });

  it("ignores revision rows that were superseded by a new submission version", () => {
    const action = getCreatorRoomNextAction({
      submissions: [
        { id: "v2", parentSubmissionId: "v1", status: "submitted", publishedUrl: null },
        { id: "v1", parentSubmissionId: null, status: "revision_requested", publishedUrl: null },
      ],
      reportTasks: [],
    });

    expect(action.key).toBe("brandReview");
    expect(action.targetTab).toBe("submit");
  });

  it("starts with the first draft when no content has been submitted", () => {
    const action = getCreatorRoomNextAction({
      submissions: [],
      reportTasks: [],
    });

    expect(action.key).toBe("firstDraft");
    expect(action.targetTab).toBe("submit");
  });

  it("shows brand review when a draft is submitted but not approved yet", () => {
    const action = getCreatorRoomNextAction({
      submissions: [{ status: "submitted", publishedUrl: null }],
      reportTasks: [],
    });

    expect(action.key).toBe("brandReview");
    expect(action.targetTab).toBe("submit");
  });

  it("moves approved content toward a live post URL before reporting", () => {
    const action = getCreatorRoomNextAction({
      submissions: [{ status: "approved", publishedUrl: null }],
      reportTasks: [{ status: "pending", dueAt: "2026-05-18" }],
    });

    expect(action.key).toBe("publishUrl");
    expect(action.targetTab).toBe("submit");
  });

  it("moves published content toward performance proof when a report is open", () => {
    const action = getCreatorRoomNextAction({
      submissions: [{ status: "published", publishedUrl: "https://example.com/post" }],
      reportTasks: [{ status: "pending", dueAt: "2026-05-18" }],
      now: new Date("2026-05-10T00:00:00.000Z"),
    });

    expect(action.key).toBe("performanceProof");
    expect(action.targetTab).toBe("submit");
    expect(action.dueAt).toBe("2026-05-18");
  });

  it("moves published content toward an overdue proof action after the due date", () => {
    const action = getCreatorRoomNextAction({
      submissions: [{ status: "published", publishedUrl: "https://example.com/post" }],
      reportTasks: [{ status: "pending", dueAt: "2026-05-10T10:00:00.000Z" }],
      now: new Date("2026-05-10T10:01:00.000Z"),
    });

    expect(action.key).toBe("performanceOverdue");
    expect(action.targetTab).toBe("submit");
    expect(action.dueAt).toBe("2026-05-10T10:00:00.000Z");
  });

  it("moves missed report tasks back to the creator as overdue proof work", () => {
    const action = getCreatorRoomNextAction({
      submissions: [{ status: "published", publishedUrl: "https://example.com/post" }],
      reportTasks: [{ status: "missed", dueAt: "2026-05-10T10:00:00.000Z" }],
      now: new Date("2026-05-12T10:00:00.000Z"),
    });

    expect(action.key).toBe("performanceOverdue");
    expect(action.targetTab).toBe("submit");
  });

  it("shows proof review after late performance proof has been submitted", () => {
    const action = getCreatorRoomNextAction({
      submissions: [{ status: "published", publishedUrl: "https://example.com/post" }],
      reportTasks: [{ status: "submitted_late", dueAt: "2026-05-10T10:00:00.000Z" }],
      now: new Date("2026-05-12T10:00:00.000Z"),
    });

    expect(action.key).toBe("proofReview");
    expect(action.targetTab).toBe("submit");
    expect(action.dueAt).toBe("2026-05-10T10:00:00.000Z");
  });

  it("shows on track when content and reporting are already handled", () => {
    const action = getCreatorRoomNextAction({
      submissions: [{ status: "published", publishedUrl: "https://example.com/post" }],
      reportTasks: [{ status: "verified", dueAt: "2026-05-18" }],
    });

    expect(action.key).toBe("onTrack");
    expect(action.targetTab).toBe("tasks");
  });
});
