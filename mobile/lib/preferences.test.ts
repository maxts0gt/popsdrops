import { describe, expect, it } from "vitest";

import {
  buildLanguagePickerModel,
  resolvePreferredLocale,
} from "./preferences";

describe("resolvePreferredLocale", () => {
  it("prefers an explicit stored locale over profile and device locales", () => {
    expect(
      resolvePreferredLocale({
        storedLocale: "fr",
        profileLocale: "ja",
        deviceLocales: ["am", "ko"],
      }),
    ).toBe("fr");
  });

  it("falls back to the profile locale when there is no stored preference", () => {
    expect(
      resolvePreferredLocale({
        storedLocale: null,
        profileLocale: "am",
        deviceLocales: ["ko"],
      }),
    ).toBe("am");
  });

  it("falls back to the first valid device locale and then english", () => {
    expect(
      resolvePreferredLocale({
        storedLocale: null,
        profileLocale: null,
        deviceLocales: ["zz-invalid", "ko", "en"],
      }),
    ).toBe("ko");

    expect(
      resolvePreferredLocale({
        storedLocale: null,
        profileLocale: null,
        deviceLocales: [],
      }),
    ).toBe("en");
  });
});

describe("buildLanguagePickerModel", () => {
  it("pins the current locale and english, then suggests device locales", () => {
    const model = buildLanguagePickerModel({
      currentLocale: "am",
      deviceLocales: ["am", "fr", "ko"],
      query: "",
    });

    expect(model.pinned.map((option) => option.code)).toEqual(["am", "en"]);
    expect(model.suggested.map((option) => option.code)).toEqual(["fr", "ko"]);
    expect(model.rest.some((option) => option.code === "am")).toBe(false);
    expect(model.rest.some((option) => option.code === "en")).toBe(false);
  });

  it("supports searching by english language name for extended locales", () => {
    const model = buildLanguagePickerModel({
      currentLocale: "en",
      deviceLocales: [],
      query: "amharic",
    });

    expect(model.pinned.map((option) => option.code)).toEqual(["en"]);
    expect(model.rest.some((option) => option.code === "am")).toBe(true);
    expect(model.custom).toBeNull();
  });

  it("offers a custom locale code path for any valid locale", () => {
    const model = buildLanguagePickerModel({
      currentLocale: "en",
      deviceLocales: [],
      query: "zza",
    });

    expect(model.custom?.code).toBe("zza");
    expect(model.custom?.nativeLabel.length).toBeGreaterThan(0);
  });
});
