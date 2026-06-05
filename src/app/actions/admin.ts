"use server";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { dispatchNotificationEmailByQueueId } from "@/lib/email/notification-queue";
import { isEmailNotificationType } from "@/lib/email/notification-types";
import { getAppBaseUrl } from "@/lib/app-url";
import { buildReportCompositionExportData } from "@/lib/reporting/report-builder";
import {
  assertReportExportServiceContractVersion,
  REPORT_EXPORT_CONTRACT_VERSION,
} from "@/lib/reporting/report-export-contract";
import {
  assertReportExportServiceReady,
  getReportExportServiceConfig,
} from "@/lib/reporting/report-export-service";
import { buildCampaignSharedReport } from "@/lib/reporting/shared-report-data";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createPrivilegedNotification,
  createPrivilegedNotifications,
} from "@/lib/supabase/privileged";
import type {
  ApplicationStatus,
  CampaignStatus,
  DataRightsRequestStatus,
  DataRightsRequestType,
  NotificationQueueStatus,
  NotificationType,
  PaymentStatusType,
  PlatformType,
  UserRole,
  UserStatus,
} from "@/types/database";
import { getUser } from "./auth";

type PlatformSettingValue =
  | string
  | number
  | boolean
  | null
  | PlatformSettingValue[]
  | { [key: string]: PlatformSettingValue };

type AdminLifecycleProfile = {
  id: string;
  full_name: string;
  email: string;
  role: "creator" | "brand" | "admin";
  status: UserStatus;
};

export type AdminUserDetail = {
  profile: {
    id: string;
    full_name: string;
    email: string;
    role: UserRole;
    status: UserStatus;
    created_at: string;
  };
  auditEntries: Array<{
    id: string;
    action: string;
    metadata: Record<string, unknown> | null;
    created_at: string;
    admin_name: string | null;
    admin_email: string | null;
  }>;
  notifications: Array<{
    id: string;
    type: NotificationType;
    title: string;
    body: string | null;
    created_at: string;
  }>;
  notificationQueue: Array<{
    id: string;
    template: string;
    status: NotificationQueueStatus;
    delivered_at: string | null;
    processed_at: string | null;
    created_at: string;
  }>;
  dataRightsRequests: Array<{
    id: string;
    request_type: DataRightsRequestType;
    status: DataRightsRequestStatus;
    scheduled_for: string | null;
    completed_at: string | null;
    created_at: string;
  }>;
  relatedCampaigns: Array<{
    id: string;
    title: string;
    status: CampaignStatus;
    relationship: "brand" | "member" | "applicant";
    application_status: ApplicationStatus | null;
    created_at: string;
  }>;
};

export type AdminAuditEntry = {
  id: string;
  action: string;
  target_type: string;
  target_id: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  admin: { full_name: string; email: string } | null;
};

export type AdminAuditEntriesResult = {
  entries: AdminAuditEntry[];
  totalCount: number;
};

type AdminAuditAdminRecord = {
  full_name: string | null;
  email: string | null;
};

type AdminAuditRow = Omit<AdminAuditEntry, "admin"> & {
  admin: AdminAuditAdminRecord | AdminAuditAdminRecord[] | null;
};

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const idSchema = z.string().uuid();
const reasonSchema = z.string().min(1).max(500).trim();
const reportTaskExcuseReasonSchema = z.string().trim().min(12).max(500);
const proofReviewInterventionNoteSchema = z.string().trim().min(12).max(500);
const reportExportRetryPayloadSchema = z.object({
  jobId: z.string().uuid(),
  format: z.enum(["json", "csv", "html"]),
  fileName: z.string().min(1),
  mimeType: z.string().min(1),
  storagePath: z.string().min(1),
  signedUrl: z.string().min(1),
  contractVersion: z.literal(REPORT_EXPORT_CONTRACT_VERSION),
});
const dataRightsDenialReasonSchema = z.string().trim().min(3).max(500);
const serviceFeeStatusSchema = z.enum([
  "pending",
  "invoiced",
  "paid",
  "overdue",
  "failed",
  "refunded",
  "disputed",
]);
const serviceFeeNoteSchema = z.string().min(3).max(500).trim();
const enterpriseConciergeRequestStatusSchema = z.enum([
  "requested",
  "reviewing",
  "closed",
]);
const dataRightsRequestStatusSchema = z.enum([
  "reviewing",
  "completed",
  "rejected",
]);
const adminAuditEntriesSchema = z.object({
  page: z.number().int().min(0).max(10_000),
  actionFilter: z.enum(["all", "approvals", "suspensions", "campaigns", "team"]),
  dateRange: z.enum(["all", "today", "7d", "30d"]),
  highlightedAuditEntryId: z.string().uuid().nullable(),
});
const quotedServiceFeeDollarsSchema = z.preprocess(
  (value) =>
    typeof value === "string" ? value.replace(/[$,\s]/g, "") : value,
  z.coerce.number().int().min(1).max(1_000_000),
);
const quoteNoteSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  },
  z.string().max(500).nullable(),
);

type PendingWaitlistAccessRequest = {
  id: string;
  type: "brand" | "creator";
  email: string;
  full_name: string;
  company_name: string | null;
  industry: string | null;
  website: string | null;
  budget_range: string | null;
  social_url: string | null;
  social_platform: PlatformType | null;
  follower_range: string | null;
  markets: string[];
  reason: string | null;
};

const waitlistAccessSelect = `
  id,
  type,
  email,
  full_name,
  company_name,
  industry,
  website,
  budget_range,
  social_url,
  social_platform,
  follower_range,
  markets,
  reason
`;

const adminAuditEntrySelectColumns = `
  id, action, target_type, target_id, metadata, created_at,
  admin:profiles!admin_audit_log_admin_id_fkey (full_name, email)
`;

const adminAuditActionFilterGroups: Record<string, string[]> = {
  approvals: ["approve_profile", "reject_profile", "re_review_profile"],
  suspensions: ["suspend_user", "unsuspend_user"],
  campaigns: [
    "pause_campaign",
    "cancel_campaign",
    "resume_campaign",
    "campaign_responsibility_updated",
  ],
  team: [
    "brand_team_invitation_created",
    "brand_team_invitation_revoked",
    "brand_team_invitation_accepted",
    "brand_team_member_role_updated",
    "brand_team_member_removed",
  ],
};

const ADMIN_AUDIT_PAGE_SIZE = 50;

type ManualServiceFeeTimestampUpdate = Partial<
  Record<
    | "service_fee_paid_at"
    | "service_fee_failed_at"
    | "service_fee_refunded_at"
    | "service_fee_disputed_at",
    string
  >
>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function requireAdmin() {
  const user = await getUser();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") throw new Error("Admin access required");
  return { user, supabase };
}

function isAlreadyRegisteredAuthError(error: { message?: string } | null) {
  return /already|registered|exists/i.test(error?.message ?? "");
}

