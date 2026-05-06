"use server";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  EVIDENCE_BUCKET_ID,
  buildEvidenceStoragePath,
  getEvidenceFileValidationError,
  getEvidenceStorageUri,
  getEvidenceTypeFromMime,
  sanitizeEvidenceFileName,
} from "@/lib/reporting/evidence-upload";
import { buildMetricValueRows } from "@/lib/reporting/metric-values";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ReportingPlatform } from "@/types/database";
import { getUser } from "./auth";

type ConfirmableReportingPlatform =
  | "instagram"
  | "tiktok"
  | "youtube"
  | "facebook"
  | "snapchat"
  | "x"
  | "generic";

type ExpectedMetric = {
  metricKey: string;
  metricLabel: string;
};

const uuidLike = z
  .string()
  .regex(
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/,
    "Invalid ID format",
  );

const reportingPlatformSchema = z.enum([
  "instagram",
  "tiktok",
  "youtube",
  "facebook",
  "snapchat",
  "x",
  "generic",
]);

const createPerformanceEvidenceUploadSchema = z.object({
  reportTaskId: uuidLike,
  submissionId: uuidLike.optional(),
  fileName: z.string().trim().min(1).max(220),
  mimeType: z.string().trim().min(1).max(120),
  sizeBytes: z.coerce.number().int().positive(),
});

const analyzePerformanceEvidenceSchema = z.object({
  evidenceId: uuidLike,
  reportTaskId: uuidLike,
  platform: reportingPlatformSchema,
  expectedMetrics: z
    .array(
      z.object({
        metricKey: z.string().trim().min(1).max(80),
        metricLabel: z.string().trim().min(1).max(120),
      }),
    )
    .max(40)
    .optional(),
});

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

function stripJsonFence(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
}

function parseGeminiMetricPayload(
  text: string,
  expectedMetrics: ExpectedMetric[],
): {
  metricValues: Array<{
    metricKey: string;
    metricLabel: string;
    metricValue?: number;
    metricText?: string;
    confidence?: number;
  }>;
  confidenceSummary: Record<string, unknown>;
} {
  let parsed: unknown;

  try {
    parsed = JSON.parse(stripJsonFence(text));
  } catch {
    return {
      metricValues: [],
      confidenceSummary: {
        overall: "low",
        note: "Gemini returned non-JSON output.",
      },
    };
  }

  const payload =
    parsed && typeof parsed === "object" && "metrics" in parsed
      ? (parsed as { metrics?: unknown; confidenceSummary?: unknown })
      : { metrics: parsed, confidenceSummary: undefined };

  const expectedLabels = new Map(
    expectedMetrics.map((metric) => [metric.metricKey, metric.metricLabel]),
  );
  const metrics = Array.isArray(payload.metrics) ? payload.metrics : [];

  const metricValues = metrics.flatMap((metric) => {
    if (!metric || typeof metric !== "object") return [];
    const record = metric as Record<string, unknown>;
    const metricKey =
      typeof record.metricKey === "string"
        ? record.metricKey
        : typeof record.metric_key === "string"
          ? record.metric_key
          : null;

    if (!metricKey) return [];

    const rawValue = record.metricValue ?? record.metric_value ?? record.value;
    const metricValue =
      typeof rawValue === "number"
        ? rawValue
        : typeof rawValue === "string" && rawValue.trim() !== ""
          ? Number(rawValue.replace(/,/g, ""))
          : undefined;
    const metricText =
      metricValue == null && typeof rawValue === "string" ? rawValue : undefined;
    const confidence =
      typeof record.confidence === "number" ? record.confidence : undefined;

    return [
      {
        metricKey,
        metricLabel:
          (typeof record.metricLabel === "string" && record.metricLabel) ||
          (typeof record.metric_label === "string" && record.metric_label) ||
          expectedLabels.get(metricKey) ||
          metricKey,
        metricValue: Number.isFinite(metricValue) ? metricValue : undefined,
        metricText,
        confidence,
      },
    ];
  });

  const confidenceSummary =
    payload.confidenceSummary && typeof payload.confidenceSummary === "object"
      ? (payload.confidenceSummary as Record<string, unknown>)
      : {
          overall:
            metricValues.length > 0
              ? Math.min(
                  ...metricValues.map((metric) => metric.confidence ?? 0.5),
                )
              : "low",
        };

  return { metricValues, confidenceSummary };
}

