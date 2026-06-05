import { z } from "npm:zod@4.3.6";
import { createAdminClient, requireServiceRole } from "../_shared/auth.ts";
import { corsHeaders, json, methodNotAllowed } from "../_shared/json.ts";
import { REPORT_EXPORT_CONTRACT_VERSION } from "../_shared/report-export-contract.ts";
import {
  buildCsvContent,
  buildHtmlDocument,
  buildJsonContent,
  buildReportFilename,
  type ReportExportData,
} from "../_shared/report-export.ts";

const REPORT_EXPORT_BUCKET = "report-exports";

const uuidLike = z
  .string()
  .regex(
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
    "Invalid ID format",
  );

const metricPointSchema = z.object({
  date: z.string().trim().min(1).max(40),
  label: z.string().trim().min(1).max(120),
  value: z.number().finite(),
});

const metricSchema = z.object({
  key: z.string().trim().min(1).max(80).optional(),
  label: z.string().trim().min(1).max(120),
  value: z.string().trim().min(1).max(120),
  detail: z.string().trim().min(1).max(160),
  points: z.array(metricPointSchema).max(90),
});

const proofReviewSchema = z.object({
  label: z.string().trim().min(1).max(120),
  value: z.string().trim().regex(/^Reviewed \d{4}\/\d{2}\/\d{2}$/),
  detail: z.string().trim().min(1).max(160),
  reviewedAt: z.string().trim().min(1).max(80),
  reviewerRecorded: z.boolean(),
});

const reportStorySchema = z.object({
  decisionRead: z.string().trim().min(1).max(320),
  evidenceTrail: z.string().trim().min(1).max(320),
  trustDecision: z.string().trim().min(1).max(320),
  nextAction: z.string().trim().min(1).max(320),
  proofReview: proofReviewSchema.optional(),
});

const leadershipProofBasisItemSchema = z.object({
  key: z.enum(["included", "needs-review", "corrections", "missing-proof"]),
  label: z.string().trim().min(1).max(80),
  value: z.number().int().nonnegative().max(100000),
});

const leadershipHandoffSchema = z.object({
  state: z.enum(["ready", "hold"]),
  label: z.string().trim().min(1).max(120),
  decision: z.string().trim().min(1).max(320),
  proofBasis: z.array(leadershipProofBasisItemSchema).max(8),
});

const proofOperationsSchema = z.object({
  scope: z.enum(["single", "scale"]),
  state: z.enum(["ready", "hold"]),
  label: z.string().trim().min(1).max(120),
  decision: z.string().trim().min(1).max(320),
  verifiedCoverage: z.string().trim().regex(/^\d+\/\d+$/),
  attentionCount: z.number().int().nonnegative().max(100000),
  proofBasis: z.array(leadershipProofBasisItemSchema).max(8),
});

const reportSchema = z.object({
  campaignTitle: z.string().trim().min(1).max(180),
  dateRange: z.string().trim().min(1).max(120),
  generatedAt: z.string().trim().min(1).max(80),
  campaignImageAlt: z.string().trim().min(1).max(180).nullable().optional(),
  campaignImageUrl: z.string().trim().url().max(5000).nullable().optional(),
  composition: z
    .object({
      reportTitle: z.string().trim().min(1).max(180).optional(),
      presetId: z.string().trim().min(1).max(80),
      presetTitle: z.string().trim().min(1).max(120),
      presetDetail: z.string().trim().min(1).max(220),
      bestFor: z.string().trim().min(1).max(220).optional(),
      executiveQuestion: z.string().trim().min(1).max(260).optional(),
      chartModeId: z.string().trim().min(1).max(80),
      chartModeTitle: z.string().trim().min(1).max(120),
      chartModeDetail: z.string().trim().min(1).max(220),
      chartLayoutTitle: z.string().trim().min(1).max(120),
      chartLayoutDetail: z.string().trim().min(1).max(260),
      templateId: uuidLike.nullable().optional(),
      templateName: z.string().trim().min(1).max(120).nullable().optional(),
      templateDescription: z.string().trim().max(220).nullable().optional(),
      presentation: z
        .object({
          coverMode: z.enum(["campaign_visual", "proof_room"]).optional(),
          typography: z.enum(["quiet", "compact"]).optional(),
          density: z.enum(["editorial", "compact"]).optional(),
          chartMetricKey: z.enum(["views", "engagements", "engagementRate", "cpe"]).nullable().optional(),
          headline: z.string().trim().min(1).max(120).optional(),
          executiveQuestion: z.string().trim().min(1).max(220).optional(),
          kpiIds: z.array(z.string().trim().min(1).max(80)).max(24).nullable().optional(),
          trustIds: z.array(z.string().trim().min(1).max(80)).max(24).nullable().optional(),
          kpiLabels: z.record(z.string(), z.string().trim().min(1).max(80)).nullable().optional(),
          trustLabels: z.record(z.string(), z.string().trim().min(1).max(80)).nullable().optional(),
          sectionLabels: z.record(z.string(), z.string().trim().min(1).max(80)).nullable().optional(),
        })
        .optional(),
    })
    .optional(),
  blocks: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(80),
        title: z.string().trim().min(1).max(120),
        detail: z.string().trim().min(1).max(180),
        executivePurpose: z.string().trim().min(1).max(260).optional(),
      }),
    )
    .max(12)
    .optional(),
  proofReview: proofReviewSchema.nullable().optional(),
  kpis: z
    .array(
      z.object({
        key: z.string().trim().min(1).max(80).optional(),
        label: z.string().trim().min(1).max(120),
        value: z.string().trim().min(1).max(120),
        detail: z.string().trim().max(160).optional(),
      }),
    )
    .max(24),
  trust: z
    .array(
      z.object({
        key: z.string().trim().min(1).max(80).optional(),
        label: z.string().trim().min(1).max(120),
        value: z.string().trim().min(1).max(120),
        detail: z.string().trim().min(1).max(160),
      }),
    )
    .max(24),
  story: reportStorySchema.optional(),
  leadershipHandoff: leadershipHandoffSchema.optional(),
  proofOperations: proofOperationsSchema.optional(),
  recommendations: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(120),
        value: z.string().trim().min(1).max(160),
        detail: z.string().trim().min(1).max(220),
      }),
    )
    .max(6),
  sections: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(120),
        detail: z.string().trim().min(1).max(160),
        sourceGroup: z.enum(["campaign_channel", "proof_source"]).optional(),
        metrics: z.array(metricSchema).max(12),
      }),
    )
    .max(20),
  creators: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(160),
        market: z.string().trim().min(1).max(120),
        platform: z.string().trim().min(1).max(80),
        views: z.string().trim().min(1).max(80),
        engagements: z.string().trim().min(1).max(80),
        er: z.string().trim().min(1).max(80),
        cpe: z.string().trim().min(1).max(80),
        spent: z.string().trim().min(1).max(80),
        rating: z.string().trim().min(1).max(80),
      }),
    )
    .max(500),
});

