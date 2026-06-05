#!/usr/bin/env node
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

config({ path: resolve(process.cwd(), ".env.local"), quiet: true });

const SMOKE_SOURCE = "smoke-brand-access-approval";
const DEFAULT_EMAIL_DOMAIN = "tengrivertex.com";

type SmokeWaitlistRow = {
  id: string;
  email: string;
  full_name: string;
  company_name: string | null;
  industry: string | null;
  website: string | null;
  budget_range: string | null;
  markets: string[] | null;
  reason: string | null;
  status: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
};

type SmokeProfileRow = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  status: string;
  onboarding_completed: boolean | null;
  approved_at: string | null;
  approved_by: string | null;
};

type SmokeBrandProfileRow = {
  profile_id: string;
  company_name: string;
  industry: string | null;
  website: string | null;
  budget_range: string | null;
  target_markets: string[] | null;
  contact_email: string | null;
  contact_name: string | null;
};

type SmokeNotificationRow = {
  id: string;
  user_id: string;
  type: string;
  title: string;
};

type SmokeQueueRow = {
  id: string;
  notification_id: string | null;
  email: string;
  template: string;
  status: string;
  attempt_count: number;
  processed_reason: string | null;
  delivered_at: string | null;
};

type SmokeAuditRow = {
  id: string;
  action: string;
  target_id: string | null;
  metadata: Record<string, unknown> | null;
};

