import Link from "next/link";
import { LocalizedRouteShell } from "@/components/localized-route-shell";
import { getCachedTranslations, getLocale } from "@/lib/i18n/server";
import { strings, type PageKey } from "@/lib/i18n/strings";

export default async function AuthLayout({
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
