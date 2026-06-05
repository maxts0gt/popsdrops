import { describe, expect, it } from "vitest";

import { getPlatformPostUrlExample, isPlatformPostUrl } from "./platform-url";

describe("platform post URL validation", () => {
  it("accepts native platform post URLs", () => {
    expect(
      isPlatformPostUrl("tiktok", "https://www.tiktok.com/@popsdrops/video/123"),
    ).toBe(true);
    expect(
      isPlatformPostUrl("instagram", "https://www.instagram.com/reel/ABC123/"),
    ).toBe(true);
    expect(
      isPlatformPostUrl("youtube", "https://www.youtube.com/shorts/ABC123"),
    ).toBe(true);
  });

  it("rejects draft asset links as live platform URLs", () => {
    expect(
      isPlatformPostUrl("tiktok", "https://drive.google.com/file/d/example/view"),
    ).toBe(false);
    expect(
      isPlatformPostUrl("instagram", "https://www.dropbox.com/s/example/video.mp4"),
    ).toBe(false);
  });

  it("keeps examples platform-specific for creator guidance", () => {
    expect(getPlatformPostUrlExample("facebook")).toContain("facebook.com");
    expect(getPlatformPostUrlExample("snapchat")).toContain("snapchat.com");
  });
});
