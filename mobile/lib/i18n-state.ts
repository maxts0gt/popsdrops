import { resolvePreferredLocale } from "./preferences";

export function buildLocaleBootstrapPlan(input: {
  storedLocale: string | null;
  profileLocale: string | null;
  deviceLocales: string[];
}) {
  const locale = resolvePreferredLocale(input);

  return {
    locale,
    shouldLoadTranslations: locale !== "en",
    isReadyImmediately: true,
  };
}
