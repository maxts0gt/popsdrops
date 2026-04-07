import { DEFAULT_LOCALE, type PageKey } from "./strings";

export const TRANSLATION_CHUNK_SIZE = 5;

export interface TranslationCache {
  [locale: string]: Partial<Record<PageKey, Record<string, string>>>;
}

export function chunkPageKeys(
  pageKeys: PageKey[],
  chunkSize: number = TRANSLATION_CHUNK_SIZE,
): PageKey[][] {
  if (chunkSize < 1) {
    throw new Error("chunkSize must be at least 1");
  }

  const chunks: PageKey[][] = [];

  for (let index = 0; index < pageKeys.length; index += chunkSize) {
    chunks.push(pageKeys.slice(index, index + chunkSize));
  }

  return chunks;
}

export function buildInitialTranslationCache(
  locale: string,
  initialTranslations?: Partial<Record<PageKey, Record<string, string>>>,
): TranslationCache {
  if (!initialTranslations || locale === DEFAULT_LOCALE) {
    return {};
  }

  return {
    [locale]: Object.fromEntries(
      Object.entries(initialTranslations).map(([pageKey, pageStrings]) => [
        pageKey,
        { ...pageStrings },
      ]),
    ) as Partial<Record<PageKey, Record<string, string>>>,
  };
}

export function hasCompleteTranslations(
  locale: string,
  pageKeys: PageKey[],
  initialTranslations?: Partial<Record<PageKey, Record<string, string>>>,
): boolean {
  if (locale === DEFAULT_LOCALE) {
    return true;
  }

  if (!initialTranslations) {
    return false;
  }

  return pageKeys.every((pageKey) => {
    const pageStrings = initialTranslations[pageKey];
    return pageStrings != null && Object.keys(pageStrings).length > 0;
  });
}

export function getCachedTranslation(
  cache: TranslationCache,
  locale: string,
  pageKey: PageKey,
  key: string,
): string | undefined {
  return cache[locale]?.[pageKey]?.[key];
}

export function mergeTranslationsIntoCache(
  cache: TranslationCache,
  locale: string,
  pageTranslations: Partial<Record<PageKey, Record<string, string>>>,
): void {
  const localeCache = (cache[locale] ??= {});

  for (const [pageKey, pageStrings] of Object.entries(pageTranslations) as Array<
    [PageKey, Record<string, string>]
  >) {
    localeCache[pageKey] = {
      ...(localeCache[pageKey] ?? {}),
      ...pageStrings,
    };
  }
}