async function getEvidenceBlobParts(blob: Blob, mimeType: string) {
  const arrayBuffer = await blob.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (mimeType === "text/csv") {
    return {
      sha256: createHash("sha256").update(buffer).digest("hex"),
      parts: [
        {
          text: new TextDecoder().decode(buffer),
        },
      ],
    };
  }

  return {
    sha256: createHash("sha256").update(buffer).digest("hex"),
    parts: [
      {
        inline_data: {
          mime_type: mimeType,
          data: buffer.toString("base64"),
        },
      },
    ],
  };
}

export async function createPerformanceEvidenceUpload(input: {
  reportTaskId: string;
  submissionId?: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}) {
  const parsed = createPerformanceEvidenceUploadSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const validationError = getEvidenceFileValidationError({
    mimeType: parsed.data.mimeType,
    sizeBytes: parsed.data.sizeBytes,
  });
  if (validationError) throw new Error(validationError);

  const user = await getUser();
  const supabase = await createClient();

  const { data: task } = await supabase
    .from("campaign_report_tasks")
    .select("id, campaign_id, campaign_member_id, campaign_members(creator_id)")
    .eq("id", parsed.data.reportTaskId)
    .single();

  if (!task) throw new Error("Report task not found");

  const taskMember = firstRelation(
    task.campaign_members as { creator_id: string } | { creator_id: string }[] | null,
  );
  if (!taskMember || taskMember.creator_id !== user.id) {
    throw new Error("Not authorized");
  }

  if (parsed.data.submissionId) {
    const { data: submission } = await supabase
      .from("content_submissions")
      .select("id, campaign_member_id")
      .eq("id", parsed.data.submissionId)
      .single();

    if (!submission) throw new Error("Submission not found");
    if (submission.campaign_member_id !== task.campaign_member_id) {
      throw new Error("Not authorized");
    }
  }

  const evidenceId = randomUUID();
  const storagePath = buildEvidenceStoragePath({
    campaignId: task.campaign_id,
    campaignMemberId: task.campaign_member_id,
    reportTaskId: task.id,
    evidenceId,
    fileName: parsed.data.fileName,
  });

  const { data: evidence, error } = await supabase
    .from("content_performance_evidence")
    .insert({
      id: evidenceId,
      campaign_id: task.campaign_id,
      campaign_member_id: task.campaign_member_id,
      report_task_id: task.id,
      submission_id: parsed.data.submissionId ?? null,
      uploaded_by: user.id,
      evidence_type: getEvidenceTypeFromMime(parsed.data.mimeType),
      bucket_id: EVIDENCE_BUCKET_ID,
      storage_path: storagePath,
      file_name: sanitizeEvidenceFileName(parsed.data.fileName),
      mime_type: parsed.data.mimeType,
      size_bytes: parsed.data.sizeBytes,
      verification_status: "submitted",
    })
    .select("id, storage_path")
    .single();

  if (error) throw new Error(error.message);
  if (!evidence) throw new Error("Evidence upload could not be prepared");

  return {
    id: evidence.id,
    bucket: EVIDENCE_BUCKET_ID,
    storagePath: evidence.storage_path,
    storageUri: getEvidenceStorageUri(evidence.storage_path),
  };
}

