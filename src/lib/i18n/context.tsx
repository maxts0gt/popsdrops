"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import {
  type PageKey,
  getSourceStrings,
  isRTLLocale,
  DEFAULT_LOCALE,
} from "./strings";

interface I18nContextValue {
  locale: string;
  setLocale: (locale: string) => void;
  isRTL: boolean;
  dir: "ltr" | "rtl";
  t: (pageKey: PageKey, key: string, vars?: Record<string, string>) => string;
  preload: (...pageKeys: PageKey[]) => Promise<void>;
  isLoading: boolean;
  isLocaleReady: boolean;
}

const I18nContext = createContext<I18nContextValue | null>(null);
type TranslationCache = Partial<
  Record<string, Partial<Record<PageKey, Record<string, string>>>>
>;

function interpolate(text: string, vars?: Record<string, string>): string {
  if (!vars) return text;
  let result = text;
  for (const [k, v] of Object.entries(vars)) {
    result = result.replace(`{${k}}`, v);
  }
  return result;
}

export function I18nProvider({
  children,
  initialLocale,
  initialTranslations,
}: {
  children: ReactNode;
  initialLocale: string;
  initialTranslations?: Partial<Record<PageKey, Record<string, string>>>;
}) {
  const [locale, setLocaleState] = useState(initialLocale);
  const cache = useRef<TranslationCache>(
    initialTranslations && initialLocale !== DEFAULT_LOCALE
      ? {
          [initialLocale]: Object.fromEntries(
            Object.entries(initialTranslations).map(([pageKey, pageStrings]) => [
              pageKey,
              { ...pageStrings },
            ]),
          ) as Partial<Record<PageKey, Record<string, string>>>,
        }
      : {},
  );

  const isRTL = isRTLLocale(locale);
  const dir = isRTL ? "rtl" as const : "ltr" as const;

  const setLocale = useCallback((newLocale: string) => {
    setLocaleState(newLocale);
    document.cookie = `popsdrops-locale=${newLocale};path=/;max-age=31536000;samesite=lax`;
    document.documentElement.lang = newLocale;
    document.documentElement.dir = isRTLLocale(newLocale) ? "rtl" : "ltr";
  }, []);

  /**
   * Kept for API compatibility with usePageTranslations.
   * UI translations are fully bundled, so nothing is fetched at runtime.
   */
  const preload = useCallback(
    async (...pageKeys: PageKey[]) => {
      void pageKeys;
    },
    [],
  );

  const t = useCallback(
    (pageKey: PageKey, key: string, vars?: Record<string, string>): string => {
      // English — return source directly
      if (locale === DEFAULT_LOCALE) {
        const source = getSourceStrings(pageKey);
        return interpolate(source[key] || key, vars);
      }

      // Other locale — check cache
      const translated = cache.current[locale]?.[pageKey]?.[key];
      if (translated) {
        return interpolate(translated, vars);
      }

      // Cache miss — return English fallback. Route shells seed bundle translations.
      const source = getSourceStrings(pageKey);
      return interpolate(source[key] || key, vars);
    },
    [locale],
  );

  return (
    <I18nContext.Provider
      value={{
        locale,
        setLocale,
        isRTL,
        dir,
        t,
        preload,
        isLoading: false,
        isLocaleReady: true,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

/**
 * Hook for a specific page's translations.
 */
export function useTranslation(pageKey: PageKey) {
  const { t, locale, isRTL, dir, isLoading, isLocaleReady } = useI18n();

  return {
    t: (key: string, vars?: Record<string, string>) => t(pageKey, key, vars),
    locale,
    isRTL,
    dir,
    isLoading,
    isLocaleReady,
  };
}
