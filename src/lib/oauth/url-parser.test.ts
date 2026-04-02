import { describe, expect, it } from "vitest";
import { detectPlatformFromUrl, parsePostUrl } from "./url-parser";

describe("detectPlatformFromUrl", () => {
  it("detects known social hosts", () => {
    expect(detectPlatformFromUrl("https://www.instagram.com/p/ABC123def/")).toBe(
      "instagram",
    );
    expect(detectPlatformFromUrl("https://youtu.be/dQw4w9WgXcQ")).toBe("youtube");
    expect(detectPlatformFromUrl("https://vm.tiktok.com/ZMabc1234/")).toBe(
      "tiktok",
    );
  });

  it("rejects urls that only contain a social domain in the path or query", () => {
    expect(
      detectPlatformFromUrl("https://evil.example/path/instagram.com/reel/ABC123"),
    ).toBeNull();
    expect(
      detectPlatformFromUrl("https://evil.example/?next=https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    ).toBeNull();
    expect(
      detectPlatformFromUrl("https://evil.example/facebook.com/reel/1234567890"),
    ).toBeNull();
  });
});

describe("parsePostUrl", () => {
  it("extracts post ids from supported hosts", () => {
    expect(
      parsePostUrl("https://www.tiktok.com/@creator/video/7123456789012345678"),
    ).toEqual({
      platform: "tiktok",
      postId: "7123456789012345678",
    });
    expect(parsePostUrl("https://www.instagram.com/reel/ABC123def/")).toEqual({
      platform: "instagram",
      postId: "ABC123def",
    });
    expect(parsePostUrl("https://youtu.be/dQw4w9WgXcQ")).toEqual({
      platform: "youtube",
      postId: "dQw4w9WgXcQ",
    });
    expect(parsePostUrl("https://story.snapchat.com/s/ABC123")).toEqual({
      platform: "snapchat",
      postId: "ABC123",
    });
    expect(
      parsePostUrl("https://www.facebook.com/brand/videos/1234567890/"),
    ).toEqual({
      platform: "facebook",
      postId: "1234567890",
    });
  });

  it("rejects crafted urls on untrusted hosts", () => {
    expect(
      parsePostUrl("https://evil.example/tiktok.com/@creator/video/7123456789012345678"),
    ).toBeNull();
    expect(
      parsePostUrl("https://evil.example/?target=https://www.instagram.com/reel/ABC123def/"),
    ).toBeNull();
    expect(
      parsePostUrl("https://evil.example/path/fb.watch/ABC123"),
    ).toBeNull();
  });
});
