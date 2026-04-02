#!/usr/bin/env node
/**
 * Seed dev users via Supabase Admin API.
 *
 * Creates real auth users with passwords so the dev-login route works.
 * Safe to run multiple times — skips users that already exist.
 *
 * Usage:  node scripts/seed-dev-users.mjs
 * Requires: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const DEV_PASSWORD = "dev-password-123";

const DEV_USERS = [
  {
    email: "creator@dev.popsdrops.com",
    full_name: "Dev Creator",
    role: "creator",
    user_metadata: { full_name: "Dev Creator" },
  },
  {
    email: "brand@dev.popsdrops.com",
    full_name: "Dev Brand Manager",
    role: "brand",
    user_metadata: { full_name: "Dev Brand Manager" },
  },
  {
    email: "admin@dev.popsdrops.com",
    full_name: "Dev Admin",
    role: "admin",
    user_metadata: { full_name: "Dev Admin" },
  },
];

async function seedUser(user) {
  // Check if user already exists
  const { data: existing } = await supabase.auth.admin.listUsers();
  const found = existing?.users?.find((u) => u.email === user.email);

  let userId;

  if (found) {
    console.log(`  ✓ ${user.email} already exists (${found.id})`);
    // Update password in case it changed
    await supabase.auth.admin.updateUserById(found.id, { password: DEV_PASSWORD });
    userId = found.id;
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: DEV_PASSWORD,
      email_confirm: true,
      user_metadata: user.user_metadata,
    });

    if (error) {
      console.error(`  ✗ Failed to create ${user.email}:`, error.message);
      return;
    }

    userId = data.user.id;
    console.log(`  + Created ${user.email} (${userId})`);
  }

  // Upsert profile
  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: userId,
      email: user.email,
      full_name: user.full_name,
      role: user.role,
      status: "active",
      onboarding_completed: true,
    },
    { onConflict: "id" }
  );

  if (profileError) {
    console.error(`  ✗ Failed to upsert profile for ${user.email}:`, profileError.message);
  } else {
    console.log(`  ✓ Profile OK for ${user.email} (role: ${user.role})`);
  }

  // If creator, upsert a creator_profiles row
  if (user.role === "creator") {
    const { error: cpError } = await supabase.from("creator_profiles").upsert(
      {
        profile_id: userId,
        slug: "dev-creator",
        bio: "Development test creator for local testing.",
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
    if (cpError) {
      console.error(`  ✗ Failed to upsert creator_profiles:`, cpError.message);
    } else {
      console.log(`  ✓ Creator profile OK`);
    }
  }

  // If brand, upsert a brand_profiles row
  if (user.role === "brand") {
    const { error: bpError } = await supabase.from("brand_profiles").upsert(
      {
        profile_id: userId,
        company_name: "Dev Brand Co.",
        industry: "fashion",
        target_markets: ["us", "uk", "japan", "france"],
        website: "https://devbrand.example.com",
      },
      { onConflict: "profile_id" }
    );
    if (bpError) {
      console.error(`  ✗ Failed to upsert brand_profiles:`, bpError.message);
    } else {
      console.log(`  ✓ Brand profile OK`);
    }
  }
}

async function main() {
  console.log("Seeding dev users...\n");

  for (const user of DEV_USERS) {
    await seedUser(user);
    console.log();
  }

  console.log("Done! Dev login credentials:");
  console.log(`  Password for all: ${DEV_PASSWORD}`);
  console.log(`  Creator: creator@dev.popsdrops.com`);
  console.log(`  Brand:   brand@dev.popsdrops.com`);
  console.log(`  Admin:   admin@dev.popsdrops.com`);
  console.log(`\n  Login at: http://localhost:3000/dev/login`);
}

main().catch(console.error);
