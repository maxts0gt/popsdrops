import { describe, expect, it } from "vitest";

import type { PageKey } from "./strings";
import {
  PUBLIC_TRANSLATION_BUNDLES,
} from "./generated/public-translation-manifest";
import { PUBLIC_TRANSLATION_LOCALES } from "./generated/public-translation-locales";
import {
  PUBLIC_BUNDLE_PAGE_KEYS,
  buildPublicBundleFallback,
  resolvePublicBundleTranslations,
} from "./public-bundles";

describe("public translation bundles", () => {
  it("uses a bundled locale when one is available", () => {
    const bundled = resolvePublicBundleTranslations("ko", {
      ko: {
        "ui.common": {
          "nav.login": "로그인",
        },
      } as Partial<Record<PageKey, Record<string, string>>>,
    });

    expect(bundled["ui.common"]?.["nav.login"]).toBe("로그인");
    expect(bundled["public.apply"]?.["privateInvite.title"]).toBe("Private invite");
  });

  it("applies editorial overrides for premium public copy", () => {
    const bundled = resolvePublicBundleTranslations("ko", {
      ko: {
        "ui.common": {
          "language.preparingTitle": "OLD",
          "nav.discover": "OLD",
        },
      } as Partial<Record<PageKey, Record<string, string>>>,
    });

    expect(bundled["ui.common"]?.["language.preparingTitle"]).toBe(
      "PopsDrops를 {language}로 전환하는 중입니다",
    );
    expect(bundled["ui.common"]?.["nav.discover"]).toBe("둘러보기");
  });

  it("falls back to english source copy when a public locale bundle is missing", () => {
    const fallback = resolvePublicBundleTranslations("sv", {});

    expect(Object.keys(fallback).sort()).toEqual(
      [...PUBLIC_BUNDLE_PAGE_KEYS].sort(),
    );
    expect(fallback["marketing.landing"]?.headline).toBe(
      "Run private creator campaigns.\nIn markets you cannot reach alone.",
    );
  });

  it("builds fallback copy only for public page keys", () => {
    const fallback = buildPublicBundleFallback();

    expect(fallback["brand.home"]).toBeUndefined();
    expect(fallback["public.apply"]).toBeDefined();
  });

  it("keeps generated public common bundles free of message navigation copy", () => {
    for (const locale of PUBLIC_TRANSLATION_LOCALES) {
      const bundle = PUBLIC_TRANSLATION_BUNDLES[locale]!;

      expect(bundle["ui.common"]?.["nav.communications"]).toBeTruthy();
      expect(bundle["ui.common"]?.["nav.messages"]).toBeUndefined();
      expect(bundle["ui.common"]?.["empty.noUpdates"]).toBeTruthy();
      expect(bundle["ui.common"]?.["empty.noMessages"]).toBeUndefined();
    }
  });
});