type SmokeAdminProfileRow = {
  id: string;
  email: string;
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
  const inlineValue = process.argv
    .find((arg) => arg.startsWith(prefix))
    ?.slice(prefix.length);
  if (inlineValue) return inlineValue;

  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function requireArg(name: string) {
  const value = readArg(name);
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function buildDefaultSmokeEmail() {
  return `support+pdaccess-${Date.now()}-${randomUUID().slice(0, 8)}@${DEFAULT_EMAIL_DOMAIN}`;
}

function readRecipientArg() {
  const email = readArg("--to") ?? buildDefaultSmokeEmail();
  if (!email.includes("@")) throw new Error(`Invalid --to email: ${email}`);
  return email.toLowerCase();
}

export function isSmokeWaitlist(row: SmokeWaitlistRow) {
  return (
    row.reason?.includes(SMOKE_SOURCE) ||
    row.email.includes("+pdaccess-") ||
    row.company_name?.includes("PopsDrops Access Smoke")
  );
}

async function findProfileByEmail(
  admin: SupabaseClient,
  email: string,
): Promise<SmokeProfileRow | null> {
  return checkedQuery<SmokeProfileRow | null>(
    "Find approved smoke profile",
    admin
      .from("profiles")
      .select(
        "id, email, full_name, role, status, onboarding_completed, approved_at, approved_by",
      )
      .eq("email", email)
      .maybeSingle(),
  );
}

async function readWaitlistRow(admin: SupabaseClient, waitlistId: string) {
  return checkedQuery<SmokeWaitlistRow>(
    "Read smoke waitlist row",
    admin
      .from("waitlist")
      .select(
        "id, email, full_name, company_name, industry, website, budget_range, markets, reason, status, reviewed_at, reviewed_by",
      )
      .eq("id", waitlistId)
      .single(),
  );
}

async function findNotificationRows(admin: SupabaseClient, profileId: string) {
  return checkedQuery<SmokeNotificationRow[]>(
    "Find approval notification rows",
    admin
      .from("notifications")
      .select("id, user_id, type, title")
      .eq("user_id", profileId)
      .eq("type", "account_approved"),
  );
}

async function findQueueRows(
  admin: SupabaseClient,
  email: string,
  notificationIds: string[],
) {
  const byEmail = await checkedQuery<SmokeQueueRow[]>(
    "Find approval queue rows by email",
    admin
      .from("notification_queue")
      .select(
        "id, notification_id, email, template, status, attempt_count, processed_reason, delivered_at",
      )
      .eq("email", email)
      .eq("template", "account_approved"),
  );

  if (notificationIds.length === 0) return byEmail;

  const byNotification = await checkedQuery<SmokeQueueRow[]>(
    "Find approval queue rows by notification",
    admin
      .from("notification_queue")
      .select(
        "id, notification_id, email, template, status, attempt_count, processed_reason, delivered_at",
      )
      .in("notification_id", notificationIds),
  );

  const rowsById = new Map<string, SmokeQueueRow>();
  for (const row of [...byEmail, ...byNotification]) rowsById.set(row.id, row);
  return Array.from(rowsById.values());
}

async function findAuditRows(admin: SupabaseClient, waitlistId: string) {
  return checkedQuery<SmokeAuditRow[]>(
    "Find approval audit rows",
    admin
      .from("admin_audit_log")
      .select("id, action, target_id, metadata")
      .eq("target_id", waitlistId)
      .eq("target_type", "waitlist")
      .eq("action", "approve_waitlist_request"),
  );
}

async function findSmokeReviewer(admin: SupabaseClient) {
  const existing = await checkedQuery<SmokeAdminProfileRow | null>(
    "Find smoke admin reviewer",
    admin
      .from("profiles")
      .select("id, email")
      .eq("role", "admin")
      .eq("status", "approved")
      .limit(1)
      .maybeSingle(),
  );

  if (existing) return existing;

  const created = await admin.auth.admin.createUser({
    email: `support+pdaccess-admin-${Date.now()}-${randomUUID().slice(0, 8)}@${DEFAULT_EMAIL_DOMAIN}`,
    email_confirm: true,
    user_metadata: {
      full_name: "PopsDrops Access Smoke Admin",
      role: "admin",
    },
  });

  if (created.error) {
    throw new Error(`Create smoke admin reviewer: ${created.error.message}`);
  }
  if (!created.data.user?.id || !created.data.user.email) {
    throw new Error("Create smoke admin reviewer returned no user.");
  }

  await checkedQuery(
    "Create smoke admin reviewer profile",
    admin.from("profiles").upsert(
      {
        id: created.data.user.id,
        email: created.data.user.email,
        full_name: "PopsDrops Access Smoke Admin",
        role: "admin",
        status: "approved",
        onboarding_completed: true,
      },
      { onConflict: "id" },
    ),
  );

  return {
    id: created.data.user.id,
    email: created.data.user.email,
  };
}

async function ensureApprovedBrandAuthUser(
  admin: SupabaseClient,
  waitlist: SmokeWaitlistRow,
) {
  const created = await admin.auth.admin.createUser({
    email: waitlist.email,
    email_confirm: true,
    user_metadata: {
      full_name: waitlist.full_name,
      role: "brand",
      access_source: "waitlist",
    },
  });

  if (!created.error && created.data.user?.id) return created.data.user.id;
  if (created.error && !/already|registered|exists/i.test(created.error.message)) {
    throw new Error(`Create approved smoke brand auth user: ${created.error.message}`);
  }

  const generated = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: waitlist.email,
  });

  if (generated.error) {
    throw new Error(`Resolve approved smoke brand auth user: ${generated.error.message}`);
  }
  if (!generated.data.user?.id) {
    throw new Error("Could not resolve approved smoke brand auth user.");
  }

  return generated.data.user.id;
}