const requestSchema = z.object({
  campaignId: uuidLike,
  requestedBy: uuidLike,
  format: z.enum(["json", "csv", "html"]),
  report: reportSchema,
});

const formatConfig = {
  json: {
    extension: "json",
    mimeType: "application/json; charset=utf-8",
    build: buildJsonContent,
  },
  csv: {
    extension: "csv",
    mimeType: "text/csv; charset=utf-8",
    build: buildCsvContent,
  },
  html: {
    extension: "html",
    mimeType: "text/html; charset=utf-8",
    build: buildHtmlDocument,
  },
} satisfies Record<
  z.infer<typeof requestSchema>["format"],
  {
    extension: string;
    mimeType: string;
    build: (report: ReportExportData) => string;
  }
>;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method === "GET") {
    try {
      requireServiceRole(req);
      return json({ contractVersion: REPORT_EXPORT_CONTRACT_VERSION });
    } catch {
      return json({ error: "Report export service is not authorized." }, { status: 401 });
    }
  }

  if (req.method !== "POST") {
    return methodNotAllowed();
  }

  try {
    requireServiceRole(req);

    const parsed = requestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return json(
        { error: "Invalid report export request", issues: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const admin = createAdminClient();
    const { campaignId, requestedBy, format, report } = parsed.data;
    const jobId = crypto.randomUUID();
    const config = formatConfig[format];
    const fileName = buildReportFilename(
      report.composition?.reportTitle ?? report.campaignTitle,
      config.extension,
    );
    const storagePath = `${campaignId}/${jobId}/${fileName}`;
    const content = config.build(report as ReportExportData);
    const artifact = new Blob([content], { type: config.mimeType });

    const { error: uploadError } = await admin.storage
      .from(REPORT_EXPORT_BUCKET)
      .upload(storagePath, artifact, {
        contentType: config.mimeType,
        upsert: false,
      });

    if (uploadError) {
      await admin.from("report_export_jobs").insert({
        id: jobId,
        campaign_id: campaignId,
        requested_by: requestedBy,
        format,
        status: "failed",
        storage_bucket: REPORT_EXPORT_BUCKET,
        storage_path: storagePath,
        file_name: fileName,
        mime_type: config.mimeType,
        error_message: uploadError.message,
      });

      return json({ error: uploadError.message }, { status: 500 });
    }

    const { data: signed, error: signedUrlError } = await admin.storage
      .from(REPORT_EXPORT_BUCKET)
      .createSignedUrl(storagePath, 600, {
        download: fileName,
      });

    if (signedUrlError || !signed?.signedUrl) {
      await admin.from("report_export_jobs").insert({
        id: jobId,
        campaign_id: campaignId,
        requested_by: requestedBy,
        format,
        status: "failed",
        storage_bucket: REPORT_EXPORT_BUCKET,
        storage_path: storagePath,
        file_name: fileName,
        mime_type: config.mimeType,
        error_message: signedUrlError?.message ?? "Signed URL could not be created.",
      });

      return json(
        { error: signedUrlError?.message ?? "Signed URL could not be created." },
        { status: 500 },
      );
    }

    const { error: insertError } = await admin.from("report_export_jobs").insert({
      id: jobId,
      campaign_id: campaignId,
      requested_by: requestedBy,
      format,
      status: "completed",
      storage_bucket: REPORT_EXPORT_BUCKET,
      storage_path: storagePath,
      file_name: fileName,
      mime_type: config.mimeType,
      completed_at: new Date().toISOString(),
    });

    if (insertError) {
      return json({ error: insertError.message }, { status: 500 });
    }

    return json({
      jobId,
      format,
      fileName,
      mimeType: config.mimeType,
      storagePath,
      signedUrl: signed.signedUrl,
      contractVersion: REPORT_EXPORT_CONTRACT_VERSION,
    });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Report export failed." },
      { status: 401 },
    );
  }
});
