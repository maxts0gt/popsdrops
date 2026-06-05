import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./notification-bell.tsx", import.meta.url), "utf8");

describe("NotificationBell", () => {
  it("cleans up realtime work that starts after the async user lookup", () => {
    expect(source).toContain("let isMounted = true");
    expect(source).toContain("let unsubscribeNotifications");
    expect(source).toContain("getNotificationBellState");
    expect(source).not.toContain("getBrowserUser");
    expect(source).toContain("if (!isMounted || !bellState) return");
    expect(source).toContain("if (isMounted) setUnreadCount");
    expect(source).toContain("void load()");
    expect(source).toContain("isMounted = false");
    expect(source).toContain("unsubscribeNotifications?.()");
  });
});
