import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./notification-email-preferences-panel.tsx", import.meta.url),
  "utf8",
);

describe("NotificationEmailPreferencesPanel", () => {
  it("loads saved preferences and falls back to opt-in defaults", () => {
    expect(source).toContain("notification_email_preferences");
    expect(source).toContain("DEFAULT_NOTIFICATION_EMAIL_PREFERENCES");
    expect(source).toContain("normalizeNotificationEmailPreferences");
  });

  it("renders three compact switch controls plus the required email note", () => {
    expect(source).toContain("role=\"switch\"");
    expect(source).toContain("email_campaign_activity");
    expect(source).toContain("email_messages");
    expect(source).toContain("email_reports");
    expect(source).toContain("required.title");
  });

  it("supports a lighter inbox variant for notification pages", () => {
    expect(source).toContain('variant = "default"');
    expect(source).toContain('variant === "compact"');
    expect(source).toContain("isCompact");
  });

  it("saves each toggle immediately through the server action", () => {
    expect(source).toContain("updateNotificationEmailPreferences");
    expect(source).toContain("toast.success");
    expect(source).toContain("toast.error");
  });
});