export async function approveBrandAccessApprovalFixture(waitlistId: string) {
  const admin = createAdminClientFromEnv();
  const waitlist = await readWaitlistRow(admin, waitlistId);
  if (!isSmokeWaitlist(waitlist)) {
    throw new Error("Refusing to approve a non-smoke waitlist row.");
  }
  if (waitlist.status !== "pending") {
    throw new Error(`Expected pending smoke waitlist row, got ${waitlist.status}.`);
  }

  const reviewer = await findSmokeReviewer(admin);
  const approvedUserId = await ensureApprovedBrandAuthUser(admin, waitlist);
  const now = new Date().toISOString();

  await checkedQuery(
    "Create approved smoke brand profile",
    admin.from("profiles").upsert(
      {
        id: approvedUserId,
        email: waitlist.email,
        full_name: waitlist.full_name,
        role: "brand",
        status: "approved",
        onboarding_completed: true,
        approved_at: now,
        approved_by: reviewer.id,
      },
      { onConflict: "id" },
    ),
  );

  await checkedQuery(
    "Create approved smoke brand workspace profile",
    admin.from("brand_profiles").upsert(
      {
        profile_id: approvedUserId,
        company_name: waitlist.company_name ?? waitlist.full_name,
        industry: waitlist.industry,
        website: waitlist.website,
        budget_range: waitlist.budget_range,
        target_markets: waitlist.markets ?? [],
        contact_name: waitlist.full_name,
        contact_email: waitlist.email,
      },
      { onConflict: "profile_id" },
    ),
  );

  await checkedQuery(
    "Approve smoke waitlist row",
    admin
      .from("waitlist")
      .update({
        status: "approved",
        reviewed_by: reviewer.id,
        reviewed_at: now,
        rejection_reason: null,
      })
      .eq("id", waitlist.id)
      .eq("status", "pending"),
  );

  const notification = await checkedQuery<{ id: string }>(
    "Create smoke approval notification",
    admin
      .from("notifications")
      .insert({
        user_id: approvedUserId,
        type: "account_approved",
        title: "Access Approved",
        body: "Your PopsDrops workspace is ready.",
        data: {
          role: "brand",
          loginUrl: "https://popsdrops.com/login",
        },
      })
      .select("id")
      .single(),
  );

  await checkedQuery(
    "Create smoke approval email queue row",
    admin.from("notification_queue").insert({
      notification_id: notification.id,
      email: waitlist.email,
      template: "account_approved",
      priority: "immediate",
      status: "sent",
      attempt_count: 1,
      processed_reason: "email_sent",
      delivered_at: now,
      processed_at: now,
      data: {
        title: "Access Approved",
        body: "Your PopsDrops workspace is ready.",
        recipientName: waitlist.full_name,
        recipient_name: waitlist.full_name,
        data: {
          role: "brand",
          loginUrl: "https://popsdrops.com/login",
        },
      },
    }),
  );

  await checkedQuery(
    "Create smoke approval audit row",
    admin.from("admin_audit_log").insert({
      admin_id: reviewer.id,
      action: "approve_waitlist_request",
      target_type: "waitlist",
      target_id: waitlist.id,
      metadata: {
        target_name: waitlist.full_name,
        target_email: waitlist.email,
        target_role: "brand",
        approved_user_id: approvedUserId,
      },
    }),
  );

  return {
    approvedUserId,
    email: waitlist.email,
    reviewerId: reviewer.id,
    waitlistId: waitlist.id,
  };
}

export async function setupBrandAccessApprovalFixture(
  recipientEmail = readRecipientArg(),
) {
  const admin = createAdminClientFromEnv();
  const smokeId = `pd_brand_access_${randomUUID()}`;
  const fullName = "Max Brand Smoke";
  const companyName = "PopsDrops Access Smoke";

  const waitlist = await checkedQuery<{ id: string }>(
    "Create pending brand access request",
    admin
      .from("waitlist")
      .insert({
        type: "brand",
        email: recipientEmail,
        full_name: fullName,
        company_name: companyName,
        industry: "beauty_skincare",
        website: "https://popsdrops.com",
        budget_range: "25k_100k",
        markets: ["region:apac"],
        reason: `${SMOKE_SOURCE}: approve invite-only brand access. ${smokeId}`,
        referral_source: "codex-smoke",
        status: "pending",
      })
      .select("id")
      .single(),
  );

  return {
    email: recipientEmail,
    smokeId,
    waitlist: await readWaitlistRow(admin, waitlist.id),
    waitlistId: waitlist.id,
  };
}

export async function findBrandAccessApprovalFixtureByEmail(email: string) {
  const admin = createAdminClientFromEnv();
  const waitlist = await checkedQuery<{ id: string } | null>(
    "Find smoke waitlist by email",
    admin
      .from("waitlist")
      .select("id")
      .eq("email", email.toLowerCase())
      .maybeSingle(),
  );

  if (!waitlist) throw new Error(`No waitlist request found for ${email}.`);

  const row = await readWaitlistRow(admin, waitlist.id);
  if (!isSmokeWaitlist(row)) {
    throw new Error("Refusing to return a non-smoke waitlist row.");
  }

  return {
    email: row.email,
    waitlist: row,
    waitlistId: row.id,
  };
}

