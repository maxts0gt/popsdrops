import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  getMarketingLocaleFromPathname,
  isPublicPath,
  resolvePublicLocaleRouting,
} from "@/lib/i18n/public-locale";

const DEFAULT_LOCALE = "en";

/** Validate that a string is a plausible ISO 639-1 locale code (2-3 lowercase letters). */
function isValidLocaleCode(code: string): boolean {
  return /^[a-z]{2,3}$/.test(code);
}

function detectLocale(request: NextRequest): string {
  // 1. Cookie (user explicitly chose a language)
  const cookieLocale = request.cookies.get("popsdrops-locale")?.value;
  if (cookieLocale && isValidLocaleCode(cookieLocale)) {
    return cookieLocale;
  }

  // 2. Accept-Language header — accept ANY valid locale, Gemini handles the rest
  const acceptLang = request.headers.get("accept-language");
  if (acceptLang) {
    const preferred = acceptLang
      .split(",")
      .map((part) => {
        const [lang, q] = part.trim().split(";q=");
        return { lang: lang.split("-")[0].toLowerCase(), q: q ? parseFloat(q) : 1 };
      })
      .sort((a, b) => b.q - a.q)
      .map((p) => p.lang);

    for (const lang of preferred) {
      if (isValidLocaleCode(lang) && lang !== "en") {
        return lang;
      }
    }
  }

  return DEFAULT_LOCALE;
}

export async function updateSession(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const detectedLocale = detectLocale(request);
  const routeLocale = getMarketingLocaleFromPathname(pathname);
  const publicRouting = resolvePublicLocaleRouting(
    pathname,
    request.nextUrl.search,
    detectedLocale,
  );
  const isPublic = isPublicPath(pathname);
  const requestHeaders = new Headers(request.headers);
  if (routeLocale) {
    requestHeaders.set("x-locale", routeLocale);
  }

  if (publicRouting?.action === "redirect") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = publicRouting.destination.split("?")[0];
    redirectUrl.search = publicRouting.destination.includes("?")
      ? `?${publicRouting.destination.split("?")[1]}`
      : "";

    const redirectResponse = NextResponse.redirect(redirectUrl);
    redirectResponse.cookies.set("popsdrops-locale", publicRouting.locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
    return redirectResponse;
  }

  if (isPublic) {
    const publicResponse = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
    if (routeLocale) {
      publicResponse.headers.set("content-language", routeLocale);
      publicResponse.cookies.set("popsdrops-locale", routeLocale, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
      });
    }
    return publicResponse;
  }

  let supabaseResponse = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request: {
              headers: requestHeaders,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: use getUser(), not getSession() — getUser() validates the JWT
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not logged in → redirect to login
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("returnTo", pathname);
    return NextResponse.redirect(url);
  }

  // Check profile for role-based routing
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .single();

  // No profile yet → onboarding
  if (!profile) {
    if (!pathname.startsWith("/onboarding")) {
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding";
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // Pending approval
  if (profile.status === "pending") {
    if (
      pathname !== "/pending-approval" &&
      !pathname.startsWith("/onboarding")
    ) {
      const url = request.nextUrl.clone();
      url.pathname = "/pending-approval";
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // Rejected
  if (profile.status === "rejected") {
    if (pathname !== "/account-rejected") {
      const url = request.nextUrl.clone();
      url.pathname = "/account-rejected";
      return NextResponse.redirect(url);
    }
    return supabaseResponse;
  }

  // Role-based access control
  if (pathname.startsWith("/i/") && profile.role !== "creator") {
    const url = request.nextUrl.clone();
    url.pathname = profile.role === "brand" ? "/b/home" : "/admin";
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/b/") && profile.role !== "brand") {
    const url = request.nextUrl.clone();
    url.pathname = profile.role === "creator" ? "/i/home" : "/admin";
    return NextResponse.redirect(url);
  }

  if (pathname.startsWith("/admin") && profile.role !== "admin") {
    const url = request.nextUrl.clone();
    url.pathname = profile.role === "creator" ? "/i/home" : "/b/home";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
