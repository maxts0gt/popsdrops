import { describe, expect, it } from "vitest";

import { buildLocaleBootstrapPlan } from "./i18n-state";

describe("buildLocaleBootstrapPlan", () => {
  it("boots immediately in english without background translation work", () => {
    expect(
      buildLocaleBootstrapPlan({
        storedLocale: null,
        profileLocale: null,
        deviceLocales: ["en"],
      }),
    ).toEqual({
      locale: "en",
      shouldLoadTranslations: false,
      isReadyImmediately: true,
    });
  });

  it("boots immediately for non-english bundled locales", () => {
    expect(
      buildLocaleBootstrapPlan({
        storedLocale: "ar",
        profileLocale: null,
        deviceLocales: ["en"],
      }),
    ).toEqual({
      locale: "ar",
      shouldLoadTranslations: true,
      isReadyImmediately: true,
    });
  });
});
