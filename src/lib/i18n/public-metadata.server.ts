import "server-only";

import type { Metadata } from "next";

import { getPublicCachedTranslations } from "./server";
import {
  buildLocalizedMarketingMetadata,
  type LocalizedMarketingMetadataPath,
} from "./public-metadata";
import { getSafePublicLocale } from "./public-locale";

export async function getLocalizedMarketingMetadata(
  pathname: LocalizedMarketingMetadataPath,
  locale: string | null | undefined,
): Promise<Metadata> {
  const safeLocale = getSafePublicLocale(locale);
  const translations = await getPublicCachedTranslations(safeLocale);

  return buildLocalizedMarketingMetadata(pathname, safeLocale, translations);
}
