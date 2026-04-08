import {
  createLocaleFetchState,
  type LocaleFetchState,
} from "./fetch-state";
import {
  mergeTranslationsIntoCache,
  type TranslationCache,
} from "./runtime";
import { type PageKey } from "./strings";

const sessionTranslationCache: TranslationCache = {};
const sessionFetchedLocales = new Set<string>();
let sessionFetchState: LocaleFetchState = createLocaleFetchState();

export function getSessionTranslationCache(): TranslationCache {
  return sessionTranslationCache;
}

export function hasFetchedLocaleInSession(locale: string): boolean {
  return sessionFetchedLocales.has(locale);
}

export function markFetchedLocaleInSession(locale: string): void {
  sessionFetchedLocales.add(locale);
}

export function hydrateLocaleSession(
  locale: string,
  translations?: Partial<Record<PageKey, Record<string, string>>>,
  isComplete: boolean = false,
): void {
  if (translations && Object.keys(translations).length > 0) {
    mergeTranslationsIntoCache(sessionTranslationCache, locale, translations);
  }

  if (isComplete) {
    sessionFetchedLocales.add(locale);
  }
}

export function getSessionFetchState(): LocaleFetchState {
  return sessionFetchState;
}

export function setSessionFetchState(state: LocaleFetchState): void {
  sessionFetchState = state;
}

export function resetI18nSessionCache(): void {
  for (const locale of Object.keys(sessionTranslationCache)) {
    delete sessionTranslationCache[locale];
  }

  sessionFetchedLocales.clear();
  sessionFetchState = createLocaleFetchState();
}