function normalizeAccessSlug({
  email,
  fullName,
  userId,
}: {
  email: string;
  fullName: string;
  userId: string;
}) {
  const readable = fullName.trim() || email.split("@")[0] || "creator";
  const base = readable
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 36);

  return `${base || "creator"}-${userId.slice(0, 8)}`;
}

function buildCreatorProfileSocials(request: PendingWaitlistAccessRequest) {
  const platform = request.social_platform;
  const socialUrl = request.social_url?.trim();
  const emptySocials = {
    tiktok: null,
    instagram: null,
    snapchat: null,
    youtube: null,
    facebook: null,
  };

  if (!platform || !socialUrl) return emptySocials;

  return {
    ...emptySocials,
    [platform]: {
      url: socialUrl,
      verified: false,
    },
  };
}

async function getPendingWaitlistAccessRequest(
  admin: ReturnType<typeof createAdminClient>,
  requestId: string,
) {
  const { data, error } = await admin
    .from("waitlist")
    .select(waitlistAccessSelect)
    .eq("id", requestId)
    .eq("status", "pending")
    .single();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Access request is not pending");

  return data as PendingWaitlistAccessRequest;
}

async function ensureWaitlistAuthUser(
  admin: ReturnType<typeof createAdminClient>,
  request: PendingWaitlistAccessRequest,
) {
  const { data, error } = await admin.auth.admin.createUser({
    email: request.email,
    email_confirm: true,
    user_metadata: {
      full_name: request.full_name,
      role: request.type,
      access_source: "waitlist",
    },
  });

  if (!error && data.user?.id) return data.user.id;

  if (error && !isAlreadyRegisteredAuthError(error)) {
    throw new Error(error.message);
  }

  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({
      type: "magiclink",
      email: request.email,
    });

  if (linkError) throw new Error(linkError.message);
  if (!linkData.user?.id) {
    throw new Error("Could not resolve the approved user");
  }

  return linkData.user.id;
}

async function upsertApprovedAccessProfile({
  admin,
  adminId,
  request,
  userId,
}: {
  admin: ReturnType<typeof createAdminClient>;
  adminId: string;
  request: PendingWaitlistAccessRequest;
  userId: string;
}) {
  const now = new Date().toISOString();
  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: userId,
      email: request.email,
      full_name: request.full_name,
      role: request.type,
      status: "approved",
      onboarding_completed: true,
      approved_at: now,
      approved_by: adminId,
    },
    { onConflict: "id" },
  );

  if (profileError) throw new Error(profileError.message);

  if (request.type === "brand") {
    const { error } = await admin.from("brand_profiles").upsert(
      {
        profile_id: userId,
        company_name: request.company_name ?? request.full_name,
        industry: request.industry,
        website: request.website,
        budget_range: request.budget_range,
        target_markets: request.markets ?? [],
        contact_name: request.full_name,
        contact_email: request.email,
      },
      { onConflict: "profile_id" },
    );

    if (error) throw new Error(error.message);
    return;
  }

  const socialFields = buildCreatorProfileSocials(request);
  const { error } = await admin.from("creator_profiles").upsert(
    {
      profile_id: userId,
      slug: normalizeAccessSlug({
        email: request.email,
        fullName: request.full_name,
        userId,
      }),
      bio: request.reason,
      primary_market: request.markets?.[0] ?? null,
      platforms: request.social_platform ? [request.social_platform] : [],
      markets: request.markets ?? [],
      languages: ["en"],
      niches: [],
      content_formats: [],
      rate_currency: "USD",
      profile_completeness: request.social_url ? 35 : 20,
      ...socialFields,
    },
    { onConflict: "profile_id" },
  );

  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Waitlist access actions
// ---------------------------------------------------------------------------

export async function approveWaitlistRequest(requestId: string) {
  const { user, supabase } = await requireAdmin();
  const validId = idSchema.parse(requestId);
  const admin = createAdminClient();
  const request = await getPendingWaitlistAccessRequest(admin, validId);
  const approvedUserId = await ensureWaitlistAuthUser(admin, request);

  await upsertApprovedAccessProfile({
    admin,
    adminId: user.id,
    request,
    userId: approvedUserId,
  });

  const now = new Date().toISOString();
  const { data: updatedWaitlistRows, error: waitlistError } = await admin
    .from("waitlist")
    .update({
      status: "approved",
      reviewed_by: user.id,
      reviewed_at: now,
      rejection_reason: null,
    })
    .eq("id", validId)
    .eq("status", "pending")
    .select("id");

  if (waitlistError) throw new Error(waitlistError.message);
  if (!updatedWaitlistRows || updatedWaitlistRows.length === 0) {
    throw new Error("Access request is no longer pending");
  }

  await createPrivilegedNotification({
    user_id: approvedUserId,
    type: "account_approved",
    title: "Access Approved",
    body: "Your PopsDrops workspace is ready.",
    data: {
      role: request.type,
      loginUrl: `${getAppBaseUrl()}/login`,
    },
  });

  await supabase.from("admin_audit_log").insert({
    admin_id: user.id,
    action: "approve_waitlist_request",
    target_type: "waitlist",
    target_id: validId,
    metadata: {
      target_name: request.full_name,
      target_email: request.email,
      target_role: request.type,
      approved_user_id: approvedUserId,
    },
  });

  revalidatePath("/admin/approvals");
  revalidatePath("/admin/users");
  return { userId: approvedUserId };
}

export async function rejectWaitlistRequest(requestId: string, reason: string) {
  const { user, supabase } = await requireAdmin();
  const validId = idSchema.parse(requestId);
  const validReason = reasonSchema.parse(reason);
  const admin = createAdminClient();
  const request = await getPendingWaitlistAccessRequest(admin, validId);

  const { data: updatedWaitlistRows, error } = await admin
    .from("waitlist")
    .update({
      status: "rejected",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      rejection_reason: validReason,
    })
    .eq("id", validId)
    .eq("status", "pending")
    .select("id");

  if (error) throw new Error(error.message);
  if (!updatedWaitlistRows || updatedWaitlistRows.length === 0) {
    throw new Error("Access request is no longer pending");
  }

  const { error: emailQueueError } = await admin
    .from("notification_queue")
    .insert({
      email: request.email,
      template: "account_rejected",
      priority: "immediate",
      data: {
        title: "Account Update",
        body: validReason,
        recipientName: request.full_name,
        recipient_name: request.full_name,
        data: {
          reason: validReason,
          role: request.type,
        },
      },
    });

  if (emailQueueError) throw new Error(emailQueueError.message);

  await supabase.from("admin_audit_log").insert({
    admin_id: user.id,
    action: "reject_waitlist_request",
    target_type: "waitlist",
    target_id: validId,
    metadata: {
      reason: validReason,
      target_name: request.full_name,
      target_email: request.email,
      target_role: request.type,
    },
  });

  revalidatePath("/admin/approvals");
}

// ---------------------------------------------------------------------------
// Profile actions
// ---------------------------------------------------------------------------

