import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const actionsDir = new URL("./", import.meta.url);
const projectRoot = new URL("../../../", import.meta.url);

function actionFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const absolute = join(dir, entry);
    const stat = statSync(absolute);
    if (stat.isDirectory()) return actionFiles(absolute);
    if (!entry.endsWith(".ts") || entry.endsWith(".test.ts")) return [];
    return [absolute];
  });
}

const actionSources = actionFiles(actionsDir.pathname).map((file) => ({
  file,
  source: readFileSync(file, "utf8"),
}));

const privilegedSource = readFileSync(
  new URL("../../lib/supabase/privileged.ts", import.meta.url),
  "utf8",
);
const notifySource = readFileSync(
  new URL("../../lib/email/notify.ts", import.meta.url),
  "utf8",
);
const notificationTypesSource = readFileSync(
  new URL("../../lib/email/notification-types.ts", import.meta.url),
  "utf8",
);
const queuePath = new URL("../../lib/email/notification-queue.ts", import.meta.url);
const queueSource = existsSync(queuePath) ? readFileSync(queuePath, "utf8") : "";

describe("notification delivery contract", () => {
  it("keeps product actions out of direct email delivery", () => {
    const offenders = actionSources
      .filter(({ source }) => source.includes("sendNotificationEmail"))
      .map(({ file }) => file.replace(projectRoot.pathname, ""));

    expect(offenders).toEqual([]);
  });

  it("keeps product actions from inserting notifications directly", () => {
    const offenders = actionSources
      .filter(({ source }) => source.includes('.from("notifications").insert'))
      .map(({ file }) => file.replace(projectRoot.pathname, ""));

    expect(offenders).toEqual([]);
  });

  it("dispatches email from the privileged notification helper", () => {
    expect(privilegedSource).toContain("dispatchNotificationEmailByNotificationId");
    expect(queueSource).toContain("dispatchNotificationEmailByQueueId");
    expect(queueSource).toContain('.eq("id", queueId)');
    expect(queueSource).toContain("queueItem.notification_id");
    expect(privilegedSource).toContain(".select(\"id\")");
    expect(privilegedSource).toContain("notification.id");
  });

  it("keeps one explicit list of email-backed notification types", () => {
    expect(notifySource).toContain("EMAIL_NOTIFICATION_TYPES");
    expect(notifySource).toContain("isEmailNotificationType");
    expect(notificationTypesSource).toContain("EMAIL_NOTIFICATION_TYPES");
    expect(notificationTypesSource).toContain('"account_rejected"');
    expect(queueSource).toContain("isEmailNotificationType");
    expect(queueSource).toContain("processed_at");
  });

  it("checks user email preferences inside the queue dispatcher", () => {
    expect(queueSource).toContain("isNotificationEmailSuppressed");
    expect(queueSource).toContain("notification_email_preferences");
    expect(queueSource).toContain("buildPreferenceSuppressedQueueUpdate");
  });
});
