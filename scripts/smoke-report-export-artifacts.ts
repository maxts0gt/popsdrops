#!/usr/bin/env node

import { buildCampaignSharedReport } from "../src/lib/reporting/shared-report-data";

import {
  createAdminClient,
  cleanupApplicationFlowSmokeData,
  loadLocalEnv,
} from "./smoke-application-flow.mjs";
import {
  buildContentReportManualSourceSmokeTargets,
  runContentReportManualSourceSmoke,
} from "./smoke-content-report-manual-source.mjs";

export const DEFAULT_REPORT_EXPORT_ARTIFACT_CAMPAIGN_ID =
  "a0000000-0000-4000-8000-000000000111";
export const REPORT_EXPORT_ARTIFACT_FORMATS = ["html", "json", "csv"] as const;
export const REPORT_EXPORT_ARTIFACT_CUSTOM_TITLE =
  "Artifact proof room board report";
const REPORT_EXPORT_ARTIFACT_EXECUTIVE_QUESTION =
  "Can leadership trust this proof package for market expansion?";

type ReportExportArtifactFormat = (typeof REPORT_EXPORT_ARTIFACT_FORMATS)[number];

interface ReportExportArtifactResult {
  jobId: string;
  format: ReportExportArtifactFormat;
  fileName: string;
  mimeType: string;
  storagePath: string;
  byteLength: number;
}

interface EdgeReportExportResponse {
  jobId?: string;
  format?: string;
  fileName?: string;
  mimeType?: string;
  storagePath?: string;
  signedUrl?: string;
  error?: string;
}

function assertArtifactContainsSourceProof(format: ReportExportArtifactFormat, text: string) {
  const required =
    format === "json"
      ? [
          "Data source",
          "Brand-reviewed proof",
          "Creator evidence reviewed by brand",
          "Proof review",
          "Reviewer recorded",
          "proofOperations",
          "recommendations",
          "Top creator",
        ]
      : format === "html"
        ? [
            "Data source",
            "Brand-reviewed proof",
            "Creator evidence reviewed by brand",
            "Proof review",
            "Reviewer recorded",
            "Proof operations",
            "proof-operations",
            "Recommendations",
            "Top creator",
          ]
      : [
          "Data source",
          "Brand-reviewed proof",
          "Creator evidence reviewed by brand",
          "Proof review",
          "Reviewer recorded",
          "Proof Operations",
          "Recommendations",
          "Top creator",
        ];

  for (const label of required) {
    if (!text.includes(label)) {
      throw new Error(`Missing ${label} in ${format} report export artifact.`);
    }
  }

  if (format === "json") {
    const parsed = JSON.parse(text) as {
      recommendations?: Array<{ title?: string; value?: string; detail?: string }>;
      proofReview?: { value?: string; detail?: string };
      proofOperations?: {
        attentionCount?: number;
        proofBasis?: Array<{ key?: string; value?: number }>;
        scope?: string;
        state?: string;
        verifiedCoverage?: string;
      };
      story?: { evidenceTrail?: string };
      trust?: Array<{ label?: string; value?: string; detail?: string }>;
    };
    const dataSource = parsed.trust?.find((item) => item.label === "Data source");
    const topCreator = parsed.recommendations?.find((item) => item.title === "Top creator");
    const proofReviewValue = parsed.proofReview?.value ?? "";

    if (
      dataSource?.value !== "Brand-reviewed proof" ||
      dataSource.detail !== "Creator evidence reviewed by brand"
    ) {
      throw new Error("JSON report export does not preserve the data source trust row.");
    }

    if (
      !/^Reviewed \d{4}\/\d{2}\/\d{2}$/.test(proofReviewValue) ||
      parsed.proofReview?.detail !== "Reviewer recorded" ||
      !parsed.story?.evidenceTrail?.includes(proofReviewValue)
    ) {
      throw new Error("JSON report export does not preserve proof review provenance.");
    }

    if (!topCreator?.value || !topCreator.detail) {
      throw new Error("JSON report export does not preserve data-backed recommendations.");
    }

    if (
      !parsed.proofOperations ||
      !["single", "scale"].includes(parsed.proofOperations.scope ?? "") ||
      !["ready", "hold"].includes(parsed.proofOperations.state ?? "") ||
      !/^\d+\/\d+$/.test(parsed.proofOperations.verifiedCoverage ?? "") ||
      !parsed.proofOperations.proofBasis?.some((item) => item.key === "included")
    ) {
      throw new Error("JSON report export does not preserve proof operations readiness.");
    }
  } else if (!/Reviewed \d{4}\/\d{2}\/\d{2}/.test(text)) {
    throw new Error(`Missing proof review date in ${format} report export artifact.`);
  }
}

