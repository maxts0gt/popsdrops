// DEV ONLY - admin-generated session for dev users. No password auth needed.
// Uses service role key to create user + generate magic link + verify server-side.
// Blocked in production.

import { NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  getDevBrandTeamDisplayName,
  getDevBrandTeamEmail,
  getDevBrandTeamRole,
  getDevBrandCompanyName,
  getDevDisplayName,
  getDevCreatorSlug,
  getDevLoginRedirectOrigin,
  getDevLoginRole,
  getDevUserEmail,
  type DevBrandTeamRole,
  type DevLoginRole,
} from "@/lib/dev-users";
import { createAdminClient } from "@/lib/supabase/admin";

const DEV_LOGIN_REMOTE_ATTEMPTS = 3;
const DEV_LOGIN_SESSION_CACHE_TTL_MS = 10 * 60 * 1000;
const DEV_LOGIN_SESSION_CACHE_VERSION = "clean-otp-v2";

type DevLoginCookie = {
  name: string;
  value: string;
  options: Record<string, unknown>;
};

type CachedDevLoginSession = {
  email: string;
  userId: string;
  profileRole: DevLoginRole;
  workspaceIdentity: string;
  cookies: DevLoginCookie[];
  expiresAt: number;
};

type DevLoginGlobal = typeof globalThis & {
  __popsdropsDevLoginSessionCache?: Map<string, CachedDevLoginSession>;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function getDevLoginSessionCache() {
  const devGlobal = globalThis as DevLoginGlobal;
  devGlobal.__popsdropsDevLoginSessionCache ??= new Map();
  return devGlobal.__popsdropsDevLoginSessionCache;
}

function getDevLoginSessionCacheKey(workspaceIdentity: string) {
  return `${DEV_LOGIN_SESSION_CACHE_VERSION}:${workspaceIdentity}`;
}

function getCachedDevLoginSession(workspaceIdentity: string, targetEmail: string) {
  const cache = getDevLoginSessionCache();
  const cacheKey = getDevLoginSessionCacheKey(workspaceIdentity);
  const cachedSession = cache.get(cacheKey);
  if (!cachedSession) return null;

  if (cachedSession.expiresAt <= Date.now()) {
    cache.delete(cacheKey);
    return null;
  }

  if (
    cachedSession.email !== targetEmail ||
    cachedSession.workspaceIdentity !== workspaceIdentity
  ) {
    cache.delete(cacheKey);
    return null;
  }

  return cachedSession;
}

function setCachedDevLoginSession(session: Omit<CachedDevLoginSession, "expiresAt">) {
  getDevLoginSessionCache().set(
    getDevLoginSessionCacheKey(session.workspaceIdentity),
    {
      ...session,
      expiresAt: Date.now() + DEV_LOGIN_SESSION_CACHE_TTL_MS,
    },
  );
}

function buildDevLoginResponse({
  cached,
  cookies,
  debug,
  dest,
  profileRole,
  redirectOrigin,
  teamRole,
  userId,
  workspaceIdentity,
}: {
  cached: boolean;
  cookies: DevLoginCookie[];
  debug: boolean;
  dest: string;
  profileRole: DevLoginRole;
  redirectOrigin: string;
  teamRole?: DevBrandTeamRole | null;
  userId: string;
  workspaceIdentity: string;
}) {
  if (debug) {
    return NextResponse.json({
      ok: true,
      cached,
      userId,
      profileRole,
      teamRole,
      workspaceIdentity,
      dest,
      cookies: cookies.length,
    });
  }

  const response = NextResponse.redirect(`${redirectOrigin}${dest}`);
  for (const cookie of cookies) {
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }
  return response;
}

async function withDevLoginRetry<T extends { error: { message: string } | null }>(
  operation: () => Promise<T>,
) {
  let result = await operation();

  for (let attempt = 1; result.error && attempt < DEV_LOGIN_REMOTE_ATTEMPTS; attempt += 1) {
    await sleep(250 * attempt);
    result = await operation();
  }

  return result;
}

type DevAdminClient = ReturnType<typeof createAdminClient>;

async function ensureDevProfile({
  admin,
  displayName,
  email,
  profileRole,
  userId,
}: {
  admin: DevAdminClient;
  displayName: string;
  email: string;
  profileRole: DevLoginRole;
  userId: string;
}) {
  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: userId,
      email,
      full_name: displayName,
      role: profileRole,
      status: "approved",
      onboarding_completed: true,
    },
    { onConflict: "id" },
  );

  if (profileError) {
    throw new Error(`Profile failed: ${profileError.message}`);
  }
}