export async function approveProfile(profileId: string) {
  const { user, supabase } = await requireAdmin();
  const validId = idSchema.parse(profileId);
  const now = new Date().toISOString();

  const { data: rows, error } = await supabase
    .from("profiles")
    .update({
      status: "approved",
      approved_at: now,
      approved_by: user.id,
    })
    .eq("id", validId)
    .eq("status", "pending")
    .select("id, email, full_name, role");

  if (error) throw new Error(error.message);
  if (!rows || rows.length === 0)
    throw new Error("Profile is not in pending status");

  const profile = rows[0];

  // Notify user
  await createPrivilegedNotification({
    user_id: validId,
    type: "account_approved",
    title: "Account Approved!",
    body: "Your account has been approved. You can now access the platform.",
    data: { role: profile.role },
  });

  // Audit log
  await supabase.from("admin_audit_log").insert({
    admin_id: user.id,
    action: "approve_profile",
    target_type: "profile",
    target_id: validId,
    metadata: {
      target_name: profile.full_name,
      target_role: profile.role,
    },
  });

  revalidatePath("/admin/approvals");
}

export async function rejectProfile(profileId: string, reason: string) {
  const { user, supabase } = await requireAdmin();
  const validId = idSchema.parse(profileId);
  const validReason = reasonSchema.parse(reason);

  const { data: rows, error } = await supabase
    .from("profiles")
    .update({ status: "rejected" })
    .eq("id", validId)
    .eq("status", "pending")
    .select("id, email, full_name, role");

  if (error) throw new Error(error.message);
  if (!rows || rows.length === 0)
    throw new Error("Profile is not in pending status");

  const profile = rows[0];

  // Notify user
  await createPrivilegedNotification({
    user_id: validId,
    type: "account_rejected",
    title: "Account Update",
    body: validReason,
    data: { reason: validReason, role: profile.role },
  });

  // Audit log
  await supabase.from("admin_audit_log").insert({
    admin_id: user.id,
    action: "reject_profile",
    target_type: "profile",
    target_id: validId,
    metadata: {
      reason: validReason,
      target_name: profile.full_name,
      target_role: profile.role,
    },
  });

  revalidatePath("/admin/approvals");
}

type AdminAuditProfileRelation =
  | {
      full_name: string | null;
      email: string | null;
    }
  | Array<{
      full_name: string | null;
      email: string | null;
    }>
  | null;

type AdminAuditDetailRow = {
  id: string;
  action: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  admin?: AdminAuditProfileRelation;
};

type AdminUserDetailCampaignRow = {
  id: string;
  title: string;
  status: CampaignStatus;
  created_at: string;
};

type AdminUserDetailCampaignRelation =
  | AdminUserDetailCampaignRow
  | AdminUserDetailCampaignRow[]
  | null;

type AdminUserDetailApplicationCampaignRow = {
  campaign_id: string;
  status: ApplicationStatus;
  campaigns?: AdminUserDetailCampaignRelation;
};

type AdminUserDetailMemberCampaignRow = {
  campaign_id: string;
  campaigns?: AdminUserDetailCampaignRelation;
};

function getAuditAdminProfile(row: AdminAuditDetailRow) {
  if (Array.isArray(row.admin)) {
    return row.admin[0] ?? null;
  }

  return row.admin ?? null;
}

function getAdminAuditAdminProfile(row: AdminAuditRow) {
  if (Array.isArray(row.admin)) {
    return row.admin[0] ?? null;
  }

  return row.admin ?? null;
}

function mapAdminAuditEntry(row: unknown): AdminAuditEntry {
  const entry = row as AdminAuditRow;
  const admin = getAdminAuditAdminProfile(entry);

  return {
    ...entry,
    admin: admin
      ? {
          full_name: admin.full_name ?? "Unknown",
          email: admin.email ?? "",
        }
      : null,
  };
}

function getAdminAuditDateRangeFilter(range: string): string | null {
  const now = new Date();
  switch (range) {
    case "today": {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return start.toISOString();
    }
    case "7d": {
      const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return start.toISOString();
    }
    case "30d": {
      const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return start.toISOString();
    }
    default:
      return null;
  }
}

function buildManualServiceFeeTimestampUpdate(
  status: PaymentStatusType,
  now: string,
): ManualServiceFeeTimestampUpdate {
  if (status === "paid") return { service_fee_paid_at: now };
  if (status === "failed") return { service_fee_failed_at: now };
  if (status === "refunded") return { service_fee_refunded_at: now };
  if (status === "disputed") return { service_fee_disputed_at: now };
  return {};
}

function getCampaignRelation(campaigns?: AdminUserDetailCampaignRelation) {
  if (Array.isArray(campaigns)) {
    return campaigns[0] ?? null;
  }

  return campaigns ?? null;
}

