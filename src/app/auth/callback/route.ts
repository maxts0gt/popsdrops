import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { acceptPendingBrandTeamInvitationForUser } from "@/lib/brand-team-invitations";

type AuthCookie = {
  name: string;
  value: string;
  options: CookieOptions;
};

const supportedEmailOtpTypes = new Set([
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
]);

function isSupportedEmailOtpType(value: string | null) {
  return Boolean(value && supportedEmailOtpTypes.has(value));
}

export async function GET(request: NextRequest) {
  const nextRequest = request;
  const requestUrl = new URL(nextRequest.url);
  const { searchParams } = requestUrl;
  const origin = getAuthCallbackRedirectOrigin(nextRequest, requestUrl);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const next = normalizeAuthCallbackNextPath(searchParams.get("next"));

  if (code) {
    const { supabase, withAuthCookies } = createAuthCallbackClient(nextRequest);
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      return withAuthCookies(
        await redirectAuthenticatedUser(supabase, origin, next),
      );
    }
  }

  if (tokenHash && isSupportedEmailOtpType(type)) {
    const { supabase, withAuthCookies } = createAuthCallbackClient(nextRequest);
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: type as "signup" | "invite" | "magiclink" | "recovery" | "email_change" | "email",
    });

    if (!error) {
      if (data.session?.access_token && data.session?.refresh_token) {
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });

        if (sessionError) {
          return NextResponse.redirect(`${origin}/login?error=auth_failed`);
        }
      }

      return withAuthCookies(
        await redirectAuthenticatedUser(supabase, origin, next),
      );
    }
  }

  // Auth error - redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}

function createAuthCallbackClient(request: NextRequest) {
  let cookiesToSet: AuthCookie[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(nextCookies) {
          cookiesToSet = nextCookies;
        },
      },
    },
  );

  return {
    supabase,
    withAuthCookies(response: NextResponse) {
      cookiesToSet.forEach(({ name, value, options }) => {
        response.cookies.set(name, value, options);
      });
      return response;
    },
  };
}

function readForwardedHeader(value: string | null) {
  return value?.split(",")[0]?.trim() || null;
}

function getAuthCallbackRedirectOrigin(request: NextRequest, requestUrl: URL) {
  const host =
    readForwardedHeader(request.headers.get("x-forwarded-host")) ??
    readForwardedHeader(request.headers.get("host"));
  const protocol =
    readForwardedHeader(request.headers.get("x-forwarded-proto")) ??
    requestUrl.protocol.replace(/:$/, "");

  return host ? `${protocol}://${host}` : requestUrl.origin;
}

function normalizeAuthCallbackNextPath(value: string | null) {
  if (!value) return "/";

  let next = value;
  try {
    next = decodeURIComponent(next);
  } catch {
    next = value;
  }

  if (next.startsWith("http://") || next.startsWith("https://")) {
    try {
      const nextUrl = new URL(next);
      return `${nextUrl.pathname}${nextUrl.search}`;
    } catch {
      return "/";
    }
  }

  return next.startsWith("/") ? next : `/${next}`;
}

function isTeamInvitationReturnPath(next: string) {
  return next.startsWith("/team/invitations/");
}

async function redirectAuthenticatedUser(
  supabase: ReturnType<typeof createServerClient>,
  origin: string,
  next: string,
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  if (isTeamInvitationReturnPath(next)) {
    return NextResponse.redirect(`${origin}${next}`);
  }

  const inviteAcceptance = await acceptPendingBrandTeamInvitationForUser({
    userId: user.id,
    email: user.email,
    fullName:
      typeof user.user_metadata?.full_name === "string"
        ? user.user_metadata.full_name
        : typeof user.user_metadata?.name === "string"
          ? user.user_metadata.name
          : null,
    avatarUrl:
      typeof user.user_metadata?.avatar_url === "string"
        ? user.user_metadata.avatar_url
        : null,
  });

  if (inviteAcceptance.accepted) {
    return NextResponse.redirect(`${origin}/b/home`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, status")
    .eq("id", user.id)
    .single();

  if (!profile) {
    // New user - closed launch access is pending
    return NextResponse.redirect(`${origin}/pending-approval`);
  }

  if (profile.status === "pending") {
    return NextResponse.redirect(`${origin}/pending-approval`);
  }

  if (profile.status === "rejected") {
    return NextResponse.redirect(`${origin}/account-rejected`);
  }

  if (profile.status === "suspended") {
    return NextResponse.redirect(`${origin}/account-deleted`);
  }

  // Approved - redirect to role-based home
  const homeMap: Record<string, string> = {
    creator: "/i/home",
    brand: "/b/home",
    admin: "/admin",
  };

  return NextResponse.redirect(`${origin}${homeMap[profile.role] ?? next}`);
}
