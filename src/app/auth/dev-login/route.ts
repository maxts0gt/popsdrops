// DEV ONLY — admin-generated session for dev users. No password auth needed.
// Uses service role key to create user + generate magic link + verify server-side.
// Blocked in production.

import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";

export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const { searchParams, origin } = new URL(request.url);
  const role = searchParams.get("role") ?? "creator";
  const debug = searchParams.has("debug");

  const targetEmail = `dev-${role}@popsdrops.test`;
  const profileRole = role === "admin" ? "admin" : role === "brand" ? "brand" : "creator";
  const displayName = `Dev ${role.charAt(0).toUpperCase() + role.slice(1)}`;

  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // --- Step 1: Ensure user exists (create if needed, ignore "already exists") ---
  await admin.auth.admin.createUser({
    email: targetEmail,
    email_confirm: true,
    user_metadata: { full_name: displayName },
  });
  // If creation fails (user already exists), that's fine — generateLink will find them.

  // --- Step 2: Generate magic link (this works even when listUsers is broken) ---
  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({ type: "magiclink", email: targetEmail });

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

  // --- Step 3: Ensure profile exists ---
  await admin.from("profiles").upsert(
    {
      id: userId,
      email: targetEmail,
      full_name: displayName,
      role: profileRole,
      status: "approved",
      onboarding_completed: true,
    },
    { onConflict: "id" }
  );

  if (profileRole === "creator") {
    await admin.from("creator_profiles").upsert(
      {
        profile_id: userId,
        slug: "dev-creator",
        bio: "Dev test creator for local testing.",
        primary_market: "us",
        platforms: ["tiktok", "instagram"],
        niches: ["lifestyle", "tech"],
        markets: ["us", "uk"],
        languages: ["en"],
        content_formats: ["short_video", "reel"],
        rate_card: { tiktok: { short_video: 200 }, instagram: { reel: 150 } },
        rate_currency: "USD",
        tier: "rising",
        profile_completeness: 90,
      },
      { onConflict: "profile_id" }
    );
  } else if (profileRole === "brand") {
    await admin.from("brand_profiles").upsert(
      {
        profile_id: userId,
        company_name: "Dev Brand Co.",
        industry: "fashion",
        target_markets: ["us", "uk", "japan", "france"],
        website: "https://devbrand.example.com",
      },
      { onConflict: "profile_id" }
    );
  }

  // --- Step 4: Verify OTP to create session, collecting cookies ---
  const pendingCookies: Array<{
    name: string;
    value: string;
    options: Record<string, unknown>;
  }> = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          const header = request.headers.get("cookie") ?? "";
          return header
            .split(";")
            .filter(Boolean)
            .map((c) => {
              const [name, ...rest] = c.trim().split("=");
              return { name, value: rest.join("=") };
            });
        },
        setAll(cookiesToSet) {
          pendingCookies.push(...cookiesToSet);
        },
      },
    }
  );

  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: "magiclink",
    token_hash: linkData.properties.hashed_token,
  });

  if (verifyError) {
    return NextResponse.json(
      { error: `OTP verify failed: ${verifyError.message}` },
      { status: 500 }
    );
  }

  // --- Step 5: Redirect with auth cookies ---
  const homeMap: Record<string, string> = {
    creator: "/i/home",
    brand: "/b/home",
    admin: "/admin",
  };
  const dest = homeMap[profileRole] ?? "/";

  if (debug) {
    return NextResponse.json({ ok: true, userId, profileRole, dest, cookies: pendingCookies.length });
  }

  const response = NextResponse.redirect(`${origin}${dest}`);
  for (const cookie of pendingCookies) {
    response.cookies.set(cookie.name, cookie.value, cookie.options);
  }
  return response;
}
