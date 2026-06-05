import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));
vi.mock("./notify", () => ({
  sendNotificationEmail: vi.fn().mockResolvedValue({ status: "sent" }),
}));

import { sendNotificationEmail } from "./notify";
import { dispatchNotificationEmailByQueueId } from "./notification-queue";

function createAdminStub(queueItem: Record<string, unknown>) {
  const updates: Record<string, unknown>[] = [];
  const queueSelect = {
    eq: vi.fn(() => queueSelect),
    in: vi.fn(() => queueSelect),
    is: vi.fn(() => queueSelect),
    maybeSingle: vi.fn(async () => ({ data: queueItem, error: null })),
  };
  const queueUpdate = {
    eq: vi.fn(async () => ({ error: null })),
  };
  const notificationQueueTable = {
    select: vi.fn(() => queueSelect),
    update: vi.fn((values: Record<string, unknown>) => {
      updates.push(values);
      return queueUpdate;
    }),
  };

  const admin = {
    from: vi.fn((table: string) => {
      if (table !== "notification_queue") {
        throw new Error(`Unexpected table read: ${table}`);
      }

      return notificationQueueTable;
    }),
  };

  return { admin, queueSelect, updates };
}

describe("dispatchNotificationEmailByQueueId", () => {
  it("sends direct pending queue rows without requiring a notification record", async () => {
    const { admin, queueSelect, updates } = createAdminStub({
      id: "2939d530-3180-43d4-a8b2-157cf87a2a8d",
      notification_id: null,
      email: "test-brand@example.com",
      template: "account_rejected",
      data: {
        body: "We cannot approve this request yet.",
        recipientName: "Brand Lead",
        data: {
          reason: "We cannot approve this request yet.",
          role: "brand",
        },
      },
      status: "pending",
      attempt_count: 0,
      processed_at: null,
    });

    const result = await dispatchNotificationEmailByQueueId(
      "2939d530-3180-43d4-a8b2-157cf87a2a8d",
      admin as never,
    );

    expect(queueSelect.eq).toHaveBeenCalledWith(
      "id",
      "2939d530-3180-43d4-a8b2-157cf87a2a8d",
    );
    expect(sendNotificationEmail).toHaveBeenCalledWith({
      data: {
        body: "We cannot approve this request yet.",
        recipientName: "Brand Lead",
        data: {
          reason: "We cannot approve this request yet.",
          role: "brand",
        },
      },
      recipientEmail: "test-brand@example.com",
      recipientName: "Brand Lead",
      type: "account_rejected",
    });
    expect(result).toMatchObject({
      queueId: "2939d530-3180-43d4-a8b2-157cf87a2a8d",
      status: "sent",
    });
    expect(updates[0]).toMatchObject({
      attempt_count: 1,
      last_error: null,
      processed_reason: "email_sent",
      status: "sent",
    });
  });
});
