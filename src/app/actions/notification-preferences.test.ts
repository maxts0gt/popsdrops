import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./profile.ts", import.meta.url),
  "utf8",
);

describe("notification preference actions", () => {
  it("upserts the signed-in user's email preferences through a server action", () => {
    expect(source).toContain("notificationEmailPreferencesSchema");
    expect(source).toContain("updateNotificationEmailPreferences");
    expect(source).toContain(".from(\"notification_email_preferences\")");
    expect(source).toContain(".upsert(");
    expect(source).toContain("user_id: user.id");
    expect(source).toContain("email_campaign_activity");
    expect(source).toContain("email_messages");
    expect(source).toContain("email_reports");
  });
});