export async function fetchAdminUserDetail(
  profileId: string,
): Promise<AdminUserDetail> {
  await requireAdmin();
  const validId = idSchema.parse(profileId);
  const admin = createAdminClient();

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, full_name, email, role, status, created_at")
    .eq("id", validId)
    .single();

  if (profileError) throw new Error(profileError.message);
  if (!profile) throw new Error("User not found");

  const [
    auditResult,
    notificationsResult,
    notificationQueueResult,
    dataRightsResult,
  ] = await Promise.all([
    admin
      .from("admin_audit_log")
      .select(
        `
        id,
        action,
        metadata,
        created_at,
        admin:profiles!admin_audit_log_admin_id_fkey (full_name, email)
      `,
      )
      .eq("target_id", validId)
      .order("created_at", { ascending: false })
      .limit(8),
    admin
      .from("notifications")
      .select("id, type, title, body, created_at")
      .eq("user_id", validId)
      .order("created_at", { ascending: false })
      .limit(8),
    admin
      .from("notification_queue")
      .select("id, template, status, delivered_at, processed_at, created_at")
      .eq("email", profile.email)
      .order("created_at", { ascending: false })
      .limit(8),
    admin
      .from("data_rights_requests")
      .select(
        "id, request_type, status, scheduled_for, completed_at, created_at",
      )
      .eq("profile_id", validId)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  if (auditResult.error) throw new Error(auditResult.error.message);
  if (notificationsResult.error) {
    throw new Error(notificationsResult.error.message);
  }
  if (notificationQueueResult.error) {
    throw new Error(notificationQueueResult.error.message);
  }
  if (dataRightsResult.error) throw new Error(dataRightsResult.error.message);

  const detailProfile = profile as AdminUserDetail["profile"];
  const relatedCampaignById = new Map<
    string,
    AdminUserDetail["relatedCampaigns"][number]
  >();
  const addRelatedCampaign = ({
    applicationStatus = null,
    campaign,
    relationship,
  }: {
    applicationStatus?: ApplicationStatus | null;
    campaign: AdminUserDetailCampaignRow | null;
    relationship: AdminUserDetail["relatedCampaigns"][number]["relationship"];
  }) => {
    if (!campaign) return;

    const existing = relatedCampaignById.get(campaign.id);
    if (existing?.relationship === "member") return;

    relatedCampaignById.set(campaign.id, {
      id: campaign.id,
      title: campaign.title,
      status: campaign.status,
      relationship,
      application_status: applicationStatus,
      created_at: campaign.created_at,
    });
  };

  if (detailProfile.role === "brand") {
    const { data: brandCampaigns, error } = await admin
      .from("campaigns")
      .select("id, title, status, created_at")
      .eq("brand_id", validId)
      .order("created_at", { ascending: false })
      .limit(8);

    if (error) throw new Error(error.message);

    ((brandCampaigns ?? []) as AdminUserDetailCampaignRow[]).forEach(
      (campaign) =>
        addRelatedCampaign({
          campaign,
          relationship: "brand",
        }),
    );
  }

  if (detailProfile.role === "creator") {
    const { data: applications, error: applicationsError } = await admin
      .from("campaign_applications")
      .select(
        `
        campaign_id,
        status,
        campaigns (
          id,
          title,
          status,
          created_at
        )
      `,
      )
      .eq("creator_id", validId)
      .order("created_at", { ascending: false })
      .limit(8);

    if (applicationsError) throw new Error(applicationsError.message);

    ((applications ?? []) as AdminUserDetailApplicationCampaignRow[]).forEach(
      (row) =>
        addRelatedCampaign({
          applicationStatus: row.status,
          campaign: getCampaignRelation(row.campaigns),
          relationship: "applicant",
        }),
    );

    const { data: memberships, error: membershipsError } = await admin
      .from("campaign_members")
      .select(
        `
        campaign_id,
        campaigns (
          id,
          title,
          status,
          created_at
        )
      `,
      )
      .eq("creator_id", validId)
      .limit(8);

    if (membershipsError) throw new Error(membershipsError.message);

    ((memberships ?? []) as AdminUserDetailMemberCampaignRow[]).forEach((row) =>
      addRelatedCampaign({
        campaign: getCampaignRelation(row.campaigns),
        relationship: "member",
      }),
    );
  }

  return {
    profile: detailProfile,
    auditEntries: ((auditResult.data ?? []) as AdminAuditDetailRow[]).map(
      (entry) => {
        const adminProfile = getAuditAdminProfile(entry);

        return {
          id: entry.id,
          action: entry.action,
          metadata: entry.metadata,
          created_at: entry.created_at,
          admin_name: adminProfile?.full_name ?? null,
          admin_email: adminProfile?.email ?? null,
        };
      },
    ),
    notifications:
      (notificationsResult.data ?? []) as AdminUserDetail["notifications"],
    notificationQueue:
      (notificationQueueResult.data ??
        []) as AdminUserDetail["notificationQueue"],
    dataRightsRequests:
      (dataRightsResult.data ?? []) as AdminUserDetail["dataRightsRequests"],
    relatedCampaigns: Array.from(relatedCampaignById.values())
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      )
      .slice(0, 8),
  };
}

export async function fetchAdminAuditEntries(
  input: z.infer<typeof adminAuditEntriesSchema>,
): Promise<AdminAuditEntriesResult> {
  await requireAdmin();
  const params = adminAuditEntriesSchema.parse(input);
  const admin = createAdminClient();

  let query = admin
    .from("admin_audit_log")
    .select(adminAuditEntrySelectColumns, { count: "exact" })
    .order("created_at", { ascending: false });

  if (params.actionFilter !== "all") {
    const actions = adminAuditActionFilterGroups[params.actionFilter];
    if (actions) {
      query = query.in("action", actions);
    }
  }

  const dateFrom = getAdminAuditDateRangeFilter(params.dateRange);
  if (dateFrom) {
    query = query.gte("created_at", dateFrom);
  }

  query = query.range(
    params.page * ADMIN_AUDIT_PAGE_SIZE,
    (params.page + 1) * ADMIN_AUDIT_PAGE_SIZE - 1,
  );

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);

  const entries = (data ?? []).map(mapAdminAuditEntry);

  if (
    params.highlightedAuditEntryId &&
    !entries.some((entry) => entry.id === params.highlightedAuditEntryId)
  ) {
    const { data: highlightedEntry, error: highlightedError } = await admin
      .from("admin_audit_log")
      .select(adminAuditEntrySelectColumns)
      .eq("id", params.highlightedAuditEntryId)
      .maybeSingle();

    if (highlightedError) throw new Error(highlightedError.message);
    if (highlightedEntry) {
      entries.unshift(mapAdminAuditEntry(highlightedEntry));
    }
  }

  return {
    entries,
    totalCount: count ?? 0,
  };
}

export async function suspendUser(profileId: string, reason: string) {
  const { user, supabase } = await requireAdmin();
  const validId = idSchema.parse(profileId);
  const validReason = reasonSchema.parse(reason);

  if (validId === user.id) {
    throw new Error("You cannot suspend your own admin account");
  }

  const { data: targetProfile, error: targetError } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, status")
    .eq("id", validId)
    .single();

  if (targetError) throw new Error(targetError.message);
  if (!targetProfile) throw new Error("User not found");

  const profile = targetProfile as AdminLifecycleProfile;

  if (profile.status !== "approved") {
    throw new Error("User is not in approved status");
  }

  if (profile.role === "admin") {
    const { count: approvedAdminCount, error: countError } = await supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "admin")
      .eq("status", "approved");

    if (countError) throw new Error(countError.message);
    if ((approvedAdminCount ?? 0) <= 1) {
      throw new Error("At least one approved admin must remain");
    }

    throw new Error("Admin accounts must be managed through owner controls");
  }

  const { data: rows, error } = await supabase
    .from("profiles")
    .update({ status: "suspended" })
    .eq("id", validId)
    .eq("status", "approved")
    .select("id, full_name, email, role, status");

  if (error) throw new Error(error.message);
  if (!rows || rows.length === 0)
    throw new Error("User is not in approved status");

  const updatedProfile = rows[0] as AdminLifecycleProfile;

  // Notify suspended user
  await createPrivilegedNotification({
    user_id: validId,
    type: "account_suspended" as const,
    title: "Account Suspended",
    body:
      validReason ||
      "Your account has been suspended. Please contact support for more information.",
    data: { reason: validReason, role: updatedProfile.role },
  });

  // Suspension cascades
  if (profile.role === "creator") {
    // Withdraw pending campaign applications
    await supabase
      .from("campaign_applications")
      .delete()
      .eq("creator_id", validId)
      .eq("status", "pending");

    // Notify brands of active campaigns this creator is in
    const { data: memberships } = await supabase
      .from("campaign_members")
      .select("campaign_id, campaigns(brand_id, title)")
      .eq("creator_id", validId);

    if (memberships && memberships.length > 0) {
      const brandNotifications = memberships
        .filter((m) => m.campaigns)
        .map((m) => {
          const campaign = m.campaigns as unknown as {
            brand_id: string;
            title: string;
          };
          return {
            user_id: campaign.brand_id,
            type: "account_rejected" as const,
            title: "Creator Suspended",
            body: `A creator in "${campaign.title}" has been suspended by admin.`,
            data: { campaign_id: m.campaign_id, creator_id: validId },
          };
        });

      if (brandNotifications.length > 0) {
        await createPrivilegedNotifications(brandNotifications);
      }
    }
  } else if (profile.role === "brand") {
    // Pause all active campaigns
    const { data: campaigns } = await supabase
      .from("campaigns")
      .update({ status: "paused" })
      .eq("brand_id", validId)
      .not("status", "in", '("draft","completed","cancelled","paused")')
      .select("id, title");

    // Notify all campaign members
    if (campaigns && campaigns.length > 0) {
      for (const campaign of campaigns) {
        const { data: members } = await supabase
          .from("campaign_members")
          .select("creator_id")
          .eq("campaign_id", campaign.id);

        if (members && members.length > 0) {
          await createPrivilegedNotifications(
            members.map((m) => ({
              user_id: m.creator_id,
              type: "campaign_paused" as const,
              title: "Campaign Paused",
              body: `"${campaign.title}" has been paused because the brand has been suspended.`,
              data: { campaign_id: campaign.id },
            }))
          );
        }
      }
    }
  }

  // Audit log
  await supabase.from("admin_audit_log").insert({
    admin_id: user.id,
    action: "suspend_user",
    target_type: "profile",
    target_id: validId,
    metadata: {
      reason: validReason,
      target_name: updatedProfile.full_name,
      target_email: updatedProfile.email,
      target_role: updatedProfile.role,
      previous_status: profile.status,
      new_status: updatedProfile.status,
    },
  });

  revalidatePath("/admin/users");
}

