"use client";

import { I18nProvider } from "@/lib/i18n";
import { isRTLLocale } from "@/lib/i18n/strings";
import { useEffect, type ReactNode } from "react";

export function LocaleProvider({
  children,
  locale,
  initialTranslations,
}: {
  children: ReactNode;
  locale: string;
  initialTranslations?: Record<string, Record<string, string>>;
}) {
  // Set dir and lang on html element
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = isRTLLocale(locale) ? "rtl" : "ltr";
  }, [locale]);

  return (
    <I18nProvider initialLocale={locale} initialTranslations={initialTranslations}>
      {children}
    </I18nProvider>
  );
}