function assertArtifactContainsConfiguredStory(
  format: ReportExportArtifactFormat,
  text: string,
) {
  const required =
    format === "json"
      ? [
          REPORT_EXPORT_ARTIFACT_CUSTOM_TITLE,
          "Proof view",
          "Evidence audit",
          REPORT_EXPORT_ARTIFACT_EXECUTIVE_QUESTION,
          "report_framing",
          "proof_sources",
        ]
      : [
          REPORT_EXPORT_ARTIFACT_CUSTOM_TITLE,
          "Proof view",
          "Evidence audit",
          REPORT_EXPORT_ARTIFACT_EXECUTIVE_QUESTION,
          "Global Proof Room",
          "Proof sources",
        ];

  for (const label of required) {
    if (!text.includes(label)) {
      throw new Error(`Missing configured report story ${label} in ${format} artifact.`);
    }
  }

  if (format === "html") {
    if (
      !text.includes('data-report-cover-mode="proof_room"') ||
      !text.includes('data-report-typography="compact"') ||
      !text.includes('data-report-density="compact"') ||
      !text.includes('data-report-chart-mode="proof"')
    ) {
      throw new Error("HTML report export does not preserve presentation controls.");
    }
  }

  if (format === "json") {
    const parsed = JSON.parse(text) as {
      composition?: {
        reportTitle?: string;
        chartModeId?: string;
        chartModeTitle?: string;
        chartLayoutTitle?: string;
        executiveQuestion?: string;
        presentation?: {
          coverMode?: string;
          typography?: string;
          density?: string;
        };
      };
      blocks?: Array<{ id?: string }>;
      story?: {
        decisionRead?: string;
        evidenceTrail?: string;
        trustDecision?: string;
        nextAction?: string;
      };
    };

    if (
      parsed.composition?.reportTitle !== REPORT_EXPORT_ARTIFACT_CUSTOM_TITLE ||
      parsed.composition.chartModeId !== "proof" ||
      parsed.composition.chartModeTitle !== "Proof view" ||
      parsed.composition.chartLayoutTitle !== "Evidence audit" ||
      parsed.composition.executiveQuestion !== REPORT_EXPORT_ARTIFACT_EXECUTIVE_QUESTION ||
      parsed.composition.presentation?.coverMode !== "proof_room" ||
      parsed.composition.presentation.typography !== "compact" ||
      parsed.composition.presentation.density !== "compact"
    ) {
      throw new Error("JSON report export does not preserve configured report composition.");
    }

    const blockIds = new Set(parsed.blocks?.map((block) => block.id));
    if (!blockIds.has("report_framing") || !blockIds.has("proof_sources")) {
      throw new Error("JSON report export does not preserve selected report blocks.");
    }

    if (
      parsed.story?.decisionRead !== REPORT_EXPORT_ARTIFACT_EXECUTIVE_QUESTION ||
      !parsed.story.evidenceTrail?.includes("Brand-reviewed proof") ||
      !parsed.story.evidenceTrail?.includes(parsed.proofReview?.value ?? "__missing__") ||
      parsed.story.trustDecision !== "Ready for leadership sharing." ||
      parsed.story.nextAction !== "Share the verified proof room with leadership."
    ) {
      throw new Error("JSON report export does not preserve decision story.");
    }
  }
}

