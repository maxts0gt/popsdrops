export type NotificationQueueStatus =
  | "pending"
  | "sent"
  | "failed"
  | "unsupported"
  | "skipped"
  | "archived";

export type NotificationQueueUpdate = {
  attempt_count: number;
  delivered_at: string | null;
  last_error: string | null;
  processed_at: string | null;
  processed_reason: string;
  status: NotificationQueueStatus;
  updated_at: string;
};

const MAX_ERROR_LENGTH = 500;

function nextAttemptCount(attemptCount: number | null | undefined) {
  return Math.max(0, attemptCount ?? 0) + 1;
}

function truncateError(message: string) {
  return message.slice(0, MAX_ERROR_LENGTH);
}

export function buildSentQueueUpdate({
  attemptCount,
  now,
}: {
  attemptCount: number | null | undefined;
  now: string;
}): NotificationQueueUpdate {
  return {
    attempt_count: nextAttemptCount(attemptCount),
    delivered_at: now,
    last_error: null,
    processed_at: now,
    processed_reason: "email_sent",
    status: "sent",
    updated_at: now,
  };
}

export function buildUnsupportedQueueUpdate({
  attemptCount,
  now,
}: {
  attemptCount: number | null | undefined;
  now: string;
}): NotificationQueueUpdate {
  return {
    attempt_count: nextAttemptCount(attemptCount),
    delivered_at: null,
    last_error: null,
    processed_at: now,
    processed_reason: "unsupported_template",
    status: "unsupported",
    updated_at: now,
  };
}

export function buildPreferenceSuppressedQueueUpdate({
  attemptCount,
  now,
}: {
  attemptCount: number | null | undefined;
  now: string;
}): NotificationQueueUpdate {
  return {
    attempt_count: nextAttemptCount(attemptCount),
    delivered_at: null,
    last_error: null,
    processed_at: now,
    processed_reason: "email_preference_suppressed",
    status: "skipped",
    updated_at: now,
  };
}

export function buildFailedQueueUpdate({
  attemptCount,
  errorMessage,
  now,
}: {
  attemptCount: number | null | undefined;
  errorMessage: string;
  now: string;
}): NotificationQueueUpdate {
  return {
    attempt_count: nextAttemptCount(attemptCount),
    delivered_at: null,
    last_error: truncateError(errorMessage),
    processed_at: null,
    processed_reason: "email_failed",
    status: "failed",
    updated_at: now,
  };
}
