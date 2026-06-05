import { z } from "npm:zod@4.3.6";
import { createAdminClient, requireUser } from "../_shared/auth.ts";
import { corsHeaders, json, methodNotAllowed } from "../_shared/json.ts";
import { parseStructuredCsvMetricPayload } from "../_shared/performance-evidence.ts";

type ExpectedMetric = {
  metricKey: string;
  metricLabel: string;
};

type GeminiPart =
  | { text: string }
  | {
      inline_data: {
        mime_type: string;
        data: string;
      };
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

const requestSchema = z.object({
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
              ? Math.min(...metricValues.map((metric) => metric.confidence ?? 0.5))
              : "low",
        };

  return { metricValues, confidenceSummary };
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;

  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function bytesToHex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function getEvidenceBlobParts(blob: Blob, mimeType: string) {
  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const hash = await crypto.subtle.digest("SHA-256", arrayBuffer);

  if (mimeType === "text/csv") {
    return {
      sha256: bytesToHex(hash),
      parts: [
        {
          text: new TextDecoder().decode(bytes),
        },
      ] satisfies GeminiPart[],
    };
  }

  return {
    sha256: bytesToHex(hash),
    parts: [
      {
        inline_data: {
          mime_type: mimeType,
          data: bytesToBase64(bytes),
        },
      },
    ] satisfies GeminiPart[],
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return methodNotAllowed();
  }

  let userId: string | null = null;

  try {
    const { client, user } = await requireUser(req);
    userId = user.id;
    const parsed = requestSchema.safeParse(await req.json());

    if (!parsed.success) {
      return json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request" },
        { status: 400 },
      );
    }

    const { data: evidence, error: evidenceError } = await client
      .from("content_performance_evidence")
      .select("id, report_task_id, bucket_id, storage_path, mime_type, file_name")
      .eq("id", parsed.data.evidenceId)
      .eq("report_task_id", parsed.data.reportTaskId)
      .single();

    if (evidenceError || !evidence) {
      return json({ error: "Evidence not found" }, { status: 404 });
    }

    const admin = createAdminClient();
    const evidenceBucket = admin.storage.from(evidence.bucket_id);
    const { data: blob, error: downloadError } =
      await evidenceBucket.download(evidence.storage_path);

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

    if (evidence.mime_type === "text/csv") {
      const csvText = blobParts.parts
        .flatMap((part) => ("text" in part ? [part.text] : []))
        .join("\n");
      const structuredCsvExtraction = parseStructuredCsvMetricPayload(
        csvText,
        expectedMetrics,
      );

      if (structuredCsvExtraction.metricValues.length > 0) {
        const { data: extractionRow, error: insertError } = await admin
          .from("content_performance_ai_extractions")
          .insert({
            evidence_id: evidence.id,
            report_task_id: evidence.report_task_id,
            platform: parsed.data.platform,
            model: "structured-csv",
            input_sha256: blobParts.sha256,
            extracted_metrics: {
              metrics: structuredCsvExtraction.metricValues,
              sourceFileName: evidence.file_name,
            },
            confidence_summary: structuredCsvExtraction.confidenceSummary,
            status: "pending_confirmation",
          })
          .select("id")
          .single();

        if (insertError) throw new Error(insertError.message);

        return json({
          status: "pending_confirmation",
          extractionId: extractionRow?.id ?? null,
          metricValues: structuredCsvExtraction.metricValues,
          userId,
        });
      }
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return json({
        status: "skipped",
        reason: "GEMINI_API_KEY is not configured.",
        userId,
      });
    }

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

    if (extraction.metricValues.length === 0) {
      return json({
        status: "manual_required",
        reason: "Evidence extraction returned no visible metrics.",
        extractionId: null,
        metricValues: [],
        userId,
      });
    }

    const { data: extractionRow, error: insertError } = await admin
      .from("content_performance_ai_extractions")
      .insert({
        evidence_id: evidence.id,
        report_task_id: evidence.report_task_id,
        platform: parsed.data.platform,
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

    return json({
      status: "pending_confirmation",
      extractionId: extractionRow?.id ?? null,
      metricValues: extraction.metricValues,
      userId,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Extraction failed";
    const status = message === "Unauthorized" ? 401 : 500;

    return json(
      {
        error: message,
        userId,
      },
      { status },
    );
  }
});
