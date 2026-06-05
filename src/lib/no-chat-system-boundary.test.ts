import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "../..");

function read(relativePath: string) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

describe("no chat system product boundary", () => {
  it("keeps dormant campaign message infrastructure out of active app code", () => {
    const removedFiles = [
      "mobile/lib/campaign-chat.ts",
      "src/lib/db/messages.ts",
      "src/hooks/use-realtime-messages.ts",
    ];

    for (const file of removedFiles) {
      expect(existsSync(path.join(root, file)), `${file} should not exist`).toBe(false);
    }

    const activeFiles = [
      "mobile/lib/campaign-actions.ts",
      "mobile/lib/strings.ts",
      "shared/validations.ts",
      "src/lib/validations.ts",
      "src/app/actions/social.ts",
      "src/app/(site)/(app)/admin/analytics/page.tsx",
    ];

    for (const file of activeFiles) {
      const source = read(file);
      expect(source, `${file} should not use campaign_messages`).not.toContain(
        "campaign_messages",
      );
      expect(source, `${file} should not expose sendMessageSchema`).not.toContain(
        "sendMessageSchema",
      );
      expect(source, `${file} should not expose chat copy`).not.toContain(
        "room.chat",
      );
    }
  });

  it("names campaign notifications as updates, not messages", () => {
    const activeFiles = [
      "mobile/app/notifications.tsx",
      "src/app/actions/admin.ts",
      "src/app/actions/campaigns.ts",
      "src/app/(site)/(app)/admin/communications/page.tsx",
      "src/app/(site)/(app)/b/notifications/page.tsx",
      "src/app/(site)/(app)/i/notifications/page.tsx",
      "src/lib/campaigns/brand-campaign-links.ts",
      "src/lib/campaigns/creator-campaign-links.ts",
      "src/lib/email/notification-email-builder.ts",
      "src/lib/email/notification-preferences.ts",
      "src/lib/email/notification-types.ts",
    ];

    for (const file of activeFiles) {
      const source = read(file);
      expect(source, `${file} should not use legacy new_message`).not.toContain(
        "new_message",
      );
      expect(source, `${file} should not label updates as new messages`).not.toContain(
        "New message",
      );
    }
  });
});