export async function unsuspendUser(profileId: string) {
  const { user, supabase } = await requireAdmin();
  const validId = idSchema.parse(profileId);

  const { data: rows, error } = await supabase
    .from("profiles")
    .update({ status: "approved" })
    .eq("id", validId)
    .eq("status", "suspended")
    .select("id, full_name, email, role, status");

  if (error) throw new Error(error.message);
  if (!rows || rows.length === 0)
    throw new Error("User is not in suspended status");

  const profile = rows[0] as AdminLifecycleProfile;

  await createPrivilegedNotification({
    user_id: validId,
    type: "account_restored" as const,
    title: "Access restored",
    body: "Your PopsDrops account access has been restored.",
    data: {
      loginUrl: `${getAppBaseUrl()}/login`,
      role: profile.role,
    },
  });

  // Audit log
  await supabase.from("admin_audit_log").insert({
    admin_id: user.id,
    action: "unsuspend_user",
    target_type: "profile",
    target_id: validId,
    metadata: {
      target_name: profile.full_name,
      target_email: profile.email,
      target_role: profile.role,
      previous_status: "suspended",
      new_status: profile.status,
    },
  });

  revalidatePath("/admin/users");
}

export async function reReviewProfile(profileId: string, reason: string) {
  const { user, supabase } = await requireAdmin();
  const validId = idSchema.parse(profileId);
  const validReason = reasonSchema.parse(reason);

  const { data: targetProfile, error: targetError } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, status")
    .eq("id", validId)
    .single();

  if (targetError) throw new Error(targetError.message);
  if (!targetProfile) throw new Error("Profile not found");

  const profile = targetProfile as AdminLifecycleProfile;

  if (profile.role === "admin") {
    throw new Error("Admin profiles do not use profile re-review");
  }

  if (profile.status !== "approved" && profile.status !== "rejected") {
    throw new Error(
      "Profile must be in approved or rejected status to re-review"
    );
  }

  const { data: rows, error } = await supabase
    .from("profiles")
    .update({ status: "pending" })
    .eq("id", validId)
    .in("status", ["approved", "rejected"])
    .select("id, full_name, email, role, status");

  if (error) throw new Error(error.message);
  if (!rows || rows.length === 0)
    throw new Error(
      "Profile must be in approved or rejected status to re-review"
    );

  const updatedProfile = rows[0] as AdminLifecycleProfile;

  await createPrivilegedNotification({
    user_id: validId,
    type: "account_review_reopened" as const,
    title: "Account review reopened",
    body: validReason,
    data: {
      reason: validReason,
      role: updatedProfile.role,
    },
  });

  // Audit log
  await supabase.from("admin_audit_log").insert({
    admin_id: user.id,
    action: "re_review_profile",
    target_type: "profile",
    target_id: validId,
    metadata: {
      reason: validReason,
      target_name: updatedProfile.full_name,
      target_email: updatedProfile.email,
      target_role: updatedProfile.role,
      previous_status: profile.status,
      new_status: "pending",
    },
  });

  revalidatePath("/admin/users");
}

// ---------------------------------------------------------------------------
// Campaign actions
// ---------------------------------------------------------------------------

export async function pauseCampaign(campaignId: string, reason: string) {
  const { user, supabase } = await requireAdmin();
  const validId = idSchema.parse(campaignId);
  const validReason = reasonSchema.parse(reason);

  const { data: rows, error } = await supabase
    .from("campaigns")
    .update({ status: "paused" })
    .eq("id", validId)
    .not("status", "in", '("draft","completed","cancelled","paused")')
    .select("id, brand_id, title");

  if (error) throw new Error(error.message);
  if (!rows || rows.length === 0)
    throw new Error("Campaign cannot be paused in its current state");

  const campaign = rows[0];

  // Notify brand and all members
  const { data: members } = await supabase
    .from("campaign_members")
    .select("creator_id")
    .eq("campaign_id", validId);

  const recipientIds = [
    campaign.brand_id,
    ...(members?.map((m) => m.creator_id) ?? []),
  ];

  await createPrivilegedNotifications(
    recipientIds.map((uid) => ({
      user_id: uid,
      type: "campaign_paused" as const,
      title: "Campaign Paused",
      body: `"${campaign.title}" has been paused by admin: ${validReason}`,
      data: { campaign_id: validId },
    }))
  );

  // Audit log
  await supabase.from("admin_audit_log").insert({
    admin_id: user.id,
    action: "pause_campaign",
    target_type: "campaign",
    target_id: validId,
    metadata: {
      reason: validReason,
      target_name: campaign.title,
    },
  });

  revalidatePath("/admin/campaigns");
}

