import { describe, expect, it } from "vitest";

import { buildPlatformPageMetadata } from "./platform-page-metadata";

describe("platform page metadata", () => {
  it("prefers localized copy when available", () => {
    const metadata = buildPlatformPageMetadata({
      pageKey: "auth.login",
      translations: {
        "auth.login": {
          title: "PopsDrops에 오신 것을 환영합니다",
          subtitle: "계속하려면 로그인하세요",
        },
      },
      robots: {
        index: false,
        follow: false,
      },
    });

    expect(metadata.title).toBe("PopsDrops에 오신 것을 환영합니다");
    expect(metadata.description).toBe("계속하려면 로그인하세요");
    expect(metadata.robots).toEqual({
      index: false,
      follow: false,
    });
  });

  it("falls back to source strings when bundle metadata is missing", () => {
    const metadata = buildPlatformPageMetadata({
      pageKey: "auth.login",
    });

    expect(metadata.title).toBe("Welcome to PopsDrops");
    expect(metadata.description).toBe("Sign in to continue");
  });
});
