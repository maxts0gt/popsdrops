"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  assertBrandWorkspacePermission,
  type BrandWorkspaceSupabaseClient,
  type BrandWorkspace,
} from "@/lib/brand-workspace";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createPrivilegedNotification,
  createPrivilegedReportTasksForMember,
  updatePrivilegedCampaignApplicationStatus,
  upsertPrivilegedCampaignMember,
} from "@/lib/supabase/privileged";
import { isCampaignServiceFeeUnlocked } from "@/lib/campaigns/service-fee-visibility";
import {
  assertCampaignAllowsApplicationDecision,
  assertCampaignAllowsApplicationSubmission as assertCampaignLifecycleAllowsApplicationSubmission,
} from "@/lib/campaigns/lifecycle";
import { requiresVerifiedInviteForApplication } from "@/lib/campaigns/recruitment-visibility";
import {
  creatorProfileMatchesInvite,
  type CreatorInviteProfile,
} from "@/lib/campaigns/creator-invite-match";
import { isActiveCampaignCreatorInviteStatus } from "@/lib/campaigns/creator-invite-status";
import {
  assertCampaignCreatorBatchCapacity,
  assertCampaignCreatorCapacity,
} from "@/lib/campaigns/creator-capacity";
import { getCampaignPaidCreatorCapacity } from "@/lib/campaign-service-packages";
import {
  getCreatorDeclaredPlatforms,
  getCreatorReportingEligibility,
  type EligibilityRequirement,
} from "@/lib/reporting/eligibility";
import {
  getReportingPlatformLabel,
  type ReportingAccountRequirement,
  type ReportingEvidenceType,
  type ReportingPlatform,
} from "@/lib/reporting/platform-templates";
import type { PaymentStatusType } from "@/types/database";
import { getUser } from "./auth";
import { submitApplicationSchema, counterOfferSchema } from "@/lib/validations";

const missingPlatformApplicationMessage =
  "Add {platform} to your creator profile before applying.";

const paymentStatusSchema = z.enum([
  "pending",
  "invoiced",
  "paid",
  "overdue",
  "failed",
  "refunded",
  "disputed",
]);

const memberPaymentStatusSchema = z.object({
  memberId: z.string().uuid(),
  status: paymentStatusSchema,
});

const memberPaymentStatusBatchSchema = z.object({
  member_ids: z.array(z.string().uuid()).min(1).max(100),
  status: paymentStatusSchema,
});

const acceptApplicationBatchSchema = z.object({
  application_ids: z.array(z.string().uuid()).min(1).max(100),
});

const creatorCampaignInviteContextSchema = submitApplicationSchema.pick({
  campaign_id: true,
  invite_id: true,
});

type CampaignApplicationSubmissionLifecycle = {
  status: string;
  application_deadline: string | null;
  service_fee_cents: unknown;
  service_fee_status: unknown;
  recruitment_visibility?: unknown;
};

function assertCampaignAllowsApplicationSubmission<
  T extends CampaignApplicationSubmissionLifecycle | null | undefined,
>(campaign: T): asserts campaign is NonNullable<T> {
  assertCampaignLifecycleAllowsApplicationSubmission(campaign);

  if (!isCampaignServiceFeeUnlocked(campaign)) {
    throw new Error("This campaign is not accepting applications yet.");
  }
}

function buildCreatorPaymentStatusNotification({
  status,
  member,
  campaign,
}: {
  status: PaymentStatusType;
  member: {
    id: string;
    campaign_id: string;
    creator_id: string;
    accepted_rate: number | null;
  };
  campaign: {
    title: string;
  };
}) {
  const data = {
    campaign_id: member.campaign_id,
    campaignId: member.campaign_id,
    campaign_title: campaign.title,
    campaignTitle: campaign.title,
    member_id: member.id,
    memberId: member.id,
    payment_status: status,
    paymentStatus: status,
    accepted_rate: member.accepted_rate,
    acceptedRate: member.accepted_rate,
  };

  switch (status) {
    case "paid":
      return {
        user_id: member.creator_id,
        type: "payment_received" as const,
        title: "Payment marked paid",
        body: `Payment for ${campaign.title} is marked paid.`,
        data,
      };
    case "overdue":
      return {
        user_id: member.creator_id,
        type: "campaign_update" as const,
        title: "Payment marked overdue",
        body: `Payment for ${campaign.title} is marked overdue. Check your earnings for the current status.`,
        data,
      };
    default:
      return null;
  }
}

