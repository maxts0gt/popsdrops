import type { Metadata } from "next";

import { getSourceStrings, type PageKey } from "./strings";

export function buildPlatformPageMetadata({
  pageKey,
  translations,
  titleKey = "meta.title",
  descriptionKey = "meta.description",
  fallbackTitleKey = "title",
  fallbackDescriptionKey = "subtitle",
  robots,
}: {
  pageKey: PageKey;
  translations?: Partial<Record<PageKey, Record<string, string>>>;
  titleKey?: string;
  descriptionKey?: string;
  fallbackTitleKey?: string;
  fallbackDescriptionKey?: string;
  robots?: Metadata["robots"];
}): Metadata {
  const source = getSourceStrings(pageKey);
  const localized = translations?.[pageKey] ?? {};

  const title =
    localized[titleKey] ||
    localized[fallbackTitleKey] ||
    source[titleKey] ||
    source[fallbackTitleKey] ||
    "PopsDrops";

  const description =
    localized[descriptionKey] ||
    localized[fallbackDescriptionKey] ||
    source[descriptionKey] ||
    source[fallbackDescriptionKey] ||
    "";

  return {
    title,
    description,
    robots,
    openGraph: {
      title,
      description,
    },
    twitter: {
      title,
      description,
    },
  };
}
