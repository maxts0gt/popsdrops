"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import {
  type PageKey,
  strings,
  getSourceStrings,
  isRTLLocale,
  DEFAULT_LOCALE,
} from "./strings";

interface TranslationCache {
  [locale: string]: Record<string, string>; // flat: all page keys merged per locale
}

interface I18nContextValue {
  locale: string;
  setLocale: (locale: string) => void;
  isRTL: boolean;
  dir: "ltr" | "rtl";
  t: (pageKey: PageKey, key: string, vars?: Record<string, string>) => string;
  preload: (...pageKeys: PageKey[]) => Promise<void>;
  isLoading: boolean;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function interpolate(text: string, vars?: Record<string, string>): string {
  if (!vars) return text;
  let result = text;
  for (const [k, v] of Object.entries(vars)) {
    result = result.replace(`{${k}}`, v);
  }
  return result;
}

function buildInitialCache(
  initialTranslations?: Record<string, Record<string, string>>,
): TranslationCache {
  const initial: TranslationCache = {};
  if (initialTranslations) {
    for (const [loc, pageStrings] of Object.entries(initialTranslations)) {
      if (!initial[loc]) initial[loc] = {};
      Object.assign(initial[loc], pageStrings);
    }
  }
  return initial;
}

export function I18nProvider({
  children,
  initialLocale,
  initialTranslations,
}: {
  children: ReactNode;
  initialLocale: string;
  initialTranslations?: Record<string, Record<string, string>>;
}) {
  const [locale, setLocaleState] = useState(initialLocale);
  const [isLoading, setIsLoading] = useState(false);
  const [cacheVersion, setCacheVersion] = useState(0);

  // Flat cache: { "ko": { "headline": "...", "nav.home": "...", ... } }
  // English strings are always available from source, never fetched.
  const cache = useRef<TranslationCache>(buildInitialCache(initialTranslations));

  // Fetch state: tracks whether we've already fetched ALL keys for this locale
  const fetchedLocales = useRef<Set<string>>(new Set());
  const fetchingLocale = useRef<string | null>(null);

  const isRTL = isRTLLocale(locale);
  const dir = isRTL ? "rtl" as const : "ltr" as const;

  const setLocale = useCallback((newLocale: string) => {
    setLocaleState(newLocale);
    document.cookie = `popsdrops-locale=${newLocale};path=/;max-age=31536000;samesite=lax`;
    document.documentElement.lang = newLocale;
    document.documentElement.dir = isRTLLocale(newLocale) ? "rtl" : "ltr";
  }, []);

  /**
   * Fetch all page keys for a locale in chunked Gemini calls.
   * Chunks of ~5 page keys each to avoid Gemini output truncation.
   * Only fires once per locale. All components share the result.
   */
  useEffect(() => {
    if (locale === DEFAULT_LOCALE) return;
    if (fetchedLocales.current.has(locale)) return;
    if (fetchingLocale.current === locale) return;

    fetchingLocale.current = locale;
    setIsLoading(true);

    const allPageKeys = Object.keys(strings) as PageKey[];
    const supabase = createClient();

    // Chunk page keys into groups of 5 to keep Gemini output within limits
    const CHUNK_SIZE = 5;
    const chunks: PageKey[][] = [];
    for (let i = 0; i < allPageKeys.length; i += CHUNK_SIZE) {
      chunks.push(allPageKeys.slice(i, i + CHUNK_SIZE));
    }

    if (!cache.current[locale]) cache.current[locale] = {};

    // Fetch all chunks concurrently
    Promise.all(
      chunks.map(async (chunk) => {
        const pages: Record<string, Record<string, string>> = {};
        for (const pk of chunk) {
          pages[pk] = getSourceStrings(pk);
        }

        const { data, error } = await supabase.functions.invoke("translate", {
          body: { locale, pages },
        });

        if (error) throw error;

        if (data?.pages) {
          for (const [, pageData] of Object.entries(data.pages)) {
            const pd = pageData as { strings: Record<string, string> };
            if (pd.strings) {
              Object.assign(cache.current[locale]!, pd.strings);
            }
          }
          // Update after each chunk so UI progressively translates
          setCacheVersion((n) => n + 1);
        }
      }),
    )
      .then(() => {
        fetchedLocales.current.add(locale);
      })
      .catch((err) => {
        console.error(`Batch translation failed for ${locale}`, err);
      })
      .finally(() => {
        fetchingLocale.current = null;
        setIsLoading(false);
      });
  }, [locale]);

  /**
   * Preload is now a no-op — the provider fetches ALL keys on locale change.
   * Kept for API compatibility with useTranslation hook.
   */
  const preload = useCallback(
    async (...pageKeys: PageKey[]) => {
      void pageKeys;
      // All translations are fetched by the provider's useEffect.
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
      const translated = cache.current[locale]?.[key];
      if (translated) {
        return interpolate(translated, vars);
      }

      // Cache miss — return English fallback (fetch is handled by provider useEffect)
      const source = getSourceStrings(pageKey);
      return interpolate(source[key] || key, vars);
    },
    // Include cacheVersion so t() identity updates when translations arrive
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locale, cacheVersion],
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
        isLoading,
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
 * Translations are fetched by the provider — this hook just provides the t() accessor.
 */
export function useTranslation(pageKey: PageKey) {
  const { t, locale, isRTL, dir, isLoading } = useI18n();

  return {
    t: (key: string, vars?: Record<string, string>) => t(pageKey, key, vars),
    locale,
    isRTL,
    dir,
    isLoading,
  };
}
