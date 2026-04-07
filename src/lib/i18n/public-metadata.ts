import type { Metadata } from "next";

import { getSourceStrings, type PageKey } from "./strings";
import {
  DEFAULT_MARKETING_LOCALE,
  SUPPORTED_MARKETING_LOCALES,
  buildLocalizedMarketingPath,
  getSafePublicLocale,
} from "./public-locale";

const LOCALIZED_MARKETING_METADATA = {
  "/": {
    pageKey: "marketing.landing",
    titleKey: "meta.title",
    descriptionKey: "meta.description",
  },
  "/about": {
    pageKey: "marketing.about",
    titleKey: "meta.title",
    descriptionKey: "meta.description",
  },
  "/for-brands": {
    pageKey: "marketing.forBrands",
    titleKey: "meta.title",
    descriptionKey: "meta.description",
  },
  "/for-creators": {
    pageKey: "marketing.forCreators",
    titleKey: "meta.title",
    descriptionKey: "meta.description",
  },
  "/request-invite": {
    pageKey: "marketing.requestInvite",
    titleKey: "meta.title",
    descriptionKey: "meta.description",
  },
} as const satisfies Record<
  string,
  {
    pageKey: PageKey;
    titleKey: string;
    descriptionKey: string;
  }
>;

export type LocalizedMarketingMetadataPath = keyof typeof LOCALIZED_MARKETING_METADATA;

function getMetadataCopy(
  pageKey: PageKey,
  key: string,
  translations?: Partial<Record<PageKey, Record<string, string>>>,
): string {
  const localizedValue = translations?.[pageKey]?.[key];
  if (localizedValue) {
    return localizedValue;
  }

  return getSourceStrings(pageKey)[key] ?? "";
}

function getLanguageAlternates(
  pathname: LocalizedMarketingMetadataPath,
): Record<string, string> {
  const languages = Object.fromEntries(
    [...SUPPORTED_MARKETING_LOCALES]
      .sort((a, b) => a.localeCompare(b))
      .map((locale) => [locale, buildLocalizedMarketingPath(locale, pathname)]),
  );

  return {
    ...languages,
    "x-default": buildLocalizedMarketingPath(DEFAULT_MARKETING_LOCALE, pathname),
  };
}

export function buildLocalizedMarketingMetadata(
  pathname: LocalizedMarketingMetadataPath,
  locale: string | null | undefined,
  translations?: Partial<Record<PageKey, Record<string, string>>>,
): Metadata {
  const safeLocale = getSafePublicLocale(locale);
  const { pageKey, titleKey, descriptionKey } = LOCALIZED_MARKETING_METADATA[pathname];
  const title = getMetadataCopy(pageKey, titleKey, translations);
  const description = getMetadataCopy(pageKey, descriptionKey, translations);
  const canonical = buildLocalizedMarketingPath(safeLocale, pathname);

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: getLanguageAlternates(pathname),
    },
    openGraph: {
      title,
      description,
      type: "website",
      url: canonical,
      siteName: "PopsDrops",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}
