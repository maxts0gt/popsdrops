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
import {
  chunkPageKeys,
  getCachedTranslation,
  hasCompleteTranslations,
  mergeTranslationsIntoCache,
  type TranslationCache,
} from "./runtime";
import {
  beginLocaleFetch,
  finishLocaleFetch,
  isLocaleFetchInFlight,
} from "./fetch-state";
import {
  getSessionFetchState,
  getSessionTranslationCache,
  hasFetchedLocaleInSession,
  hydrateLocaleSession,
  markFetchedLocaleInSession,
  setSessionFetchState,
} from "./session-cache";

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
const ALL_PAGE_KEYS = Object.keys(strings) as PageKey[];

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
  runtimeTranslationEnabled = true,
}: {
  children: ReactNode;
  initialLocale: string;
  initialTranslations?: Partial<Record<PageKey, Record<string, string>>>;
  runtimeTranslationEnabled?: boolean;
}) {
  const initialLocaleReadyFromProps = hasCompleteTranslations(
    initialLocale,
    ALL_PAGE_KEYS,
    initialTranslations,
  );
  hydrateLocaleSession(
    initialLocale,
    initialTranslations,
    initialLocaleReadyFromProps,
  );
  const initialLocaleReady = hasFetchedLocaleInSession(initialLocale);
  const [locale, setLocaleState] = useState(initialLocale);
  const [isLoading, setIsLoading] = useState(
    runtimeTranslationEnabled &&
      initialLocale !== DEFAULT_LOCALE &&
      !initialLocaleReady,
  );
  const [cacheVersion, setCacheVersion] = useState(0);

  // Nested cache: { "ko": { "marketing.landing": { "headline": "..." } } }
  // English strings are always available from source, never fetched.
  const cache = useRef<TranslationCache>(getSessionTranslationCache());

  const isRTL = isRTLLocale(locale);
  const dir = isRTL ? "rtl" as const : "ltr" as const;
  const isLocaleReady =
    !runtimeTranslationEnabled ||
    locale === DEFAULT_LOCALE ||
    hasFetchedLocaleInSession(locale);

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
    if (!runtimeTranslationEnabled) return;
    if (locale === DEFAULT_LOCALE) return;
    if (hasFetchedLocaleInSession(locale)) return;

    const activeFetchState = getSessionFetchState();
    if (isLocaleFetchInFlight(activeFetchState, locale)) return;

    const nextFetch = beginLocaleFetch(activeFetchState, locale);
    setSessionFetchState(nextFetch.state);
    const requestId = nextFetch.requestId;
    setIsLoading(true);

    const supabase = createClient();
    const chunks = chunkPageKeys(ALL_PAGE_KEYS);

    // Fetch all chunks concurrently, then update UI once with all translations
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
          const chunkTranslations = Object.fromEntries(
            Object.entries(data.pages).flatMap(([pageKey, pageData]) => {
              const pd = pageData as { strings: Record<string, string> };
              return pd.strings ? [[pageKey as PageKey, pd.strings]] : [];
            }),
          ) as Partial<Record<PageKey, Record<string, string>>>;

          mergeTranslationsIntoCache(cache.current, locale, chunkTranslations);
        }
      }),
    )
      .then(() => {
        markFetchedLocaleInSession(locale);
        // Single re-render after ALL chunks are done — no progressive flicker
        setCacheVersion((n) => n + 1);
      })
      .catch((err) => {
        console.error(`Batch translation failed for ${locale}`, err);
      })
      .finally(() => {
        const currentFetchState = getSessionFetchState();
        const nextState = finishLocaleFetch(currentFetchState, requestId);
        const didFinishActiveRequest = nextState !== currentFetchState;

        setSessionFetchState(nextState);
        if (didFinishActiveRequest) {
          setIsLoading(false);
        }
      });
  }, [locale, runtimeTranslationEnabled]);

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
      const translated = getCachedTranslation(cache.current, locale, pageKey, key);
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
        isLocaleReady,
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
