"use client";

import { useState, useTransition } from "react";
import { Info, CheckCircle2, AlertCircle, Upload, FileCheck2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PlatformIcon } from "@/components/platform-icons";
import {
  PLATFORM_METRICS,
  PLATFORM_METRIC_NOTES,
  type MetricField,
} from "@/lib/platform-metrics";
import { PLATFORM_LABELS, type Platform } from "@/lib/constants";
import { submitPerformance } from "@/app/actions/content";
import {
  analyzePerformanceEvidence,
  createPerformanceEvidenceUpload,
} from "@/app/actions/reporting-evidence";
import { createClient } from "@/lib/supabase/client";
import { getEvidenceFileValidationError } from "@/lib/reporting/evidence-upload";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PerformanceFormProps {
  submissionId: string;
  reportTaskId?: string;
  reportTaskDueAt?: string | null;
  reportTaskStatus?: string | null;
  isSubmitted?: boolean;
  platform: Platform;
  measurementType: "initial_48h" | "final_7d" | "extended_30d";
  onSuccess?: () => void;
}

const MEASUREMENT_LABELS: Record<string, string> = {
  initial_48h: "48-Hour Report",
  final_7d: "7-Day Report",
  extended_30d: "30-Day Report",
};

const SUBMITTED_REPORT_STATUSES = new Set([
  "submitted",
  "submitted_late",
  "verified",
]);

