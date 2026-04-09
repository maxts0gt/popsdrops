import { describe, expect, it } from "vitest";

import {
  buildMobileEnglishSource,
  getSafeMobileLocale,
  resolveMobileBundleTranslations,
} from "./mobile-bundles";

describe("mobile translation bundles", () => {
  it("uses a bundled locale when one is available", () => {
    const bundled = resolveMobileBundleTranslations("ko", {
      ko: {
        "tab.home": "홈",
      },
    });

    expect(bundled["tab.home"]).toBe("홈");
  });

  it("falls back to english source copy when a mobile locale bundle is missing", () => {
    const fallback = resolveMobileBundleTranslations("sv", {});

    expect(fallback["tab.home"]).toBe("Home");
    expect(fallback["auth.signInGoogle"]).toBe("Continue with Google");
  });

  it("clamps unsupported mobile locales to english", () => {
    expect(getSafeMobileLocale("am")).toBe("en");
    expect(getSafeMobileLocale("ko")).toBe("ko");
  });

  it("builds the merged english source bundle", () => {
    const fallback = buildMobileEnglishSource();

    expect(fallback["tab.home"]).toBe("Home");
    expect(fallback["preferences.languageTitle"]).toBe("Language");
  });
});
