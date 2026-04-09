import Link from "next/link";
import { LocalizedRouteShell } from "@/components/localized-route-shell";
import { getLocale, getPlatformCachedTranslations } from "@/lib/i18n/server";
import { getSafePlatformLocale } from "@/lib/i18n/platform-bundles";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = getSafePlatformLocale(await getLocale());
  const initialTranslations = locale !== "en"
    ? await getPlatformCachedTranslations(locale)
    : undefined;

  return (
    <LocalizedRouteShell
      locale={locale}
      initialTranslations={initialTranslations}
    >
      <div className="flex min-h-svh flex-col items-center justify-center bg-background px-4">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <Link href="/" className="inline-block">
              <span className="text-lg font-extrabold tracking-tight text-foreground">PopsDrops</span>
            </Link>
          </div>
          {children}
        </div>
      </div>
    </LocalizedRouteShell>
  );
}