function formatDueDate(value: string | null | undefined): string | null {
  if (!value) return null;
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PerformanceForm({
  submissionId,
  reportTaskId,
  reportTaskDueAt,
  reportTaskStatus,
  isSubmitted = false,
  platform,
  measurementType,
  onSuccess,
}: PerformanceFormProps) {
  const metrics = PLATFORM_METRICS[platform];
  const note = PLATFORM_METRIC_NOTES[platform];
  const Icon = PlatformIcon[platform];

  const [values, setValues] = useState<Record<string, string>>({});
  const [evidenceUpload, setEvidenceUpload] = useState<Awaited<
    ReturnType<typeof createPerformanceEvidenceUpload>
  > | null>(null);
  const [evidenceFileName, setEvidenceFileName] = useState("");
  const [evidenceStatus, setEvidenceStatus] = useState<
    "idle" | "uploading" | "analyzing" | "ready"
  >("idle");
  const [evidenceNote, setEvidenceNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();
  const dueDate = formatDueDate(reportTaskDueAt);
  const alreadySubmitted =
    isSubmitted ||
    (reportTaskStatus != null && SUBMITTED_REPORT_STATUSES.has(reportTaskStatus));

  function updateValue(key: string, val: string) {
    setValues((prev) => ({ ...prev, [key]: val }));
  }

  function parseMetricValue(field: MetricField, raw: string): number | undefined {
    if (!raw || raw.trim() === "") return undefined;
    const n = Number(raw);
    if (isNaN(n)) return undefined;
    if (field.type === "percentage") return Math.min(100, Math.max(0, n));
    if (field.type === "integer") return Math.max(0, Math.floor(n));
    return Math.max(0, n);
  }

  async function handleEvidenceFile(file: File | null) {
    setError(null);
    setEvidenceUpload(null);
    setEvidenceNote(null);
    setEvidenceFileName(file?.name ?? "");
    setEvidenceStatus("idle");

    if (!file) return;

    if (!reportTaskId) {
      setError("This report is not ready for evidence upload.");
      return;
    }

    const validationError = getEvidenceFileValidationError({
      mimeType: file.type,
      sizeBytes: file.size,
    });

    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setEvidenceStatus("uploading");
      const evidenceUpload = await createPerformanceEvidenceUpload({
        reportTaskId,
        submissionId,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      });
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage.from(evidenceUpload.bucket)
        .upload(evidenceUpload.storagePath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) throw new Error(uploadError.message);

      setEvidenceUpload(evidenceUpload);
      setEvidenceStatus("analyzing");

      try {
        const extraction = await analyzePerformanceEvidence({
          evidenceId: evidenceUpload.id,
          reportTaskId,
          platform,
          expectedMetrics: metrics.map((metric) => ({
            metricKey: metric.key,
            metricLabel: metric.label,
          })),
        });

        if (extraction.status === "pending_confirmation") {
          setValues((previous) => {
            const next = { ...previous };

            for (const metric of extraction.metricValues) {
              if (metric.metricValue == null) continue;
              if (!metrics.some((field) => field.key === metric.metricKey)) continue;
              if (next[metric.metricKey]?.trim()) continue;
              next[metric.metricKey] = String(metric.metricValue);
            }

            return next;
          });
          setEvidenceNote("Evidence read. Review the numbers before submitting.");
        } else {
          setEvidenceNote("Evidence uploaded. Enter the numbers manually.");
        }
      } catch {
        setEvidenceNote("Evidence uploaded. Enter the numbers manually.");
      }

      setEvidenceStatus("ready");
    } catch (e) {
      setEvidenceStatus("idle");
      setError(e instanceof Error ? e.message : "Evidence upload failed");
    }
  }

  function handleSubmit() {
    setError(null);

    // Validate required fields
    const missing = metrics
      .filter((m) => m.required && (!values[m.key] || values[m.key].trim() === ""))
      .map((m) => m.label);

    if (missing.length > 0) {
      setError(`Required: ${missing.join(", ")}`);
      return;
    }

    if (!evidenceUpload) {
      setError("Upload analytics evidence first");
      return;
    }

    // Build the payload
    const payload: Record<string, unknown> = {
      submission_id: submissionId,
      report_task_id: reportTaskId,
      evidence_id: evidenceUpload.id,
      measurement_type: measurementType,
    };

    for (const field of metrics) {
      const val = parseMetricValue(field, values[field.key] || "");
      if (val !== undefined) {
        payload[field.key] = val;
      }
    }

    payload.metric_values = metrics
      .map((field) => {
        const val = parseMetricValue(field, values[field.key] || "");
        if (val === undefined) return null;
        return {
          platform,
          metricKey: field.key,
          metricLabel: field.label,
          metricValue: val,
        };
      })
      .filter(Boolean);

    startTransition(async () => {
      try {
        await submitPerformance(payload as Parameters<typeof submitPerformance>[0]);
        setSuccess(true);
        onSuccess?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to submit");
      }
    });
  }

  if (success || alreadySubmitted) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <CheckCircle2 className="mx-auto mb-3 size-8 text-emerald-500" />
          <p className="text-sm font-medium text-foreground">
            {MEASUREMENT_LABELS[measurementType]} submitted
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Performance data has been recorded for this content.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Platform header */}
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-lg bg-muted">
          <Icon className="size-4 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">
            {PLATFORM_LABELS[platform]} - {MEASUREMENT_LABELS[measurementType]}
          </p>
          <p className="text-xs text-muted-foreground">
            {dueDate
              ? `Report due ${dueDate}`
              : `Enter metrics from your ${PLATFORM_LABELS[platform]} analytics`}
          </p>
        </div>
      </div>

      {/* Platform-specific note */}
      <div className="flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2.5 ring-1 ring-ring/[0.04]">
        <Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/70" />
        <p className="text-xs leading-relaxed text-muted-foreground">{note}</p>
      </div>

      {/* Metric fields */}
      <div className="space-y-3">
        {metrics.map((field) => (
          <div key={field.key}>
            <label className="mb-1 flex items-center gap-1 text-sm font-medium text-foreground">
              {field.label}
              {field.required && (
                <span className="text-xs text-red-400">*</span>
              )}
              {field.type === "percentage" && (
                <span className="text-xs font-normal text-muted-foreground/70">(%)</span>
              )}
              {field.key === "avg_watch_time_seconds" && (
                <span className="text-xs font-normal text-muted-foreground/70">(seconds)</span>
              )}
            </label>
            <input
              type="number"
              min="0"
              max={field.type === "percentage" ? 100 : undefined}
              step={field.type === "integer" ? 1 : 0.1}
              placeholder={field.description}
              value={values[field.key] || ""}
              onChange={(e) => updateValue(field.key, e.target.value)}
              className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
          </div>
        ))}
      </div>

      {/* Evidence proof */}
      <div>
        <label className="mb-1 flex items-center gap-1 text-sm font-medium text-foreground">
          Analytics Evidence
          <span className="text-xs text-red-400">*</span>
        </label>
        <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground transition hover:border-slate-300">
          <span className="flex min-w-0 items-center gap-2">
            {evidenceUpload ? (
              <FileCheck2 className="size-4 shrink-0 text-emerald-600" />
            ) : (
              <Upload className="size-4 shrink-0 text-muted-foreground" />
            )}
            <span className="truncate">
              {evidenceFileName || "Choose analytics file"}
            </span>
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {evidenceStatus === "uploading"
              ? "Uploading"
              : evidenceStatus === "analyzing"
                ? "Reading"
                : evidenceUpload
                  ? "Ready"
                  : "PNG, JPG, WEBP, PDF, CSV"}
          </span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,application/pdf,text/csv"
            className="sr-only"
            onChange={(event) => {
              void handleEvidenceFile(event.target.files?.[0] ?? null);
            }}
          />
        </label>
        {evidenceNote && (
          <p className="mt-1 text-[11px] text-muted-foreground/70">
            {evidenceNote}
          </p>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
          <AlertCircle className="size-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Submit */}
      <Button
        onClick={handleSubmit}
        disabled={
          isPending ||
          evidenceStatus === "uploading" ||
          evidenceStatus === "analyzing"
        }
        className="w-full"
      >
        {isPending ? "Submitting..." : `Submit ${MEASUREMENT_LABELS[measurementType]}`}
      </Button>
    </div>
  );
}
