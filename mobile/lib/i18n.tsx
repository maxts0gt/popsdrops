import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { getLocales } from "expo-localization";
import { strings } from "./strings";
import { supabase } from "./supabase";

const RTL_LOCALES = new Set([
  "ar", "he", "fa", "ur", "ps", "sd", "yi", "dv", "ku", "ckb", "ug",
]);

type I18nContextValue = {
  t: (key: string, vars?: Record<string, string | number>) => string;
  locale: string;
  setLocale: (locale: string) => void;
  isRTL: boolean;
  ready: boolean;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function getDeviceLocale(): string {
  // Dev override: check URL param on web (e.g. ?locale=ja)
  if (typeof window !== "undefined" && window.location?.search) {
    const params = new URLSearchParams(window.location.search);
    const override = params.get("locale");
    if (override && /^[a-z]{2,3}$/.test(override)) return override;
  }
  const locales = getLocales();
  if (locales.length > 0 && locales[0].languageCode) {
    return locales[0].languageCode;
  }
  return "en";
}

/** Flatten all English source strings into one map */
function getAllSourceStrings(): Record<string, string> {
  const merged: Record<string, string> = {};
  for (const section of Object.values(strings)) {
    Object.assign(merged, section);
  }
  return merged;
}

/** Look up a key in the English source strings */
function lookupEnglish(key: string): string | undefined {
  for (const section of Object.values(strings)) {
    if (key in section) {
      return section[key];
    }
  }
  return undefined;
}

function interpolate(
  template: string,
  vars?: Record<string, string | number>,
): string {
  if (!vars) return template;
  return template.replace(
    /\{(\w+)\}/g,
    (_, name) => vars[name]?.toString() ?? `{${name}}`,
  );
}

/**
 * Load translations for a locale. Three-step:
 * 1. Check Supabase DB cache (fast, ~300ms)
 * 2. Verify cache freshness — if source strings have new keys, cache is stale
 * 3. Cache miss or stale → call Edge Function with source strings → Gemini translates
 *    → returns translations immediately AND caches in DB for next time
 *
 * The caller always gets translations back. No fire-and-forget.
 */
async function loadTranslations(
  locale: string,
): Promise<Record<string, string>> {
  if (locale === "en") return {};

  const sourceStrings = getAllSourceStrings();
  const sourceKeyCount = Object.keys(sourceStrings).length;

  try {
    // Step 1: Try DB cache
    const { data, error } = await supabase
      .from("translations")
      .select("page_key, strings")
      .eq("locale", locale)
      .eq("page_key", "mobile.app");

    if (!error && data && data.length > 0) {
      const cached = data[0].strings as Record<string, string>;
      if (cached && typeof cached === "object") {
        const cachedKeyCount = Object.keys(cached).length;
        // Step 2: Check freshness — if cache has ≥90% of source keys, it's fresh enough
        // (translations may legitimately have slightly fewer keys if some are untranslatable)
        if (cachedKeyCount >= sourceKeyCount * 0.9) {
          return cached;
        }
        // Stale cache — fall through to re-translate
      }
    }

    // Step 3: No cache or stale → call Edge Function with ALL source strings
    const { data: fnData, error: fnError } = await supabase.functions.invoke(
      "translate",
      {
        body: {
          locale,
          pages: { "mobile.app": sourceStrings },
          force: true,
        },
      },
    );

    if (fnError || !fnData) return {};

    // Edge Function returns { pages: { "mobile.app": { strings: {...} } } }
    const translated = fnData?.pages?.["mobile.app"]?.strings;
    if (translated && typeof translated === "object") {
      return translated as Record<string, string>;
    }

    return {};
  } catch {
    return {};
  }
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState(getDeviceLocale);
  const [remoteStrings, setRemoteStrings] = useState<Record<string, string>>({});
  const [ready, setReady] = useState(() => getDeviceLocale() === "en");
  const isRTL = RTL_LOCALES.has(locale);
  const fetchedLocaleRef = useRef<string | null>(null);

  // Load translations when locale changes — block rendering until done
  useEffect(() => {
    if (locale === "en") {
      setRemoteStrings({});
      setReady(true);
      return;
    }

    if (fetchedLocaleRef.current === locale) return;
    fetchedLocaleRef.current = locale;

    let cancelled = false;

    (async () => {
      const translated = await loadTranslations(locale);
      if (cancelled) return;
      if (Object.keys(translated).length > 0) {
        setRemoteStrings(translated);
      }
      setReady(true);
    })();

    return () => { cancelled = true; };
  }, [locale]);

  const setLocale = useCallback((newLocale: string) => {
    fetchedLocaleRef.current = null;
    setReady(newLocale === "en");
    setLocaleState(newLocale);
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>): string => {
      // 1. Try remote translated string
      if (locale !== "en" && remoteStrings[key]) {
        return interpolate(remoteStrings[key], vars);
      }
      // 2. Fall back to English source
      const english = lookupEnglish(key);
      if (english) {
        return interpolate(english, vars);
      }
      // 3. Return key itself as last resort
      return key;
    },
    [locale, remoteStrings],
  );

  return (
    <I18nContext.Provider value={{ t, locale, setLocale, isRTL, ready }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return ctx;
}
