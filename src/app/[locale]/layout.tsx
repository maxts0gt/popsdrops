import { notFound } from "next/navigation";

import { DocumentShell } from "@/components/document-shell";
import { LocalizedRouteShell } from "@/components/localized-route-shell";
import { getPublicCachedTranslations } from "@/lib/i18n/server";
import {
  DEFAULT_MARKETING_LOCALE,
  SUPPORTED_MARKETING_LOCALES,
} from "@/lib/i18n/public-locale";
import { PUBLIC_TRANSLATION_LOCALES } from "@/lib/i18n/generated/public-translation-locales";
import { ROOT_METADATA } from "@/lib/root-metadata";
import "../globals.css";

export const revalidate = 60;
export const metadata = ROOT_METADATA;

export async function generateStaticParams() {
  return PUBLIC_TRANSLATION_LOCALES.map((locale) => ({ locale }));
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
    <DocumentShell locale={locale}>
      <LocalizedRouteShell
        locale={locale}
        initialTranslations={initialTranslations}
        runtimeTranslationEnabled={false}
      >
        {children}
      </LocalizedRouteShell>
    </DocumentShell>
  );
}
