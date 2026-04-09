import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useMemo,
} from "react";
import { getLocales } from "expo-localization";
import { strings } from "./strings";
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
import { getSafeMobileLocale, resolveMobileBundleTranslations } from "./mobile-bundles";

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

function loadTranslations(locale: string): Record<string, string> {
  if (locale === "en") {
    return {};
  }

  return resolveMobileBundleTranslations(locale);
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const deviceLocales = useMemo(() => getDeviceLocales(), []);
  const [locale, setLocaleState] = useState("en");
  const [translationsByLocale, setTranslationsByLocale] = useState<
    Record<string, Record<string, string>>
  >({});
  const [ready, setReady] = useState(false);
  const [isLoadingLocale, setIsLoadingLocale] = useState(false);
  const isRTL = isRTLLocale(locale);

  const ensureLocaleLoaded = useCallback(
    (targetLocale: string) => {
      const safeLocale = getSafeMobileLocale(targetLocale);

      if (safeLocale === "en") {
        return;
      }

      if (translationsByLocale[safeLocale]) {
        return;
      }

      const translated = loadTranslations(safeLocale);

      if (Object.keys(translated).length > 0) {
        setTranslationsByLocale((current) => ({
          ...current,
          [safeLocale]: translated,
        }));
      }
    },
    [translationsByLocale],
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

      const safeLocale = getSafeMobileLocale(bootstrapPlan.locale);
      if (bootstrapPlan.shouldLoadTranslations) {
        ensureLocaleLoaded(safeLocale);
      }

      if (!cancelled) {
        setLocaleState(safeLocale);
        setReady(bootstrapPlan.isReadyImmediately);
        setIsLoadingLocale(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [deviceLocales, ensureLocaleLoaded]);

  const setLocale = useCallback(
    (nextLocale: string) => {
      const normalized = getSafeMobileLocale(normalizeLocaleCode(nextLocale));

      if (normalized === locale) {
        return;
      }

      ensureLocaleLoaded(normalized);
      setLocaleState(normalized);
      void writeStoredLocalePreference(normalized);
      setIsLoadingLocale(false);
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
