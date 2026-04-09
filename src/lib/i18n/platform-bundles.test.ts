import { describe, expect, it } from "vitest";

import type { PageKey } from "./strings";
import {
  PLATFORM_BUNDLE_PAGE_KEYS,
  buildPlatformBundleFallback,
  getSafePlatformLocale,
  resolvePlatformBundleTranslations,
} from "./platform-bundles";

describe("platform translation bundles", () => {
  it("uses a bundled locale when one is available", () => {
    const bundled = resolvePlatformBundleTranslations("ko", {
      ko: {
        "brand.home": {
          "title": "브랜드 홈",
        },
      } as Partial<Record<PageKey, Record<string, string>>>,
    });

    expect(bundled["brand.home"]?.title).toBe("브랜드 홈");
  });

  it("applies editorial overrides for premium signed-in copy", () => {
    const bundled = resolvePlatformBundleTranslations("ko", {
      ko: {
        "brand.home": {
          "greeting": "OLD",
        },
      } as Partial<Record<PageKey, Record<string, string>>>,
    });

    expect(bundled["brand.home"]?.greeting).toBe(
      "다시 오신 것을 환영합니다, {name}님",
    );
  });

  it("falls back to english source copy when a platform locale bundle is missing", () => {
    const fallback = resolvePlatformBundleTranslations("sv", {});

    expect(Object.keys(fallback).sort()).toEqual(
      [...PLATFORM_BUNDLE_PAGE_KEYS].sort(),
    );
    expect(fallback["brand.home"]?.title).toBe("Dashboard");
  });

  it("clamps unsupported locales to english", () => {
    expect(getSafePlatformLocale("am")).toBe("en");
    expect(getSafePlatformLocale("ko")).toBe("ko");
  });

  it("builds fallback copy for the full signed-in surface", () => {
    const fallback = buildPlatformBundleFallback();

    expect(fallback["brand.home"]).toBeDefined();
    expect(fallback["creator.home"]).toBeDefined();
  });
});
