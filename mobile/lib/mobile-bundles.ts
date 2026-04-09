import { strings } from "./strings";
import {
  MOBILE_EDITORIAL_OVERRIDES,
  applyMobileEditorialOverrides,
} from "./editorial-overrides";
import { MOBILE_TRANSLATION_LOCALES } from "./generated/mobile-translation-locales";
import {
  MOBILE_TRANSLATION_BUNDLES,
  type MobileTranslationBundle,
} from "./generated/mobile-translation-manifest";
import { normalizeLocaleCode } from "./preferences";

export { MOBILE_TRANSLATION_LOCALES as MOBILE_BUNDLED_LOCALES } from "./generated/mobile-translation-locales";

export function buildMobileEnglishSource(): Record<string, string> {
  const merged: Record<string, string> = {};

  for (const section of Object.values(strings)) {
    Object.assign(merged, section);
  }

  return merged;
}

export function resolveMobileBundleTranslations(
  locale: string,
  bundles: Partial<Record<string, MobileTranslationBundle>> = MOBILE_TRANSLATION_BUNDLES,
): MobileTranslationBundle {
  const resolved =
    locale === "en" ? buildMobileEnglishSource() : bundles[locale] ?? buildMobileEnglishSource();

  return applyMobileEditorialOverrides(
    resolved,
    MOBILE_EDITORIAL_OVERRIDES[locale],
  );
}

export function hasMobileBundle(locale: string): boolean {
  return (MOBILE_TRANSLATION_LOCALES as readonly string[]).includes(locale);
}

export function getSafeMobileLocale(locale: string | null | undefined): string {
  const normalized = normalizeLocaleCode(locale);
  return normalized && hasMobileBundle(normalized) ? normalized : "en";
}
