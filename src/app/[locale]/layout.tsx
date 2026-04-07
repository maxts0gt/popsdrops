import { notFound } from "next/navigation";

import { LocalizedRouteShell } from "@/components/localized-route-shell";
import { getPublicCachedTranslations } from "@/lib/i18n/server";
import {
  DEFAULT_MARKETING_LOCALE,
  SUPPORTED_MARKETING_LOCALES,
} from "@/lib/i18n/public-locale";

export const revalidate = 60;

export async function generateStaticParams() {
  return [{ locale: DEFAULT_MARKETING_LOCALE }];
}

export default async function LocalizedPublicLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<Record<string, string | string[] | undefined>>;
}) {
  const routeParams = await params;
  const locale = typeof routeParams.locale === "string" ? routeParams.locale : null;

  if (!locale || !SUPPORTED_MARKETING_LOCALES.has(locale)) {
    notFound();
  }

  const initialTranslations = locale !== DEFAULT_MARKETING_LOCALE
    ? await getPublicCachedTranslations(locale)
    : undefined;

  return (
    <LocalizedRouteShell locale={locale} initialTranslations={initialTranslations}>
      {children}
    </LocalizedRouteShell>
  );
}
