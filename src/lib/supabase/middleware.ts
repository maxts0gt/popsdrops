import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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
  const locale = detectLocale(request);
  let supabaseResponse = NextResponse.next({ request });
  // Pass locale to Server Components via header
  supabaseResponse.headers.set("x-locale", locale);

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
          supabaseResponse = NextResponse.next({ request });
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

  const pathname = request.nextUrl.pathname;

  // Public routes — no auth required
  const publicPaths = [
    "/",
    "/for-brands",
    "/for-creators",
    "/partners",
    "/request-invite",
    "/terms",
    "/privacy",
    "/login",
    "/dev/login",
  ];

  const isPublic =
    publicPaths.includes(pathname) ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/c/") ||
    pathname.startsWith("/apply/");

  if (isPublic) {
    return supabaseResponse;
  }

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
