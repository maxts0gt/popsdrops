import Link from "next/link";

import { LocalizedRouteShell } from "@/components/localized-route-shell";
import { SharedReportView } from "@/components/reports/shared-report-view";
import { getSafePlatformLocale } from "@/lib/i18n/platform-bundles";
import {
  getLocale,
  getPlatformCachedTranslations,
} from "@/lib/i18n/server";
import { getSourceStrings } from "@/lib/i18n/strings";
import { getSharedReportByToken } from "@/lib/reporting/shared-report-data";

interface SharedReportPageProps {
  params: Promise<{ token: string }>;
}

export const metadata = {
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const revalidate = 0;

export default async function SharedReportPage({ params }: SharedReportPageProps) {
  const { token } = await params;
  const locale = getSafePlatformLocale(await getLocale());
  const initialTranslations = locale !== "en"
    ? await getPlatformCachedTranslations(locale)
    : undefined;
  const payload = await getSharedReportByToken(token);

  if (!payload) {
    const strings = getSourceStrings("brand.report");

    return (
      <LocalizedRouteShell
        locale={locale}
        initialTranslations={initialTranslations}
      >
        <main className="grid min-h-svh place-items-center bg-slate-50 px-5 text-slate-900">
          <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
            <p className="text-sm font-semibold text-slate-500">PopsDrops</p>
            <h1 className="mt-3 text-2xl font-semibold">
              {strings["share.unavailableTitle"]}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {strings["share.unavailableBody"]}
            </p>
            <Link
              href="/"
              className="mt-5 inline-flex h-9 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-medium text-white"
            >
              {strings["share.unavailableCta"]}
            </Link>
          </section>
        </main>
      </LocalizedRouteShell>
    );
  }

  return (
    <LocalizedRouteShell
      locale={locale}
      initialTranslations={initialTranslations}
    >
      <SharedReportView data={payload.report} share={payload.share} />
    </LocalizedRouteShell>
  );
}
