import { describe, expect, it } from "vitest";
import {
  buildFailedQueueUpdate,
  buildPreferenceSuppressedQueueUpdate,
  buildSentQueueUpdate,
  buildUnsupportedQueueUpdate,
} from "./notification-queue-state";

const NOW = "2026-05-09T05:40:00.000Z";

describe("notification queue state transitions", () => {
  it("marks sent rows as terminal with delivery time and clear error state", () => {
    expect(buildSentQueueUpdate({ attemptCount: 2, now: NOW })).toEqual({
      attempt_count: 3,
      delivered_at: NOW,
      last_error: null,
      processed_at: NOW,
      processed_reason: "email_sent",
      status: "sent",
      updated_at: NOW,
    });
  });

  it("marks unsupported templates as terminal without pretending an email was sent", () => {
    expect(
      buildUnsupportedQueueUpdate({ attemptCount: 0, now: NOW }),
    ).toEqual({
      attempt_count: 1,
      delivered_at: null,
      last_error: null,
      processed_at: NOW,
      processed_reason: "unsupported_template",
      status: "unsupported",
      updated_at: NOW,
    });
  });

  it("marks preference-suppressed emails as skipped and terminal", () => {
    expect(
      buildPreferenceSuppressedQueueUpdate({ attemptCount: 0, now: NOW }),
    ).toEqual({
      attempt_count: 1,
      delivered_at: null,
      last_error: null,
      processed_at: NOW,
      processed_reason: "email_preference_suppressed",
      status: "skipped",
      updated_at: NOW,
    });
  });

  it("keeps failed rows retryable with the latest error message", () => {
    expect(
      buildFailedQueueUpdate({
        attemptCount: 1,
        errorMessage: "send-email function error: 500",
        now: NOW,
      }),
    ).toEqual({
      attempt_count: 2,
      delivered_at: null,
      last_error: "send-email function error: 500",
      processed_at: null,
      processed_reason: "email_failed",
      status: "failed",
      updated_at: NOW,
    });
  });

  it("truncates long delivery errors so the queue row stays readable", () => {
    const update = buildFailedQueueUpdate({
      attemptCount: 0,
      errorMessage: "x".repeat(3000),
      now: NOW,
    });

    expect(update.last_error).toHaveLength(500);
  });
});
