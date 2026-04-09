import { LocalizedRouteShell } from "@/components/localized-route-shell";
import { getLocale, getPlatformCachedTranslations } from "@/lib/i18n/server";
import { getSafePlatformLocale } from "@/lib/i18n/platform-bundles";

export default async function PublicApplyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<Record<string, string | string[] | undefined>>;
}) {
  void params;
  const locale = getSafePlatformLocale(await getLocale());
  const initialTranslations = locale !== "en"
    ? await getPlatformCachedTranslations(locale)
    : undefined;

  return (
    <LocalizedRouteShell
      locale={locale}
      initialTranslations={initialTranslations}
      runtimeTranslationEnabled={false}
    >
      {children}
    </LocalizedRouteShell>
  );
}
