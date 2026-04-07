import { LocalizedRouteShell } from "@/components/localized-route-shell";
import { getCachedTranslations, getLocale } from "@/lib/i18n/server";
import { strings, type PageKey } from "@/lib/i18n/strings";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const allPageKeys = Object.keys(strings) as PageKey[];
  const initialTranslations = locale !== "en"
    ? await getCachedTranslations(allPageKeys, locale)
    : undefined;

  return (
    <LocalizedRouteShell locale={locale} initialTranslations={initialTranslations}>
      {children}
    </LocalizedRouteShell>
  );
}
