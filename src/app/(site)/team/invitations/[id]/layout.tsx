import { LocalizedRouteShell } from "@/components/localized-route-shell";
import { getSafePlatformLocale } from "@/lib/i18n/platform-bundles";
import { getLocale, getPlatformCachedTranslations } from "@/lib/i18n/server";

export default async function TeamInvitationLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = getSafePlatformLocale(await getLocale());
  const initialTranslations =
    locale !== "en" ? await getPlatformCachedTranslations(locale) : undefined;

  return (
    <LocalizedRouteShell
      locale={locale}
      initialTranslations={initialTranslations}
    >
      {children}
    </LocalizedRouteShell>
  );
}
