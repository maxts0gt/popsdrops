import "server-only";
import { cookies, headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { type PageKey, DEFAULT_LOCALE } from "./strings";
import { resolvePublicBundleTranslations } from "./public-bundles";
import { resolvePlatformBundleTranslations } from "./platform-bundles";

/** Validate that a string is a plausible ISO 639-1 locale code (2-3 lowercase letters). */
function isValidLocaleCode(code: string): boolean {
  return /^[a-z]{2,3}$/.test(code);
}

/**
 * Detect the user's preferred locale on the server.
 * Priority: cookie → user profile → Accept-Language header → English
 * Route shells clamp unsupported locales back to the shipped bundle set.
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

export async function getPublicCachedTranslations(
  locale?: string,
): Promise<Partial<Record<PageKey, Record<string, string>>>> {
  const targetLocale = locale || (await getLocale());

  return resolvePublicBundleTranslations(targetLocale);
}

export async function getPlatformCachedTranslations(
  locale?: string,
): Promise<Partial<Record<PageKey, Record<string, string>>>> {
  const targetLocale = locale || (await getLocale());

  return resolvePlatformBundleTranslations(targetLocale);
}
