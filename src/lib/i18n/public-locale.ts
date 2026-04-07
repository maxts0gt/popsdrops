import { SUPPORTED_LOCALES } from "./strings";

export const DEFAULT_MARKETING_LOCALE = "en";

export const LOCALIZED_MARKETING_PATHS = new Set([
  "/",
  "/about",
  "/for-brands",
  "/for-creators",
  "/request-invite",
]);

export const ROOT_PUBLIC_PATHS = new Set([
  ...LOCALIZED_MARKETING_PATHS,
  "/partners",
  "/terms",
  "/privacy",
  "/login",
  "/dev/login",
]);

// Anonymous public traffic is restricted to our curated marketing locales so
// crawlers and agents cannot spray arbitrary cold locales into Gemini/DB.
export const SUPPORTED_MARKETING_LOCALES = new Set(SUPPORTED_LOCALES);
const PUBLIC_PATH_PREFIXES = ["/auth/", "/c/", "/apply/"] as const;

export type PublicLocaleRoutingDecision =
  | {
      action: "redirect";
      destination: string;
      locale: string;
    };

function normalizePathname(pathname: string): string {
  if (!pathname) {
    return "/";
  }

  const stripped = pathname.split("?")[0].replace(/\/+$/, "");
  return stripped === "" ? "/" : stripped;
}

export function getSafePublicLocale(locale: string | null | undefined): string {
  return locale && SUPPORTED_MARKETING_LOCALES.has(locale)
    ? locale
    : DEFAULT_MARKETING_LOCALE;
}

export function getMarketingLocaleFromPathname(
  pathname: string,
): string | null {
  const normalized = normalizePathname(pathname);
  const segments = normalized.split("/").filter(Boolean);
  const candidate = segments[0];

  if (!candidate || !SUPPORTED_MARKETING_LOCALES.has(candidate)) {
    return null;
  }

  const restPath = segments.length === 1 ? "/" : `/${segments.slice(1).join("/")}`;
  return LOCALIZED_MARKETING_PATHS.has(restPath) ? candidate : null;
}

export function stripMarketingLocalePrefix(pathname: string): string {
  const normalized = normalizePathname(pathname);
  const locale = getMarketingLocaleFromPathname(normalized);

  if (!locale) {
    return normalized;
  }

  const stripped = normalized.slice(`/${locale}`.length);
  return stripped === "" ? "/" : stripped;
}

export function isLocalePrefixedMarketingPath(pathname: string): boolean {
  return getMarketingLocaleFromPathname(pathname) != null;
}

export function buildLocalizedMarketingPath(
  locale: string,
  href: string,
): string {
  const safeLocale = getSafePublicLocale(locale);
  const [rawPathname, query = ""] = href.split("?");
  const pathname = normalizePathname(rawPathname);

  if (!LOCALIZED_MARKETING_PATHS.has(pathname)) {
    return href;
  }

  const localizedPath = pathname === "/"
    ? `/${safeLocale}`
    : `/${safeLocale}${pathname}`;

  return query ? `${localizedPath}?${query}` : localizedPath;
}

export function isPublicPath(pathname: string): boolean {
  const normalized = normalizePathname(pathname);

  if (ROOT_PUBLIC_PATHS.has(normalized) || isLocalePrefixedMarketingPath(normalized)) {
    return true;
  }

  return PUBLIC_PATH_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function resolvePublicLocaleRouting(
  pathname: string,
  search: string,
  locale: string,
): PublicLocaleRoutingDecision | null {
  const normalized = normalizePathname(pathname);

  if (!LOCALIZED_MARKETING_PATHS.has(normalized)) {
    return null;
  }

  const safeLocale = getSafePublicLocale(locale);
  const currentTarget = `${normalized}${search}`;
  const localizedTarget = buildLocalizedMarketingPath(safeLocale, currentTarget);

  return localizedTarget === currentTarget
    ? null
    : {
        action: "redirect",
        destination: localizedTarget,
        locale: safeLocale,
      };
}

export function getPublicLocaleNavigationHref(
  locale: string,
  pathname: string,
  search: string,
): string | null {
  const normalized = normalizePathname(pathname);
  const unprefixedPath = stripMarketingLocalePrefix(normalized);

  if (
    !LOCALIZED_MARKETING_PATHS.has(unprefixedPath) &&
    !isLocalePrefixedMarketingPath(normalized)
  ) {
    return null;
  }

  return buildLocalizedMarketingPath(
    locale,
    `${unprefixedPath}${search}`,
  );
}
