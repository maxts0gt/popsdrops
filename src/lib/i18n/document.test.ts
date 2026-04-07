import { describe, expect, it } from "vitest";

import { getDocumentI18n } from "./document";

describe("document locale metadata", () => {
  it("uses the provided locale and computes RTL direction", () => {
    expect(getDocumentI18n("ar")).toEqual({
      lang: "ar",
      dir: "rtl",
    });
  });

  it("falls back to english when locale is missing", () => {
    expect(getDocumentI18n(null)).toEqual({
      lang: "en",
      dir: "ltr",
    });
  });
});