async function resolveDevUserId({
  admin,
  displayName,
  email,
}: {
  admin: DevAdminClient;
  displayName: string;
  email: string;
}) {
  const createResult = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: displayName },
  });

  if (createResult.data.user?.id) return createResult.data.user.id;

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .maybeSingle();

  if (profileError) throw new Error(`Profile lookup failed: ${profileError.message}`);
  if (profile?.id) return profile.id;

  const { data: linkData, error: linkError } = await withDevLoginRetry(() =>
    admin.auth.admin.generateLink({ type: "magiclink", email }),
  );

  if (linkError || !linkData.user?.id) {
    throw new Error(`User lookup failed: ${linkError?.message ?? "no user id"}`);
  }

  return linkData.user.id;
}

async function ensureDevBrandWorkspace({
  admin,
  brandId,
}: {
  admin: DevAdminClient;
  brandId: string;
}) {
  const { error: brandProfileError } = await admin.from("brand_profiles").upsert(
    {
      profile_id: brandId,
      company_name: getDevBrandCompanyName(),
      industry: "fashion_apparel",
      target_markets: ["us", "gb", "jp", "fr"],
      website: "https://devbrand.example.com",
    },
    { onConflict: "profile_id" },
  );

  if (brandProfileError) {
    throw new Error(`Brand profile failed: ${brandProfileError.message}`);
  }

  await ensureDevBrandTeamMembership({
    admin,
    brandId,
    role: "owner",
    userId: brandId,
  });
}

async function ensureDevBrandOwner(admin: DevAdminClient) {
  const ownerEmail = getDevBrandTeamEmail("owner");
  const ownerDisplayName = getDevBrandTeamDisplayName("owner");
  const ownerUserId = await resolveDevUserId({
    admin,
    displayName: ownerDisplayName,
    email: ownerEmail,
  });

  await ensureDevProfile({
    admin,
    displayName: ownerDisplayName,
    email: ownerEmail,
    profileRole: "brand",
    userId: ownerUserId,
  });
  await ensureDevBrandWorkspace({ admin, brandId: ownerUserId });

  return ownerUserId;
}

