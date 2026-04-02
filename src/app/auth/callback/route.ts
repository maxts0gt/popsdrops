import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Check if user has a profile
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role, status")
          .eq("id", user.id)
          .single();

        if (!profile) {
          // New user — needs onboarding
          return NextResponse.redirect(`${origin}/onboarding`);
        }

        if (profile.status === "pending") {
          return NextResponse.redirect(`${origin}/pending-approval`);
        }

        if (profile.status === "rejected") {
          return NextResponse.redirect(`${origin}/account-rejected`);
        }

        // Approved — redirect to role-based home
        const homeMap: Record<string, string> = {
          creator: "/i/home",
          brand: "/b/home",
          admin: "/admin",
        };

        return NextResponse.redirect(
          `${origin}${homeMap[profile.role] ?? next}`
        );
      }
    }
  }

  // Auth error — redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth_failed`);
}
