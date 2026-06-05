#!/usr/bin/env node

import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createClient } from "@supabase/supabase-js";

import {
  createCdpPage,
  ensureDevServer,
  evaluate,
  findFreePort,
  launchChrome,
  loginForSmoke,
  navigate,
  stopDevServer,
  waitForExpression,
} from "./smoke-campaign-detail.mjs";
import { captureScreenshot, loadLocalEnv } from "./smoke-application-flow.mjs";

const DEFAULT_BASE_URL = "http://127.0.0.1:4000";
const SMOKE_EMAIL_DOMAIN = "example.invalid";
const SMOKE_EMAIL_PREFIX = "support+pdteam-ui";

export function buildBrandTeamInviteUiSmokeTargets({
  baseUrl = process.env.SMOKE_BASE_URL || DEFAULT_BASE_URL,
} = {}) {
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");

  return {
    baseUrl: normalizedBaseUrl,
    ownerLoginUrl: `${normalizedBaseUrl}/auth/dev-login?role=brand&teamRole=owner`,
    settingsUrl: `${normalizedBaseUrl}/b/settings`,
    callbackUrl: `${normalizedBaseUrl}/auth/callback`,
  };
}

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

function buildSmokeEmail() {
  return `${SMOKE_EMAIL_PREFIX}-${Date.now()}-${randomUUID().slice(0, 8)}@${SMOKE_EMAIL_DOMAIN}`;
}

function isSmokeEmail(email) {
  return (
    email.startsWith(`${SMOKE_EMAIL_PREFIX}-`) &&
    email.endsWith(`@${SMOKE_EMAIL_DOMAIN}`)
  );
}

