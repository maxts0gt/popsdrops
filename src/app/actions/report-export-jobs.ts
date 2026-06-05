"use server";

import { assertBrandWorkspacePermission } from "@/lib/brand-workspace";
import {
  assertReportExportServiceContractVersion,
  REPORT_EXPORT_CONTRACT_VERSION,
} from "@/lib/reporting/report-export-contract";
import {
  assertReportExportServiceReady,
  getReportExportServiceConfig,
} from "@/lib/reporting/report-export-service";
import {
  buildReportCompositionExportData,
  type ReportBuilderBlockId,
  type ReportBuilderChartModeId,
  type ReportBuilderPresentation,
  type ReportBuilderPresetSelectionId,
} from "@/lib/reporting/report-builder";
import { buildCampaignSharedReport } from "@/lib/reporting/shared-report-data";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "./auth";

export type ReportExportJobFormat = "json" | "csv" | "html";

export interface ReportExportJobResult {
  jobId: string;
  format: ReportExportJobFormat;
  fileName: string;
  mimeType: string;
  storagePath: string;
  signedUrl: string;
  contractVersion: string;
}

const uuidLike =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const reportExportFormats = new Set<ReportExportJobFormat>(["json", "csv", "html"]);

function assertReportExportFormat(format: string): asserts format is ReportExportJobFormat {
  if (!reportExportFormats.has(format as ReportExportJobFormat)) {
    throw new Error("Unsupported report export format.");
  }
}

function assertUuid(value: string, label: string) {
  if (!uuidLike.test(value)) {
    throw new Error(`Invalid ${label}.`);
  }
}

async function assertCampaignReportAccess({
  campaignId,
  userId,
}: {
  campaignId: string;
  userId: string;
}) {
  const supabase = await createClient();
  const workspace = await assertBrandWorkspacePermission(
    supabase,
    userId,
    "share_reports",
  );
  const { data: campaign, error: campaignError } = await supabase
    .from("campaigns")
    .select("id")
    .eq("id", campaignId)
    .eq("brand_id", workspace.brandId)
    .maybeSingle();

  if (campaignError) throw new Error(campaignError.message);
  if (!campaign) throw new Error("Campaign not found.");

  return workspace;
}

async function loadReportCompositionTemplateForExport({
  brandId,
  templateId,
}: {
  brandId: string;
  templateId: string;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("report_composition_templates")
    .select("id, name, description, preset_id, chart_mode_id, block_ids, report_presentation")
    .eq("id", templateId)
    .eq("brand_id", brandId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("Report template not found.");

  return {
    id: data.id as string,
    name: data.name as string,
    description: data.description as string | null,
    presetId: data.preset_id as ReportBuilderPresetSelectionId,
    chartModeId: data.chart_mode_id as ReportBuilderChartModeId,
    blockIds: data.block_ids as ReportBuilderBlockId[],
    presentation: data.report_presentation as ReportBuilderPresentation | null,
  };
}

export async function requestReportExport({
  blockIds,
  campaignId,
  chartModeId,
  format,
  presentation,
  presetId,
  templateId,
}: {
  blockIds?: ReportBuilderBlockId[];
  campaignId: string;
  chartModeId?: ReportBuilderChartModeId;
  format: ReportExportJobFormat;
  presentation?: ReportBuilderPresentation;
  presetId?: ReportBuilderPresetSelectionId;
  templateId?: string | null;
}): Promise<ReportExportJobResult> {
  assertUuid(campaignId, "campaign ID");
  if (templateId) assertUuid(templateId, "report template ID");
  assertReportExportFormat(format);

  const user = await getUser();
  const workspace = await assertCampaignReportAccess({ campaignId, userId: user.id });
  const template = templateId
    ? await loadReportCompositionTemplateForExport({
        brandId: workspace.brandId,
        templateId,
      })
    : null;

  const report = await buildCampaignSharedReport(campaignId, { applyCampaignComposition: false });
  if (!report) throw new Error("Report data is not available yet.");
  const exportReport = buildReportCompositionExportData(report, {
    blockIds: template?.blockIds ?? blockIds,
    chartModeId: template?.chartModeId ?? chartModeId,
    presetId: template?.presetId ?? presetId,
    presentation: template?.presentation ?? presentation,
    template: template
      ? {
          id: template.id,
          name: template.name,
          description: template.description,
          presentation: template.presentation,
        }
      : null,
  });

  await assertReportExportServiceReady();
  const { serviceRoleKey, supabaseUrl } = getReportExportServiceConfig();

  const response = await fetch(`${supabaseUrl}/functions/v1/generate-report`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({
      campaignId,
      requestedBy: user.id,
      format,
      report: exportReport,
    }),
  });

  const payload = await response.json().catch(() => null) as
    | (Partial<ReportExportJobResult> & { error?: string })
    | null;

  if (!response.ok || !payload) {
    throw new Error(payload?.error ?? "Report export failed.");
  }

  assertReportExportServiceContractVersion(payload);

  if (
    typeof payload.jobId !== "string" ||
    typeof payload.fileName !== "string" ||
    typeof payload.mimeType !== "string" ||
    typeof payload.storagePath !== "string" ||
    typeof payload.signedUrl !== "string" ||
    payload.format !== format
  ) {
    throw new Error("Report export returned an invalid response.");
  }

  return {
    jobId: payload.jobId,
    format,
    fileName: payload.fileName,
    mimeType: payload.mimeType,
    storagePath: payload.storagePath,
    signedUrl: payload.signedUrl,
    contractVersion: REPORT_EXPORT_CONTRACT_VERSION,
  };
}