export async function cancelCampaign(campaignId: string, reason: string) {
  const { user, supabase } = await requireAdmin();
  const validId = idSchema.parse(campaignId);
  const validReason = reasonSchema.parse(reason);

  const { data: rows, error } = await supabase
    .from("campaigns")
    .update({ status: "cancelled" })
    .eq("id", validId)
    .not("status", "in", '("draft","completed","cancelled","paused")')
    .select("id, brand_id, title");

  if (error) throw new Error(error.message);
  if (!rows || rows.length === 0)
    throw new Error("Campaign cannot be cancelled in its current state");

  const campaign = rows[0];

  // Notify brand and all members
  const { data: members } = await supabase
    .from("campaign_members")
    .select("creator_id")
    .eq("campaign_id", validId);

  const recipientIds = [
    campaign.brand_id,
    ...(members?.map((m) => m.creator_id) ?? []),
  ];

  await createPrivilegedNotifications(
    recipientIds.map((uid) => ({
      user_id: uid,
      type: "campaign_cancelled" as const,
      title: "Campaign Cancelled",
      body: `"${campaign.title}" has been cancelled by admin: ${validReason}`,
      data: { campaign_id: validId },
    }))
  );

  // Audit log
  await supabase.from("admin_audit_log").insert({
    admin_id: user.id,
    action: "cancel_campaign",
    target_type: "campaign",
    target_id: validId,
    metadata: {
      reason: validReason,
      target_name: campaign.title,
    },
  });

  revalidatePath("/admin/campaigns");
}

export async function resumeCampaign(campaignId: string) {
  const { user, supabase } = await requireAdmin();
  const validId = idSchema.parse(campaignId);

  const { data: rows, error } = await supabase
    .from("campaigns")
    .update({ status: "in_progress" })
    .eq("id", validId)
    .eq("status", "paused")
    .select("id, brand_id, title");

  if (error) throw new Error(error.message);
  if (!rows || rows.length === 0)
    throw new Error("Campaign is not in paused status");

  const campaign = rows[0];

  // Notify brand and all members
  const { data: members } = await supabase
    .from("campaign_members")
    .select("creator_id")
    .eq("campaign_id", validId);

  const recipientIds = [
    campaign.brand_id,
    ...(members?.map((m) => m.creator_id) ?? []),
  ];

  await createPrivilegedNotifications(
    recipientIds.map((uid) => ({
      user_id: uid,
      type: "campaign_update" as const,
      title: "Campaign Resumed",
      body: `"${campaign.title}" has been resumed by admin.`,
      data: {
        campaign_id: validId,
        campaignId: validId,
        campaignTitle: campaign.title,
      },
    }))
  );

  // Audit log
  await supabase.from("admin_audit_log").insert({
    admin_id: user.id,
    action: "resume_campaign",
    target_type: "campaign",
    target_id: validId,
    metadata: {
      target_name: campaign.title,
    },
  });

  revalidatePath("/admin/campaigns");
}

// ---------------------------------------------------------------------------
// Campaign deadline (admin override)
// ---------------------------------------------------------------------------

export async function extendContentDeadline(
  campaignId: string,
  newDeadline: string
) {
  const { user, supabase } = await requireAdmin();
  const validId = idSchema.parse(campaignId);

  const date = new Date(newDeadline);
  if (isNaN(date.getTime()) || date < new Date()) {
    throw new Error("Deadline must be a valid future date");
  }

  const { data: rows, error } = await supabase
    .from("campaigns")
    .update({ content_due_date: newDeadline })
    .eq("id", validId)
    .select("id, title, brand_id, content_due_date");

  if (error) throw new Error(error.message);
  if (!rows || rows.length === 0)
    throw new Error("Campaign not found");

  const campaign = rows[0];

  // Notify brand
  await createPrivilegedNotification({
    user_id: campaign.brand_id,
    type: "campaign_update" as const,
    title: "Content Deadline Extended",
    body: `The content deadline for "${campaign.title}" has been extended to ${date.toLocaleDateString()} by admin.`,
    data: {
      campaign_id: validId,
      campaignId: validId,
      campaignTitle: campaign.title,
    },
  });

  // Audit log
  await supabase.from("admin_audit_log").insert({
    admin_id: user.id,
    action: "extend_content_deadline",
    target_type: "campaign",
    target_id: validId,
    metadata: {
      target_name: campaign.title,
      new_deadline: newDeadline,
    },
  });

  revalidatePath("/admin/reports");
}

export async function updateCampaignServiceFeeStatus(formData: FormData) {
  const { user, supabase } = await requireAdmin();
  const validId = idSchema.parse(formData.get("campaign_id"));
  const validStatus = serviceFeeStatusSchema.parse(
    formData.get("service_fee_status"),
  );
  const validNote = serviceFeeNoteSchema.parse(formData.get("note"));
  const now = new Date().toISOString();
  const manualEventId = `admin_manual_${randomUUID()}`;

  const { data: current, error: currentError } = await supabase
    .from("campaigns")
    .select("id, title, service_fee_status")
    .eq("id", validId)
    .single();

  if (currentError) throw new Error(currentError.message);
  if (!current) throw new Error("Campaign not found");
  if (current.service_fee_status !== validStatus) {
    const { data: rows, error } = await supabase
      .from("campaigns")
      .update({
        ...buildManualServiceFeeTimestampUpdate(validStatus, now),
        service_fee_last_event_at: now,
        service_fee_last_event_id: manualEventId,
        service_fee_last_event_type: "admin.manual_status_update",
        service_fee_status: validStatus,
        updated_at: now,
      })
      .eq("id", validId)
      .select("id, title, service_fee_status");

    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) {
      throw new Error("Campaign service fee status was not updated");
    }
  }

  await supabase.from("admin_audit_log").insert({
    admin_id: user.id,
    action: "update_campaign_service_fee_status",
    target_type: "campaign",
    target_id: validId,
    metadata: {
      target_name: current.title,
      manual_event_id: manualEventId,
      previous_status: current.service_fee_status,
      new_status: validStatus,
      note: validNote,
    },
  });

  revalidatePath("/admin/revenue");
  revalidatePath("/admin/campaigns");
  revalidatePath(`/admin/campaigns/${validId}`);
  revalidatePath(`/b/campaigns/${validId}`);
}

export async function excuseAdminReportTask(formData: FormData) {
  const { user, supabase } = await requireAdmin();
  const reportTaskId = idSchema.parse(formData.get("report_task_id"));
  const excuseReason = reportTaskExcuseReasonSchema.parse(formData.get("excuse_reason"));
  const admin = createAdminClient();

  const { data: task, error: taskError } = await admin
    .from("campaign_report_tasks")
    .select("id, campaign_id, status")
    .eq("id", reportTaskId)
    .single();

  if (taskError) throw new Error(taskError.message);
  if (!task) throw new Error("Report task not found");
  if (task.status !== "missed") {
    throw new Error("Only missed report tasks can be excused");
  }

  const excusedAt = new Date().toISOString();
  const { data: rows, error } = await admin
    .from("campaign_report_tasks")
    .update({
      status: "excused",
      excused_at: excusedAt,
      missed_at: null,
      review_note: `Excused by admin: ${excuseReason}`,
      updated_at: excusedAt,
    })
    .eq("id", reportTaskId)
    .eq("status", "missed")
    .select("id, campaign_id, status");

  if (error) throw new Error(error.message);
  if (!rows || rows.length === 0) {
    throw new Error("Report task could not be excused");
  }

  const { error: auditError } = await supabase.from("admin_audit_log").insert({
    admin_id: user.id,
    action: "excuse_report_task",
    target_type: "campaign_report_task",
    target_id: reportTaskId,
    metadata: {
      campaign_id: task.campaign_id,
      previous_status: task.status,
      new_status: "excused",
      reason: excuseReason,
    },
  });
  if (auditError) throw new Error(auditError.message);

  revalidatePath("/admin/campaigns");
  revalidatePath("/admin/reports");
  revalidatePath(`/admin/campaigns/${task.campaign_id}`);
  revalidatePath(`/b/campaigns/${task.campaign_id}`);
  revalidatePath(`/b/campaigns/${task.campaign_id}/report`);
  revalidatePath(`/i/campaigns/${task.campaign_id}`);
}

