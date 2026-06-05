import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const adminActionsSource = readFileSync(
  fileURLToPath(new URL("./admin.ts", import.meta.url)),
  "utf8",
);

describe("admin notification queue actions", () => {
  it("sends and retries email deliveries through the queue dispatcher contract", () => {
    expect(adminActionsSource).toContain("sendOrRetryNotificationEmail");
    expect(adminActionsSource).toContain(
      "dispatchNotificationEmailByQueueId",
    );
    expect(adminActionsSource).toContain("isEmailNotificationType");
    expect(adminActionsSource).toContain('action: "send_notification_email"');
    expect(adminActionsSource).toContain('action: "retry_notification_email"');
    expect(adminActionsSource).not.toContain("sendNotificationEmail(");
  });
});