async function getBrandApplicationWorkspace(
  supabase: BrandWorkspaceSupabaseClient,
  userId: string,
): Promise<BrandWorkspace> {
  return assertBrandWorkspacePermission(supabase, userId, "manage_campaigns");
}

async function assertCampaignHasCreatorCapacity(
  campaignId: string,
  campaign: {
    max_creators?: number | null;
    service_fee_cents?: number | null;
    service_fee_status?: string | null;
    service_package_snapshot?: Record<string, unknown> | null;
  },
) {
  const admin = createAdminClient();
  const [{ count, error }, { data: paymentEvents, error: paymentEventsError }] =
    await Promise.all([
      admin
        .from("campaign_members")
        .select("id", { count: "exact", head: true })
        .eq("campaign_id", campaignId),
      admin
        .from("campaign_payment_events")
        .select("amount_cents, checkout_session_id, service_fee_status, event_summary")
        .eq("campaign_id", campaignId),
    ]);

  if (error) throw new Error(error.message);
  if (paymentEventsError) throw new Error(paymentEventsError.message);

  return assertCampaignCreatorCapacity({
    maxCreators: getCampaignPaidCreatorCapacity({
      maxCreators: campaign.max_creators,
      paymentEvents: paymentEvents ?? [],
      serviceFeeCents: campaign.service_fee_cents,
      serviceFeeStatus: campaign.service_fee_status,
      servicePackageSnapshot: campaign.service_package_snapshot,
    }),
    acceptedCreatorCount: count ?? 0,
  });
}

async function getMatchedSourceInvite({
  campaignId,
  creatorAccountProfile,
  inviteId,
  userEmail,
}: {
  campaignId: string;
  creatorAccountProfile: CreatorInviteProfile | null | undefined;
  inviteId: string | undefined;
  userEmail: string | undefined;
}) {
  if (!inviteId) return null;

  const admin = createAdminClient();
  const { data: invite, error } = await admin
    .from("campaign_creator_invites")
    .select("id, campaign_id, contact_type, normalized_contact, status")
    .eq("id", inviteId)
    .eq("campaign_id", campaignId)
    .maybeSingle();

  if (error || !invite || !isActiveCampaignCreatorInviteStatus(invite.status)) {
    return null;
  }

  return creatorProfileMatchesInvite({
    creatorAccountProfile,
    invite: invite as {
      contact_type: "email" | "handle";
      normalized_contact: string;
    },
    userEmail,
  })
    ? invite
    : null;
}

async function updateCampaignCreatorInviteResponse(inviteId: string) {
  const now = new Date().toISOString();
  const admin = createAdminClient();
  const { error } = await admin
    .from("campaign_creator_invites")
    .update({
      status: "sent",
      updated_at: now,
    })
    .eq("id", inviteId);

  if (error) throw new Error(error.message);
}

export async function getCreatorCampaignInviteContext(input: {
  campaign_id: string;
  invite_id?: string;
}) {
  const parsed = creatorCampaignInviteContextSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  if (!parsed.data.invite_id) {
    return { valid: false, inviteId: null };
  }

  const user = await getUser();
  const supabase = await createClient();

  const [{ data: profile }, { data: creatorAccountProfile }] = await Promise.all([
    supabase.from("profiles").select("role").eq("id", user.id).single(),
    supabase
      .from("creator_profiles")
      .select("tiktok, instagram, snapchat, youtube, facebook")
      .eq("profile_id", user.id)
      .maybeSingle(),
  ]);

  if (profile?.role !== "creator") {
    return { valid: false, inviteId: null };
  }

  const matchedSourceInvite = await getMatchedSourceInvite({
    campaignId: parsed.data.campaign_id,
    creatorAccountProfile,
    inviteId: parsed.data.invite_id,
    userEmail: user.email,
  });

  return {
    valid: Boolean(matchedSourceInvite?.id),
    inviteId: matchedSourceInvite?.id ?? null,
  };
}

