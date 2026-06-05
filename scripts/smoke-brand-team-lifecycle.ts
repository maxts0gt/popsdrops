#!/usr/bin/env node
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { acceptPendingBrandTeamInvitationForUser } from "../src/lib/brand-team-invitations";

config({ path: resolve(process.cwd(), ".env.local"), quiet: true });

const SMOKE_SOURCE = "smoke-brand-team-lifecycle";
const DEFAULT_EMAIL_DOMAIN = "tengrivertex.com";
const SMOKE_OWNER_EMAIL_PREFIX = "support+pdteam-owner";
const SMOKE_MEMBER_EMAIL_PREFIX = "support+pdteam-member";

type SmokeProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  status: string;
  onboarding_completed: boolean | null;
};

type SmokeBrandProfileRow = {
  profile_id: string;
  company_name: string;
  contact_email: string | null;
};

type SmokeInvitationRow = {
  id: string;
  brand_id: string;
  email: string;
  role: string;
  status: string;
  invited_by: string;
  expires_at: string;
};

type SmokeMemberRow = {
  id: string;
  brand_id: string;
  user_id: string;
  role: string;
  accepted_at: string | null;
};

type SmokeAuditRow = {
  id: string;
  action: string;
  target_id: string;
  metadata: Record<string, unknown> | null;
};

type BrandTeamLifecycleFixture = {
  smokeId: string;
  ownerAuthId: string;
  memberAuthId: string;
  ownerEmail: string;
  memberEmail: string;
  invitationId: string;
};