export async function retryAdminReportExportJob(formData: FormData) {
  const { user, supabase } = await requireAdmin();
  const reportExportJobId = idSchema.parse(formData.get("report_export_job_id"));
  const admin = createAdminClient();

  const { data: exportJob, error: exportJobError } = await admin
    .from("report_export_jobs")
    .select("id, campaign_id, format, status, file_name, error_message")
    .eq("id", reportExportJobId)
    .single();

  if (exportJobError) throw new Error(exportJobError.message);
  if (!exportJob) throw new Error("Report export job not found");
  if (exportJob.status !== "failed") {
    throw new Error("Only failed report exports can be retried");
  }

  const report = await buildCampaignSharedReport(exportJob.campaign_id, {
    applyCampaignComposition: false,
  });
  if (!report) throw new Error("Report data is not available yet.");

  await assertReportExportServiceReady();
  const { serviceRoleKey, supabaseUrl } = getReportExportServiceConfig();

  const response = await fetch(`${supabaseUrl}/functions/v1/generate-report`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({
      campaignId: exportJob.campaign_id,
      requestedBy: user.id,
      format: exportJob.format,
      report: buildReportCompositionExportData(report),
    }),
  });
  const responsePayload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      typeof responsePayload?.error === "string"
        ? responsePayload.error
        : "Report export retry failed.",
    );
  }

  assertReportExportServiceContractVersion(responsePayload);
  const payload = reportExportRetryPayloadSchema.parse(responsePayload);
  const { error: auditError } = await supabase.from("admin_audit_log").insert({
    admin_id: user.id,
    action: "retry_report_export",
    target_type: "report_export_job",
    target_id: reportExportJobId,
    metadata: {
      campaign_id: exportJob.campaign_id,
      previous_status: exportJob.status,
      previous_error: exportJob.error_message,
      previous_file_name: exportJob.file_name,
      new_job_id: payload.jobId,
      new_file_name: payload.fileName,
      new_storage_path: payload.storagePath,
      format: exportJob.format,
    },
  });
  if (auditError) throw new Error(auditError.message);

  revalidatePath("/admin/campaigns");
  revalidatePath("/admin/reports");
  revalidatePath(`/admin/campaigns/${exportJob.campaign_id}`);
  revalidatePath(`/b/campaigns/${exportJob.campaign_id}`);
  revalidatePath(`/b/campaigns/${exportJob.campaign_id}/report`);
}

export async function recordAdminProofReviewIntervention(formData: FormData) {
  const { user, supabase } = await requireAdmin();
  const evidenceId = idSchema.parse(formData.get("evidence_id"));
  const interventionNote = proofReviewInterventionNoteSchema.parse(
    formData.get("intervention_note"),
  );
  const admin = createAdminClient();

  const { data: evidence, error: evidenceError } = await admin
    .from("content_performance_evidence")
    .select(
      "id, campaign_id, campaign_member_id, report_task_id, file_name, verification_status, created_at",
    )
    .eq("id", evidenceId)
    .single();

  if (evidenceError) throw new Error(evidenceError.message);
  if (!evidence) throw new Error("Performance evidence not found");
  if (evidence.verification_status !== "submitted") {
    throw new Error("Only submitted proof awaiting brand review can be intervened on");
  }

  const { error: auditError } = await supabase.from("admin_audit_log").insert({
    admin_id: user.id,
    action: "record_proof_review_intervention",
    target_type: "content_performance_evidence",
    target_id: evidenceId,
    metadata: {
      campaign_id: evidence.campaign_id,
      campaign_member_id: evidence.campaign_member_id,
      report_task_id: evidence.report_task_id,
      file_name: evidence.file_name,
      verification_status: evidence.verification_status,
      submitted_at: evidence.created_at,
      reason: interventionNote,
    },
  });
  if (auditError) throw new Error(auditError.message);

  revalidatePath("/admin/campaigns");
  revalidatePath("/admin/reports");
  revalidatePath(`/admin/campaigns/${evidence.campaign_id}`);
  revalidatePath(`/b/campaigns/${evidence.campaign_id}`);
  revalidatePath(`/b/campaigns/${evidence.campaign_id}/report`);
}