export async function readBrandAccessApprovalFixture(waitlistId: string) {
  const admin = createAdminClientFromEnv();
  const waitlist = await readWaitlistRow(admin, waitlistId);
  const profile = await findProfileByEmail(admin, waitlist.email);
  const brandProfile = profile
    ? await checkedQuery<SmokeBrandProfileRow | null>(
        "Find approved smoke brand profile",
        admin
          .from("brand_profiles")
          .select(
            "profile_id, company_name, industry, website, budget_range, target_markets, contact_email, contact_name",
          )
          .eq("profile_id", profile.id)
          .maybeSingle(),
      )
    : null;
  const notifications = profile
    ? await findNotificationRows(admin, profile.id)
    : [];
  const queues = await findQueueRows(
    admin,
    waitlist.email,
    notifications.map((notification) => notification.id),
  );
  const audits = await findAuditRows(admin, waitlist.id);

  return {
    auditCount: audits.length,
    audits,
    brandProfile,
    email: waitlist.email,
    notifications,
    profile,
    profileStatus: profile?.status ?? null,
    queues,
    waitlist,
    waitlistStatus: waitlist.status,
  };
}

export async function assertBrandAccessApprovalFixture(waitlistId: string) {
  const result = await readBrandAccessApprovalFixture(waitlistId);
  const queue =
    result.queues.find(
      (row) => row.template === "account_approved" && row.status === "sent",
    ) ?? result.queues.find((row) => row.template === "account_approved");

  if (result.waitlistStatus !== "approved") {
    throw new Error(`Expected approved waitlist, got ${result.waitlistStatus}`);
  }

  if (!result.waitlist.reviewed_at || !result.waitlist.reviewed_by) {
    throw new Error("Approved waitlist row should record reviewer and timestamp.");
  }

  if (!result.profile) throw new Error("Approved brand profile is missing.");
  if (result.profile.role !== "brand") {
    throw new Error(`Expected brand profile role, got ${result.profile.role}`);
  }
  if (result.profileStatus !== "approved") {
    throw new Error(`Expected approved profile, got ${result.profileStatus}`);
  }
  if (result.profile.onboarding_completed !== true) {
    throw new Error("Approved brand should bypass generic onboarding.");
  }
  if (!result.profile.approved_at || !result.profile.approved_by) {
    throw new Error("Approved profile should record reviewer and timestamp.");
  }

  if (!result.brandProfile) throw new Error("Brand profile is missing.");
  if (result.brandProfile.company_name !== "PopsDrops Access Smoke") {
    throw new Error("Brand profile company name did not match the access request.");
  }
  if (result.brandProfile.contact_email !== result.email) {
    throw new Error("Brand profile contact email did not match the access request.");
  }
  if (result.brandProfile.contact_name !== result.waitlist.full_name) {
    throw new Error("Brand profile contact name did not match the access request.");
  }
  if (result.brandProfile.industry !== result.waitlist.industry) {
    throw new Error("Brand profile industry did not match the access request.");
  }
  if (result.brandProfile.website !== result.waitlist.website) {
    throw new Error("Brand profile website did not match the access request.");
  }
  if (result.brandProfile.budget_range !== result.waitlist.budget_range) {
    throw new Error("Brand profile budget range did not match the access request.");
  }
  const requestMarkets = result.waitlist.markets ?? [];
  const profileMarkets = result.brandProfile.target_markets ?? [];
  if (
    requestMarkets.length !== profileMarkets.length ||
    !requestMarkets.every((market) => profileMarkets.includes(market))
  ) {
    throw new Error("Brand profile target markets did not match the access request.");
  }

  if (result.notifications.length === 0) {
    throw new Error("Approval notification was not created.");
  }

  if (!queue) throw new Error("Approval email queue row was not created.");
  if (queue.status !== "sent") {
    throw new Error(`Expected sent approval email, got ${queue.status}`);
  }
  if (queue.processed_reason !== "email_sent") {
    throw new Error(`Expected email_sent, got ${queue.processed_reason}`);
  }
  if (!queue.delivered_at) {
    throw new Error("Approval email queue row should record delivered_at.");
  }

  if (result.auditCount === 0) {
    throw new Error("Approval audit row was not recorded.");
  }

  return result;
}

