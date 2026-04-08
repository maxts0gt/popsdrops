import { describe, expect, it } from "vitest";

import type { PageKey } from "./strings";
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
  });

  it("falls back to english source copy when a public locale bundle is missing", () => {
    const fallback = resolvePublicBundleTranslations("sv", {});

    expect(Object.keys(fallback).sort()).toEqual(
      [...PUBLIC_BUNDLE_PAGE_KEYS].sort(),
    );
    expect(fallback["marketing.landing"]?.headline).toBe(
      "Creator campaigns.\nAny market. Any language.",
    );
  });

  it("builds fallback copy only for public page keys", () => {
    const fallback = buildPublicBundleFallback();

    expect(fallback["brand.home"]).toBeUndefined();
    expect(fallback["public.apply"]).toBeDefined();
  });
});