export async function updateEnterpriseConciergeRequestStatus(formData: FormData) {
  const { user, supabase } = await requireAdmin();
  const validId = idSchema.parse(formData.get("request_id"));
  const validStatus = enterpriseConciergeRequestStatusSchema.parse(
    formData.get("status"),
  );

  const { data: current, error: currentError } = await supabase
    .from("enterprise_concierge_requests")
    .select("id, campaign_title, status")
    .eq("id", validId)
    .single();

  if (currentError) throw new Error(currentError.message);
  if (!current) throw new Error("Enterprise Concierge request not found");

  if (current.status !== validStatus) {
    const shouldClearQuote =
      current.status === "quoted" && validStatus === "reviewing";
    const { data: rows, error } = await supabase
      .from("enterprise_concierge_requests")
      .update({
        status: validStatus,
        ...(shouldClearQuote
          ? {
              quoted_service_fee_cents: null,
              quote_note: null,
              quoted_at: null,
            }
          : {}),
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", validId)
      .select("id, campaign_title, status");

    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) {
      throw new Error("Enterprise Concierge request was not updated");
    }
  }

  await supabase.from("admin_audit_log").insert({
    admin_id: user.id,
    action: "update_enterprise_concierge_request_status",
    target_type: "enterprise_concierge_request",
    target_id: validId,
    metadata: {
      target_name: current.campaign_title,
      previous_status: current.status,
      new_status: validStatus,
    },
  });

  revalidatePath("/admin/concierge");
  revalidatePath("/admin/campaigns");
  revalidatePath("/b/campaigns");
}

export async function quoteEnterpriseConciergeRequest(formData: FormData) {
  const { user, supabase } = await requireAdmin();
  const validId = idSchema.parse(formData.get("request_id"));
  const quotedServiceFeeDollars = quotedServiceFeeDollarsSchema.parse(
    formData.get("quoted_service_fee_dollars"),
  );
  const quoteNote = quoteNoteSchema.parse(formData.get("quote_note"));
  const quotedServiceFeeCents = quotedServiceFeeDollars * 100;

  const { data: current, error: currentError } = await supabase
    .from("enterprise_concierge_requests")
    .select("id, campaign_title, status, quoted_service_fee_cents, quote_note")
    .eq("id", validId)
    .single();

  if (currentError) throw new Error(currentError.message);
  if (!current) throw new Error("Enterprise Concierge request not found");

  const quotedAt = new Date().toISOString();
  const { data: rows, error } = await supabase
    .from("enterprise_concierge_requests")
    .update({
      status: "quoted",
      quoted_service_fee_cents: quotedServiceFeeCents,
      quoted_service_fee_currency: "usd",
      quote_note: quoteNote,
      quoted_at: quotedAt,
      reviewed_by: user.id,
      reviewed_at: quotedAt,
    })
    .eq("id", validId)
    .select("id, campaign_title, status, quoted_service_fee_cents");

  if (error) throw new Error(error.message);
  if (!rows || rows.length === 0) {
    throw new Error("Enterprise Concierge quote was not saved");
  }

  await supabase.from("admin_audit_log").insert({
    admin_id: user.id,
    action: "quote_enterprise_concierge_request",
    target_type: "enterprise_concierge_request",
    target_id: validId,
    metadata: {
      target_name: current.campaign_title,
      previous_status: current.status,
      previous_quoted_service_fee_cents: current.quoted_service_fee_cents,
      quoted_service_fee_cents: quotedServiceFeeCents,
      quote_note: quoteNote,
    },
  });

  revalidatePath("/admin/concierge");
  revalidatePath("/admin/campaigns");
  revalidatePath("/b/campaigns");
}

// ---------------------------------------------------------------------------
// Privacy and data-rights operations
// ---------------------------------------------------------------------------

export async function updateDataRightsRequestStatus(
  requestId: string,
  status: z.input<typeof dataRightsRequestStatusSchema>,
  reason?: string,
) {
  const { user, supabase } = await requireAdmin();
  const admin = createAdminClient();
  const validId = idSchema.parse(requestId);
  const validStatus = dataRightsRequestStatusSchema.parse(status);
  const validReason =
    validStatus === "rejected"
      ? dataRightsDenialReasonSchema.parse(reason)
      : null;
  const now = new Date().toISOString();

  const { data: current, error: currentError } = await supabase
    .from("data_rights_requests")
    .select("id, profile_id, email, request_type, status, retention_note")
    .eq("id", validId)
    .single();

  if (currentError) throw new Error(currentError.message);
  if (!current) throw new Error("Data-rights request not found");
  if (current.request_type === "deletion" && validStatus === "completed") {
    throw new Error(
      "Deletion requests are completed by the automated retention processor",
    );
  }

  if (current.status !== validStatus) {
    const updateValues = {
      status: validStatus,
      reviewed_by: user.id,
      reviewed_at: now,
      completed_at: validStatus === "completed" ? now : null,
      updated_at: now,
      ...(validStatus === "rejected" && validReason
        ? {
            retention_note: [
              current.retention_note,
              `Admin denial reason: ${validReason}`,
            ]
              .filter(Boolean)
              .join("\n\n"),
          }
        : {}),
    };

    const { data: rows, error } = await supabase
      .from("data_rights_requests")
      .update(updateValues)
      .eq("id", validId)
      .select("id, email, request_type, status, completed_at");

    if (error) throw new Error(error.message);
    if (!rows || rows.length === 0) {
      throw new Error("Data-rights request was not updated");
    }

    if (validStatus === "rejected" && validReason) {
      const { error: emailQueueError } = await admin
        .from("notification_queue")
        .insert({
          email: current.email,
          template: "privacy_request_denied",
          priority: "immediate",
          data: {
            title: "Privacy request update",
            body: validReason,
            recipientName: current.email,
            recipient_name: current.email,
            data: {
              request_id: validId,
              request_type: current.request_type,
              reason: validReason,
            },
          },
        });

      if (emailQueueError) throw new Error(emailQueueError.message);
    }
  }

  const { error: auditError } = await supabase.from("admin_audit_log").insert({
    admin_id: user.id,
    action: "update_data_rights_request_status",
    target_type: "data_rights_request",
    target_id: validId,
    metadata: {
      email: current.email,
      request_type: current.request_type,
      previous_status: current.status,
      new_status: validStatus,
      ...(validReason ? { reason: validReason } : {}),
    },
  });

  if (auditError) throw new Error(auditError.message);

  revalidatePath("/admin/settings");
  revalidatePath("/admin/approvals");
  revalidatePath("/admin/communications");
}

// ---------------------------------------------------------------------------
// Platform settings actions
// ---------------------------------------------------------------------------

export async function updatePlatformSetting(key: string, value: unknown) {
  const { user, supabase } = await requireAdmin();
  const validKey = z.string().min(1).max(100).parse(key);
  const serializedValue =
    value === undefined
      ? null
      : (JSON.parse(JSON.stringify(value)) as PlatformSettingValue);

  const { error } = await supabase.from("platform_settings").upsert({
    key: validKey,
    value: serializedValue,
    updated_at: new Date().toISOString(),
    updated_by: user.id,
  });

  if (error) throw new Error(error.message);

  // Audit log
  const { error: auditError } = await supabase.from("admin_audit_log").insert({
    admin_id: user.id,
    action: "update_setting",
    target_type: "platform_setting",
    target_id: user.id,
    metadata: { key: validKey, value: serializedValue },
  });
  if (auditError) throw new Error(auditError.message);

  revalidatePath("/admin/settings");
}

export async function getPlatformSettings() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase
    .from("platform_settings")
    .select("key, value");
  const settings: Record<string, unknown> = {};
  for (const row of data ?? []) {
    settings[row.key] = row.value;
  }
  return settings;
}

// ---------------------------------------------------------------------------
// Notification delivery operations
// ---------------------------------------------------------------------------

export async function sendOrRetryNotificationEmail(queueId: string) {
  const { user, supabase } = await requireAdmin();
  const validId = idSchema.parse(queueId);
  const admin = createAdminClient();

  const { data: queueItem, error } = await admin
    .from("notification_queue")
    .select("id, template, status, processed_at")
    .eq("id", validId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!queueItem) throw new Error("Notification queue item not found");
  if (
    (queueItem.status !== "pending" && queueItem.status !== "failed") ||
    queueItem.processed_at
  ) {
    throw new Error("Only active pending or failed notification emails can be sent");
  }
  if (!isEmailNotificationType(queueItem.template)) {
    throw new Error("This notification type does not have an email template");
  }

  const result = await dispatchNotificationEmailByQueueId(validId, admin);
  const auditAction =
    queueItem.status === "failed"
      ? { action: "retry_notification_email" }
      : { action: "send_notification_email" };

  await supabase.from("admin_audit_log").insert({
    admin_id: user.id,
    ...auditAction,
    target_type: "notification_queue",
    target_id: validId,
    metadata: {
      template: queueItem.template,
      previous_status: queueItem.status,
      result_status: result.status,
    },
  });

  revalidatePath("/admin/communications");
}
