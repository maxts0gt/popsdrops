"use client";

import { useI18n, useTranslation, I18nProvider } from "@/lib/i18n";
import {
  getLocaleDisplayName,
  isRTLLocale,
  type PageKey,
} from "@/lib/i18n/strings";
import { Loader2 } from "lucide-react";
import { useEffect, type ReactNode } from "react";

export function LocaleProvider({
  children,
  locale,
  initialTranslations,
}: {
  children: ReactNode;
  locale: string;
  initialTranslations?: Partial<Record<PageKey, Record<string, string>>>;
}) {
  // Set dir and lang on html element
  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = isRTLLocale(locale) ? "rtl" : "ltr";
  }, [locale]);

  return (
    <I18nProvider
      initialLocale={locale}
      initialTranslations={initialTranslations}
    >
      <TranslationPreparationOverlay />
      {children}
    </I18nProvider>
  );
}

function TranslationPreparationOverlay() {
  const { locale, isLoading, isLocaleReady } = useI18n();
  const { t } = useTranslation("ui.common");

  if (locale === "en" || isLocaleReady || !isLoading) {
    return null;
  }

  const languageName = getLocaleDisplayName(locale);

  return (
    <div
      aria-busy="true"
      aria-live="polite"
      className="fixed inset-0 z-[120] overflow-hidden bg-white/92 backdrop-blur-2xl"
    >
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(15,23,42,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.03)_1px,transparent_1px)] bg-[size:44px_44px]" />
      <div className="absolute start-[8%] top-[14%] h-64 w-64 rounded-full bg-teal-500/[0.08] blur-3xl" />
      <div className="absolute end-[10%] top-[18%] h-72 w-72 rounded-full bg-amber-500/[0.08] blur-3xl" />

      <div className="relative flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-lg rounded-[28px] border border-slate-200/80 bg-white/90 p-8 shadow-[0_30px_80px_rgba(15,23,42,0.08)] ring-1 ring-slate-900/[0.03] sm:p-10">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-slate-500">
            <span className="h-2 w-2 rounded-full bg-teal-600 animate-pulse" />
            {t("language.preparingBadge")}
          </div>

          <div className="mb-6 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
            <div className="h-px flex-1 bg-gradient-to-r from-slate-200 via-slate-100 to-transparent" />
          </div>

          <h2 className="max-w-md text-3xl font-semibold tracking-tight text-slate-950 sm:text-[2rem]">
            {t("language.preparingTitle", { language: languageName })}
          </h2>
          <p className="mt-4 max-w-md text-base leading-7 text-slate-600">
            {t("language.preparingBody")}
          </p>
          <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
            {t("language.preparingHint", { language: languageName })}
          </p>

          <div className="mt-10">
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full w-2/3 animate-pulse rounded-full bg-slate-900" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
