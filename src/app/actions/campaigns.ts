"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  assertBrandWorkspacePermission,
} from "@/lib/brand-workspace";
import { dispatchNotificationEmailByQueueId } from "@/lib/email/notification-queue";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createPrivilegedNotifications } from "@/lib/supabase/privileged";
import { getUser } from "./auth";
import { CONTENT_FORMATS } from "@/lib/constants";
import {
  PRIVATE_CAMPAIGN_MAX_SELF_SERVE_CREATORS,
  getCampaignPaidCreatorCapacity,
  getCampaignServiceEstimate,
  getCampaignServiceFeeBalance,
  getCampaignServiceInsertFields,
  getCampaignServicePricingDays,
} from "@/lib/campaign-service-packages";
import { getAppBaseUrl } from "@/lib/app-url";
import {
  buildDefaultCampaignReportingRequirements,
  validateRequirementMetricKeys,
} from "@/lib/reporting/requirements";
import {
  normalizeReportCompositionSelection,
  type ReportBuilderBlockId,
  type ReportBuilderChartModeId,
  type ReportBuilderPresetSelectionId,
} from "@/lib/reporting/report-builder";
import { getCampaignReportingPlanWindow } from "@/lib/reporting/plan-window";
import {
  assertCampaignCloseoutReadiness,
  getCampaignCloseoutReadiness,
} from "@/lib/campaigns/campaign-closeout";
import {
  assertCampaignAllowsAnnouncement,
  assertCampaignAllowsApplicationDeadlineUpdate,
  assertCampaignAllowsCreatorInviteManagement,
  assertCampaignAllowsCreatorInviteSending,
  assertCampaignAllowsPaidScopeUpdate,
  assertCampaignAllowsReportingRequirementUpdate,
  assertCampaignAllowsWorkStart,
  isCampaignApplicationDeadlinePassed,
} from "@/lib/campaigns/lifecycle";
import { parseCreatorInviteImport } from "@/lib/campaigns/creator-invite-import";
import {
  createCampaignSchema,
  campaignReportingRequirementSchema,
  enterpriseConciergeRequestSchema,
  type CreateCampaignInput,
  type EnterpriseConciergeRequestInput,
} from "@/lib/validations";
import type { CampaignResponsibilityKind } from "@/types/database";

type CampaignServiceFeeObligation = {
  service_fee_cents: number | null;
  service_fee_currency: string | null;
  service_fee_status: string | null;
  service_package_snapshot: Record<string, unknown> | null;
};

type CampaignServiceFeeReady = {
  service_fee_cents: number;
  service_fee_currency: "usd";
  service_fee_status: string;
  service_package_snapshot: Record<string, unknown>;
};

type CampaignLaunchCandidate = CampaignServiceFeeObligation & {
  status: string;
  brief_description: string | null;
};

type CampaignLaunchReadiness = {
  hasCreatorImage: boolean;
  hasDeliverables: boolean;
  hasReportingRequirements: boolean;
  rulesReady: boolean;
};

type CampaignReportGoalSnapshot = {
  templateId: string | null;
  presetId: ReportBuilderPresetSelectionId;
  chartModeId: ReportBuilderChartModeId;
  blockIds: ReportBuilderBlockId[];
};

const REPORTING_REQUIREMENT_UPDATE_LOCK_MESSAGE =
  "Only draft or recruiting campaigns can change proof fields.";

const uuidLike = z.string().regex(
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
  "Invalid campaign ID",
);

const launchSetupPlatformSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "Platform is required")
  .max(50, "Platform must be 50 characters or less")
  .regex(
    /^[a-z0-9]+(?:[-_][a-z0-9]+)*$/,
    "Use lowercase letters, numbers, hyphens, or underscores",
  );

const campaignLaunchSetupSchema = z
  .object({
    campaignId: uuidLike,
    briefDescription: z.string().trim().min(10).max(5000).optional(),
    deliverable: z
      .object({
        platform: launchSetupPlatformSchema,
        contentType: z.enum(CONTENT_FORMATS),
        quantity: z.coerce.number().int().min(1).max(100),
      })
      .optional(),
    syncReportingRequirements: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.briefDescription !== undefined ||
      value.deliverable !== undefined ||
      value.syncReportingRequirements === true,
    { message: "Choose one launch setup fix." },
  );

const campaignServiceFeeCheckoutSchema = z.object({
  campaignId: uuidLike,
});

const campaignCreatorCapacityUpdateSchema = z.object({
  campaignId: uuidLike,
  maxCreators: z.coerce
    .number()
    .int()
    .min(1)
    .max(PRIVATE_CAMPAIGN_MAX_SELF_SERVE_CREATORS),
  activeDays: z.coerce.number().int().min(1).max(365).optional(),
  reportingDays: z.coerce.number().int().min(0).max(180).optional(),
});

const campaignCreatorInviteImportSchema = z.object({
  campaignId: uuidLike,
  rawContacts: z.string().trim().min(1).max(12_000),
});

const campaignCreatorInviteMutationSchema = z.object({
  campaignId: uuidLike,
  inviteId: uuidLike,
});

const campaignReportingRequirementUpdateSchema =
  campaignReportingRequirementSchema.extend({
    campaignId: uuidLike,
    requirementId: uuidLike,
  });

const campaignResponsibilityUpdateSchema = z.object({
  campaignId: uuidLike,
  responsibility: z.enum(["owner", "approvals", "reporting", "billing"]),
  brandTeamMemberId: z.string().uuid().nullable(),
});

type CampaignResponsibilityAuditInput = {
  actorId: string;
  campaignId: string;
  brandId: string;
  actorRole: string;
  responsibility: CampaignResponsibilityKind;
  previousBrandTeamMemberId: string | null;
  nextBrandTeamMemberId: string | null;
};

async function insertCampaignResponsibilityAuditLog(
  input: CampaignResponsibilityAuditInput,
) {
  const admin = createAdminClient();
  const { error } = await admin.from("admin_audit_log").insert({
    admin_id: input.actorId,
    action: "campaign_responsibility_updated",
    target_type: "campaign",
    target_id: input.campaignId,
    metadata: {
      brand_id: input.brandId,
      actor_role: input.actorRole,
      responsibility: input.responsibility,
      previous_brand_team_member_id: input.previousBrandTeamMemberId,
      next_brand_team_member_id: input.nextBrandTeamMemberId,
    },
  });

  if (error) throw new Error(error.message);
}

function assertCampaignHasServiceFeeObligation(
  campaign: CampaignServiceFeeObligation | null,
): asserts campaign is CampaignServiceFeeReady {
  const snapshot = campaign?.service_package_snapshot;
  const snapshotFeeCents = snapshot?.feeCents;

  if (
    !campaign ||
    !Number.isFinite(campaign.service_fee_cents) ||
    Number(campaign.service_fee_cents) <= 0 ||
    campaign.service_fee_currency !== "usd" ||
    !campaign.service_fee_status ||
    !snapshot ||
    snapshot.mode !== "private" ||
    snapshot.requiresCustomPricing === true ||
    snapshotFeeCents !== campaign.service_fee_cents
  ) {
    throw new Error("Campaign service fee is missing. Save a fresh draft before publishing.");
  }
}

function assertCampaignServiceFeePaid(campaign: CampaignServiceFeeReady) {
  if (campaign.service_fee_status !== "paid") {
    throw new Error("Pay the PopsDrops fee before launching this campaign.");
  }
}

function assertDevOnlyServiceFeeSmoke() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Dev payment completion is disabled in production.");
  }
}

