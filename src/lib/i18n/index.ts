// Client-safe exports only — no server-only code
// Import server functions directly from "@/lib/i18n/server" in Server Components
export { strings, getSourceStrings, RTL_LOCALES, isRTLLocale, LOCALE_DISPLAY_NAMES, SUPPORTED_LOCALES, DEFAULT_LOCALE, getLocaleDisplayName } from "./strings";
export type { PageKey, StringKey } from "./strings";
export { I18nProvider, useI18n, useTranslation } from "./context";
