import { describe, expect, it } from "vitest";

import {
  buildInitialTranslationCache,
  chunkPageKeys,
  getCachedTranslation,
  hasCompleteTranslations,
} from "./runtime";
import type { PageKey } from "./strings";

describe("chunkPageKeys", () => {
  it("splits page keys into stable chunks", () => {
    const pageKeys = [
      "ui.common",
      "marketing.landing",
      "marketing.forBrands",
      "marketing.forCreators",
      "marketing.partners",
      "marketing.about",
      "marketing.requestInvite",
    ] satisfies PageKey[];

    expect(chunkPageKeys(pageKeys, 3)).toEqual([
      ["ui.common", "marketing.landing", "marketing.forBrands"],
      ["marketing.forCreators", "marketing.partners", "marketing.about"],
      ["marketing.requestInvite"],
    ]);
  });
});

describe("buildInitialTranslationCache", () => {
  it("keeps duplicate inner keys isolated by page key", () => {
    const cache = buildInitialTranslationCache("ko", {
      "marketing.landing": { headline: "랜딩 헤드라인" },
      "marketing.forBrands": { headline: "브랜드 헤드라인" },
    });

    expect(
      getCachedTranslation(cache, "ko", "marketing.landing", "headline"),
    ).toBe("랜딩 헤드라인");
    expect(
      getCachedTranslation(cache, "ko", "marketing.forBrands", "headline"),
    ).toBe("브랜드 헤드라인");
  });
});

describe("hasCompleteTranslations", () => {
  it("treats partial server hydration as incomplete", () => {
    const pageKeys = [
      "ui.common",
      "marketing.landing",
      "marketing.forBrands",
    ] satisfies PageKey[];

    expect(
      hasCompleteTranslations("ko", pageKeys, {
        "ui.common": { "nav.home": "홈" },
        "marketing.landing": { headline: "랜딩 헤드라인" },
      }),
    ).toBe(false);
  });

  it("treats english as complete without cached translations", () => {
    const pageKeys = ["ui.common", "marketing.landing"] satisfies PageKey[];

    expect(hasCompleteTranslations("en", pageKeys)).toBe(true);
  });
});
