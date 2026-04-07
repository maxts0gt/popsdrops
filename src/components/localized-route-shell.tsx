import type { ReactNode } from "react";

import { LocaleProvider } from "@/components/locale-provider";
import { Toaster } from "@/components/ui/sonner";
import { isRTLLocale, type PageKey } from "@/lib/i18n/strings";

export function LocalizedRouteShell({
  children,
  initialTranslations,
  locale,
}: {
  children: ReactNode;
  initialTranslations?: Partial<Record<PageKey, Record<string, string>>>;
  locale: string;
}) {
  const isRTL = isRTLLocale(locale);

  return (
    <LocaleProvider locale={locale} initialTranslations={initialTranslations}>
      {children}
      <Toaster position={isRTL ? "top-left" : "top-right"} richColors />
    </LocaleProvider>
  );
}
