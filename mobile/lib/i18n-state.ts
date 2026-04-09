import { resolvePreferredLocale } from "./preferences";
import { getSafeMobileLocale } from "./mobile-bundles";

export function buildLocaleBootstrapPlan(input: {
  storedLocale: string | null;
  profileLocale: string | null;
  deviceLocales: string[];
}) {
  const locale = getSafeMobileLocale(resolvePreferredLocale(input));

  return {
    locale,
    shouldLoadTranslations: locale !== "en",
    isReadyImmediately: true,
  };
}
