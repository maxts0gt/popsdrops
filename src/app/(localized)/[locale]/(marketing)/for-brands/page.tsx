import { getLocalizedMarketingMetadata } from "@/lib/i18n/public-metadata.server";

export { default } from "@/app/(site)/(marketing)/for-brands/page";

export async function generateMetadata({
  params,
}: {
  params: Promise<Record<string, string | string[] | undefined>>;
}) {
  const routeParams = await params;
  const locale = typeof routeParams.locale === "string" ? routeParams.locale : null;

  return getLocalizedMarketingMetadata("/for-brands", locale);
}