export async function submitApplication(input: {
  campaign_id: string;
  invite_id?: string;
  proposed_rate: number;
  pitch: string;
}) {
  const parsed = submitApplicationSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const user = await getUser();
  const supabase = await createClient();

  const { data: campaign } = await supabase
    .from("campaigns")
    .select(
      "id, brand_id, title, status, application_deadline, service_fee_cents, service_fee_status, recruitment_visibility",
    )
    .eq("id", parsed.data.campaign_id)
    .single();

  assertCampaignAllowsApplicationSubmission(campaign);

  const [
    { data: profile },
    { data: creatorAccountProfile },
    { data: reportingRequirements },
  ] = await Promise.all([
    supabase.from("profiles").select("role, full_name").eq("id", user.id).single(),
    supabase
      .from("creator_profiles")
      .select("platforms, tiktok, instagram, snapchat, youtube, facebook")
      .eq("profile_id", user.id)
      .maybeSingle(),
    supabase
      .from("campaign_reporting_requirements")
      .select(
        "platform, platform_label, content_format, account_requirement, evidence_types, required_metric_keys",
      )
      .eq("campaign_id", parsed.data.campaign_id)
      .order("sort_order", { ascending: true }),
  ]);

  if (profile?.role !== "creator") {
    throw new Error("Only creators can apply to campaigns.");
  }

  const reportingEligibility = getCreatorReportingEligibility({
    creatorPlatforms: getCreatorDeclaredPlatforms(creatorAccountProfile),
    requirements: (reportingRequirements ?? []).map((requirement) => ({
      platform: requirement.platform as ReportingPlatform,
      platformLabel: requirement.platform_label,
      contentFormat: requirement.content_format,
      accountRequirement:
        requirement.account_requirement as ReportingAccountRequirement,
      evidenceTypes: requirement.evidence_types as ReportingEvidenceType[],
      requiredMetricKeys: requirement.required_metric_keys,
    })) satisfies EligibilityRequirement[],
  });

  if (reportingEligibility.status === "not_eligible") {
    const missingPlatform = reportingEligibility.missingPlatforms[0];
    throw new Error(
      missingPlatformApplicationMessage.replace(
        "{platform}",
        getReportingPlatformLabel(missingPlatform),
      ),
    );
  }

  const matchedSourceInvite = await getMatchedSourceInvite({
    campaignId: parsed.data.campaign_id,
    creatorAccountProfile,
    inviteId: parsed.data.invite_id,
    userEmail: user.email,
  });

  if (requiresVerifiedInviteForApplication(campaign) && !matchedSourceInvite?.id) {
    throw new Error("This campaign is invite-only. Open the private invite link to apply.");
  }

  const { data, error } = await supabase
    .from("campaign_applications")
    .insert({
      campaign_id: parsed.data.campaign_id,
      creator_id: user.id,
      proposed_rate: parsed.data.proposed_rate,
      pitch: parsed.data.pitch,
      status: "pending",
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  if (matchedSourceInvite?.id) {
    await updateCampaignCreatorInviteResponse(matchedSourceInvite.id);
  }

  await createPrivilegedNotification({
    user_id: campaign.brand_id,
    type: "application_received",
    title: "New Application",
    body: `A creator applied to "${campaign.title}"`,
    data: {
      application_id: data.id,
      campaign_id: parsed.data.campaign_id,
      campaignId: parsed.data.campaign_id,
      campaignTitle: campaign.title,
      creatorName: profile.full_name ?? "A creator",
      proposedRate: parsed.data.proposed_rate,
      source_invite_id: matchedSourceInvite?.id ?? null,
      sourceInviteId: matchedSourceInvite?.id ?? null,
    },
  });

  revalidatePath(`/i/discover/${parsed.data.campaign_id}`);
  revalidatePath("/i/campaigns");
  return { id: data.id };
}

export async function acceptApplication(
  applicationId: string,
  acceptedRate: number
) {
  const user = await getUser();
  const supabase = await createClient();
  const workspace = await getBrandApplicationWorkspace(supabase, user.id);

  // Get application details
  const { data: app, error: appError } = await supabase
    .from("campaign_applications")
    .select(
      "campaign_id, creator_id, status, campaigns(brand_id, title, max_creators, status, application_deadline, service_fee_cents, service_fee_status, service_package_snapshot)",
    )
    .eq("id", applicationId)
    .single();

  if (appError || !app) throw new Error("Application not found");

  // Verify current user is the campaign brand
  const campaign = app.campaigns as unknown as {
    brand_id: string;
    title: string;
    max_creators: number | null;
    status: string;
    application_deadline: string | null;
    service_fee_cents: number | null;
    service_fee_status: string | null;
    service_package_snapshot: Record<string, unknown> | null;
  };
  if (campaign.brand_id !== workspace.brandId) throw new Error("Not authorized");
  if (!["pending", "counter_offer"].includes(app.status)) {
    throw new Error("This application can no longer be accepted.");
  }

  assertCampaignAllowsApplicationDecision(campaign);
  await assertCampaignHasCreatorCapacity(app.campaign_id, campaign);

  await updatePrivilegedCampaignApplicationStatus({
    applicationId,
    status: "accepted",
    expectedStatus: app.status,
  });

  try {
    const member = await upsertPrivilegedCampaignMember({
      campaign_id: app.campaign_id,
      creator_id: app.creator_id,
      accepted_rate: acceptedRate,
    });
    await createPrivilegedReportTasksForMember(member.id);
  } catch (error) {
    await updatePrivilegedCampaignApplicationStatus({
      applicationId,
      status: app.status,
      expectedStatus: "accepted",
    });
    throw error;
  }

  // Notify creator
  await createPrivilegedNotification({
    user_id: app.creator_id,
    type: "application_accepted",
    title: "Application Accepted!",
    body: `You've been accepted to "${campaign.title}"`,
    data: {
      acceptedRate,
      campaign_id: app.campaign_id,
      campaignId: app.campaign_id,
      campaignTitle: campaign.title,
    },
  });

  revalidatePath(`/b/campaigns/${app.campaign_id}`);
}

export async function acceptApplicationsBatch(input: {
  application_ids: string[];
}) {
  const parsed = acceptApplicationBatchSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const applicationIds = [...new Set(parsed.data.application_ids)];
  const user = await getUser();
  const supabase = await createClient();
  const workspace = await getBrandApplicationWorkspace(supabase, user.id);

  const { data, error } = await supabase
    .from("campaign_applications")
    .select(
      "id, campaign_id, creator_id, proposed_rate, counter_rate, status, campaigns(brand_id, title, max_creators, status, application_deadline, service_fee_cents, service_fee_status, service_package_snapshot)",
    )
    .in("id", applicationIds);

  if (error) throw new Error(error.message);

  const applications = data ?? [];
  if (applications.length !== applicationIds.length) {
    throw new Error("One or more applications could not be found.");
  }

  const campaignIds = new Set(applications.map((app) => app.campaign_id));
  const brandIds = new Set(
    applications.map((app) => {
      const campaign = app.campaigns as unknown as {
        brand_id: string;
      } | null;
      return campaign?.brand_id;
    }),
  );

  if (campaignIds.size !== 1 || brandIds.size !== 1) {
    throw new Error("Select applications from one campaign.");
  }

  const campaign = applications[0]?.campaigns as unknown as {
    brand_id: string;
    title: string;
    max_creators: number | null;
    status: string;
    application_deadline: string | null;
    service_fee_cents: number | null;
    service_fee_status: string | null;
    service_package_snapshot: Record<string, unknown> | null;
  } | null;

  if (!campaign || campaign.brand_id !== workspace.brandId) {
    throw new Error("Not authorized");
  }

  if (
    applications.some(
      (app) => !["pending", "counter_offer"].includes(app.status),
    )
  ) {
    throw new Error("Only pending applications can be accepted.");
  }

  assertCampaignAllowsApplicationDecision(campaign);

  const admin = createAdminClient();
  const campaignId = applications[0].campaign_id;
  const [
    { count, error: countError },
    { data: paymentEvents, error: paymentEventsError },
  ] = await Promise.all([
    admin
      .from("campaign_members")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", campaignId),
    admin
      .from("campaign_payment_events")
      .select("amount_cents, checkout_session_id, service_fee_status, event_summary")
      .eq("campaign_id", campaignId),
  ]);

  if (countError) throw new Error(countError.message);
  if (paymentEventsError) throw new Error(paymentEventsError.message);

  assertCampaignCreatorBatchCapacity({
    maxCreators: getCampaignPaidCreatorCapacity({
      maxCreators: campaign.max_creators,
      paymentEvents: paymentEvents ?? [],
      serviceFeeCents: campaign.service_fee_cents,
      serviceFeeStatus: campaign.service_fee_status,
      servicePackageSnapshot: campaign.service_package_snapshot,
    }),
    acceptedCreatorCount: count ?? 0,
    requestedCreatorCount: applications.length,
  });

  for (const app of applications) {
    const acceptedRate =
      app.status === "counter_offer" && app.counter_rate != null
        ? app.counter_rate
        : app.proposed_rate || 0;

    await updatePrivilegedCampaignApplicationStatus({
      applicationId: app.id,
      status: "accepted",
      expectedStatus: app.status,
    });

    try {
      const member = await upsertPrivilegedCampaignMember({
        campaign_id: app.campaign_id,
        creator_id: app.creator_id,
        accepted_rate: acceptedRate,
      });
      await createPrivilegedReportTasksForMember(member.id);
    } catch (error) {
      await updatePrivilegedCampaignApplicationStatus({
        applicationId: app.id,
        status: app.status,
        expectedStatus: "accepted",
      });
      throw error;
    }

    await createPrivilegedNotification({
      user_id: app.creator_id,
      type: "application_accepted",
      title: "Application Accepted!",
      body: `You've been accepted to "${campaign.title}"`,
      data: {
        acceptedRate,
        campaign_id: app.campaign_id,
        campaignId: app.campaign_id,
        campaignTitle: campaign.title,
      },
    });
  }

  revalidatePath(`/b/campaigns/${campaignId}`);

  return { acceptedCount: applications.length, campaignId };
}

export async function rejectApplicationsBatch(input: {
  application_ids: string[];
}) {
  const parsed = acceptApplicationBatchSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const applicationIds = [...new Set(parsed.data.application_ids)];
  const user = await getUser();
  const supabase = await createClient();
  const workspace = await getBrandApplicationWorkspace(supabase, user.id);

  const { data, error } = await supabase
    .from("campaign_applications")
    .select(
      "id, campaign_id, creator_id, status, campaigns(brand_id, title, status, application_deadline)",
    )
    .in("id", applicationIds);

  if (error) throw new Error(error.message);

  const applications = data ?? [];
  if (applications.length !== applicationIds.length) {
    throw new Error("One or more applications could not be found.");
  }

  const campaignIds = new Set(applications.map((app) => app.campaign_id));
  const brandIds = new Set(
    applications.map((app) => {
      const campaign = app.campaigns as unknown as {
        brand_id: string;
      } | null;
      return campaign?.brand_id;
    }),
  );

  if (campaignIds.size !== 1 || brandIds.size !== 1) {
    throw new Error("Select applications from one campaign.");
  }

  const campaign = applications[0]?.campaigns as unknown as {
    brand_id: string;
    title: string;
    status: string;
    application_deadline: string | null;
  } | null;

  if (!campaign || campaign.brand_id !== workspace.brandId) {
    throw new Error("Not authorized");
  }

  if (
    applications.some(
      (app) => !["pending", "counter_offer"].includes(app.status),
    )
  ) {
    throw new Error("Only pending applications can be declined.");
  }

  assertCampaignAllowsApplicationDecision(campaign);

  for (const app of applications) {
    await updatePrivilegedCampaignApplicationStatus({
      applicationId: app.id,
      status: "rejected",
      expectedStatus: app.status,
    });

    await createPrivilegedNotification({
      user_id: app.creator_id,
      type: "application_rejected",
      title: "Application Update",
      body: `Update on your application to "${campaign.title}"`,
      data: {
        campaign_id: app.campaign_id,
        campaignId: app.campaign_id,
        campaignTitle: campaign.title,
      },
    });
  }

  const campaignId = applications[0].campaign_id;
  revalidatePath(`/b/campaigns/${campaignId}`);

  return { rejectedCount: applications.length, campaignId };
}

export async function updateCampaignMemberPaymentStatus(input: {
  memberId: string;
  status: PaymentStatusType;
}) {
  const parsed = memberPaymentStatusSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const user = await getUser();
  const supabase = await createClient();
  const workspace = await getBrandApplicationWorkspace(supabase, user.id);

  const { data: member, error: memberError } = await supabase
    .from("campaign_members")
    .select(
      `id, campaign_id, creator_id, accepted_rate, payment_status,
       campaigns(brand_id, title),
       profiles!campaign_members_creator_id_fkey(full_name)`,
    )
    .eq("id", parsed.data.memberId)
    .single();

  if (memberError || !member) throw new Error("Campaign member not found");

  const campaign = member.campaigns as unknown as {
    brand_id: string;
    title: string;
  } | null;
  if (!campaign || campaign.brand_id !== workspace.brandId) {
    throw new Error("Not authorized");
  }

  if (member.payment_status === parsed.data.status) {
    return { ok: true, status: parsed.data.status, changed: false };
  }

  const { error } = await supabase
    .from("campaign_members")
    .update({ payment_status: parsed.data.status })
    .eq("id", member.id);

  if (error) throw new Error(error.message);

  const creatorProfile = member.profiles as unknown as { full_name: string | null } | null;
  const admin = createAdminClient();
  const { error: auditError } = await admin.from("admin_audit_log").insert({
    admin_id: user.id,
    action: "creator_payment_status_updated",
    target_type: "campaign_member",
    target_id: member.id,
    metadata: {
      campaign_id: member.campaign_id,
      campaign_title: campaign.title,
      creator_id: member.creator_id,
      creator_name: creatorProfile?.full_name ?? null,
      previous_status: member.payment_status,
      new_status: parsed.data.status,
    },
  });

  if (auditError) {
    await supabase
      .from("campaign_members")
      .update({ payment_status: member.payment_status })
      .eq("id", member.id);
    throw new Error(auditError.message);
  }

  const paymentNotification = buildCreatorPaymentStatusNotification({
    status: parsed.data.status,
    member,
    campaign,
  });

  if (paymentNotification) {
    await createPrivilegedNotification(paymentNotification);
  }

  revalidatePath(`/b/campaigns/${member.campaign_id}`);
  revalidatePath(`/i/campaigns/${member.campaign_id}`);
  revalidatePath("/i/earnings");

  return { ok: true, status: parsed.data.status, changed: true };
}

export async function updateCampaignMemberPaymentStatuses(input: {
  member_ids: string[];
  status: PaymentStatusType;
}) {
  const parsed = memberPaymentStatusBatchSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const memberIds = [...new Set(parsed.data.member_ids)];
  const user = await getUser();
  const supabase = await createClient();
  const workspace = await getBrandApplicationWorkspace(supabase, user.id);

  const { data: members, error: membersError } = await supabase
    .from("campaign_members")
    .select(
      `id, campaign_id, creator_id, accepted_rate, payment_status,
       campaigns(brand_id, title),
       profiles!campaign_members_creator_id_fkey(full_name)`,
    )
    .in("id", memberIds);

  if (membersError) throw new Error(membersError.message);
  if (!members || members.length !== memberIds.length) {
    throw new Error("Campaign members not found");
  }

  const campaigns = members.map((member) => {
    const campaign = Array.isArray(member.campaigns)
      ? member.campaigns[0]
      : member.campaigns;
    if (!campaign) throw new Error("Campaign not found");
    return campaign as { brand_id: string; title: string };
  });
  const campaignIds = new Set(members.map((member) => member.campaign_id));
  const brandIds = new Set(campaigns.map((campaign) => campaign.brand_id));

  if (campaignIds.size !== 1 || brandIds.size !== 1) {
    throw new Error("Select creators from one campaign");
  }
  if (campaigns[0].brand_id !== workspace.brandId) {
    throw new Error("Not authorized");
  }

  const changedMembers = members.filter(
    (member) => member.payment_status !== parsed.data.status,
  );
  const admin = createAdminClient();
  const campaignId = members[0].campaign_id;
  const campaign = campaigns[0];

  for (const member of changedMembers) {
    const { error: updateError } = await supabase
      .from("campaign_members")
      .update({ payment_status: parsed.data.status })
      .eq("id", member.id);

    if (updateError) throw new Error(updateError.message);

    const creatorProfile = member.profiles as unknown as {
      full_name: string | null;
    } | null;
    const { error: auditError } = await admin.from("admin_audit_log").insert({
      admin_id: user.id,
      action: "creator_payment_status_updated",
      target_type: "campaign_member",
      target_id: member.id,
      metadata: {
        campaign_id: member.campaign_id,
        campaign_title: campaign.title,
        creator_id: member.creator_id,
        creator_name: creatorProfile?.full_name ?? null,
        previous_status: member.payment_status,
        new_status: parsed.data.status,
      },
    });

    if (auditError) {
      await supabase
        .from("campaign_members")
        .update({ payment_status: member.payment_status })
        .eq("id", member.id);
      throw new Error(auditError.message);
    }

    const paymentNotification = buildCreatorPaymentStatusNotification({
      status: parsed.data.status,
      member,
      campaign,
    });

    if (paymentNotification) {
      await createPrivilegedNotification(paymentNotification);
    }
  }

  revalidatePath(`/b/campaigns/${campaignId}`);
  revalidatePath(`/i/campaigns/${campaignId}`);
  revalidatePath("/i/earnings");

  return {
    ok: true,
    status: parsed.data.status,
    updatedCount: changedMembers.length,
    skippedCount: members.length - changedMembers.length,
    campaignId,
  };
}

export async function rejectApplication(applicationId: string) {
  const user = await getUser();
  const supabase = await createClient();
  const workspace = await getBrandApplicationWorkspace(supabase, user.id);

  const { data: app } = await supabase
    .from("campaign_applications")
    .select(
      "campaign_id, creator_id, status, campaigns(brand_id, title, status, application_deadline)",
    )
    .eq("id", applicationId)
    .single();

  if (!app) throw new Error("Application not found");

  const campaign = app.campaigns as unknown as {
    brand_id: string;
    title: string;
    status: string;
    application_deadline: string | null;
  };
  if (campaign.brand_id !== workspace.brandId) throw new Error("Not authorized");
  if (!["pending", "counter_offer"].includes(app.status)) {
    throw new Error("This application can no longer be rejected.");
  }

  assertCampaignAllowsApplicationDecision(campaign);

  await updatePrivilegedCampaignApplicationStatus({
    applicationId,
    status: "rejected",
    expectedStatus: app.status,
  });

  await createPrivilegedNotification({
    user_id: app.creator_id,
    type: "application_rejected",
    title: "Application Update",
    body: `Update on your application to "${campaign.title}"`,
    data: {
      campaign_id: app.campaign_id,
      campaignId: app.campaign_id,
      campaignTitle: campaign.title,
    },
  });

  revalidatePath(`/b/campaigns/${app.campaign_id}`);
}

export async function counterOffer(input: {
  application_id: string;
  counter_rate: number;
  counter_message?: string;
}) {
  const parsed = counterOfferSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const user = await getUser();
  const supabase = await createClient();
  const workspace = await getBrandApplicationWorkspace(supabase, user.id);

  const { data: app } = await supabase
    .from("campaign_applications")
    .select(
      "campaign_id, creator_id, status, campaigns(brand_id, title, status, application_deadline)",
    )
    .eq("id", input.application_id)
    .single();

  if (!app) throw new Error("Application not found");

  const campaign = app.campaigns as unknown as {
    brand_id: string;
    title: string;
    status: string;
    application_deadline: string | null;
  };
  if (campaign.brand_id !== workspace.brandId) throw new Error("Not authorized");
  if (app.status !== "pending") {
    throw new Error("A counter-offer can only be sent for pending applications.");
  }

  assertCampaignAllowsApplicationDecision(campaign);

  await updatePrivilegedCampaignApplicationStatus({
    applicationId: input.application_id,
    status: "counter_offer",
    expectedStatus: "pending",
    values: {
      counter_rate: input.counter_rate,
      counter_message: input.counter_message ?? null,
    },
  });

  await createPrivilegedNotification({
    user_id: app.creator_id,
    type: "counter_offer",
    title: "Counter Offer Received",
    body: `A brand proposed $${input.counter_rate} for "${campaign.title}"`,
    data: {
      campaign_id: app.campaign_id,
      campaignId: app.campaign_id,
      campaignTitle: campaign.title,
      application_id: input.application_id,
      counter_rate: input.counter_rate,
      counterRate: input.counter_rate,
      message: input.counter_message,
    },
  });

  revalidatePath(`/b/campaigns/${app.campaign_id}`);
}

export async function respondToCounterOffer(
  applicationId: string,
  accept: boolean
) {
  const user = await getUser();
  const supabase = await createClient();

  const { data: app } = await supabase
    .from("campaign_applications")
    .select(
      "campaign_id, creator_id, counter_rate, status, campaigns(brand_id, title, max_creators, status, application_deadline, service_fee_cents, service_fee_status, service_package_snapshot)",
    )
    .eq("id", applicationId)
    .single();

  if (!app || app.creator_id !== user.id) throw new Error("Not authorized");
  if (app.status !== "counter_offer") {
    throw new Error("There is no counter-offer to respond to.");
  }

  const campaign = app.campaigns as unknown as {
    brand_id: string;
    title: string;
    max_creators: number | null;
    status: string;
    application_deadline: string | null;
    service_fee_cents: number | null;
    service_fee_status: string | null;
    service_package_snapshot: Record<string, unknown> | null;
  };
  assertCampaignAllowsApplicationDecision(campaign);

  if (accept) {
    if (app.counter_rate == null) {
      throw new Error("This counter-offer is missing a proposed rate.");
    }

    await assertCampaignHasCreatorCapacity(app.campaign_id, campaign);

    await updatePrivilegedCampaignApplicationStatus({
      applicationId,
      status: "accepted",
      expectedStatus: "counter_offer",
    });

    try {
      const member = await upsertPrivilegedCampaignMember({
        campaign_id: app.campaign_id,
        creator_id: user.id,
        accepted_rate: app.counter_rate,
      });
      await createPrivilegedReportTasksForMember(member.id);
    } catch (error) {
      await updatePrivilegedCampaignApplicationStatus({
        applicationId,
        status: "counter_offer",
        expectedStatus: "accepted",
      });
      throw error;
    }

    await createPrivilegedNotification({
      user_id: campaign.brand_id,
      type: "campaign_match",
      title: "Counter Offer Accepted",
      body: `Creator accepted your offer for "${campaign.title}"`,
      data: {
        campaign_id: app.campaign_id,
        campaignId: app.campaign_id,
        campaignTitle: campaign.title,
        application_id: applicationId,
      },
    });
  } else {
    await updatePrivilegedCampaignApplicationStatus({
      applicationId,
      status: "rejected",
      expectedStatus: "counter_offer",
    });
  }

  revalidatePath(`/i/discover/${app.campaign_id}`);
  revalidatePath("/i/campaigns");
}

export async function withdrawApplication(applicationId: string) {
  const user = await getUser();
  const supabase = await createClient();

  const { data: app } = await supabase
    .from("campaign_applications")
    .select("campaign_id, creator_id, status, campaigns(status, application_deadline)")
    .eq("id", applicationId)
    .single();

  if (!app || app.creator_id !== user.id) throw new Error("Not authorized");
  if (!["pending", "counter_offer"].includes(app.status)) {
    throw new Error("Application cannot be withdrawn.");
  }

  const campaign = Array.isArray(app.campaigns) ? app.campaigns[0] : app.campaigns;
  assertCampaignAllowsApplicationDecision(campaign);

  const { error } = await supabase
    .from("campaign_applications")
    .update({ status: "withdrawn" })
    .eq("id", applicationId)
    .eq("creator_id", user.id)
    .eq("status", app.status)
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath(`/i/discover/${app.campaign_id}`);
  revalidatePath("/i/campaigns");
}