async function checkedQuery<T>(label: string, query: PromiseLike<{ data: T; error: Error | null }>) {
  const { data, error } = await query;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

async function configureReportExportArtifactStory(
  admin: ReturnType<typeof createAdminClient>,
  campaignId: string,
) {
  await checkedQuery(
    "Configure report export artifact story",
    admin
      .from("campaign_reporting_plans")
      .upsert(
        {
          campaign_id: campaignId,
          report_preset_id: "proof_audit",
          report_chart_mode_id: "proof",
          report_block_ids: [
            "report_framing",
            "proof_sources",
            "report_trust",
            "creator_table",
            "recommendations",
          ],
          report_presentation: {
            coverMode: "proof_room",
            typography: "compact",
            density: "compact",
            headline: REPORT_EXPORT_ARTIFACT_CUSTOM_TITLE,
            executiveQuestion: REPORT_EXPORT_ARTIFACT_EXECUTIVE_QUESTION,
          },
        },
        { onConflict: "campaign_id" },
      ),
  );
}

async function getCampaignBrandId(admin: ReturnType<typeof createAdminClient>, campaignId: string) {
  const campaign = await checkedQuery(
    "Find export smoke campaign owner",
    admin
      .from("campaigns")
      .select("brand_id")
      .eq("id", campaignId)
      .maybeSingle(),
  );

  if (!campaign?.brand_id) {
    throw new Error("Report export smoke campaign is missing a brand owner.");
  }

  return campaign.brand_id as string;
}

async function requestReportExportArtifact({
  campaignId,
  requestedBy,
  format,
  report,
  admin,
}: {
  campaignId: string;
  requestedBy: string;
  format: ReportExportArtifactFormat;
  report: NonNullable<Awaited<ReturnType<typeof buildCampaignSharedReport>>>;
  admin: ReturnType<typeof createAdminClient>;
}): Promise<ReportExportArtifactResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase URL or service role key for report export artifact smoke.");
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/generate-report`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({
      campaignId,
      requestedBy,
      format,
      report,
    }),
  });
  const payload = (await response.json().catch(() => null)) as EdgeReportExportResponse | null;

  if (!response.ok || !payload) {
    throw new Error(payload?.error ?? `Report export ${format} request failed.`);
  }

  if (
    payload.format !== format ||
    !payload.jobId ||
    !payload.fileName ||
    !payload.mimeType ||
    !payload.storagePath ||
    !payload.signedUrl
  ) {
    throw new Error(`Report export ${format} returned an invalid response.`);
  }

  const job = await checkedQuery(
    `Read ${format} report_export_jobs row`,
    admin
      .from("report_export_jobs")
      .select("id, format, status, storage_bucket, storage_path, file_name, mime_type")
      .eq("id", payload.jobId)
      .maybeSingle(),
  );

  if (
    job?.format !== format ||
    job.status !== "completed" ||
    job.storage_bucket !== "report-exports" ||
    job.storage_path !== payload.storagePath
  ) {
    throw new Error(`Report export ${format} did not persist a completed job row.`);
  }

  const { data: artifact, error: artifactError } = await admin.storage
    .from("report-exports")
    .download(payload.storagePath);
  if (artifactError || !artifact) {
    throw new Error(
      `Download ${format} report-exports artifact: ${artifactError?.message ?? "missing file"}`,
    );
  }

  const text = await artifact.text();
  assertArtifactContainsSourceProof(format, text);
  assertArtifactContainsConfiguredStory(format, text);

  return {
    jobId: payload.jobId,
    format,
    fileName: payload.fileName,
    mimeType: payload.mimeType,
    storagePath: payload.storagePath,
    byteLength: text.length,
  };
}

async function removeReportExportArtifacts(
  admin: ReturnType<typeof createAdminClient>,
  artifacts: ReportExportArtifactResult[],
) {
  const storagePaths = artifacts.map((artifact) => artifact.storagePath).filter(Boolean);
  const jobIds = artifacts.map((artifact) => artifact.jobId).filter(Boolean);

  if (storagePaths.length > 0) {
    const { error } = await admin.storage.from("report-exports").remove(storagePaths);
    if (error) throw new Error(`Clean report export artifacts: ${error.message}`);
  }

  if (jobIds.length > 0) {
    await checkedQuery(
      "Clean report export artifact jobs",
      admin.from("report_export_jobs").delete().in("id", jobIds),
    );
  }
}

async function runReportExportArtifactsSmoke() {
  await loadLocalEnv();

  const admin = createAdminClient();
  const callerWantedKeepData = process.env.SMOKE_KEEP_DATA === "1";
  const previousKeepData = process.env.SMOKE_KEEP_DATA;
  const previousManualSourceCampaignId =
    process.env.SMOKE_CONTENT_REPORT_MANUAL_SOURCE_CAMPAIGN_ID;
  const campaignId =
    process.env.SMOKE_REPORT_EXPORT_ARTIFACT_CAMPAIGN_ID ||
    DEFAULT_REPORT_EXPORT_ARTIFACT_CAMPAIGN_ID;
  const targets = buildContentReportManualSourceSmokeTargets({ campaignId });
  const artifacts: ReportExportArtifactResult[] = [];

  process.env.SMOKE_KEEP_DATA = "1";
  process.env.SMOKE_CONTENT_REPORT_MANUAL_SOURCE_CAMPAIGN_ID = campaignId;

  try {
    const manualSourceSmoke = await runContentReportManualSourceSmoke();
    await configureReportExportArtifactStory(admin, targets.campaignId);
    const report = await buildCampaignSharedReport(targets.campaignId);
    if (!report) {
      throw new Error("Report export artifact smoke could not build report data.");
    }

    assertArtifactContainsSourceProof("json", JSON.stringify(report));
    assertArtifactContainsConfiguredStory("json", JSON.stringify(report));

    const requestedBy = await getCampaignBrandId(admin, targets.campaignId);
    for (const format of REPORT_EXPORT_ARTIFACT_FORMATS) {
      artifacts.push(
        await requestReportExportArtifact({
          campaignId: targets.campaignId,
          requestedBy,
          format,
          report,
          admin,
        }),
      );
    }

    return {
      ok: true,
      campaignId: targets.campaignId,
      brandReportUrl: targets.brandReportUrl,
      formats: artifacts.map((artifact) => ({
        format: artifact.format,
        fileName: artifact.fileName,
        mimeType: artifact.mimeType,
        storagePath: artifact.storagePath,
        byteLength: artifact.byteLength,
      })),
      source: "Brand-reviewed proof",
      trust: "Data source",
      keptSmokeData: callerWantedKeepData,
      manualSourceSmoke,
    };
  } finally {
    if (previousKeepData === undefined) {
      delete process.env.SMOKE_KEEP_DATA;
    } else {
      process.env.SMOKE_KEEP_DATA = previousKeepData;
    }

    if (previousManualSourceCampaignId === undefined) {
      delete process.env.SMOKE_CONTENT_REPORT_MANUAL_SOURCE_CAMPAIGN_ID;
    } else {
      process.env.SMOKE_CONTENT_REPORT_MANUAL_SOURCE_CAMPAIGN_ID =
        previousManualSourceCampaignId;
    }

    if (!callerWantedKeepData) {
      await removeReportExportArtifacts(admin, artifacts);
      await cleanupApplicationFlowSmokeData(admin, targets.campaignId);
    }
  }
}

if (process.argv[1] && process.argv[1].endsWith("smoke-report-export-artifacts.ts")) {
  runReportExportArtifactsSmoke()
    .then((result) => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
