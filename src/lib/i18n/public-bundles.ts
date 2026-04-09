import { getSourceStrings } from "./strings";
import {
  WEB_EDITORIAL_OVERRIDES,
  applyWebEditorialOverrides,
} from "./editorial-overrides";
import { PUBLIC_BUNDLE_PAGE_KEYS } from "./public-bundle-config";
import { PUBLIC_TRANSLATION_LOCALES } from "./generated/public-translation-locales";
import {
  PUBLIC_TRANSLATION_BUNDLES,
  type PublicTranslationBundle,
} from "./generated/public-translation-manifest";

export { PUBLIC_BUNDLE_PAGE_KEYS } from "./public-bundle-config";
export { PUBLIC_TRANSLATION_LOCALES as PUBLIC_BUNDLED_LOCALES } from "./generated/public-translation-locales";

export function buildPublicBundleFallback(): PublicTranslationBundle {
  const fallback: PublicTranslationBundle = {};

  for (const pageKey of PUBLIC_BUNDLE_PAGE_KEYS) {
    fallback[pageKey] = getSourceStrings(pageKey);
  }

  return fallback;
}

export function resolvePublicBundleTranslations(
  locale: string,
  bundles: Partial<Record<string, PublicTranslationBundle>> = PUBLIC_TRANSLATION_BUNDLES,
): PublicTranslationBundle {
  const resolved =
    locale === "en" ? buildPublicBundleFallback() : bundles[locale] ?? buildPublicBundleFallback();

  return applyWebEditorialOverrides(resolved, WEB_EDITORIAL_OVERRIDES[locale]);
}

export function hasPublicBundle(locale: string): boolean {
  return (PUBLIC_TRANSLATION_LOCALES as readonly string[]).includes(locale);
}