export async function analyzePerformanceEvidence(input: {
  evidenceId: string;
  reportTaskId: string;
  platform: ConfirmableReportingPlatform;
  expectedMetrics?: ExpectedMetric[];
}) {
  const parsed = analyzePerformanceEvidenceSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);

  const user = await getUser();
  const supabase = await createClient();

  const { data: evidence } = await supabase
    .from("content_performance_evidence")
    .select("id, report_task_id, storage_path, mime_type, file_name")
    .eq("id", parsed.data.evidenceId)
    .eq("report_task_id", parsed.data.reportTaskId)
    .single();

  if (!evidence) throw new Error("Evidence not found");

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      status: "skipped" as const,
      reason: "GEMINI_API_KEY is not configured.",
      userId: user.id,
    };
  }

  const admin = createAdminClient();
  const { data: blob, error: downloadError } = await admin.storage.from(EVIDENCE_BUCKET_ID)
    .download(evidence.storage_path);

  if (downloadError) throw new Error(downloadError.message);
  if (!blob) throw new Error("Evidence file not found in Storage");

  const expectedMetrics = parsed.data.expectedMetrics ?? [];
  const blobParts = await getEvidenceBlobParts(blob, evidence.mime_type);
  const expectedMetricText =
    expectedMetrics.length > 0
      ? expectedMetrics
          .map((metric) => `${metric.metricKey}: ${metric.metricLabel}`)
          .join("\n")
      : "Use the platform analytics labels visible in the evidence.";

  const prompt = [
    "You are reading creator campaign analytics evidence for PopsDrops.",
    "Extract only metrics visible in the file.",
    "Return strict JSON with this shape:",
    "{\"metrics\":[{\"metricKey\":\"views\",\"metricLabel\":\"Views\",\"metricValue\":123,\"confidence\":0.9}],\"confidenceSummary\":{\"overall\":0.9,\"notes\":\"short note\"}}",
    `Platform: ${parsed.data.platform}`,
    `Expected metrics:\n${expectedMetricText}`,
    "If a metric is unclear or missing, omit it.",
  ].join("\n\n");

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }, ...blobParts.parts],
          },
        ],
        generationConfig: {
          response_mime_type: "application/json",
          temperature: 0,
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Gemini extraction failed with ${response.status}`);
  }

  const geminiPayload = (await response.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };
  const text =
    geminiPayload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text)
      .filter(Boolean)
      .join("\n") ?? "";
  const extraction = parseGeminiMetricPayload(text, expectedMetrics);

  const { data: extractionRow, error: insertError } = await admin
    .from("content_performance_ai_extractions")
    .insert({
      evidence_id: evidence.id,
      report_task_id: evidence.report_task_id,
      platform: parsed.data.platform as ReportingPlatform,
      model: "gemini-2.0-flash",
      input_sha256: blobParts.sha256,
      extracted_metrics: {
        metrics: extraction.metricValues,
        sourceFileName: evidence.file_name,
      },
      confidence_summary: extraction.confidenceSummary,
      status: "pending_confirmation",
    })
    .select("id")
    .single();

  if (insertError) throw new Error(insertError.message);

  return {
    status: "pending_confirmation" as const,
    extractionId: extractionRow?.id ?? null,
    metricValues: extraction.metricValues,
    userId: user.id,
  };
}

export async function confirmAiExtraction(input: {
  extractionId: string;
  performanceId: string;
  reportTaskId: string;
  platform: ConfirmableReportingPlatform;
  values: Array<{
    metricKey: string;
    metricLabel: string;
    metricValue?: number;
    metricText?: string;
  }>;
}) {
  const user = await getUser();
  const supabase = await createClient();

  const { data: extraction } = await supabase
    .from("content_performance_ai_extractions")
    .select("id, report_task_id, status")
    .eq("id", input.extractionId)
    .eq("report_task_id", input.reportTaskId)
    .single();

  if (!extraction) throw new Error("Extraction not found");
  if (extraction.status !== "pending_confirmation") {
    throw new Error("Extraction has already been resolved");
  }

  const rows = buildMetricValueRows({
    performanceId: input.performanceId,
    reportTaskId: input.reportTaskId,
    platform: input.platform,
    metricValues: input.values,
    sourceType: "creator_confirmed",
    confirmedByCreator: true,
  });

  const { error: upsertError } = await supabase
    .from("content_performance_metric_values")
    .upsert(rows, { onConflict: "performance_id,metric_key" });

  if (upsertError) throw new Error(upsertError.message);

  const { error: updateError } = await supabase
    .from("content_performance_ai_extractions")
    .update({
      status: "accepted_by_creator",
    })
    .eq("id", extraction.id);

  if (updateError) throw new Error(updateError.message);

  const { data: task } = await supabase
    .from("campaign_report_tasks")
    .select("campaign_id")
    .eq("id", input.reportTaskId)
    .single();

  if (task?.campaign_id) {
    revalidatePath(`/i/campaigns/${task.campaign_id}`);
    revalidatePath(`/b/campaigns/${task.campaign_id}`);
    revalidatePath(`/b/campaigns/${task.campaign_id}/report`);
  }

  return { ok: true, userId: user.id };
}
