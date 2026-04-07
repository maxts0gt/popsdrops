import { DEFAULT_LOCALE, isRTLLocale } from "./strings";

export function getDocumentI18n(locale: string | null | undefined) {
  const lang = locale ?? DEFAULT_LOCALE;

  return {
    lang,
    dir: isRTLLocale(lang) ? "rtl" : "ltr",
  } as const;
}