function createAdminClientFromEnv() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.",
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function checkedQuery<T>(
  label: string,
  query: PromiseLike<{ data: T; error: { message: string } | null }>,
): Promise<T> {
  const { data, error } = await query;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

function readArg(name: string) {
  const prefix = `${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function buildSmokeEmail(kind: "owner" | "member") {
  const prefix =
    kind === "owner" ? SMOKE_OWNER_EMAIL_PREFIX : SMOKE_MEMBER_EMAIL_PREFIX;
  return `${prefix}-${Date.now()}-${randomUUID().slice(0, 8)}@${DEFAULT_EMAIL_DOMAIN}`;
}

function isSmokeEmail(email: string) {
  return email.startsWith("support+pdteam-") && email.endsWith(`@${DEFAULT_EMAIL_DOMAIN}`);
}

async function createSmokeAuthUser(
  admin: SupabaseClient,
  email: string,
  fullName: string,
) {
  const created = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: fullName, smoke_source: SMOKE_SOURCE },
  });

  if (created.error) {
    throw new Error(`Create ${email} auth user: ${created.error.message}`);
  }

  const userId = created.data.user?.id;
  if (!userId) throw new Error(`Create ${email} auth user returned no id.`);
  return userId;
}

async function setupBrandTeamLifecycleFixture(): Promise<BrandTeamLifecycleFixture> {
  const admin = createAdminClientFromEnv();
  const now = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const smokeId = `pd_brand_team_${randomUUID()}`;
  const ownerEmail = readArg("--owner")?.toLowerCase() ?? buildSmokeEmail("owner");
  const memberEmail = readArg("--member")?.toLowerCase() ?? buildSmokeEmail("member");

  if (!isSmokeEmail(ownerEmail) || !isSmokeEmail(memberEmail)) {
    throw new Error("Brand team lifecycle smoke only accepts support+pdteam-* emails.");
  }

  const ownerAuthId = await createSmokeAuthUser(
    admin,
    ownerEmail,
    "PopsDrops Team Owner Smoke",
  );
  const memberAuthId = await createSmokeAuthUser(
    admin,
    memberEmail,
    "PopsDrops Team Member Smoke",
  );

  await checkedQuery(
    "Create smoke owner profile",
    admin
      .from("profiles")
      .upsert(
        {
          id: ownerAuthId,
          email: ownerEmail,
          full_name: "PopsDrops Team Owner Smoke",
          role: "brand",
          status: "approved",
          onboarding_completed: true,
          updated_at: now,
        },
        { onConflict: "id" },
      ),
  );

  await checkedQuery(
    "Create smoke brand profile",
    admin.from("brand_profiles").insert({
      profile_id: ownerAuthId,
      company_name: "PopsDrops Team Smoke",
      industry: "beauty_skincare",
      target_markets: ["global"],
      platforms: ["instagram"],
      website: "https://popsdrops.com",
      description: `${SMOKE_SOURCE}: isolated brand workspace. ${smokeId}`,
      contact_name: "PopsDrops Team Owner Smoke",
      contact_email: ownerEmail,
    }),
  );

  await checkedQuery(
    "Create accepted smoke owner member",
    admin.from("brand_team_members").insert({
      brand_id: ownerAuthId,
      user_id: ownerAuthId,
      role: "owner",
      accepted_at: now,
      created_at: now,
      updated_at: now,
    }),
  );

  const invitation = await checkedQuery<{ id: string }>(
    "Create pending smoke teammate invite",
    admin
      .from("brand_team_invitations")
      .insert({
        brand_id: ownerAuthId,
        email: memberEmail,
        role: "manager",
        status: "pending",
        invited_by: ownerAuthId,
        invited_at: now,
        expires_at: expiresAt,
        updated_at: now,
      })
      .select("id")
      .single(),
  );

  return {
    smokeId,
    ownerAuthId,
    memberAuthId,
    ownerEmail,
    memberEmail,
    invitationId: invitation.id,
  };
}

async function readInvitation(admin: SupabaseClient, invitationId: string) {
  return checkedQuery<SmokeInvitationRow>(
    "Read smoke brand team invitation",
    admin
      .from("brand_team_invitations")
      .select("id, brand_id, email, role, status, invited_by, expires_at")
      .eq("id", invitationId)
      .single(),
  );
}

async function readMember(
  admin: SupabaseClient,
  brandId: string,
  userId: string,
) {
  return checkedQuery<SmokeMemberRow | null>(
    "Read smoke brand team member",
    admin
      .from("brand_team_members")
      .select("id, brand_id, user_id, role, accepted_at")
      .eq("brand_id", brandId)
      .eq("user_id", userId)
      .maybeSingle(),
  );
}

async function readProfile(admin: SupabaseClient, profileId: string) {
  return checkedQuery<SmokeProfileRow | null>(
    "Read smoke profile",
    admin
      .from("profiles")
      .select("id, email, full_name, role, status, onboarding_completed")
      .eq("id", profileId)
      .maybeSingle(),
  );
}

async function assertBrandTeamLifecycleFixture(fixture: BrandTeamLifecycleFixture) {
  const admin = createAdminClientFromEnv();
  const pendingInvitation = await readInvitation(admin, fixture.invitationId);

  if (pendingInvitation.status !== "pending") {
    throw new Error(`Expected pending invite, got ${pendingInvitation.status}`);
  }
  if (pendingInvitation.role !== "manager") {
    throw new Error(`Expected manager invite, got ${pendingInvitation.role}`);
  }

  const accepted = await acceptPendingBrandTeamInvitationForUser({
    userId: fixture.memberAuthId,
    email: fixture.memberEmail,
    fullName: "PopsDrops Team Member Smoke",
    avatarUrl: null,
  });

  if (!accepted.accepted) {
    throw new Error("Pending brand team invitation was not accepted.");
  }
  if (accepted.brandId !== fixture.ownerAuthId) {
    throw new Error("Accepted invitation returned the wrong brand workspace.");
  }
  if (accepted.role !== "manager") {
    throw new Error(`Expected accepted manager role, got ${accepted.role}`);
  }

  const acceptedInvitation = await readInvitation(admin, fixture.invitationId);
  if (acceptedInvitation.status !== "accepted") {
    throw new Error(`Expected accepted invite, got ${acceptedInvitation.status}`);
  }

  const member = await readMember(
    admin,
    fixture.ownerAuthId,
    fixture.memberAuthId,
  );
  if (!member) throw new Error("Accepted member row is missing.");
  if (member.role !== "manager") {
    throw new Error(`Expected manager member role, got ${member.role}`);
  }
  if (!member.accepted_at) {
    throw new Error("Accepted member row should record accepted_at.");
  }

  const teammateProfile = await readProfile(admin, fixture.memberAuthId);
  if (!teammateProfile) throw new Error("Accepted teammate profile is missing.");
  if (teammateProfile.email !== fixture.memberEmail) {
    throw new Error("Accepted teammate profile email mismatch.");
  }
  if (teammateProfile.role !== "brand" || teammateProfile.status !== "approved") {
    throw new Error("Accepted teammate should become an approved brand profile.");
  }
  if (teammateProfile.onboarding_completed !== true) {
    throw new Error("Accepted teammate should bypass generic onboarding.");
  }

  const auditRows = await checkedQuery<SmokeAuditRow[]>(
    "Read brand team acceptance audit rows",
    admin
      .from("admin_audit_log")
      .select("id, action, target_id, metadata")
      .eq("target_type", "brand_team_invitation")
      .eq("target_id", fixture.invitationId)
      .eq("action", "brand_team_invitation_accepted"),
  );
  if (auditRows.length === 0) {
    throw new Error("Accepted invite audit row is missing.");
  }
  const acceptedUserId = auditRows[0]?.metadata?.accepted_user_id;
  if (acceptedUserId !== fixture.memberAuthId) {
    throw new Error("Accepted invite audit row points at the wrong teammate.");
  }

  const updatedMember = await checkedQuery<SmokeMemberRow>(
    "Update accepted teammate role to viewer",
    admin
      .from("brand_team_members")
      .update({ role: "viewer", updated_at: new Date().toISOString() })
      .eq("id", member.id)
      .select("id, brand_id, user_id, role, accepted_at")
      .single(),
  );
  if (updatedMember.role !== "viewer") {
    throw new Error(`Expected viewer role after update, got ${updatedMember.role}`);
  }

  const removedMember = await checkedQuery<SmokeMemberRow>(
    "Remove accepted teammate member row",
    admin
      .from("brand_team_members")
      .delete()
      .eq("id", member.id)
      .select("id, brand_id, user_id, role, accepted_at")
      .single(),
  );
  if (removedMember.user_id !== fixture.memberAuthId) {
    throw new Error("Removed the wrong teammate member row.");
  }

  const remainingTeammateProfile = await readProfile(admin, fixture.memberAuthId);
  if (!remainingTeammateProfile) {
    throw new Error("Removing a teammate should not delete the user profile.");
  }

  const brandProfile = await checkedQuery<SmokeBrandProfileRow | null>(
    "Read smoke brand profile",
    admin
      .from("brand_profiles")
      .select("profile_id, company_name, contact_email")
      .eq("profile_id", fixture.ownerAuthId)
      .maybeSingle(),
  );
  if (!brandProfile) throw new Error("Smoke brand profile is missing.");

  return {
    acceptedInvitation,
    auditCount: auditRows.length,
    brandProfile,
    removedMember,
    teammateProfile: remainingTeammateProfile,
    updatedMember,
  };
}

async function cleanupBrandTeamLifecycleFixture(
  fixture: BrandTeamLifecycleFixture,
) {
  const admin = createAdminClientFromEnv();

  if (!isSmokeEmail(fixture.ownerEmail) || !isSmokeEmail(fixture.memberEmail)) {
    throw new Error("Refusing to clean non-smoke brand team emails.");
  }

  await checkedQuery(
    "Delete smoke brand team invitation audit rows",
    admin
      .from("admin_audit_log")
      .delete()
      .eq("target_type", "brand_team_invitation")
      .eq("target_id", fixture.invitationId),
  );
  await checkedQuery(
    "Delete smoke brand team invitation",
    admin.from("brand_team_invitations").delete().eq("id", fixture.invitationId),
  );
  await checkedQuery(
    "Delete smoke team member rows",
    admin
      .from("brand_team_members")
      .delete()
      .or(
        `brand_id.eq.${fixture.ownerAuthId},user_id.eq.${fixture.ownerAuthId},user_id.eq.${fixture.memberAuthId}`,
      ),
  );
  await checkedQuery(
    "Delete smoke brand profile",
    admin.from("brand_profiles").delete().eq("profile_id", fixture.ownerAuthId),
  );
  await checkedQuery(
    "Delete smoke profiles",
    admin.from("profiles").delete().in("id", [
      fixture.ownerAuthId,
      fixture.memberAuthId,
    ]),
  );

  for (const userId of [fixture.memberAuthId, fixture.ownerAuthId]) {
    const deleted = await admin.auth.admin.deleteUser(userId);
    if (deleted.error && !/not found|does not exist/i.test(deleted.error.message)) {
      throw new Error(`Delete smoke auth user ${userId}: ${deleted.error.message}`);
    }
  }

  return {
    cleaned: true,
    invitationId: fixture.invitationId,
    ownerEmail: fixture.ownerEmail,
    memberEmail: fixture.memberEmail,
  };
}

export async function runBrandTeamLifecycleSmoke() {
  const fixture = await setupBrandTeamLifecycleFixture();

  try {
    const result = await assertBrandTeamLifecycleFixture(fixture);
    const cleanup = process.argv.includes("--keep")
      ? { cleaned: false, reason: "--keep" }
      : await cleanupBrandTeamLifecycleFixture(fixture);

    return {
      cleanup,
      fixture,
      ok: true,
      result,
    };
  } catch (error) {
    if (!process.argv.includes("--keep")) {
      await cleanupBrandTeamLifecycleFixture(fixture).catch((cleanupError) => {
        console.error(
          cleanupError instanceof Error
            ? cleanupError.message
            : String(cleanupError),
        );
      });
    }
    throw error;
  }
}

async function main() {
  const result = await runBrandTeamLifecycleSmoke();
  console.log(JSON.stringify(result, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
