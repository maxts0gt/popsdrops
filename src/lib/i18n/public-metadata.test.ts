import { describe, expect, it } from "vitest";

import { buildLocalizedMarketingMetadata } from "./public-metadata";

describe("localized marketing metadata", () => {
  it("builds canonical and hreflang alternates for locale-prefixed marketing pages", () => {
    const metadata = buildLocalizedMarketingMetadata("/for-brands", "ko", {
      "marketing.forBrands": {
        "meta.title": "브랜드용",
        "meta.description": "하나의 대시보드에서 크리에이터 캠페인을 운영하세요.",
      },
    });

    expect(metadata.title).toBe("브랜드용");
    expect(metadata.description).toBe(
      "하나의 대시보드에서 크리에이터 캠페인을 운영하세요.",
    );
    expect(metadata.alternates?.canonical).toBe("/ko/for-brands");
    expect(metadata.alternates?.languages?.ko).toBe("/ko/for-brands");
    expect(metadata.alternates?.languages?.en).toBe("/en/for-brands");
    expect(metadata.alternates?.languages?.["x-default"]).toBe(
      "/en/for-brands",
    );
    expect(metadata.openGraph?.url).toBe("/ko/for-brands");
  });

  it("falls back to the english locale and source copy for unsupported or missing locales", () => {
    const metadata = buildLocalizedMarketingMetadata("/request-invite", "am");

    expect(metadata.title).toBe("Request Early Access");
    expect(metadata.description).toBe(
      "Tell us about yourself and we'll get back to you within 24 hours.",
    );
    expect(metadata.alternates?.canonical).toBe("/en/request-invite");
    expect(metadata.alternates?.languages?.["x-default"]).toBe(
      "/en/request-invite",
    );
    expect(metadata.openGraph?.url).toBe("/en/request-invite");
  });
});