async function checkedQuery(label, query) {
  const { data, error } = await query;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

async function stopChrome(chrome) {
  if (!chrome) return;

  const exited = new Promise((resolve) => {
    if (chrome.exitCode !== null || chrome.signalCode !== null) {
      resolve();
      return;
    }
    chrome.once("exit", resolve);
  });

  chrome.kill();
  await Promise.race([
    exited,
    new Promise((resolve) => setTimeout(resolve, 5000)),
  ]);
}

async function inviteTeammateFromSettings(client, targets, email) {
  await loginForSmoke(client, {
    loginUrl: targets.ownerLoginUrl,
    expectedUrlPrefix: `${targets.baseUrl}/b`,
    description: "brand owner login for team invite",
  });

  await navigate(client, targets.settingsUrl);
  await waitForExpression(
    client,
    "Boolean(document.querySelector('[data-testid=\"brand-team-invite-form\"]'))",
    "brand team invite form",
    60000,
  );

  await evaluate(
    client,
    `(() => {
      const emailInput = document.querySelector("#teamInviteEmail");
      const roleSelect = document.querySelector("#teamInviteRole");
      const form = document.querySelector('[data-testid="brand-team-invite-form"]');
      if (!emailInput || !roleSelect || !form) {
        throw new Error("Missing brand team invite controls.");
      }

      const emailSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      ).set;
      const selectSetter = Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        "value",
      ).set;

      emailSetter.call(emailInput, ${JSON.stringify(email)});
      emailInput.dispatchEvent(new Event("input", { bubbles: true }));
      selectSetter.call(roleSelect, "manager");
      roleSelect.dispatchEvent(new Event("change", { bubbles: true }));
      form.requestSubmit();
      return true;
    })()`,
  );

  await waitForExpression(
    client,
    `document.body.innerText.includes(${JSON.stringify(email)})`,
    "pending team invitation row",
    60000,
  );
}

async function readPendingInvitation(admin, email) {
  return checkedQuery(
    "Read UI smoke brand team invitation",
    admin
      .from("brand_team_invitations")
      .select("id, brand_id, email, role, status, invited_by, expires_at")
      .eq("email", email)
      .eq("status", "pending")
      .single(),
  );
}

async function expirePendingInvitationForSmoke(admin, invitation) {
  return checkedQuery(
    "Expire UI smoke brand team invitation",
    admin
      .from("brand_team_invitations")
      .update({
        status: "expired",
        expires_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", invitation.id)
      .select("id, status, expires_at")
      .single(),
  );
}

async function assertExpiredInviteVisibleInSettings(client, targets, email) {
  await navigate(client, targets.settingsUrl);
  await waitForExpression(
    client,
    `([...document.querySelectorAll('[data-testid="brand-team-invite-row"]')]
      .some((row) =>
        row.textContent.includes(${JSON.stringify(email)}) &&
        row.textContent.includes("Expired")
      ))`,
    "expired invite row",
    60000,
  );
}

async function readNotificationQueue(admin, email) {
  return checkedQuery(
    "Read UI smoke invitation email queue",
    admin
      .from("notification_queue")
      .select("id, email, template, status, data, processed_at")
      .eq("email", email)
      .eq("template", "brand_team_invitation")
      .order("created_at", { ascending: false })
      .limit(1)
      .single(),
  );
}

async function resendPendingInviteFromSettings(client, targets, email) {
  await navigate(client, targets.settingsUrl);
  await waitForExpression(
    client,
    `([...document.querySelectorAll('[data-testid="brand-team-invite-row"]')]
      .some((row) => row.textContent.includes(${JSON.stringify(email)})))`,
    "pending invite row for resend",
    60000,
  );

  await evaluate(
    client,
    `(() => {
      const rows = [...document.querySelectorAll('[data-testid="brand-team-invite-row"]')];
      const row = rows.find((nextRow) => nextRow.textContent.includes(${JSON.stringify(email)}));
      if (!row) throw new Error("Missing pending invite row for resend.");
      const resendButton = row.querySelector('[aria-label="Resend invite"]');
      if (!resendButton) throw new Error("Missing pending invite resend button.");
      resendButton.click();
      return true;
    })()`,
  );

  await waitForExpression(
    client,
    `([...document.querySelectorAll('[data-testid="brand-team-invite-row"]')]
      .some((row) =>
        row.textContent.includes(${JSON.stringify(email)}) &&
        row.textContent.includes("Expires")
      ))`,
    "resent invite row with fresh expiry",
    60000,
  );
}

async function assertResentInvitation(admin, invitation) {
  const startedAt = Date.now();
  let resentInvitation;

  while (Date.now() - startedAt < 60000) {
    resentInvitation = await checkedQuery(
      "Read resent UI smoke brand team invitation",
      admin
        .from("brand_team_invitations")
        .select("id, status, role, expires_at")
        .eq("id", invitation.id)
        .single(),
    );

    if (
      resentInvitation.status === "pending" &&
      new Date(resentInvitation.expires_at).getTime() >
        new Date(invitation.expires_at).getTime()
    ) {
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  if (resentInvitation?.status !== "pending") {
    throw new Error(
      `Expected resent team invite to be pending, got ${resentInvitation?.status}`,
    );
  }
  if (
    new Date(resentInvitation.expires_at).getTime() <=
    new Date(invitation.expires_at).getTime()
  ) {
    throw new Error("Resent team invite did not receive a fresh expiry.");
  }

  let auditRows = [];
  const auditStartedAt = Date.now();

  while (Date.now() - auditStartedAt < 60000) {
    auditRows = await checkedQuery(
      "Read resent UI smoke brand team audit rows",
      admin
        .from("admin_audit_log")
        .select("id, action, target_id, metadata")
        .eq("target_type", "brand_team_invitation")
        .eq("target_id", invitation.id)
        .eq("action", "brand_team_invitation_resent"),
    );

    if (auditRows.length) break;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  if (!auditRows.length) {
    throw new Error("Resent team invitation audit row did not settle.");
  }

  return { auditCount: auditRows.length, resentInvitation };
}

async function assertResentNotificationQueue(admin, email, previousQueueItem) {
  const startedAt = Date.now();
  let resentQueueItem;

  while (Date.now() - startedAt < 60000) {
    resentQueueItem = await readNotificationQueue(admin, email);
    if (resentQueueItem.id !== previousQueueItem.id) break;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  if (resentQueueItem?.id === previousQueueItem.id) {
    throw new Error("Resent invite did not queue a fresh invitation email.");
  }

  return resentQueueItem;
}

async function createInvitedAuthUser(admin, email) {
  const created = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: {
      full_name: "PopsDrops Team Invite UI Smoke",
      smoke_source: "smoke-brand-team-invite-ui",
    },
  });

  if (created.error) {
    throw new Error(`Create invited smoke auth user: ${created.error.message}`);
  }

  const userId = created.data.user?.id;
  if (!userId)
    throw new Error("Create invited smoke auth user returned no id.");
  return userId;
}

async function openMagicLinkAndAccept(client, admin, targets, invitation, email) {
  await client.send("Network.enable");
  await client.send("Network.clearBrowserCookies");

  const generated = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      redirectTo: targets.callbackUrl,
    },
  });

  if (generated.error) {
    throw new Error(`Generate smoke magic link: ${generated.error.message}`);
  }

  const tokenHash = generated.data.properties?.hashed_token;
  if (!tokenHash) {
    throw new Error("Generated smoke magic link token hash is missing.");
  }

  const invitationPath = `/team/invitations/${invitation.id}`;
  const callbackUrl = `${targets.callbackUrl}?token_hash=${encodeURIComponent(tokenHash)}&type=magiclink&next=${encodeURIComponent(invitationPath)}`;
  await navigate(client, callbackUrl);
  await waitForExpression(
    client,
    `location.href === ${JSON.stringify(`${targets.baseUrl}${invitationPath}`)}`,
    "team invitation handoff page after magic link",
    60000,
  );
  await waitForExpression(
    client,
    `document.querySelector('[data-testid="brand-team-invitation-preview"]')?.textContent.includes(${JSON.stringify(email)})`,
    "team invitation preview includes invited email",
    60000,
  );
  await evaluate(
    client,
    `(() => {
      const button = [...document.querySelectorAll("button")]
        .find((node) => node.textContent.includes("Accept invitation"));
      if (!button) throw new Error("Missing team invitation accept button.");
      button.click();
      return true;
    })()`,
  );
  await waitForExpression(
    client,
    `location.href.startsWith(${JSON.stringify(`${targets.baseUrl}/b`)})`,
    "accepted teammate brand redirect",
    60000,
  );
}

async function assertAcceptedTeamMember(admin, invitation, memberUserId) {
  const acceptedInvitation = await checkedQuery(
    "Read accepted UI smoke brand team invitation",
    admin
      .from("brand_team_invitations")
      .select("id, status, role")
      .eq("id", invitation.id)
      .single(),
  );

  if (acceptedInvitation.status !== "accepted") {
    throw new Error(
      `Expected accepted team invite, got ${acceptedInvitation.status}`,
    );
  }

  const member = await checkedQuery(
    "Read accepted UI smoke brand team member",
    admin
      .from("brand_team_members")
      .select("id, brand_id, user_id, role, accepted_at")
      .eq("brand_id", invitation.brand_id)
      .eq("user_id", memberUserId)
      .single(),
  );

  if (member.role !== "manager") {
    throw new Error(`Expected manager teammate role, got ${member.role}`);
  }
  if (!member.accepted_at) {
    throw new Error("Accepted teammate row is missing accepted_at.");
  }

  const auditRows = await checkedQuery(
    "Read accepted UI smoke brand team audit rows",
    admin
      .from("admin_audit_log")
      .select("id, action, target_id, metadata")
      .eq("target_type", "brand_team_invitation")
      .eq("target_id", invitation.id)
      .eq("action", "brand_team_invitation_accepted"),
  );

  if (!auditRows.length) {
    throw new Error("Accepted team invitation audit row is missing.");
  }

  return { acceptedInvitation, auditCount: auditRows.length, member };
}

async function assertAcceptedMemberVisibleInSettings(client, targets, email) {
  await navigate(client, targets.settingsUrl);
  await waitForExpression(
    client,
    "Boolean(document.querySelector('[data-testid=\"brand-team-settings\"]'))",
    "accepted teammate settings",
    60000,
  );
  await waitForExpression(
    client,
    `([...document.querySelectorAll('[data-testid="brand-team-member-row"]')]
      .some((row) => row.textContent.includes(${JSON.stringify(email)})))`,
    "accepted teammate row",
    60000,
  );
  await waitForExpression(
    client,
    "!Boolean(document.querySelector('[data-testid=\"brand-team-invite-form\"]'))",
    "manager cannot invite teammates",
    60000,
  );
}

async function assertAcceptedTeammateInviteRejected(client, targets, email) {
  await navigate(client, targets.settingsUrl);
  await waitForExpression(
    client,
    "Boolean(document.querySelector('[data-testid=\"brand-team-invite-form\"]'))",
    "brand owner invite form for duplicate guard",
    60000,
  );

  await evaluate(
    client,
    `(() => {
      const emailInput = document.querySelector("#teamInviteEmail");
      const roleSelect = document.querySelector("#teamInviteRole");
      const form = document.querySelector('[data-testid="brand-team-invite-form"]');
      if (!emailInput || !roleSelect || !form) {
        throw new Error("Missing brand team invite controls for duplicate guard.");
      }

      const emailSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value",
      ).set;
      const selectSetter = Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        "value",
      ).set;

      emailSetter.call(emailInput, ${JSON.stringify(email)});
      emailInput.dispatchEvent(new Event("input", { bubbles: true }));
      selectSetter.call(roleSelect, "manager");
      roleSelect.dispatchEvent(new Event("change", { bubbles: true }));
      form.requestSubmit();
      return true;
    })()`,
  );

  await waitForExpression(
    client,
    'document.body.innerText.includes("That person is already on this team.")',
    "accepted teammate invite rejection toast",
    60000,
  );
}

async function assertNoPendingInvitationForAcceptedEmail(
  admin,
  brandId,
  email,
) {
  const pendingInvitations = await checkedQuery(
    "Read duplicate guard pending invitations",
    admin
      .from("brand_team_invitations")
      .select("id, status")
      .eq("brand_id", brandId)
      .eq("email", email)
      .in("status", ["pending", "expired"]),
  );

  if (pendingInvitations.length) {
    throw new Error(
      "Accepted teammate duplicate invite created a pending row.",
    );
  }
}

async function revokePendingInviteFromSettings(client, targets, email) {
  await navigate(client, targets.settingsUrl);
  await waitForExpression(
    client,
    `([...document.querySelectorAll('[data-testid="brand-team-invite-row"]')]
      .some((row) => row.textContent.includes(${JSON.stringify(email)})))`,
    "pending invite row for revoke",
    60000,
  );

  await evaluate(
    client,
    `(() => {
      const rows = [...document.querySelectorAll('[data-testid="brand-team-invite-row"]')];
      const row = rows.find((nextRow) => nextRow.textContent.includes(${JSON.stringify(email)}));
      if (!row) throw new Error("Missing pending invite row for revoke.");
      const revokeButton = row.querySelector('[aria-label="Revoke invite"]');
      if (!revokeButton) throw new Error("Missing pending invite revoke button.");
      revokeButton.click();
      return true;
    })()`,
  );

  await waitForExpression(
    client,
    `(![...document.querySelectorAll('[data-testid="brand-team-invite-row"]')]
      .some((row) => row.textContent.includes(${JSON.stringify(email)})))`,
    "revoked invite row removed",
    60000,
  );
}

async function assertRevokedInvitation(admin, invitation) {
  const revokedInvitation = await checkedQuery(
    "Read revoked UI smoke brand team invitation",
    admin
      .from("brand_team_invitations")
      .select("id, status, role")
      .eq("id", invitation.id)
      .single(),
  );

  if (revokedInvitation.status !== "revoked") {
    throw new Error(
      `Expected revoked team invite, got ${revokedInvitation.status}`,
    );
  }

  const auditRows = await checkedQuery(
    "Read revoked UI smoke brand team audit rows",
    admin
      .from("admin_audit_log")
      .select("id, action, target_id, metadata")
      .eq("target_type", "brand_team_invitation")
      .eq("target_id", invitation.id)
      .eq("action", "brand_team_invitation_revoked"),
  );

  if (!auditRows.length) {
    throw new Error("Revoked team invitation audit row is missing.");
  }

  return { auditCount: auditRows.length, revokedInvitation };
}

async function updateAcceptedMemberRoleFromSettings(
  client,
  targets,
  email,
  role,
) {
  await navigate(client, targets.settingsUrl);
  await waitForExpression(
    client,
    `([...document.querySelectorAll('[data-testid="brand-team-member-row"]')]
      .some((row) => row.textContent.includes(${JSON.stringify(email)})))`,
    "accepted teammate row for role update",
    60000,
  );

  await evaluate(
    client,
    `(() => {
      const rows = [...document.querySelectorAll('[data-testid="brand-team-member-row"]')];
      const row = rows.find((nextRow) => nextRow.textContent.includes(${JSON.stringify(email)}));
      if (!row) throw new Error("Missing accepted teammate row for role update.");
      const roleSelect = row.querySelector("select");
      if (!roleSelect) throw new Error("Missing accepted teammate role select.");
      const selectSetter = Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        "value",
      ).set;
      selectSetter.call(roleSelect, ${JSON.stringify(role)});
      roleSelect.dispatchEvent(new Event("input", { bubbles: true }));
      roleSelect.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    })()`,
  );
}

async function assertUpdatedTeamMemberRole(admin, memberId, role) {
  const startedAt = Date.now();
  let updatedMember;

  while (Date.now() - startedAt < 60000) {
    updatedMember = await checkedQuery(
      "Read updated UI smoke brand team member",
      admin
        .from("brand_team_members")
        .select("id, role")
        .eq("id", memberId)
        .single(),
    );

    if (updatedMember.role === role) break;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  if (updatedMember?.role !== role) {
    throw new Error(
      `Expected updated teammate role ${role}, got ${updatedMember?.role}`,
    );
  }

  let auditRows = [];
  const auditStartedAt = Date.now();

  while (Date.now() - auditStartedAt < 60000) {
    auditRows = await checkedQuery(
      "Read updated UI smoke brand team audit rows",
      admin
        .from("admin_audit_log")
        .select("id, action, target_id, metadata")
        .eq("target_type", "brand_team_member")
        .eq("target_id", memberId)
        .eq("action", "brand_team_member_role_updated"),
    );

    if (auditRows.length) break;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  if (!auditRows.length) {
    throw new Error("Updated team member role audit row is missing.");
  }

  return { auditCount: auditRows.length, updatedMember };
}

async function removeAcceptedMemberFromSettings(client, targets, email) {
  await navigate(client, targets.settingsUrl);
  await waitForExpression(
    client,
    `([...document.querySelectorAll('[data-testid="brand-team-member-row"]')]
      .some((row) => row.textContent.includes(${JSON.stringify(email)})))`,
    "accepted teammate row for removal",
    60000,
  );

  await evaluate(
    client,
    `(() => {
      const rows = [...document.querySelectorAll('[data-testid="brand-team-member-row"]')];
      const row = rows.find((nextRow) => nextRow.textContent.includes(${JSON.stringify(email)}));
      if (!row) throw new Error("Missing accepted teammate row for removal.");
      const buttons = [...row.querySelectorAll("button")];
      const removeButton = buttons.at(-1);
      if (!removeButton) throw new Error("Missing accepted teammate remove button.");
      removeButton.click();
      return true;
    })()`,
  );

  await waitForExpression(
    client,
    `(![...document.querySelectorAll('[data-testid="brand-team-member-row"]')]
      .some((row) => row.textContent.includes(${JSON.stringify(email)})))`,
    "removed teammate row",
    60000,
  );
}

async function assertRemovedTeamMember(admin, memberId) {
  let exists = true;
  const startedAt = Date.now();

  while (Date.now() - startedAt < 60000) {
    const { data, error } = await admin
      .from("brand_team_members")
      .select("id")
      .eq("id", memberId)
      .maybeSingle();

    if (error) {
      throw new Error(
        `Read removed UI smoke brand team member: ${error.message}`,
      );
    }

    exists = Boolean(data);
    if (!exists) break;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  if (exists) throw new Error("Removed team member row still exists.");

  let auditRows = [];
  const auditStartedAt = Date.now();

  while (Date.now() - auditStartedAt < 60000) {
    auditRows = await checkedQuery(
      "Read removed UI smoke brand team audit rows",
      admin
        .from("admin_audit_log")
        .select("id, action, target_id, metadata")
        .eq("target_type", "brand_team_member")
        .eq("target_id", memberId)
        .eq("action", "brand_team_member_removed"),
    );

    if (auditRows.length) break;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  if (!auditRows.length) {
    throw new Error("Removed team member audit row is missing.");
  }

  return { auditCount: auditRows.length, removedMemberId: memberId };
}

export async function cleanupBrandTeamInviteUiSmoke({
  admin,
  email,
  invitationId,
  memberUserId,
  extraEmails = [],
  extraInvitationIds = [],
}) {
  const emails = [email, ...extraEmails].filter(Boolean);
  const invitationIds = [invitationId, ...extraInvitationIds].filter(Boolean);

  for (const nextEmail of emails) {
    if (!isSmokeEmail(nextEmail)) {
      throw new Error("Refusing to clean non-smoke brand team invite email.");
    }
  }

  for (const nextInvitationId of invitationIds) {
    await checkedQuery(
      "Delete UI smoke brand team invitation audit rows",
      admin
        .from("admin_audit_log")
        .delete()
        .eq("target_type", "brand_team_invitation")
        .eq("target_id", nextInvitationId),
    );
    await checkedQuery(
      "Delete UI smoke brand team invitation",
      admin.from("brand_team_invitations").delete().eq("id", nextInvitationId),
    );
  }

  for (const nextEmail of emails) {
    await checkedQuery(
      "Delete UI smoke notification queue rows",
      admin
        .from("notification_queue")
        .delete()
        .eq("email", nextEmail)
        .eq("template", "brand_team_invitation"),
    );
  }

  if (memberUserId) {
    await checkedQuery(
      "Delete UI smoke brand team member rows",
      admin.from("brand_team_members").delete().eq("user_id", memberUserId),
    );
    await checkedQuery(
      "Delete UI smoke profile",
      admin.from("profiles").delete().eq("id", memberUserId),
    );

    const deleted = await admin.auth.admin.deleteUser(memberUserId);
    if (
      deleted.error &&
      !/not found|does not exist/i.test(deleted.error.message)
    ) {
      throw new Error(`Delete UI smoke auth user: ${deleted.error.message}`);
    }
  }
}

export async function runBrandTeamInviteUiSmoke({
  screenshotDirectory = "output/playwright",
  targets = buildBrandTeamInviteUiSmokeTargets(),
} = {}) {
  await loadLocalEnv();

  const debugPort = await findFreePort();
  const userDataDir = await mkdtemp(
    path.join(tmpdir(), "popsdrops-brand-team-invite-ui-"),
  );
  const admin = createAdminClientFromEnv();
  const email = buildSmokeEmail();
  const revokedEmail = buildSmokeEmail();
  const consoleErrors = [];
  let chrome;
  let client;
  let devServer;
  let invitation;
  let revokedInvitation;
  let expiredInvitation;
  let memberUserId;
  let duplicateGuardVerified = false;
  let promoted;
  let resent;
  let resentQueueItem;

  try {
    devServer = await ensureDevServer(targets.baseUrl);
    chrome = await launchChrome({ debugPort, userDataDir });
    client = await createCdpPage(debugPort);
    await client.send("Runtime.enable");
    await client.send("Page.enable");

    client.on("Runtime.consoleAPICalled", (event) => {
      if (event.type === "error") {
        consoleErrors.push(
          event.args.map((arg) => arg.value || arg.description || "").join(" "),
        );
      }
    });
    client.on("Runtime.exceptionThrown", (event) => {
      consoleErrors.push(event.exceptionDetails?.text || "Runtime exception");
    });

    await inviteTeammateFromSettings(client, targets, revokedEmail);
    revokedInvitation = await readPendingInvitation(admin, revokedEmail);
    const initialRevokedQueueItem = await readNotificationQueue(
      admin,
      revokedEmail,
    );
    expiredInvitation = await expirePendingInvitationForSmoke(
      admin,
      revokedInvitation,
    );
    await assertExpiredInviteVisibleInSettings(client, targets, revokedEmail);
    await resendPendingInviteFromSettings(client, targets, revokedEmail);
    resent = await assertResentInvitation(admin, revokedInvitation);
    resentQueueItem = await assertResentNotificationQueue(
      admin,
      revokedEmail,
      initialRevokedQueueItem,
    );
    await revokePendingInviteFromSettings(client, targets, revokedEmail);
    const revoked = await assertRevokedInvitation(admin, revokedInvitation);

    await inviteTeammateFromSettings(client, targets, email);
    invitation = await readPendingInvitation(admin, email);

    if (invitation.role !== "manager") {
      throw new Error(
        `Expected manager pending invite, got ${invitation.role}`,
      );
    }

    const queueItem = await readNotificationQueue(admin, email);
    const teamInvitationUrl =
      queueItem.data?.teamInvitationUrl ??
      queueItem.data?.team_invitation_url ??
      queueItem.data?.data?.team_invitation_url;
    if (
      !teamInvitationUrl ||
      !teamInvitationUrl.endsWith(`/team/invitations/${invitation.id}`)
    ) {
      throw new Error(
        `Expected invite email handoff URL, got ${teamInvitationUrl}`,
      );
    }

    const loginUrl =
      queueItem.data?.loginUrl ??
      queueItem.data?.login_url ??
      queueItem.data?.data?.login_url;
    const expectedReturnTo = `/team/invitations/${invitation.id}`;
    if (
      !loginUrl ||
      new URL(loginUrl).pathname !== "/login" ||
      new URL(loginUrl).searchParams.get("returnTo") !== expectedReturnTo
    ) {
      throw new Error(`Expected invite email login return path, got ${loginUrl}`);
    }

    memberUserId = await createInvitedAuthUser(admin, email);
    await openMagicLinkAndAccept(client, admin, targets, invitation, email);
    const accepted = await assertAcceptedTeamMember(
      admin,
      invitation,
      memberUserId,
    );
    await assertAcceptedMemberVisibleInSettings(client, targets, email);

    await loginForSmoke(client, {
      loginUrl: targets.ownerLoginUrl,
      expectedUrlPrefix: `${targets.baseUrl}/b`,
      description: "brand owner login for team management",
    });
    await assertAcceptedTeammateInviteRejected(client, targets, email);
    await assertNoPendingInvitationForAcceptedEmail(
      admin,
      accepted.member.brand_id,
      email,
    );
    duplicateGuardVerified = true;
    await updateAcceptedMemberRoleFromSettings(client, targets, email, "owner");
    promoted = await assertUpdatedTeamMemberRole(
      admin,
      accepted.member.id,
      "owner",
    );
    await updateAcceptedMemberRoleFromSettings(
      client,
      targets,
      email,
      "viewer",
    );
    const updated = await assertUpdatedTeamMemberRole(
      admin,
      accepted.member.id,
      "viewer",
    );
    await removeAcceptedMemberFromSettings(client, targets, email);
    const removed = await assertRemovedTeamMember(admin, accepted.member.id);

    const screenshotPath = path.join(
      screenshotDirectory,
      "brand-team-invite-ui-governance.png",
    );
    await captureScreenshot(client, screenshotPath);

    if (consoleErrors.length > 0) {
      throw new Error(`Console errors found: ${consoleErrors.join(" | ")}`);
    }

    return {
      ok: true,
      accepted,
      baseUrl: targets.baseUrl,
      devServerStarted: Boolean(devServer),
      duplicateGuardVerified,
      email,
      expiredInvitation,
      invitation,
      memberUserId,
      promoted,
      queueItem,
      removed,
      resent,
      resentQueueItem,
      revoked,
      revokedEmail,
      revokedInvitation,
      screenshotPath,
      updated,
    };
  } finally {
    if (client) client.close();
    await stopChrome(chrome);
    await stopDevServer(devServer);
    await cleanupBrandTeamInviteUiSmoke({
      admin,
      email,
      invitationId: invitation?.id,
      memberUserId,
      extraEmails: [revokedEmail],
      extraInvitationIds: [revokedInvitation?.id],
    });
    await rm(userDataDir, {
      recursive: true,
      force: true,
      maxRetries: 3,
      retryDelay: 100,
    });
  }
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] === currentFile) {
  runBrandTeamInviteUiSmoke()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    })
    .finally(() => {
      process.exit(process.exitCode ?? 0);
    });
}
