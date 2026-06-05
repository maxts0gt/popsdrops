"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertBrandWorkspacePermission } from "@/lib/brand-workspace";
import {
  normalizeReportBuilderPresentation,
  normalizeReportCompositionSelection,
  normalizeReportCompositionTemplateInput,
  type ReportBuilderBlockId,
  type ReportBuilderChartModeId,
  type ReportBuilderPresentation,
  type ReportBuilderPresetSelectionId,
} from "@/lib/reporting/report-builder";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "./auth";

export type ReportCompositionTemplateSummary = {
  id: string;
  name: string;
  description: string | null;
  presetId: ReportBuilderPresetSelectionId;
  chartModeId: ReportBuilderChartModeId;
  blockIds: ReportBuilderBlockId[];
  presentation: ReportBuilderPresentation;
  isDefault: boolean;
  updatedAt: string;
};

export type SavedCampaignReportComposition = {
  campaignId: string;
  templateId: string | null;
  presetId: ReportBuilderPresetSelectionId;
  chartModeId: ReportBuilderChartModeId;
  blockIds: ReportBuilderBlockId[];
  presentation: ReportBuilderPresentation;
};

const reportPresentationSchema = z.object({
  coverMode: z.enum(["campaign_visual", "proof_room"]).optional(),
  typography: z.enum(["quiet", "compact"]).optional(),
  density: z.enum(["editorial", "compact"]).optional(),
  chartMetricKey: z.enum(["views", "engagements", "engagementRate", "cpe"]).nullable().optional(),
  headline: z.string().trim().max(120).nullable().optional(),
  executiveQuestion: z.string().trim().max(220).nullable().optional(),
  kpiIds: z.array(z.string().trim().min(1).max(80)).max(24).nullable().optional(),
  trustIds: z.array(z.string().trim().min(1).max(80)).max(24).nullable().optional(),
  kpiLabels: z.record(z.string(), z.string().trim().min(1).max(80)).nullable().optional(),
  trustLabels: z.record(z.string(), z.string().trim().min(1).max(80)).nullable().optional(),
  sectionLabels: z.record(z.string(), z.string().trim().min(1).max(80)).nullable().optional(),
}).optional();

const saveReportCompositionTemplateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(160).nullable().optional(),
  presetId: z.string().trim().min(1).max(80).optional(),
  chartModeId: z.string().trim().min(1).max(80).optional(),
  blockIds: z.array(z.string().trim().min(1).max(80)).min(1).max(12),
  presentation: reportPresentationSchema,
  setDefault: z.boolean().optional(),
});

const saveCampaignReportCompositionSchema = z.object({
  campaignId: z.string().uuid(),
  templateId: z.string().uuid().nullable().optional(),
  presetId: z.string().trim().min(1).max(80).optional(),
  chartModeId: z.string().trim().min(1).max(80).optional(),
  blockIds: z.array(z.string().trim().min(1).max(80)).min(1).max(12),
  presentation: reportPresentationSchema,
});

type ReportCompositionTemplateRow = {
  id: string;
  name: string;
  description: string | null;
  preset_id: string;
  chart_mode_id: string;
  block_ids: string[] | null;
  report_presentation: unknown | null;
  is_default: boolean | null;
  updated_at: string;
};

function toReportCompositionTemplateSummary(
  row: ReportCompositionTemplateRow,
): ReportCompositionTemplateSummary {
  const normalized = normalizeReportCompositionTemplateInput({
    name: row.name,
    description: row.description,
    presetId: row.preset_id,
    chartModeId: row.chart_mode_id,
    blockIds: row.block_ids ?? [],
    presentation: row.report_presentation,
  });

  return {
    id: row.id,
    name: normalized.name,
    description: normalized.description,
    presetId: normalized.presetId,
    chartModeId: normalized.chartModeId,
    blockIds: normalized.blockIds,
    presentation: normalized.presentation,
    isDefault: Boolean(row.is_default),
    updatedAt: row.updated_at,
  };
}

export async function listReportCompositionTemplates(): Promise<
  ReportCompositionTemplateSummary[]
> {
  const user = await getUser();
  const supabase = await createClient();
  const workspace = await assertBrandWorkspacePermission(
    supabase,
    user.id,
    "view_campaigns",
  );

  const { data, error } = await supabase
    .from("report_composition_templates")
    .select("id, name, description, preset_id, chart_mode_id, block_ids, report_presentation, is_default, updated_at")
    .eq("brand_id", workspace.brandId)
    .order("is_default", { ascending: false })
    .order("updated_at", { ascending: false });

  if (error) throw new Error(error.message);

  return ((data ?? []) as ReportCompositionTemplateRow[]).map(
    toReportCompositionTemplateSummary,
  );
}

