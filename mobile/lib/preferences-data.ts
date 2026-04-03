import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";
import { normalizeLocaleCode } from "./preferences";
import type { ThemePreference } from "./theme";

export const LOCALE_PREFERENCE_STORAGE_KEY = "@popsdrops:locale-preference";
export const THEME_PREFERENCE_STORAGE_KEY = "@popsdrops:theme-preference";

export async function readStoredLocalePreference() {
  const value = await AsyncStorage.getItem(LOCALE_PREFERENCE_STORAGE_KEY);
  return normalizeLocaleCode(value);
}

export async function writeStoredLocalePreference(locale: string) {
  await AsyncStorage.setItem(LOCALE_PREFERENCE_STORAGE_KEY, locale);
}

export async function readStoredThemePreference(): Promise<ThemePreference | null> {
  const value = await AsyncStorage.getItem(THEME_PREFERENCE_STORAGE_KEY);

  if (value === "light" || value === "dark" || value === "system") {
    return value;
  }

  return null;
}

export async function writeStoredThemePreference(preference: ThemePreference) {
  await AsyncStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, preference);
}

export async function loadProfileLocalePreference() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user?.id) {
    return null;
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("preferred_locale")
    .eq("id", session.user.id)
    .single();

  if (error) {
    return null;
  }

  return normalizeLocaleCode((data as { preferred_locale?: string | null }).preferred_locale);
}

export async function persistProfileLocalePreference(
  userId: string,
  locale: string,
) {
  const { error } = await supabase
    .from("profiles")
    .update({ preferred_locale: locale })
    .eq("id", userId);

  if (error) {
    throw new Error(error.message);
  }
}
