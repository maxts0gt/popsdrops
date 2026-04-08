export const PUBLIC_TRANSLATION_LOCALES = [
  "en",
  "de",
  "es",
  "fr",
  "id",
  "it",
  "ja",
  "ko",
  "tl",
  "zh",
] as const;

export type PublicTranslationLocale =
  (typeof PUBLIC_TRANSLATION_LOCALES)[number];
