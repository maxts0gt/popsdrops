import { describe, expect, it } from "vitest";

import { createTranslationSourceVersion } from "./cache-version";

describe("createTranslationSourceVersion", () => {
  it("is stable for the same translation source payload", () => {
    const pages = {
      "marketing.landing": {
        headline: "Creator campaigns without borders",
        cta: "Request invite",
      },
      "ui.common": {
        login: "Log in",
      },
    };

    expect(createTranslationSourceVersion(pages)).toBe(
      createTranslationSourceVersion(pages),
    );
  });

  it("does not depend on object key insertion order", () => {
    const a = {
      "marketing.landing": {
        headline: "Creator campaigns without borders",
        cta: "Request invite",
      },
      "ui.common": {
        login: "Log in",
      },
    };

    const b = {
      "ui.common": {
        login: "Log in",
      },
      "marketing.landing": {
        cta: "Request invite",
        headline: "Creator campaigns without borders",
      },
    };

    expect(createTranslationSourceVersion(a)).toBe(
      createTranslationSourceVersion(b),
    );
  });

  it("changes when any English source string changes", () => {
    const baseline = {
      "marketing.landing": {
        headline: "Creator campaigns without borders",
      },
    };

    const changed = {
      "marketing.landing": {
        headline: "Run creator campaigns without borders",
      },
    };

    expect(createTranslationSourceVersion(baseline)).not.toBe(
      createTranslationSourceVersion(changed),
    );
  });
});