export async function saveReportCompositionTemplate(
  input: z.input<typeof saveReportCompositionTemplateSchema>,
): Promise<ReportCompositionTemplateSummary> {
  const parsed = saveReportCompositionTemplateSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("Report template details are invalid.");
  }

  const user = await getUser();
  const supabase = await createClient();
  const workspace = await assertBrandWorkspacePermission(
    supabase,
    user.id,
    "share_reports",
  );
  const normalized = normalizeReportCompositionTemplateInput(parsed.data);

  if (parsed.data.setDefault) {
    const { error: clearDefaultError } = await supabase
      .from("report_composition_templates")
      .update({ is_default: false, updated_by: user.id })
      .eq("brand_id", workspace.brandId)
      .eq("is_default", true);

    if (clearDefaultError) throw new Error(clearDefaultError.message);
  }

  const { data, error } = await supabase
    .from("report_composition_templates")
    .insert({
      brand_id: workspace.brandId,
      name: normalized.name,
      description: normalized.description,
      preset_id: normalized.presetId,
      chart_mode_id: normalized.chartModeId,
      block_ids: normalized.blockIds,
      report_presentation: normalized.presentation,
      is_default: Boolean(parsed.data.setDefault),
      created_by: user.id,
      updated_by: user.id,
    })
    .select("id, name, description, preset_id, chart_mode_id, block_ids, report_presentation, is_default, updated_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("A report template with this name already exists.");
    }

    throw new Error(error.message);
  }

  revalidatePath("/b/campaigns");

  return toReportCompositionTemplateSummary(data as ReportCompositionTemplateRow);
}

export async function saveCampaignReportComposition(
  input: z.input<typeof saveCampaignReportCompositionSchema>,
): Promise<SavedCampaignReportComposition> {
  const parsed = saveCampaignReportCompositionSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("Campaign report shape is invalid.");
  }

  const user = await getUser();
  const supabase = await createClient();
  const workspace = await assertBrandWorkspacePermission(
    supabase,
    user.id,
    "share_reports",
  );

  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("id")
    .eq("id", parsed.data.campaignId)
    .eq("brand_id", workspace.brandId)
    .maybeSingle();

  if (campaignError) throw new Error(campaignError.message);
  if (!campaign) throw new Error("Campaign not found.");

  let templateId = parsed.data.templateId ?? null;
  let selection = normalizeReportCompositionSelection(parsed.data);

  if (templateId) {
    const { data: template, error: templateError } = await supabase
      .from("report_composition_templates")
      .select("id, name, description, preset_id, chart_mode_id, block_ids, report_presentation, is_default, updated_at")
      .eq("id", templateId)
      .eq("brand_id", workspace.brandId)
      .maybeSingle();

    if (templateError) throw new Error(templateError.message);
    if (!template) throw new Error("Report template not found.");

    const normalizedTemplate = toReportCompositionTemplateSummary(
      template as ReportCompositionTemplateRow,
    );
    selection = {
      presetId: normalizedTemplate.presetId,
      chartModeId: normalizedTemplate.chartModeId,
      blockIds: normalizedTemplate.blockIds,
      presentation: normalizedTemplate.presentation,
    };
    templateId = normalizedTemplate.id;
  }

  const { error } = await supabase
    .from("campaign_reporting_plans")
    .upsert({
      campaign_id: parsed.data.campaignId,
      report_template_id: templateId,
      report_preset_id: selection.presetId,
      report_chart_mode_id: selection.chartModeId,
      report_block_ids: selection.blockIds,
      report_presentation: normalizeReportBuilderPresentation(selection.presentation),
    },
    { onConflict: "campaign_id" },
  );

  if (error) throw new Error(error.message);

  revalidatePath(`/b/campaigns/${parsed.data.campaignId}`);
  revalidatePath(`/b/campaigns/${parsed.data.campaignId}/report`);

  return {
    campaignId: parsed.data.campaignId,
    templateId,
    presetId: selection.presetId,
    chartModeId: selection.chartModeId,
    blockIds: selection.blockIds,
    presentation: normalizeReportBuilderPresentation(selection.presentation),
  };
}
