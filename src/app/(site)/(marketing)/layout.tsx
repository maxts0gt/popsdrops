import { MarketingHeader } from "@/components/marketing/header";
import { MarketingFooter } from "@/components/marketing/footer";
import { LocalizedRouteShell } from "@/components/localized-route-shell";
import { getLocale, getPublicCachedTranslations } from "@/lib/i18n/server";

export default async function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const initialTranslations = locale !== "en"
    ? await getPublicCachedTranslations(locale)
    : undefined;

  return (
    <LocalizedRouteShell
      locale={locale}
      initialTranslations={initialTranslations}
    >
      <MarketingHeader />
      <main>{children}</main>
      <MarketingFooter />
    </LocalizedRouteShell>
  );
}
