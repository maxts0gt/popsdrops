import { describe, expect, it } from "vitest";

import type { PageKey } from "./strings";
import {
  PLATFORM_TRANSLATION_BUNDLES,
} from "./generated/platform-translation-manifest";
import { PLATFORM_TRANSLATION_LOCALES } from "./generated/platform-translation-locales";
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
    expect(bundled["brand.campaign"]?.["creativeKit.title"]).toBe("Creative Kit");
  });

  it("applies editorial overrides for premium signed-in copy", () => {
    const korean = resolvePlatformBundleTranslations("ko", {
      ko: {
        "brand.home": {
          "greeting": "OLD",
        },
      } as Partial<Record<PageKey, Record<string, string>>>,
    });

    expect(korean["brand.home"]?.greeting).toBe(
      "다시 오신 것을 환영합니다, {name}님",
    );

    const japanese = resolvePlatformBundleTranslations("ja", {
      ja: {
        "brand.creators": {
          "title": "OLD",
        },
      } as Partial<Record<PageKey, Record<string, string>>>,
    });

    expect(japanese["brand.creators"]?.title).toBe("クリエイター一覧");
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

  it("keeps generated bundles aligned with campaign update vocabulary", () => {
    for (const locale of PLATFORM_TRANSLATION_LOCALES) {
      const bundle = PLATFORM_TRANSLATION_BUNDLES[locale]!;

      expect(bundle["ui.common"]?.["nav.communications"]).toBeTruthy();
      expect(bundle["ui.common"]?.["nav.messages"]).toBeUndefined();
      expect(bundle["ui.common"]?.["empty.noUpdates"]).toBeTruthy();
      expect(bundle["ui.common"]?.["empty.noMessages"]).toBeUndefined();
      expect(
        bundle["brand.campaign"]?.["announcement.placeholder"],
      ).toBeTruthy();
      expect(bundle["brand.campaign"]?.["chat.placeholder"]).toBeUndefined();
      expect(bundle["brand.campaign"]?.["tab.chat"]).toBeUndefined();
      expect(bundle["creator.campaign"]?.["tab.chat"]).toBeUndefined();
      expect(bundle.notifications?.["type.campaignUpdate"]).toBeTruthy();
      expect(bundle.notifications?.["type.newMessage"]).toBeUndefined();
      expect(bundle.settings?.["notifications.campaignUpdates"]).toBeTruthy();
      expect(bundle.settings?.["notifications.messages"]).toBeUndefined();
    }
  });
});
