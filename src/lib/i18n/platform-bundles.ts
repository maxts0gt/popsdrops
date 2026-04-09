import { getSourceStrings } from "./strings";
import { PLATFORM_BUNDLE_PAGE_KEYS } from "./platform-bundle-config";
import { PLATFORM_TRANSLATION_LOCALES } from "./generated/platform-translation-locales";
import {
  PLATFORM_TRANSLATION_BUNDLES,
  type PlatformTranslationBundle,
} from "./generated/platform-translation-manifest";

export { PLATFORM_BUNDLE_PAGE_KEYS } from "./platform-bundle-config";
export { PLATFORM_TRANSLATION_LOCALES as PLATFORM_BUNDLED_LOCALES } from "./generated/platform-translation-locales";

export function buildPlatformBundleFallback(): PlatformTranslationBundle {
  const fallback: PlatformTranslationBundle = {};

  for (const pageKey of PLATFORM_BUNDLE_PAGE_KEYS) {
    fallback[pageKey] = getSourceStrings(pageKey);
  }

  return fallback;
}

export function resolvePlatformBundleTranslations(
  locale: string,
  bundles: Partial<Record<string, PlatformTranslationBundle>> = PLATFORM_TRANSLATION_BUNDLES,
): PlatformTranslationBundle {
  if (locale === "en") {
    return buildPlatformBundleFallback();
  }

  return bundles[locale] ?? buildPlatformBundleFallback();
}

export function hasPlatformBundle(locale: string): boolean {
  return (PLATFORM_TRANSLATION_LOCALES as readonly string[]).includes(locale);
}

export function getSafePlatformLocale(locale: string | null | undefined): string {
  return locale && hasPlatformBundle(locale) ? locale : "en";
}