async function ensureDevBrandTeamMembership({
  admin,
  brandId,
  role,
  userId,
}: {
  admin: DevAdminClient;
  brandId: string;
  role: DevBrandTeamRole;
  userId: string;
}) {
  const { error: memberError } = await admin.from("brand_team_members").upsert(
    {
      brand_id: brandId,
      user_id: userId,
      role,
      invited_by: role === "owner" ? null : brandId,
      accepted_at: new Date().toISOString(),
    },
    { onConflict: "brand_id,user_id" },
  );

  if (memberError) {
    throw new Error(`Brand team member failed: ${memberError.message}`);
  }
}

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const redirectOrigin = getDevLoginRedirectOrigin({
    requestUrl: request.url,
    host: request.headers.get("host"),
    forwardedProto: request.headers.get("x-forwarded-proto"),
  });
  const role = getDevLoginRole(searchParams.get("role"));
  const devBrandTeamRole =
    role === "brand" ? getDevBrandTeamRole(searchParams.get("teamRole")) : null;
  const teamRole = devBrandTeamRole;
  const debug = searchParams.has("debug");

  const targetEmail =
    role === "brand" ? getDevBrandTeamEmail(teamRole) : getDevUserEmail(role);
  const profileRole = role;
  const displayName =
    role === "brand" ? getDevBrandTeamDisplayName(teamRole) : getDevDisplayName(role);
  const workspaceIdentity =
    role === "brand" ? `brand:${teamRole}` : profileRole;
  const homeMap: Record<string, string> = {
    creator: "/i/home",
    brand: "/b/home",
    admin: "/admin",
  };
  const dest = homeMap[profileRole] ?? "/";

  const admin = createAdminClient();

  const cachedSession = getCachedDevLoginSession(workspaceIdentity, targetEmail);
  if (cachedSession) {
    try {
      await ensureDevProfile({
        admin,
        displayName,
        email: targetEmail,
        profileRole,
        userId: cachedSession.userId,
      });

      if (profileRole === "brand") {
        if (teamRole === "owner") {
          await ensureDevBrandWorkspace({
            admin,
            brandId: cachedSession.userId,
          });
        } else if (teamRole) {
          const brandId = await ensureDevBrandOwner(admin);
          await admin.from("brand_profiles").delete().eq("profile_id", cachedSession.userId);
          await ensureDevBrandTeamMembership({
            admin,
            brandId,
            role: teamRole,
            userId: cachedSession.userId,
          });
        }
      }
    } catch (error) {
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "Dev session failed",
        },
        { status: 500 }
      );
    }

    return buildDevLoginResponse({
      cached: true,
      cookies: cachedSession.cookies,
      debug,
      dest,
      profileRole,
      redirectOrigin,
      teamRole: devBrandTeamRole,
      userId: cachedSession.userId,
      workspaceIdentity,
    });
  }

  // --- Step 1: Ensure user exists (create if needed, ignore "already exists") ---
  await admin.auth.admin.createUser({
    email: targetEmail,
    email_confirm: true,
    user_metadata: { full_name: displayName },
  });
  // If creation fails (user already exists), that's fine - generateLink will find them.

  // --- Step 2: Generate magic link (this works even when listUsers is broken) ---
  const { data: linkData, error: linkError } =
    await withDevLoginRetry(() =>
      admin.auth.admin.generateLink({ type: "magiclink", email: targetEmail })
    );

  if (linkError || !linkData?.properties?.hashed_token) {
    return NextResponse.json(
      { error: `Link failed: ${linkError?.message ?? "no token"}` },
      { status: 500 }
    );
  }

  // Get the user ID from the link response
  const userId = linkData.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "No user ID in link response" }, { status: 500 });
  }

  try {
    await ensureDevProfile({
      admin,
      displayName,
      email: targetEmail,
      profileRole,
      userId,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Profile failed" },
      { status: 500 }
    );
  }

  if (profileRole === "creator") {
    const { error: creatorProfileError } = await admin.from("creator_profiles").upsert(
      {
        profile_id: userId,
        slug: getDevCreatorSlug(userId),
        bio: "Dev test creator for local testing.",
        primary_market: "us",
        platforms: ["tiktok", "instagram"],
        niches: ["lifestyle", "tech"],
        markets: ["us", "gb"],
        languages: ["en"],
        content_formats: ["short_video", "reel"],
        rate_card: { tiktok: { short_video: 200 }, instagram: { reel: 150 } },
        rate_currency: "USD",
        tier: "rising",
        profile_completeness: 90,
      },
      { onConflict: "profile_id" }
    );
    if (creatorProfileError) {
      return NextResponse.json(
        { error: `Creator profile failed: ${creatorProfileError.message}` },
        { status: 500 }
      );
    }
  } else if (profileRole === "brand") {
    try {
      if (teamRole === "owner") {
        await ensureDevBrandWorkspace({ admin, brandId: userId });
      } else if (teamRole) {
        const brandId = await ensureDevBrandOwner(admin);
        await admin.from("brand_profiles").delete().eq("profile_id", userId);
        await ensureDevBrandTeamMembership({
          admin,
          brandId,
          role: teamRole,
          userId,
        });
      }
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Brand workspace failed",
        },
        { status: 500 }
      );
    }
  }

  // --- Step 4: Verify OTP to create session, collecting cookies ---
  const pendingCookies: DevLoginCookie[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll(cookiesToSet) {
          pendingCookies.push(...cookiesToSet);
        },
      },
    }
  );

  const { error: verifyError } = await withDevLoginRetry(() =>
    supabase.auth.verifyOtp({
      type: "magiclink",
      token_hash: linkData.properties.hashed_token,
    })
  );

  if (verifyError) {
    return NextResponse.json(
      { error: `OTP verify failed: ${verifyError.message}` },
      { status: 500 }
    );
  }

  // --- Step 5: Redirect with auth cookies ---
  setCachedDevLoginSession({
    email: targetEmail,
    userId,
    profileRole,
    workspaceIdentity,
    cookies: pendingCookies,
  });

  return buildDevLoginResponse({
    cached: false,
    cookies: pendingCookies,
    debug,
    dest,
    profileRole,
    redirectOrigin,
    teamRole: devBrandTeamRole,
    userId,
    workspaceIdentity,
  });
}
