import { getLocalizedMarketingMetadata } from "@/lib/i18n/public-metadata.server";

export { default } from "@/app/(site)/(marketing)/request-invite/page";

export async function generateMetadata({
  params,
}: {
  params: Promise<Record<string, string | string[] | undefined>>;
}) {
  const routeParams = await params;
  const locale = typeof routeParams.locale === "string" ? routeParams.locale : null;

  return getLocalizedMarketingMetadata("/request-invite", locale);
}
