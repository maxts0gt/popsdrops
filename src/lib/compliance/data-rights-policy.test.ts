import { describe, expect, it } from "vitest";

import {
  DATA_DELETION_GRACE_DAYS,
  DATA_DELETION_RESPONSE_DAYS,
  buildDeletedUserEmail,
  getScheduledDeletionAt,
  getVerificationDueAt,
} from "./data-rights-policy";

describe("data rights policy", () => {
  it("schedules account deletion automatically inside the legal response window", () => {
    const requestedAt = new Date("2026-05-19T00:00:00.000Z");

    expect(DATA_DELETION_GRACE_DAYS).toBe(7);
    expect(DATA_DELETION_RESPONSE_DAYS).toBe(10);
    expect(getScheduledDeletionAt(requestedAt).toISOString()).toBe(
      "2026-05-26T00:00:00.000Z",
    );
    expect(getVerificationDueAt(requestedAt).toISOString()).toBe(
      "2026-05-29T00:00:00.000Z",
    );
    expect(getScheduledDeletionAt(requestedAt).getTime()).toBeLessThan(
      getVerificationDueAt(requestedAt).getTime(),
    );
  });

  it("builds a tombstone email that removes the original address from active records", () => {
    expect(buildDeletedUserEmail("0f14a2a8-d7f4-4d42-a322-e3fdff4fb122")).toBe(
      "deleted+0f14a2a8d7f44d42a322e3fdff4fb122@deleted.popsdrops.local",
    );
  });
});
