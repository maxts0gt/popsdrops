import { MarketingHeader } from "@/components/marketing/header";
import { MarketingFooter } from "@/components/marketing/footer";
import { LocalizedRouteShell } from "@/components/localized-route-shell";
import { getCachedTranslations, getLocale } from "@/lib/i18n/server";
import { strings, type PageKey } from "@/lib/i18n/strings";

export default async function MarketingLayout({
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
      <MarketingHeader />
      <main>{children}</main>
      <MarketingFooter />
    </LocalizedRouteShell>
  );
}
