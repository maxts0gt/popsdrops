import { describe, expect, it } from "vitest";

import {
  DEFAULT_MARKETING_LOCALE,
  buildLocalizedMarketingPath,
  getMarketingLocaleFromPathname,
  getPublicLocaleNavigationHref,
  getSafePublicLocale,
  isLocalePrefixedMarketingPath,
  isPublicPath,
  resolvePublicLocaleRouting,
  stripMarketingLocalePrefix,
} from "./public-locale";

describe("public locale routing", () => {
  it("builds locale-prefixed marketing URLs", () => {
    expect(buildLocalizedMarketingPath("ko", "/")).toBe("/ko");
    expect(buildLocalizedMarketingPath("fr", "/for-brands")).toBe(
      "/fr/for-brands",
    );
    expect(
      buildLocalizedMarketingPath("ja", "/request-invite?type=brand"),
    ).toBe("/ja/request-invite?type=brand");
  });

  it("detects locale-prefixed marketing paths", () => {
    expect(isLocalePrefixedMarketingPath("/ko")).toBe(true);
    expect(isLocalePrefixedMarketingPath("/ko/for-creators")).toBe(true);
    expect(isLocalePrefixedMarketingPath("/ko/login")).toBe(false);
    expect(isLocalePrefixedMarketingPath("/b/home")).toBe(false);
  });

  it("extracts and strips locale prefixes for marketing routes", () => {
    expect(getMarketingLocaleFromPathname("/de/for-brands")).toBe("de");
    expect(stripMarketingLocalePrefix("/de/for-brands")).toBe("/for-brands");
    expect(stripMarketingLocalePrefix("/ko")).toBe("/");
  });

  it("clamps unsupported public locales to the default locale", () => {
    expect(getSafePublicLocale("ko")).toBe("ko");
    expect(getSafePublicLocale("am")).toBe(DEFAULT_MARKETING_LOCALE);
    expect(getSafePublicLocale(null)).toBe(DEFAULT_MARKETING_LOCALE);
  });

  it("classifies anonymous public routes without requiring auth", () => {
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/ko/for-brands")).toBe(true);
    expect(isPublicPath("/terms")).toBe(true);
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/auth/callback")).toBe(true);
    expect(isPublicPath("/c/jane-doe")).toBe(true);
    expect(isPublicPath("/apply/campaign-1")).toBe(true);
    expect(isPublicPath("/b/home")).toBe(false);
  });

  it("resolves locale-prefixed marketing redirects and rewrites", () => {
    expect(resolvePublicLocaleRouting("/for-brands", "", "ko")).toEqual({
      action: "redirect",
      destination: "/ko/for-brands",
      locale: "ko",
    });

    expect(resolvePublicLocaleRouting("/ko/for-brands", "", "en")).toEqual({
      action: "rewrite",
      pathname: "/for-brands",
      locale: "ko",
    });

    expect(resolvePublicLocaleRouting("/terms", "", "ko")).toBeNull();
  });

  it("builds public navigation hrefs for localizable marketing pages only", () => {
    expect(
      getPublicLocaleNavigationHref("fr", "/ko/for-creators", "?ref=nav"),
    ).toBe("/fr/for-creators?ref=nav");
    expect(
      getPublicLocaleNavigationHref("de", "/request-invite", "?type=brand"),
    ).toBe("/de/request-invite?type=brand");
    expect(getPublicLocaleNavigationHref("ja", "/terms", "")).toBeNull();
  });
});
