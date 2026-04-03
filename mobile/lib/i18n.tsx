import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { getLocales } from "expo-localization";
import { strings } from "./strings";
import { supabase } from "./supabase";
import {
  loadProfileLocalePreference,
  readStoredLocalePreference,
  writeStoredLocalePreference,
} from "./preferences-data";
import {
  isRTLLocale,
  normalizeLocaleCode,
} from "./preferences";
import { buildLocaleBootstrapPlan } from "./i18n-state";

type I18nContextValue = {
  t: (key: string, vars?: Record<string, string | number>) => string;
  locale: string;
  setLocale: (locale: string) => void;
  isRTL: boolean;
  ready: boolean;
  isLoadingLocale: boolean;
  deviceLocales: string[];
};

const I18nContext = createContext<I18nContextValue | null>(null);

function getDeviceLocales(): string[] {
  if (typeof window !== "undefined" && window.location?.search) {
    const params = new URLSearchParams(window.location.search);
    const override = normalizeLocaleCode(params.get("locale"));

    if (override) {
      return [override];
    }
  }

  return Array.from(
    new Set(
      getLocales()
        .map((locale) => normalizeLocaleCode(locale.languageCode))
        .filter((locale): locale is string => locale != null),
    ),
  );
}

function getAllSourceStrings(): Record<string, string> {
  const merged: Record<string, string> = {};

  for (const section of Object.values(strings)) {
    Object.assign(merged, section);
  }

  return merged;
}

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
  if (!vars) {
    return template;
  }

  return template.replace(
    /\{(\w+)\}/g,
    (_, name) => vars[name]?.toString() ?? `{${name}}`,
  );
}

async function loadTranslations(locale: string): Promise<Record<string, string>> {
  if (locale === "en") {
    return {};
  }

  const sourceStrings = getAllSourceStrings();
  const sourceKeyCount = Object.keys(sourceStrings).length;

  try {
    const { data, error } = await supabase
      .from("translations")
      .select("page_key, strings")
      .eq("locale", locale)
      .eq("page_key", "mobile.app");

    if (!error && data && data.length > 0) {
      const cached = data[0].strings as Record<string, string>;

      if (cached && typeof cached === "object") {
        const cachedKeyCount = Object.keys(cached).length;

        if (cachedKeyCount >= sourceKeyCount * 0.9) {
          return cached;
        }
      }
    }

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

    if (fnError || !fnData) {
      return {};
    }

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
  const deviceLocales = useMemo(() => getDeviceLocales(), []);
  const [locale, setLocaleState] = useState("en");
  const [translationsByLocale, setTranslationsByLocale] = useState<
    Record<string, Record<string, string>>
  >({});
  const [ready, setReady] = useState(false);
  const [isLoadingLocale, setIsLoadingLocale] = useState(false);
  const translationsRef = useRef<Record<string, Record<string, string>>>({});
  const isRTL = isRTLLocale(locale);

  useEffect(() => {
    translationsRef.current = translationsByLocale;
  }, [translationsByLocale]);

  const ensureLocaleLoaded = useCallback(
    async (targetLocale: string) => {
      if (targetLocale === "en" || translationsRef.current[targetLocale]) {
        return;
      }

      const translated = await loadTranslations(targetLocale);

      if (Object.keys(translated).length > 0) {
        setTranslationsByLocale((current) => ({
          ...current,
          [targetLocale]: translated,
        }));
      }
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const storedLocale = await readStoredLocalePreference();
      const profileLocale = await loadProfileLocalePreference();
      const bootstrapPlan = buildLocaleBootstrapPlan({
        storedLocale,
        profileLocale,
        deviceLocales,
      });

      if (cancelled) {
        return;
      }

      setLocaleState(bootstrapPlan.locale);
      setReady(bootstrapPlan.isReadyImmediately);
      setIsLoadingLocale(bootstrapPlan.shouldLoadTranslations);

      if (!bootstrapPlan.shouldLoadTranslations) {
        return;
      }

      await ensureLocaleLoaded(bootstrapPlan.locale);

      if (!cancelled) {
        setIsLoadingLocale(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [deviceLocales, ensureLocaleLoaded]);

  const setLocale = useCallback(
    (nextLocale: string) => {
      const normalized = normalizeLocaleCode(nextLocale) ?? "en";

      if (normalized === locale) {
        return;
      }

      setLocaleState(normalized);
      void writeStoredLocalePreference(normalized);

      if (normalized === "en" || translationsRef.current[normalized]) {
        setIsLoadingLocale(false);
        return;
      }

      setIsLoadingLocale(true);

      void (async () => {
        await ensureLocaleLoaded(normalized);
        setIsLoadingLocale(false);
      })();
    },
    [ensureLocaleLoaded, locale],
  );

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>): string => {
      if (locale !== "en" && translationsByLocale[locale]?.[key]) {
        return interpolate(translationsByLocale[locale][key], vars);
      }

      const english = lookupEnglish(key);

      if (english) {
        return interpolate(english, vars);
      }

      return key;
    },
    [locale, translationsByLocale],
  );

  return (
    <I18nContext.Provider
      value={{
        t,
        locale,
        setLocale,
        isRTL,
        ready,
        isLoadingLocale,
        deviceLocales,
      }}
    >
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