function shouldDispatchCampaignInviteEmail() {
  if (process.env.POPSDROPS_SMOKE_QUEUE_ONLY === "1") return false;
  if (
    process.env.NODE_ENV !== "production" &&
    process.env.POPSDROPS_SEND_DEV_EMAILS !== "1"
  ) {
    return false;
  }

  return true;
}

function getCampaignSnapshotNumber(
  snapshot: Record<string, unknown> | null | undefined,
  key: string,
  fallback: number,
) {
  const value = snapshot?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeDateKey(value: string | null | undefined): string | null {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null;
}

function addUtcDaysDateKey(value: string | null | undefined, days: number) {
  const dateKey = normalizeDateKey(value);
  if (!dateKey) return null;

  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function normalizeApplicationDeadlineForStorage(
  value: string | null | undefined,
) {
  const dateKey = normalizeDateKey(value);
  if (!dateKey) return value ?? null;
  return `${dateKey}T23:59:59.999Z`;
}

function assertApplicationDeadlineBeforeContentDueDate(
  applicationDeadline: string,
  contentDueDate: string | null | undefined,
) {
  const contentDueDateKey = normalizeDateKey(contentDueDate);
  if (contentDueDateKey && applicationDeadline > contentDueDateKey) {
    throw new Error("Applications must close on or before the content due date.");
  }
}

async function getCampaignInviteShareReadiness(
  supabase: Awaited<ReturnType<typeof createClient>>,
  campaignId: string,
  brandId: string,
) {
  const [
    { data: campaign, error: campaignError },
    { data: creatorImages, error: imageError },
    { data: deliverables, error: deliverableError },
    { data: reportingRequirements, error: reportingError },
    { data: agreements, error: agreementError },
  ] = await Promise.all([
    supabase
      .from("campaigns")
      .select(
        "id, title, status, brand_id, max_creators, application_deadline, service_fee_cents, service_fee_status, service_package_snapshot",
      )
      .eq("id", campaignId)
      .eq("brand_id", brandId)
      .single(),
    supabase
      .from("campaign_assets")
      .select("id")
      .eq("campaign_id", campaignId)
      .eq("visibility", "public")
      .eq("status", "ready")
      .like("mime_type", "image/%")
      .limit(1),
    supabase
      .from("campaign_deliverables")
      .select("id")
      .eq("campaign_id", campaignId)
      .gt("quantity", 0)
      .limit(1),
    supabase
      .from("campaign_reporting_requirements")
      .select("id")
      .eq("campaign_id", campaignId)
      .limit(1),
    supabase
      .from("campaign_agreements")
      .select("status")
      .eq("campaign_id", campaignId)
      .order("version", { ascending: false })
      .limit(1),
  ]);

  const dataError =
    campaignError ??
    imageError ??
    deliverableError ??
    reportingError ??
    agreementError;
  if (dataError) throw new Error(dataError.message);
  if (!campaign) throw new Error("Campaign not found");

  const latestAgreement = agreements?.[0] ?? null;
  const canSendCreatorInvites =
    campaign.status === "recruiting" &&
    !isCampaignApplicationDeadlinePassed(campaign.application_deadline) &&
    campaign.service_fee_status === "paid" &&
    (creatorImages ?? []).length > 0 &&
    (deliverables ?? []).length > 0 &&
    (reportingRequirements ?? []).length > 0 &&
    (!latestAgreement ||
      latestAgreement.status === "published" ||
      latestAgreement.status === "archived");
  const canShareInviteLink = canSendCreatorInvites;

  return { campaign, canShareInviteLink, canSendCreatorInvites };
}

async function queueCampaignCreatorInviteEmail({
  admin,
  campaignId,
  campaignTitle,
  email,
  inviteId,
}: {
  admin: ReturnType<typeof createAdminClient>;
  campaignId: string;
  campaignTitle: string;
  email: string;
  inviteId: string;
}) {
  const inviteUrl = `${getAppBaseUrl()}/apply/${campaignId}?invite=${inviteId}`;
  const emailData = {
    recipientName: "Creator",
    recipient_name: "Creator",
    title: "Campaign invite",
    campaignTitle,
    campaign_title: campaignTitle,
    campaignId,
    campaign_id: campaignId,
    inviteId,
    invite_id: inviteId,
    body: `You were invited to review ${campaignTitle} on PopsDrops.`,
    actionUrl: inviteUrl,
    action_url: inviteUrl,
    data: {
      campaign_title: campaignTitle,
      campaign_id: campaignId,
      invite_id: inviteId,
      action_url: inviteUrl,
      invite_url: inviteUrl,
    },
  };

  const { data: queueItem, error: queueError } = await admin
    .from("notification_queue")
    .insert({
      email,
      template: "campaign_update",
      priority: "immediate",
      data: emailData,
    })
    .select("id")
    .single();

  if (queueError) throw new Error(queueError.message);

  if (queueItem?.id && shouldDispatchCampaignInviteEmail()) {
    try {
      await dispatchNotificationEmailByQueueId(queueItem.id, admin);
    } catch (dispatchError) {
      console.error("Failed to dispatch campaign invite email:", dispatchError);
    }
  }

  return queueItem;
}

function assertCampaignLaunchReadiness(
  campaign: CampaignLaunchCandidate,
  readiness: CampaignLaunchReadiness,
) {
  if (campaign.status !== "draft") {
    throw new Error("Campaign must be a draft before launching.");
  }

  if (!campaign.brief_description?.trim()) {
    throw new Error("Launch campaign needs a creator-facing brief.");
  }

  if (!readiness.hasCreatorImage) {
    throw new Error("Launch campaign is missing a creator-facing campaign image.");
  }

  if (!readiness.hasDeliverables) {
    throw new Error("Launch campaign needs at least one deliverable.");
  }

  if (!readiness.hasReportingRequirements) {
    throw new Error("Launch campaign needs at least one proof requirement.");
  }

  if (!readiness.rulesReady) {
    throw new Error("Publish campaign rules before launching, or remove the signing gate.");
  }
}

async function translateBrief(campaignId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke("translate-brief", {
    body: { campaignId },
  });

  if (error) throw new Error(error.message);
  return data;
}

async function loadReportCompositionTemplateForCampaign({
  brandId,
  supabase,
  templateId,
}: {
  brandId: string;
  supabase: Awaited<ReturnType<typeof createClient>>;
  templateId: string;
}): Promise<CampaignReportGoalSnapshot> {
  const { data, error } = await supabase
    .from("report_composition_templates")
    .select("id, preset_id, chart_mode_id, block_ids")
    .eq("brand_id", brandId)
    .eq("id", templateId)
    .single();

  if (error || !data) {
    throw new Error("Report template is not available for this brand workspace.");
  }

  const selection = normalizeReportCompositionSelection({
    presetId: data.preset_id,
    chartModeId: data.chart_mode_id,
    blockIds: data.block_ids,
  });

  return {
    templateId: data.id,
    ...selection,
  };
}

async function resolveCampaignReportGoal({
  brandId,
  input,
  supabase,
}: {
  brandId: string;
  input: Pick<
    CreateCampaignInput,
    | "report_template_id"
    | "report_preset_id"
    | "report_chart_mode_id"
    | "report_block_ids"
  >;
  supabase: Awaited<ReturnType<typeof createClient>>;
}): Promise<CampaignReportGoalSnapshot> {
  if (input.report_template_id) {
    return loadReportCompositionTemplateForCampaign({
      brandId,
      supabase,
      templateId: input.report_template_id,
    });
  }

  const selection = normalizeReportCompositionSelection({
    presetId: input.report_preset_id,
    chartModeId: input.report_chart_mode_id,
    blockIds: input.report_block_ids,
  });

  return {
    templateId: null,
    ...selection,
  };
}

export async function createCampaign(input: CreateCampaignInput) {
  const parsed = createCampaignSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const user = await getUser();
  const supabase = await createClient();
  const workspace = await assertBrandWorkspacePermission(
    supabase,
    user.id,
    "create_campaigns",
  );

  const {
    deliverables,
    campaign_mode,
    reporting_requirements,
    reporting_cadence,
    report_template_id,
    report_preset_id,
    report_chart_mode_id,
    report_block_ids,
    ...campaignData
  } = parsed.data;
  const reportGoal = await resolveCampaignReportGoal({
    brandId: workspace.brandId,
    input: {
      report_template_id,
      report_preset_id,
      report_chart_mode_id,
      report_block_ids,
    },
    supabase,
  });
  const serviceFields = getCampaignServiceInsertFields(campaign_mode, {
    maxCreators: campaignData.max_creators,
    marketCount: campaignData.markets.length,
    ...getCampaignServicePricingDays({
      postingWindowStart: campaignData.posting_window_start,
      postingWindowEnd: campaignData.posting_window_end,
      performanceDueDate: campaignData.performance_due_date,
    }),
  });
  const campaignDataForInsert = {
    ...campaignData,
    application_deadline: normalizeApplicationDeadlineForStorage(campaignData.application_deadline),
  };

  // Insert campaign
  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .insert({
      brand_id: workspace.brandId,
      ...campaignDataForInsert,
      ...serviceFields,
      status: "draft",
    })
    .select("id")
    .single();

  if (campaignError) throw new Error(campaignError.message);

  // Insert deliverables
  if (deliverables.length > 0) {
    const { error: delError } = await supabase
      .from("campaign_deliverables")
      .insert(
        deliverables.map((d) => ({
          campaign_id: campaign.id,
          platform: d.platform,
          content_type: d.content_type,
          quantity: d.quantity,
          notes: d.notes ?? null,
        }))
      );

    if (delError) throw new Error(delError.message);
  }

  const reportingRequirements =
    reporting_requirements?.length
      ? reporting_requirements
      : buildDefaultCampaignReportingRequirements(deliverables);

  if (reportingRequirements.length > 0) {
    const invalidRequirement = reportingRequirements.find((requirement) =>
      validateRequirementMetricKeys({
        platform: requirement.platform,
        platformLabel: requirement.platformLabel,
        requiredMetricKeys: requirement.requiredMetricKeys,
      }).length > 0,
    );

    if (invalidRequirement) {
      throw new Error("Reporting requirement contains unsupported metrics.");
    }

    const { error: requirementError } = await supabase
      .from("campaign_reporting_requirements")
      .insert(
        reportingRequirements.map((requirement, index) => ({
          campaign_id: campaign.id,
          platform: requirement.platform,
          platform_label: requirement.platformLabel,
          content_format: requirement.contentFormat,
          account_requirement: requirement.accountRequirement,
          evidence_types: requirement.evidenceTypes,
          required_metric_keys: requirement.requiredMetricKeys,
          ai_extraction_allowed: requirement.aiExtractionAllowed,
          creator_confirmation_required: requirement.creatorConfirmationRequired,
          sort_order:
            "sortOrder" in requirement && typeof requirement.sortOrder === "number"
              ? requirement.sortOrder
              : index,
        })),
      );

    if (requirementError) throw new Error(requirementError.message);
  }

  const resolvedReportingCadence = reporting_cadence ?? "final_only";
  const reportingPlanWindow = getCampaignReportingPlanWindow({
    cadence: resolvedReportingCadence,
    contentDueDate: campaignData.content_due_date,
    postingWindowStart: campaignData.posting_window_start,
    postingWindowEnd: campaignData.posting_window_end,
    performanceDueDate: campaignData.performance_due_date,
  });

  const { error: planError } = await supabase
    .from("campaign_reporting_plans")
    .upsert({
      campaign_id: campaign.id,
      cadence: resolvedReportingCadence,
      required_evidence: ["public_url", "manual_metrics", "screenshot"],
      required_metrics: {},
      report_template_id: reportGoal.templateId,
      report_preset_id: reportGoal.presetId,
      report_chart_mode_id: reportGoal.chartModeId,
      report_block_ids: reportGoal.blockIds,
      grace_period_hours: 24,
      starts_at: reportingPlanWindow.startsAt,
      ends_at: reportingPlanWindow.endsAt,
    });

  if (planError) throw new Error(planError.message);

  revalidatePath("/b/campaigns");
  return { id: campaign.id };
}

export async function requestEnterpriseConcierge(
  input: EnterpriseConciergeRequestInput,
) {
  const parsed = enterpriseConciergeRequestSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const user = await getUser();
  const supabase = await createClient();
  const workspace = await assertBrandWorkspacePermission(
    supabase,
    user.id,
    "create_campaigns",
  );

  const data = parsed.data;
  const serviceEstimate = getCampaignServiceEstimate(data.campaign_mode, {
    maxCreators: data.requested_creator_count,
    marketCount: data.market_count,
  });
  const requestReason =
    data.requestReason ?? serviceEstimate.customPricingReason ?? "sourcing";

  if (!serviceEstimate.requiresCustomPricing) {
    throw new Error("This campaign can use the private campaign workspace");
  }

  const { data: request, error } = await supabase
    .from("enterprise_concierge_requests")
    .insert({
      brand_id: workspace.brandId,
      campaign_title: data.campaign_title,
      campaign_mode: data.campaign_mode,
      requested_creator_count: data.requested_creator_count,
      market_count: data.market_count,
      markets: data.markets,
      platforms: data.platforms,
      creator_budget_cents: data.creator_budget_cents,
      product_value_cents: data.product_value_cents,
      fulfillment_budget_cents: data.fulfillment_budget_cents,
      service_estimate: {
        ...serviceEstimate,
        requestedCampaignMode: data.campaign_mode,
        requestedCreatorCount: data.requested_creator_count,
        marketCount: data.market_count,
        requestReason,
      },
      note: data.note ?? null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/b/campaigns/new");
  return { id: request.id };
}

export async function updateCampaignLaunchSetup(
  input: z.input<typeof campaignLaunchSetupSchema>,
) {
  const parsed = campaignLaunchSetupSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const user = await getUser();
  const supabase = await createClient();
  const workspace = await assertBrandWorkspacePermission(
    supabase,
    user.id,
    "manage_campaigns",
  );

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("id, status, title")
    .eq("id", parsed.data.campaignId)
    .eq("brand_id", workspace.brandId)
    .single();

  if (campaignError) throw new Error(campaignError.message);
  if (campaign.status !== "draft") {
    throw new Error("Only draft campaigns can change launch setup.");
  }

  if (parsed.data.briefDescription !== undefined) {
    const { error } = await supabase
      .from("campaigns")
      .update({ brief_description: parsed.data.briefDescription })
      .eq("id", parsed.data.campaignId)
      .eq("brand_id", workspace.brandId)
      .eq("status", "draft");

    if (error) throw new Error(error.message);
  }

  if (parsed.data.deliverable) {
    const { error } = await supabase.from("campaign_deliverables").insert({
      campaign_id: parsed.data.campaignId,
      platform: parsed.data.deliverable.platform,
      content_type: parsed.data.deliverable.contentType,
      quantity: parsed.data.deliverable.quantity,
      notes: null,
    });

    if (error) throw new Error(error.message);
  }

  if (parsed.data.syncReportingRequirements) {
    const { data: deliverables, error: deliverablesError } = await supabase
      .from("campaign_deliverables")
      .select("platform, content_type, quantity")
      .eq("campaign_id", parsed.data.campaignId);

    if (deliverablesError) throw new Error(deliverablesError.message);

    const defaultRequirements = buildDefaultCampaignReportingRequirements(
      deliverables ?? [],
    );

    if (defaultRequirements.length === 0) {
      throw new Error("Add a supported deliverable before adding proof.");
    }

    const { data: existingRequirements, error: existingError } = await supabase
      .from("campaign_reporting_requirements")
      .select("platform, content_format")
      .eq("campaign_id", parsed.data.campaignId);

    if (existingError) throw new Error(existingError.message);

    const existingKeys = new Set(
      (existingRequirements ?? []).map(
        (requirement) =>
          `${requirement.platform}:${requirement.content_format}`,
      ),
    );
    const requirementsToInsert = defaultRequirements.filter(
      (requirement) =>
        !existingKeys.has(`${requirement.platform}:${requirement.contentFormat}`),
    );

    const invalidRequirement = requirementsToInsert.find((requirement) =>
      validateRequirementMetricKeys({
        platform: requirement.platform,
        platformLabel: requirement.platformLabel,
        requiredMetricKeys: requirement.requiredMetricKeys,
      }).length > 0,
    );

    if (invalidRequirement) {
      throw new Error("Reporting requirement contains unsupported metrics.");
    }

    if (requirementsToInsert.length > 0) {
      const { error } = await supabase
        .from("campaign_reporting_requirements")
        .insert(
          requirementsToInsert.map((requirement, index) => ({
            campaign_id: parsed.data.campaignId,
            platform: requirement.platform,
            platform_label: requirement.platformLabel,
            content_format: requirement.contentFormat,
            account_requirement: requirement.accountRequirement,
            evidence_types: requirement.evidenceTypes,
            required_metric_keys: requirement.requiredMetricKeys,
            ai_extraction_allowed: requirement.aiExtractionAllowed,
            creator_confirmation_required: requirement.creatorConfirmationRequired,
            sort_order:
              "sortOrder" in requirement && typeof requirement.sortOrder === "number"
                ? requirement.sortOrder
                : index,
          })),
        );

      if (error) throw new Error(error.message);
    }
  }

  revalidatePath(`/b/campaigns/${parsed.data.campaignId}`);
  revalidatePath(`/apply/${parsed.data.campaignId}`);
  return { updated: true };
}

export async function updateCampaignReportingRequirement(
  input: z.input<typeof campaignReportingRequirementUpdateSchema>,
) {
  const parsed = campaignReportingRequirementUpdateSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const invalidMetricKeys = validateRequirementMetricKeys({
    platform: parsed.data.platform,
    platformLabel: parsed.data.platformLabel,
    requiredMetricKeys: parsed.data.requiredMetricKeys,
  });
  if (invalidMetricKeys.length > 0) {
    throw new Error("Reporting requirement contains unsupported metrics.");
  }

  const user = await getUser();
  const supabase = await createClient();
  const workspace = await assertBrandWorkspacePermission(
    supabase,
    user.id,
    "manage_campaigns",
  );

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("id, brand_id, status, application_deadline")
    .eq("id", parsed.data.campaignId)
    .eq("brand_id", workspace.brandId)
    .single();

  if (campaignError || !campaign) throw new Error("Campaign not found");
  try {
    assertCampaignAllowsReportingRequirementUpdate(campaign);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === REPORTING_REQUIREMENT_UPDATE_LOCK_MESSAGE
    ) {
      throw new Error(REPORTING_REQUIREMENT_UPDATE_LOCK_MESSAGE);
    }

    throw error;
  }

  const { data: requirement, error: requirementError } = await supabase
    .from("campaign_reporting_requirements")
    .select("id")
    .eq("id", parsed.data.requirementId)
    .eq("campaign_id", parsed.data.campaignId)
    .single();

  if (requirementError || !requirement) {
    throw new Error("Reporting requirement not found");
  }

  const { error: updateError } = await supabase
    .from("campaign_reporting_requirements")
    .update({
      platform: parsed.data.platform,
      platform_label: parsed.data.platformLabel,
      content_format: parsed.data.contentFormat,
      account_requirement: parsed.data.accountRequirement,
      evidence_types: parsed.data.evidenceTypes,
      required_metric_keys: parsed.data.requiredMetricKeys,
      ai_extraction_allowed: parsed.data.aiExtractionAllowed,
      creator_confirmation_required: parsed.data.creatorConfirmationRequired,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.requirementId)
    .eq("campaign_id", parsed.data.campaignId);

  if (updateError) throw new Error(updateError.message);

  revalidatePath(`/b/campaigns/${parsed.data.campaignId}`);
  revalidatePath(`/apply/${parsed.data.campaignId}`);
  revalidatePath(`/i/discover/${parsed.data.campaignId}`);
  revalidatePath(`/i/campaigns/${parsed.data.campaignId}`);
  return { updated: true };
}

export async function updateCampaignResponsibility(
  input: z.input<typeof campaignResponsibilityUpdateSchema>,
) {
  const parsed = campaignResponsibilityUpdateSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const user = await getUser();
  const supabase = await createClient();
  const workspace = await assertBrandWorkspacePermission(
    supabase,
    user.id,
    "manage_campaigns",
  );

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("id, brand_id")
    .eq("id", parsed.data.campaignId)
    .eq("brand_id", workspace.brandId)
    .single();

  if (campaignError || !campaign) throw new Error("Campaign not found");

  const { data: previousAssignment, error: previousError } = await supabase
    .from("campaign_responsibility_assignments")
    .select("id, brand_team_member_id")
    .eq("campaign_id", parsed.data.campaignId)
    .eq("responsibility", parsed.data.responsibility)
    .maybeSingle();

  if (previousError) throw new Error(previousError.message);

  if (parsed.data.brandTeamMemberId) {
    const { data: member, error: memberError } = await supabase
      .from("brand_team_members")
      .select("id")
      .eq("id", parsed.data.brandTeamMemberId)
      .eq("brand_id", workspace.brandId)
      .not("accepted_at", "is", null)
      .single();

    if (memberError || !member) {
      throw new Error("Choose an accepted teammate from this brand workspace.");
    }

    const { error: upsertError } = await supabase
      .from("campaign_responsibility_assignments")
      .upsert(
        {
          campaign_id: parsed.data.campaignId,
          responsibility: parsed.data.responsibility,
          brand_team_member_id: parsed.data.brandTeamMemberId,
          assigned_by: user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "campaign_id,responsibility" },
      );

    if (upsertError) throw new Error(upsertError.message);
  } else if (previousAssignment) {
    const { error: deleteError } = await supabase
      .from("campaign_responsibility_assignments")
      .delete()
      .eq("id", previousAssignment.id)
      .eq("campaign_id", parsed.data.campaignId);

    if (deleteError) throw new Error(deleteError.message);
  }

  await insertCampaignResponsibilityAuditLog({
    actorId: user.id,
    campaignId: parsed.data.campaignId,
    brandId: workspace.brandId,
    actorRole: workspace.role,
    responsibility: parsed.data.responsibility,
    previousBrandTeamMemberId:
      previousAssignment?.brand_team_member_id ?? null,
    nextBrandTeamMemberId: parsed.data.brandTeamMemberId,
  });

  revalidatePath(`/b/campaigns/${parsed.data.campaignId}`);
  revalidatePath("/b/campaigns");

  return { updated: true };
}

export async function updateCampaignCreatorCapacity(
  input: z.input<typeof campaignCreatorCapacityUpdateSchema>,
) {
  const parsed = campaignCreatorCapacityUpdateSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const user = await getUser();
  const supabase = await createClient();
  const workspace = await assertBrandWorkspacePermission(
    supabase,
    user.id,
    "manage_billing",
  );

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select(
      "id, status, campaign_mode, max_creators, markets, application_deadline, content_due_date, posting_window_start, posting_window_end, performance_due_date, service_fee_cents, service_fee_status, service_package_snapshot",
    )
    .eq("id", parsed.data.campaignId)
    .eq("brand_id", workspace.brandId)
    .single();

  if (campaignError || !campaign) throw new Error("Campaign not found");
  assertCampaignAllowsPaidScopeUpdate(campaign);
  if (campaign.campaign_mode && campaign.campaign_mode !== "private") {
    throw new Error("Concierge campaigns need a custom scope review.");
  }

  const [
    { count: acceptedCount, error: acceptedError },
    { data: paymentEvents, error: paymentEventsError },
  ] = await Promise.all([
    supabase
      .from("campaign_members")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", parsed.data.campaignId),
    supabase
      .from("campaign_payment_events")
      .select("amount_cents, checkout_session_id, service_fee_status, event_summary")
      .eq("campaign_id", parsed.data.campaignId),
  ]);

  const dataError = acceptedError ?? paymentEventsError;
  if (dataError) throw new Error(dataError.message);

  const acceptedCreatorCount = acceptedCount ?? 0;
  if (parsed.data.maxCreators < acceptedCreatorCount) {
    throw new Error("Creator capacity cannot be lower than accepted creators.");
  }

  const currentBalance = getCampaignServiceFeeBalance({
    feeCents: campaign.service_fee_cents,
    paymentEvents: paymentEvents ?? [],
  });
  const currentMaxCreators = Math.max(1, Number(campaign.max_creators) || 1);
  if (
    parsed.data.maxCreators < currentMaxCreators &&
    currentBalance.paidCents > 0
  ) {
    throw new Error("Paid creator capacity cannot be reduced after payment.");
  }

  const currentPricingDays = getCampaignServicePricingDays({
    postingWindowStart: campaign.posting_window_start,
    postingWindowEnd: campaign.posting_window_end,
    performanceDueDate: campaign.performance_due_date,
  });
  const currentActiveDays = getCampaignSnapshotNumber(
    campaign.service_package_snapshot,
    "estimatedActiveDays",
    currentPricingDays.activeDays || 45,
  );
  const currentReportingDays = getCampaignSnapshotNumber(
    campaign.service_package_snapshot,
    "estimatedReportingDays",
    currentPricingDays.reportingDays || 14,
  );
  const nextActiveDays = parsed.data.activeDays ?? currentActiveDays;
  const nextReportingDays = parsed.data.reportingDays ?? currentReportingDays;
  const durationChanged =
    nextActiveDays !== currentActiveDays ||
    nextReportingDays !== currentReportingDays;

  if (
    currentBalance.paidCents > 0 &&
    (nextActiveDays < currentActiveDays ||
      nextReportingDays < currentReportingDays)
  ) {
    throw new Error("Paid campaign duration cannot be reduced after payment.");
  }

  let nextPostingWindowEnd = campaign.posting_window_end;
  let nextPerformanceDueDate = campaign.performance_due_date;
  if (durationChanged) {
    if (!normalizeDateKey(campaign.posting_window_start)) {
      throw new Error("Set the posting window before changing paid duration.");
    }

    nextPostingWindowEnd = addUtcDaysDateKey(
      campaign.posting_window_start,
      nextActiveDays - 1,
    );
    nextPerformanceDueDate = addUtcDaysDateKey(
      nextPostingWindowEnd,
      nextReportingDays,
    );

    if (!nextPostingWindowEnd || !nextPerformanceDueDate) {
      throw new Error("Set the posting window before changing paid duration.");
    }

    const contentDueDateKey = normalizeDateKey(campaign.content_due_date);
    if (contentDueDateKey && nextPostingWindowEnd < contentDueDateKey) {
      throw new Error("Paid campaign window cannot end before content is due.");
    }
  }

  const serviceFields = getCampaignServiceInsertFields("private", {
    maxCreators: parsed.data.maxCreators,
    marketCount: Array.isArray(campaign.markets)
      ? Math.max(1, campaign.markets.length)
      : 1,
    activeDays: nextActiveDays,
    reportingDays: nextReportingDays,
  });
  const balance = getCampaignServiceFeeBalance({
    feeCents: serviceFields.service_fee_cents,
    paymentEvents: paymentEvents ?? [],
  });
  const nextServiceFeeStatus = balance.balanceDueCents === 0 ? "paid" : "pending";
  const paidCreatorCapacity = getCampaignPaidCreatorCapacity({
    maxCreators: parsed.data.maxCreators,
    paymentEvents: paymentEvents ?? [],
    serviceFeeCents: serviceFields.service_fee_cents,
    serviceFeeStatus: nextServiceFeeStatus,
    servicePackageSnapshot: campaign.service_package_snapshot,
  });

  const { data: updated, error: updateError } = await supabase
    .from("campaigns")
    .update({
      max_creators: parsed.data.maxCreators,
      posting_window_end: nextPostingWindowEnd,
      performance_due_date: nextPerformanceDueDate,
      monitoring_end_date: nextPerformanceDueDate,
      service_fee_cents: serviceFields.service_fee_cents,
      service_fee_currency: serviceFields.service_fee_currency,
      service_fee_status: nextServiceFeeStatus,
      service_package_snapshot: {
        ...serviceFields.service_package_snapshot,
        balanceDueCents: balance.balanceDueCents,
        paidCents: balance.paidCents,
        paidCreatorCapacity,
      },
    })
    .eq("id", parsed.data.campaignId)
    .eq("brand_id", workspace.brandId)
    .select(
      "id, max_creators, posting_window_end, performance_due_date, service_fee_cents, service_fee_status",
    )
    .single();

  if (updateError || !updated) {
    throw new Error(updateError?.message ?? "Creator capacity could not be updated.");
  }

  revalidatePath(`/b/campaigns/${parsed.data.campaignId}`);
  revalidatePath("/b/campaigns");

  return {
    balance_due_cents: balance.balanceDueCents,
    active_days: nextActiveDays,
    max_creators: updated.max_creators,
    performance_due_date: updated.performance_due_date,
    posting_window_end: updated.posting_window_end,
    reporting_days: nextReportingDays,
    service_fee_cents: updated.service_fee_cents,
    service_fee_status: updated.service_fee_status,
  };
}

export async function importCampaignCreatorInvites(
  input: z.input<typeof campaignCreatorInviteImportSchema>,
) {
  const parsed = campaignCreatorInviteImportSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const user = await getUser();
  const supabase = await createClient();
  const workspace = await assertBrandWorkspacePermission(
    supabase,
    user.id,
    "manage_campaigns",
  );

  const { campaign, canSendCreatorInvites } =
    await getCampaignInviteShareReadiness(
      supabase,
      parsed.data.campaignId,
      workspace.brandId,
    );

  assertCampaignAllowsCreatorInviteManagement(campaign);
  if (canSendCreatorInvites) assertCampaignAllowsCreatorInviteSending(campaign);

  const [
    { count: acceptedCount, error: acceptedError },
    { data: existingInvites, error: existingError },
    { data: paymentEvents, error: paymentEventsError },
  ] = await Promise.all([
    supabase
      .from("campaign_members")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", parsed.data.campaignId),
    supabase
      .from("campaign_creator_invites")
      .select("normalized_contact, status")
      .eq("campaign_id", parsed.data.campaignId),
    supabase
      .from("campaign_payment_events")
      .select("amount_cents, checkout_session_id, service_fee_status, event_summary")
      .eq("campaign_id", parsed.data.campaignId),
  ]);

  const dataError = acceptedError ?? existingError ?? paymentEventsError;
  if (dataError) throw new Error(dataError.message);

  const capacity = getCampaignPaidCreatorCapacity({
    maxCreators: campaign.max_creators,
    paymentEvents: paymentEvents ?? [],
    serviceFeeCents: campaign.service_fee_cents,
    serviceFeeStatus: campaign.service_fee_status,
    servicePackageSnapshot: campaign.service_package_snapshot,
  });
  const importResult = parseCreatorInviteImport({
    acceptedCount: acceptedCount ?? 0,
    capacity,
    existingContacts: (existingInvites ?? []).map(
      (invite) => invite.normalized_contact,
    ),
    reservedContacts: (existingInvites ?? [])
      .filter((invite) => invite.status !== "sent")
      .map((invite) => invite.normalized_contact),
    rawText: parsed.data.rawContacts,
  });
  const readyRows = importResult.rows.filter((row) => row.status === "ready");

  if (readyRows.length === 0) {
    return {
      importedCount: 0,
      queuedCount: 0,
      manualCount: 0,
      summary: importResult.summary,
    };
  }

  const now = new Date().toISOString();
  const { data: insertedInvites, error: insertError } = await supabase
    .from("campaign_creator_invites")
    .insert(
      readyRows.map((row) => ({
        campaign_id: parsed.data.campaignId,
        contact_type: row.type === "email" ? "email" : "handle",
        contact_value: row.value,
        normalized_contact: row.normalizedValue,
        status: "manual",
        invited_by: user.id,
        invited_at: null,
        updated_at: now,
      })),
    )
    .select("id, contact_type, contact_value, normalized_contact, status");

  if (insertError) throw new Error(insertError.message);

  const admin = createAdminClient();
  let queuedCount = 0;

  for (const invite of insertedInvites ?? []) {
    if (invite.contact_type !== "email" || !canSendCreatorInvites) continue;

    const queueItem = await queueCampaignCreatorInviteEmail({
      admin,
      campaignId: parsed.data.campaignId,
      campaignTitle: campaign.title,
      email: invite.contact_value,
      inviteId: invite.id,
    });

    const queuedAt = new Date().toISOString();
    const { error: inviteUpdateError } = await supabase
      .from("campaign_creator_invites")
      .update({
        status: "queued",
        queued_email_id: queueItem?.id ?? null,
        invited_at: queuedAt,
        updated_at: queuedAt,
      })
      .eq("id", invite.id);

    if (inviteUpdateError) throw new Error(inviteUpdateError.message);
    queuedCount += 1;
  }

  revalidatePath(`/b/campaigns/${parsed.data.campaignId}`);

  return {
    importedCount: insertedInvites?.length ?? 0,
    queuedCount,
    manualCount: (insertedInvites ?? []).length - queuedCount,
    summary: importResult.summary,
  };
}

export async function sendCampaignCreatorInvite(
  input: z.input<typeof campaignCreatorInviteMutationSchema>,
) {
  const parsed = campaignCreatorInviteMutationSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const user = await getUser();
  const supabase = await createClient();
  const workspace = await assertBrandWorkspacePermission(
    supabase,
    user.id,
    "manage_campaigns",
  );

  const { campaign, canSendCreatorInvites } =
    await getCampaignInviteShareReadiness(
      supabase,
      parsed.data.campaignId,
      workspace.brandId,
    );
  assertCampaignAllowsCreatorInviteSending(campaign);
  if (!canSendCreatorInvites) {
    throw new Error("Invite link is locked.");
  }

  const { data: invite, error: inviteError } = await supabase
    .from("campaign_creator_invites")
    .select("id, campaign_id, contact_type, contact_value, status")
    .eq("campaign_id", parsed.data.campaignId)
    .eq("id", parsed.data.inviteId)
    .single();

  if (inviteError || !invite) throw new Error("Invite contact not found.");
  if (invite.contact_type !== "email") {
    throw new Error("Only email contacts can be sent from PopsDrops.");
  }
  if (invite.status === "queued") {
    throw new Error("This invite is already queued.");
  }
  if (invite.status === "sent") {
    throw new Error("This creator has already used this invite.");
  }

  const admin = createAdminClient();
  const queueItem = await queueCampaignCreatorInviteEmail({
    admin,
    campaignId: parsed.data.campaignId,
    campaignTitle: campaign.title,
    email: invite.contact_value,
    inviteId: invite.id,
  });

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("campaign_creator_invites")
    .update({
      status: "queued",
      queued_email_id: queueItem?.id ?? null,
      invited_at: now,
      updated_at: now,
    })
    .eq("campaign_id", parsed.data.campaignId)
    .eq("id", parsed.data.inviteId);

  if (updateError) throw new Error(updateError.message);

  revalidatePath(`/b/campaigns/${parsed.data.campaignId}`);

  return { queuedEmailId: queueItem?.id ?? null };
}

export async function removeCampaignCreatorInvite(
  input: z.input<typeof campaignCreatorInviteMutationSchema>,
) {
  const parsed = campaignCreatorInviteMutationSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const user = await getUser();
  const supabase = await createClient();
  const workspace = await assertBrandWorkspacePermission(
    supabase,
    user.id,
    "manage_campaigns",
  );

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, brand_id, status, application_deadline")
    .eq("id", parsed.data.campaignId)
    .eq("brand_id", workspace.brandId)
    .single();

  if (!campaign) throw new Error("Campaign not found");
  assertCampaignAllowsCreatorInviteManagement(campaign);

  const { data: invite, error: inviteError } = await supabase
    .from("campaign_creator_invites")
    .select("id, campaign_id, queued_email_id")
    .eq("campaign_id", parsed.data.campaignId)
    .eq("id", parsed.data.inviteId)
    .single();

  if (inviteError || !invite) throw new Error("Invite contact not found.");

  const admin = createAdminClient();
  if (invite.queued_email_id) {
    const now = new Date().toISOString();
    const { error: queueUpdateError } = await admin
      .from("notification_queue")
      .update({
        status: "archived",
        processed_at: now,
        processed_reason: "campaign_invite_removed",
        updated_at: now,
      })
      .eq("id", invite.queued_email_id)
      .eq("status", "pending");

    if (queueUpdateError) throw new Error(queueUpdateError.message);
  }

  const { error: deleteError } = await admin
    .from("campaign_creator_invites")
    .delete()
    .eq("campaign_id", parsed.data.campaignId)
    .eq("id", parsed.data.inviteId);

  if (deleteError) throw new Error(deleteError.message);

  revalidatePath(`/b/campaigns/${parsed.data.campaignId}`);

  return { removed: true };
}

export async function createCampaignServiceFeeCheckout(
  input: z.input<typeof campaignServiceFeeCheckoutSchema>,
) {
  const parsed = campaignServiceFeeCheckoutSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const user = await getUser();
  const supabase = await createClient();
  const workspace = await assertBrandWorkspacePermission(
    supabase,
    user.id,
    "manage_billing",
  );

  const { data: campaign } = await supabase
    .from("campaigns")
    .select(
      "id, max_creators, posting_window_start, posting_window_end, performance_due_date, service_package_snapshot",
    )
    .eq("id", parsed.data.campaignId)
    .eq("brand_id", workspace.brandId)
    .single();

  if (!campaign) throw new Error("Campaign not found");
  const paidCreatorCapacity =
    campaign.service_package_snapshot?.estimatedMaxCreators;
  const paidActiveDays =
    campaign.service_package_snapshot?.estimatedActiveDays;
  const paidReportingDays =
    campaign.service_package_snapshot?.estimatedReportingDays;
  const checkoutPricingDays = getCampaignServicePricingDays({
    postingWindowStart: campaign.posting_window_start,
    postingWindowEnd: campaign.posting_window_end,
    performanceDueDate: campaign.performance_due_date,
  });
  if (
    !Number.isFinite(campaign.max_creators) ||
    Number(paidCreatorCapacity) !== campaign.max_creators ||
    Number(paidActiveDays) !== checkoutPricingDays.activeDays ||
    Number(paidReportingDays) !== checkoutPricingDays.reportingDays
  ) {
    throw new Error("Campaign service fee is out of sync. Save the campaign scope before paying.");
  }

  const { data, error } = await supabase.functions.invoke(
    "create-stripe-checkout-session",
    {
      body: {
        appBaseUrl: getAppBaseUrl(),
        campaignId: parsed.data.campaignId,
      },
    },
  );

  if (error) throw new Error(error.message);

  const result = z
    .object({
      alreadyPaid: z.boolean(),
      url: z.string().min(1),
    })
    .parse(data);

  revalidatePath(`/b/campaigns/${parsed.data.campaignId}`);
  revalidatePath("/b/campaigns");

  return result;
}

export async function markCampaignServiceFeePaidForDevSmoke(campaignId: string) {
  assertDevOnlyServiceFeeSmoke();
  const parsed = uuidLike.safeParse(campaignId);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const user = await getUser();
  const supabase = await createClient();
  const workspace = await assertBrandWorkspacePermission(
    supabase,
    user.id,
    "manage_billing",
  );

  const { error } = await supabase
    .from("campaigns")
    .update({ service_fee_status: "paid" })
    .eq("id", parsed.data)
    .eq("brand_id", workspace.brandId);

  if (error) throw new Error(error.message);

  revalidatePath(`/b/campaigns/${parsed.data}`);
  revalidatePath("/b/campaigns");

  return { service_fee_status: "paid" };
}

export async function launchCampaign(campaignId: string) {
  const user = await getUser();
  const supabase = await createClient();
  const workspace = await assertBrandWorkspacePermission(supabase, user.id, "manage_campaigns");

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select(
      "id, status, brief_description, service_fee_cents, service_fee_currency, service_fee_status, service_package_snapshot",
    )
    .eq("id", campaignId)
    .eq("brand_id", workspace.brandId)
    .single();

  if (campaignError) throw new Error(campaignError.message);
  assertCampaignHasServiceFeeObligation(campaign);
  assertCampaignServiceFeePaid(campaign);

  const [
    { data: creatorImages, error: imageError },
    { data: deliverables, error: deliverableError },
    { data: reportingRequirements, error: reportingError },
    { data: agreements, error: agreementError },
  ] = await Promise.all([
    supabase
      .from("campaign_assets")
      .select("id")
      .eq("campaign_id", campaignId)
      .eq("visibility", "public")
      .eq("status", "ready")
      .like("mime_type", "image/%")
      .limit(1),
    supabase
      .from("campaign_deliverables")
      .select("id")
      .eq("campaign_id", campaignId)
      .gt("quantity", 0)
      .limit(1),
    supabase
      .from("campaign_reporting_requirements")
      .select("id")
      .eq("campaign_id", campaignId)
      .limit(1),
    supabase
      .from("campaign_agreements")
      .select("status")
      .eq("campaign_id", campaignId)
      .order("version", { ascending: false })
      .limit(1),
  ]);

  const readinessErrors = [
    imageError,
    deliverableError,
    reportingError,
    agreementError,
  ].filter(Boolean);

  if (readinessErrors[0]) {
    throw new Error(readinessErrors[0].message);
  }

  const latestAgreement = agreements?.[0] ?? null;

  assertCampaignLaunchReadiness(campaign, {
    hasCreatorImage: (creatorImages ?? []).length > 0,
    hasDeliverables: (deliverables ?? []).length > 0,
    hasReportingRequirements: (reportingRequirements ?? []).length > 0,
    rulesReady:
      !latestAgreement ||
      latestAgreement.status === "published" ||
      latestAgreement.status === "archived",
  });

  const { error } = await supabase
    .from("campaigns")
    .update({ status: "recruiting" })
    .eq("id", campaignId)
    .eq("brand_id", workspace.brandId)
    .eq("status", "draft");

  if (error) throw new Error(error.message);

  try {
    await translateBrief(campaignId);
  } catch (err) {
    console.error("[launchCampaign] Brief translation failed:", err);
  }

  revalidatePath(`/b/campaigns/${campaignId}`);
  revalidatePath(`/apply/${campaignId}`);
  revalidatePath("/b/campaigns");

  return { status: "recruiting" };
}

export async function publishCampaign(campaignId: string) {
  return launchCampaign(campaignId);
}

export async function startCampaignWork(campaignId: string) {
  const user = await getUser();
  const supabase = await createClient();
  const workspace = await assertBrandWorkspacePermission(supabase, user.id, "manage_campaigns");

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("id, status, title")
    .eq("id", campaignId)
    .eq("brand_id", workspace.brandId)
    .single();

  if (campaignError) throw new Error(campaignError.message);

  const [
    { data: members, error: membersError },
    { data: unresolvedApplications, error: applicationsError },
  ] = await Promise.all([
    supabase
      .from("campaign_members")
      .select("id, creator_id")
      .eq("campaign_id", campaignId),
    supabase
      .from("campaign_applications")
      .select("id")
      .eq("campaign_id", campaignId)
      .in("status", ["pending", "counter_offer"]),
  ]);

  const preflightError = membersError ?? applicationsError;
  if (preflightError) throw new Error(preflightError.message);

  assertCampaignAllowsWorkStart({
    status: campaign.status,
    memberCount: members?.length ?? 0,
    unresolvedApplicationCount: unresolvedApplications?.length ?? 0,
  });

  const { data: startedCampaign, error } = await supabase
    .from("campaigns")
    .update({
      status: "in_progress",
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId)
    .eq("brand_id", workspace.brandId)
    .eq("status", "recruiting")
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  if (!startedCampaign) throw new Error("Campaign work could not be started.");

  if (members && members.length > 0) {
    await createPrivilegedNotifications(
      members.map((member) => ({
        user_id: member.creator_id,
        type: "campaign_update" as const,
        title: "Campaign work started",
        body: `"${campaign.title}" is ready for creator work.`,
        data: {
          campaign_id: campaignId,
          campaignId,
          campaignTitle: campaign.title,
        },
      })),
    );
  }

  revalidatePath(`/b/campaigns/${campaignId}`);
  revalidatePath(`/i/campaigns/${campaignId}`);
  revalidatePath("/b/campaigns");
  revalidatePath("/i/campaigns");

  return { status: "in_progress" };
}

export async function completeCampaign(campaignId: string) {
  const user = await getUser();
  const supabase = await createClient();
  const workspace = await assertBrandWorkspacePermission(supabase, user.id, "manage_campaigns");

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("id, status, title")
    .eq("id", campaignId)
    .eq("brand_id", workspace.brandId)
    .single();

  if (campaignError) throw new Error(campaignError.message);

  const [
    { data: pendingApplications, error: applicationsError },
    { data: members, error: membersError },
  ] = await Promise.all([
    supabase
      .from("campaign_applications")
      .select("id")
      .eq("campaign_id", campaignId)
      .eq("status", "pending"),
    supabase
      .from("campaign_members")
      .select("id, creator_id")
      .eq("campaign_id", campaignId),
  ]);

  const preflightError = applicationsError ?? membersError;
  if (preflightError) throw new Error(preflightError.message);

  const memberIds = (members ?? []).map((member) => member.id);
  let submissions: Array<{
    id: string;
    parent_submission_id: string | null;
    campaign_member_id: string;
    published_url: string | null;
    status: string;
  }> = [];
  let reportTasks: Array<{
    campaign_member_id: string;
    status: string;
  }> = [];

  if (memberIds.length > 0) {
    const [
      { data: submissionRows, error: submissionsError },
      { data: reportTaskRows, error: reportTasksError },
    ] = await Promise.all([
      supabase
        .from("content_submissions")
        .select("id, parent_submission_id, campaign_member_id, published_url, status")
        .in("campaign_member_id", memberIds),
      supabase
        .from("campaign_report_tasks")
        .select("campaign_member_id, status")
        .eq("campaign_id", campaignId)
        .in("campaign_member_id", memberIds),
    ]);

    const closeoutDataError = submissionsError ?? reportTasksError;
    if (closeoutDataError) throw new Error(closeoutDataError.message);

    submissions = submissionRows ?? [];
    reportTasks = reportTaskRows ?? [];
  }

  const closeoutReadiness = getCampaignCloseoutReadiness({
    campaignStatus: campaign.status,
    pendingApplicants: pendingApplications?.length ?? 0,
    members: (members ?? []).map((member) => ({ id: member.id })),
    submissions: submissions.map((submission) => ({
      id: submission.id,
      parentSubmissionId: submission.parent_submission_id,
      campaignMemberId: submission.campaign_member_id,
      publishedUrl: submission.published_url,
      status: submission.status,
    })),
    reportTasks: reportTasks.map((task) => ({
      campaignMemberId: task.campaign_member_id,
      status: task.status,
    })),
  });
  assertCampaignCloseoutReadiness(closeoutReadiness);

  const { data: completedCampaign, error } = await supabase
    .from("campaigns")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", campaignId)
    .eq("brand_id", workspace.brandId)
    .eq("status", "monitoring")
    .neq("status", "completed")
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  if (!completedCampaign) throw new Error("Campaign could not be completed.");

  if (members) {
    const notifications = members.map((m) => ({
      user_id: m.creator_id,
      type: "campaign_completed" as const,
      title: "Campaign Completed",
      body: "A campaign you participated in has been completed. Please leave a review!",
      data: {
        campaign_id: campaignId,
        campaignId,
        campaignTitle: campaign.title,
      },
    }));

    await createPrivilegedNotifications(notifications);
  }

  revalidatePath(`/b/campaigns/${campaignId}`);
  revalidatePath("/b/campaigns");
  revalidatePath(`/i/campaigns/${campaignId}`);
  revalidatePath("/i/campaigns");
}

export async function updateCampaignDeadline(
  campaignId: string,
  newDeadline: string
) {
  const user = await getUser();
  const supabase = await createClient();
  const workspace = await assertBrandWorkspacePermission(supabase, user.id, "manage_campaigns");

  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, status, application_deadline, content_due_date")
    .eq("id", campaignId)
    .eq("brand_id", workspace.brandId)
    .single();

  if (!campaign) throw new Error("Campaign not found");
  assertCampaignAllowsApplicationDeadlineUpdate(campaign);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(newDeadline)) {
    throw new Error("Deadline must be a valid date");
  }

  const today = new Date().toISOString().split("T")[0];
  if (newDeadline < today) {
    throw new Error("Deadline must be today or later");
  }

  assertApplicationDeadlineBeforeContentDueDate(
    newDeadline,
    campaign.content_due_date,
  );

  const normalizedDeadline = normalizeApplicationDeadlineForStorage(newDeadline);
  const { error } = await supabase
    .from("campaigns")
    .update({ application_deadline: normalizedDeadline })
    .eq("id", campaignId)
    .eq("brand_id", workspace.brandId)
    .in("status", ["draft", "recruiting"]);

  if (error) throw new Error(error.message);

  revalidatePath(`/b/campaigns/${campaignId}`);
  return normalizedDeadline;
}

export async function sendCampaignAnnouncement(
  campaignId: string,
  message: string
) {
  if (!message.trim()) throw new Error("Announcement cannot be empty");

  const user = await getUser();
  const supabase = await createClient();
  const workspace = await assertBrandWorkspacePermission(supabase, user.id, "manage_campaigns");

  // Verify ownership
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, title, status")
    .eq("id", campaignId)
    .eq("brand_id", workspace.brandId)
    .single();

  if (!campaign) throw new Error("Campaign not found");
  assertCampaignAllowsAnnouncement(campaign);

  // Get all campaign members
  const { data: members } = await supabase
    .from("campaign_members")
    .select("creator_id")
    .eq("campaign_id", campaignId);

  if (!members || members.length === 0) {
    throw new Error("No members to notify");
  }

  // Create notifications for all members
  const notifications = members.map((m) => ({
    user_id: m.creator_id,
    type: "campaign_update" as const,
    title: "Campaign announcement",
    body: message.trim(),
    data: {
      campaign_id: campaignId,
      campaignId,
      campaignTitle: campaign.title,
    },
  }));

  await createPrivilegedNotifications(notifications);

  revalidatePath(`/b/campaigns/${campaignId}`);
}
