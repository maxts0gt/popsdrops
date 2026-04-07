import "server-only";
import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { type PageKey, getSourceStrings, DEFAULT_LOCALE } from "./strings";
import { chunkPageKeys } from "./runtime";

/** Validate that a string is a plausible ISO 639-1 locale code (2-3 lowercase letters). */
function isValidLocaleCode(code: string): boolean {
  return /^[a-z]{2,3}$/.test(code);
}

/**
 * Detect the user's preferred locale on the server.
 * Priority: cookie → user profile → Accept-Language header → English
 * Accepts ANY valid locale code — Gemini translates on demand.
 */
export async function getLocale(): Promise<string> {
  const headerStore = await headers();

  // 0. Locale from pathname rewrite/redirect for public marketing routes
  const routedLocale = headerStore.get("x-locale");
  if (routedLocale && isValidLocaleCode(routedLocale)) {
    return routedLocale;
  }

  // 1. Cookie (set by client-side locale switcher)
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("popsdrops-locale")?.value;
  if (cookieLocale && isValidLocaleCode(cookieLocale)) {
    return cookieLocale;
  }

  // 2. User profile preference (if logged in)
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("preferred_locale")
        .eq("id", user.id)
        .single();
      if (profile?.preferred_locale && isValidLocaleCode(profile.preferred_locale)) {
        return profile.preferred_locale;
      }
    }
  } catch {
    // Not logged in or profile doesn't have locale — continue
  }

  // 3. Accept-Language header
  const acceptLang = headerStore.get("accept-language");
  if (acceptLang) {
    const preferred = acceptLang
      .split(",")
      .map((part) => {
        const [lang, q] = part.trim().split(";q=");
        return { lang: lang.split("-")[0].toLowerCase(), q: q ? parseFloat(q) : 1 };
      })
      .sort((a, b) => b.q - a.q)
      .map((p) => p.lang);

    for (const lang of preferred) {
      if (lang !== DEFAULT_LOCALE && isValidLocaleCode(lang)) {
        return lang;
      }
    }
  }

  return DEFAULT_LOCALE;
}

/**
 * Parse Accept-Language header into ranked supported locale codes.
 * Used by server components to pass detected languages to client for the language switcher.
 */
export async function getDetectedLocales(): Promise<string[]> {
  const headerStore = await headers();
  const acceptLang = headerStore.get("accept-language");
  if (!acceptLang) return [];

  const detected: string[] = [];
  const seen = new Set<string>();

  const ranked = acceptLang
    .split(",")
    .map((part) => {
      const [lang, q] = part.trim().split(";q=");
      return { lang: lang.split("-")[0].toLowerCase(), q: q ? parseFloat(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);

  for (const { lang } of ranked) {
    if (!seen.has(lang) && isValidLocaleCode(lang)) {
      seen.add(lang);
      detected.push(lang);
    }
  }

  return detected;
}

/**
 * Server-side fetch for translations already cached in the DB.
 * Does not invoke the translate edge function.
 */
export async function getCachedTranslations(
  pageKeys: PageKey[],
  locale?: string,
): Promise<Partial<Record<PageKey, Record<string, string>>>> {
  const targetLocale = locale || (await getLocale());
  const results: Partial<Record<PageKey, Record<string, string>>> = {};

  if (targetLocale === DEFAULT_LOCALE) {
    for (const pk of pageKeys) {
      results[pk] = getSourceStrings(pk);
    }
    return results;
  }

  try {
    const supabase = await createClient();
    const { data: cachedRows } = await supabase
      .from("translations")
      .select("page_key, strings, overrides")
      .eq("locale", targetLocale)
      .in("page_key", pageKeys);

    const cachedMap = new Map((cachedRows || []).map((row) => [row.page_key, row]));

    for (const pk of pageKeys) {
      const cached = cachedMap.get(pk);
      if (cached) {
        results[pk] = { ...cached.strings, ...cached.overrides };
      }
    }
  } catch {
    // Return whatever cached translations we were able to read.
  }

  return results;
}

/**
 * Server-side translation fetch for a single page.
 * Delegates to getMultipleTranslations for consistency (always batch mode).
 */
export async function getTranslations(
  pageKey: PageKey,
  locale?: string,
): Promise<Record<string, string>> {
  const results = await getMultipleTranslations([pageKey], locale);
  return results[pageKey];
}

/**
 * Server-side BATCH translation: fetches multiple pages in bounded chunks.
 * Returns per-page string maps, falling back to English if translation fails.
 */
export async function getMultipleTranslations(
  pageKeys: PageKey[],
  locale?: string,
): Promise<Record<string, Record<string, string>>> {
  const targetLocale = locale || (await getLocale());
  const results = await getCachedTranslations(pageKeys, targetLocale) as Record<
    string,
    Record<string, string>
  >;

  // English — return source strings directly
  if (targetLocale === DEFAULT_LOCALE) {
    return results;
  }

  const uncachedKeys = pageKeys.filter((pageKey) => !results[pageKey]);

  // If everything was cached, return
  if (uncachedKeys.length === 0) {
    return results;
  }

  // Batch fetch uncached pages via edge function in the same safe chunk size
  // the client uses, to avoid oversized Gemini requests on cold caches.
  try {
    const supabase = await createClient();
    await Promise.all(
      chunkPageKeys(uncachedKeys).map(async (chunk) => {
        const pages: Record<string, Record<string, string>> = {};
        for (const pk of chunk) {
          pages[pk] = getSourceStrings(pk);
        }

        const { data, error } = await supabase.functions.invoke("translate", {
          body: { locale: targetLocale, pages },
        });

        if (error) {
          throw error;
        }

        if (data?.pages) {
          for (const [pk, pageData] of Object.entries(data.pages)) {
            const pd = pageData as { strings: Record<string, string> };
            if (pd.strings) {
              results[pk] = pd.strings;
            }
          }
        }
      }),
    );
  } catch {
    // Batch failed — fill remaining with English
  }

  // Fill any still-missing pages with English fallback
  for (const pk of pageKeys) {
    if (!results[pk]) {
      results[pk] = getSourceStrings(pk);
    }
  }

  return results;
}
