"use client";

import { useI18n } from "./context";
import { type PageKey, getSourceStrings } from "./strings";

/**
 * Hook that loads translations for one or more page keys.
 * Use this in page-level components to ensure all strings
 * are loaded before rendering.
 *
 * Usage:
 *   const t = usePageTranslations("creator.home", "ui.common");
 *   return <h1>{t("creator.home", "greeting", { name: "Fatima" })}</h1>
 *
 * Or for a single page:
 *   const { t } = useTranslation("creator.home");
 *   return <h1>{t("greeting", { name: "Fatima" })}</h1>
 */
export function usePageTranslations(...pageKeys: PageKey[]) {
  void pageKeys;
  const { t } = useI18n();

  return t;
}

/**
 * Get all English source strings for a page.
 * Useful for Server Components that don't use hooks.
 */
export { getSourceStrings };