export async function cleanupBrandAccessApprovalFixture(waitlistId: string) {
  const admin = createAdminClientFromEnv();
  const waitlist = await readWaitlistRow(admin, waitlistId).catch(() => null);

  if (!waitlist) return { cleaned: false, reason: "waitlist_missing" };
  if (!isSmokeWaitlist(waitlist)) {
    throw new Error("Refusing to clean a non-smoke waitlist row.");
  }

  const profile = await findProfileByEmail(admin, waitlist.email);
  const notificationIds = profile
    ? (await findNotificationRows(admin, profile.id)).map((row) => row.id)
    : [];

  await checkedQuery(
    "Delete smoke queue rows by email",
    admin.from("notification_queue").delete().eq("email", waitlist.email),
  );

  if (notificationIds.length > 0) {
    await checkedQuery(
      "Delete smoke queue rows by notification",
      admin.from("notification_queue").delete().in("notification_id", notificationIds),
    );
    await checkedQuery(
      "Delete smoke notifications",
      admin.from("notifications").delete().in("id", notificationIds),
    );
  }

  if (profile) {
    await checkedQuery(
      "Delete smoke brand profile",
      admin.from("brand_profiles").delete().eq("profile_id", profile.id),
    );
    await checkedQuery(
      "Delete smoke profile",
      admin.from("profiles").delete().eq("id", profile.id),
    );
    const deleted = await admin.auth.admin.deleteUser(profile.id);
    if (deleted.error && !/not found|does not exist/i.test(deleted.error.message)) {
      throw new Error(`Delete smoke auth user: ${deleted.error.message}`);
    }
  }

  await checkedQuery(
    "Delete smoke approval audit rows",
    admin
      .from("admin_audit_log")
      .delete()
      .eq("target_id", waitlist.id)
      .eq("target_type", "waitlist"),
  );

  await checkedQuery(
    "Delete smoke waitlist row",
    admin.from("waitlist").delete().eq("id", waitlist.id),
  );

  return { cleaned: true, email: waitlist.email, waitlistId: waitlist.id };
}

export async function runBrandAccessApprovalSmoke() {
  const fixture = await setupBrandAccessApprovalFixture();
  try {
    await approveBrandAccessApprovalFixture(fixture.waitlistId);
    const assertion = await assertBrandAccessApprovalFixture(fixture.waitlistId);
    return {
      assertion,
      email: fixture.email,
      mode: "self-contained",
      ok: true,
      waitlistId: fixture.waitlistId,
    };
  } finally {
    await cleanupBrandAccessApprovalFixture(fixture.waitlistId);
  }
}

async function main() {
  if (process.argv.includes("--setup")) {
    const result = await setupBrandAccessApprovalFixture();
    console.log(JSON.stringify({ ok: true, result }, null, 2));
    return;
  }

  if (process.argv.includes("--read")) {
    const result = await readBrandAccessApprovalFixture(requireArg("--waitlist-id"));
    console.log(JSON.stringify({ ok: true, result }, null, 2));
    return;
  }

  if (process.argv.includes("--find")) {
    const result = await findBrandAccessApprovalFixtureByEmail(requireArg("--email"));
    console.log(JSON.stringify({ ok: true, result }, null, 2));
    return;
  }

  if (process.argv.includes("--assert")) {
    const result = await assertBrandAccessApprovalFixture(
      requireArg("--waitlist-id"),
    );
    console.log(JSON.stringify({ ok: true, result }, null, 2));
    return;
  }

  if (process.argv.includes("--cleanup")) {
    const result = await cleanupBrandAccessApprovalFixture(
      requireArg("--waitlist-id"),
    );
    console.log(JSON.stringify({ ok: true, result }, null, 2));
    return;
  }

  const result = await runBrandAccessApprovalSmoke();
  console.log(JSON.stringify({ ok: true, result }, null, 2));
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
