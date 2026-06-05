"use client";

import { useState, useTransition } from "react";
import { Info, CheckCircle2, AlertCircle, Upload, FileCheck2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PlatformIcon } from "@/components/platform-icons";
import {
  PLATFORM_METRIC_NOTES,
  getPlatformMetricFields,
  type MetricField,
} from "@/lib/platform-metrics";
import {
  getReportingPlatformLabel,
  type ReportingPlatform,
} from "@/lib/reporting/platform-templates";
import { submitPerformance } from "@/app/actions/content";
import {
  analyzePerformanceEvidence,
  createPerformanceEvidenceUpload,
} from "@/app/actions/reporting-evidence";
import { createClient } from "@/lib/supabase/client";
import { useI18n, useTranslation } from "@/lib/i18n";
import { getEvidenceFileValidationError } from "@/lib/reporting/evidence-upload";
import type { CreatorReportGoalContext } from "@/lib/reporting/creator-report-goal-context";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PerformanceFormProps {
  submissionId: string;
  reportTaskId?: string;
  reportTaskDueAt?: string | null;
  reportTaskStatus?: string | null;
  isSubmitted?: boolean;
  platform: ReportingPlatform;
  platformLabel?: string | null;
  requiredMetricKeys?: string[];
  additionalMetricGroups?: Array<{
    platform: ReportingPlatform;
    platformLabel?: string | null;
    requiredMetricKeys?: string[];
  }>;
  reportGoalContext?: CreatorReportGoalContext | null;
  measurementType: "initial_48h" | "final_7d" | "extended_30d";
  onSuccess?: () => void;
}

type MetricSourceState = {
  source: "ai" | "manual";
  confidence?: number;
};

const MEASUREMENT_LABEL_KEYS: Record<string, string> = {
  initial_48h: "measurement.initial48h",
  final_7d: "measurement.final7d",
  extended_30d: "measurement.extended30d",
};

const SUBMITTED_REPORT_STATUSES = new Set([
  "submitted",
  "submitted_late",
  "verified",
]);

function formatDueDate(value: string | null | undefined, locale: string): string | null {
  if (!value) return null;
  return new Intl.DateTimeFormat(locale, {
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
  platformLabel: primaryPlatformLabel,
  requiredMetricKeys,
  additionalMetricGroups = [],
  reportGoalContext,
  measurementType,
  onSuccess,
}: PerformanceFormProps) {
  const { locale } = useI18n();
  const { t } = useTranslation("creator.performance");
  const metricGroups = [
    {
      platform,
      platformLabel: primaryPlatformLabel,
      metrics: getPlatformMetricFields(platform, requiredMetricKeys),
    },
    ...additionalMetricGroups.map((group) => ({
      platform: group.platform,
      platformLabel: group.platformLabel,
      metrics: getPlatformMetricFields(group.platform, group.requiredMetricKeys),
    })),
  ];
  const metrics = metricGroups.flatMap((group) =>
    group.metrics.map((metric) => ({ ...metric, platform: group.platform })),
  );
  const note = PLATFORM_METRIC_NOTES[platform];
  const Icon = PlatformIcon[platform];
  const platformLabel =
    primaryPlatformLabel?.trim() || getReportingPlatformLabel(platform);
  const measurementLabel = t(MEASUREMENT_LABEL_KEYS[measurementType] ?? "measurement.final7d");

  const [values, setValues] = useState<Record<string, string>>({});
  const [evidenceUpload, setEvidenceUpload] = useState<Awaited<
    ReturnType<typeof createPerformanceEvidenceUpload>
  > | null>(null);
  const [aiExtractionId, setAiExtractionId] = useState<string | null>(null);
  const [metricSourceByKey, setMetricSourceByKey] = useState<
    Record<string, MetricSourceState>
  >({});
  const [evidenceFileName, setEvidenceFileName] = useState("");
  const [evidenceStatus, setEvidenceStatus] = useState<
    "idle" | "uploading" | "analyzing" | "ready"
  >("idle");
  const [evidenceNote, setEvidenceNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();
  const dueDate = formatDueDate(reportTaskDueAt, locale);
  const alreadySubmitted =
    isSubmitted ||
    (reportTaskStatus != null && SUBMITTED_REPORT_STATUSES.has(reportTaskStatus));
  const isCorrectionResubmission = reportTaskStatus === "needs_revision";
  const reportingSteps = [
    {
      label: t("steps.proof"),
      active: !evidenceUpload,
      done: Boolean(evidenceUpload),
    },
    {
      label: t("steps.metrics"),
      active: Boolean(evidenceUpload),
      done: metrics.every(
        (field) => !field.required || values[getMetricInputKey(field.platform, field.key)]?.trim(),
      ),
    },
    {
      label: t("steps.submit"),
      active: Boolean(evidenceUpload),
      done: success || alreadySubmitted,
    },
  ];
  const evidenceStatusLabel =
    evidenceStatus === "uploading"
      ? t("proof.status.uploading")
      : evidenceStatus === "analyzing"
        ? t("proof.status.reading")
        : evidenceUpload
          ? t("proof.status.ready")
          : t("proof.status.allowed");
  const hasAiSuggestions = Object.values(metricSourceByKey).some(
    (metricSource) => metricSource.source === "ai",
  );
  const hasConfirmedValues = Object.keys(values).some((key) =>
    values[key]?.trim(),
  );
  const reportGoalTitle = reportGoalContext
    ? t(reportGoalContext.titleKey)
    : "";
  const reportGoalBlocks = reportGoalContext?.blockLabelKeys
    .map((key) => t(key))
    .join(", ");

  function sanitizeMetricInput(field: MetricField, raw: string) {
    if (field.type === "text") {
      return raw.slice(0, 500);
    }

    const numeric = raw.replace(/[^\d.]/g, "");

    if (field.type === "integer") {
      return numeric.replace(/\D/g, "");
    }

    const [whole, ...decimalParts] = numeric.split(".");
    if (decimalParts.length === 0) return whole;
    return `${whole}.${decimalParts.join("")}`;
  }

  function getMetricInputKey(groupPlatform: ReportingPlatform, metricKey: string) {
    return `${groupPlatform}:${metricKey}`;
  }

  function updateValue(
    field: MetricField & { platform: ReportingPlatform },
    val: string,
  ) {
    const nextValue = sanitizeMetricInput(field, val);
    const valueKey = getMetricInputKey(field.platform, field.key);
    setValues((prev) => ({
      ...prev,
      [valueKey]: nextValue,
    }));
    setMetricSourceByKey((prev) => ({
      ...prev,
      [valueKey]: {
        source: "manual",
      },
    }));
  }

  function parseMetricInput(
    field: MetricField,
    raw: string,
  ): { metricValue?: number; metricText?: string } | undefined {
    const trimmed = raw.trim();
    if (!trimmed) return undefined;
    if (field.type === "text") return { metricText: trimmed };

    const n = Number(trimmed);
    if (isNaN(n)) return undefined;
    if (field.type === "percentage") {
      return { metricValue: Math.min(100, Math.max(0, n)) };
    }
    if (field.type === "integer") {
      return { metricValue: Math.max(0, Math.floor(n)) };
    }
    return { metricValue: Math.max(0, n) };
  }

  async function handleEvidenceFile(file: File | null) {
    setError(null);
    setValues({});
    setEvidenceUpload(null);
    setAiExtractionId(null);
    setMetricSourceByKey({});
    setEvidenceNote(null);
    setEvidenceFileName(file?.name ?? "");
    setEvidenceStatus("idle");

    if (!file) return;

    if (!reportTaskId) {
      setError(t("error.notReady"));
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
          setAiExtractionId(extraction.extractionId);
          const nextValues: Record<string, string> = {};
          const nextMetricSources: Record<string, MetricSourceState> = {};

          for (const metric of extraction.metricValues) {
            const extractedValue =
              metric.metricValue != null
                ? String(metric.metricValue)
                : metric.metricText?.trim();
            if (!extractedValue) continue;

            const matchingFields = metrics.filter(
              (field) => field.key === metric.metricKey,
            );
            if (matchingFields.length !== 1) {
              continue;
            }

            const field = matchingFields[0];
            const valueKey = getMetricInputKey(field.platform, field.key);
            nextValues[valueKey] = sanitizeMetricInput(field, extractedValue);
            nextMetricSources[valueKey] = {
              source: "ai",
              confidence: metric.confidence,
            };
          }

          setValues(nextValues);
          setMetricSourceByKey(nextMetricSources);
          setEvidenceNote(t("proof.read"));
        } else {
          setAiExtractionId(null);
          setMetricSourceByKey({});
          setEvidenceNote(t("proof.manual"));
        }
      } catch {
        setAiExtractionId(null);
        setMetricSourceByKey({});
        setEvidenceNote(t("proof.manual"));
      }

      setEvidenceStatus("ready");
    } catch (e) {
      setEvidenceStatus("idle");
      setError(e instanceof Error ? e.message : t("error.uploadFailed"));
    }
  }

  function handleSubmit() {
    setError(null);

    if (!evidenceUpload) {
      setError(t("error.proofRequired"));
      return;
    }

    // Validate required fields
    const missing = metrics
      .filter((m) => {
        const valueKey = getMetricInputKey(m.platform, m.key);
        return m.required && (!values[valueKey] || values[valueKey].trim() === "");
      })
      .map((m) => m.label);

    if (missing.length > 0) {
      setError(t("error.requiredFields", { fields: missing.join(", ") }));
      return;
    }

    const aiExtractionEdited = Boolean(aiExtractionId) && metrics.some((field) => {
      const valueKey = getMetricInputKey(field.platform, field.key);
      const parsedMetric = parseMetricInput(field, values[valueKey] || "");
      return (
        parsedMetric !== undefined &&
        metricSourceByKey[valueKey]?.source === "manual"
      );
    });

    // Build the payload
    const payload: Record<string, unknown> = {
      submission_id: submissionId,
      report_task_id: reportTaskId,
      evidence_id: evidenceUpload.id,
      ai_extraction_id: aiExtractionId || undefined,
      ai_extraction_edited: aiExtractionEdited,
      measurement_type: measurementType,
    };

    for (const field of metrics) {
      const valueKey = getMetricInputKey(field.platform, field.key);
      const parsedMetric = parseMetricInput(field, values[valueKey] || "");
      if (parsedMetric?.metricValue != null && field.platform === platform) {
        payload[field.key] = parsedMetric.metricValue;
      }
    }

    payload.metric_values = metrics
      .map((field) => {
        const valueKey = getMetricInputKey(field.platform, field.key);
        const parsedMetric = parseMetricInput(field, values[valueKey] || "");
        if (!parsedMetric) return null;
        return {
          platform: field.platform,
          metricKey: field.key,
          metricLabel: field.label,
          ...parsedMetric,
        };
      })
      .filter(Boolean);

    startTransition(async () => {
      try {
        await submitPerformance(payload as Parameters<typeof submitPerformance>[0]);
        setSuccess(true);
        onSuccess?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : t("error.submitFailed"));
      }
    });
  }

  if (success || alreadySubmitted) {
    return (
      <Card>
        <CardContent
          data-testid="performance-report-submitted"
          className="py-8 text-center"
        >
          <CheckCircle2 className="mx-auto mb-3 size-8 text-emerald-500" />
          <p className="text-sm font-medium text-foreground">
            {isCorrectionResubmission
              ? t("submitted.correctionTitle")
              : t("submitted.title", { report: measurementLabel })}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {isCorrectionResubmission
              ? t("submitted.correctionDetail")
              : t("submitted.detail")}
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
            {t("header.title", { platform: platformLabel, report: measurementLabel })}
          </p>
          <p className="text-xs text-muted-foreground">
            {dueDate
              ? t("header.due", { date: dueDate })
              : t("header.manual", { platform: platformLabel })}
          </p>
        </div>
      </div>

      <div
        data-testid="performance-reporting-steps"
        className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-muted/30 p-1"
      >
        {reportingSteps.map((step, index) => (
          <div
            key={step.label}
            className={`rounded-md px-2 py-1.5 text-center text-[11px] font-medium ${
              step.done
                ? "bg-card text-foreground shadow-sm"
                : step.active
                  ? "text-foreground"
                  : "text-muted-foreground"
            }`}
          >
            <span className="me-1 tabular-nums">{index + 1}</span>
            {step.label}
          </div>
        ))}
      </div>

      {reportGoalContext && (
        <div
          data-testid="performance-report-goal-context"
          className="rounded-lg border border-border bg-muted/35 px-3 py-2.5"
        >
          <p className="text-xs font-semibold text-foreground">
            {t("reportGoalContext.title")}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {t("reportGoalContext.detail", {
              goal: reportGoalTitle,
              blocks: reportGoalBlocks || t("reportGoal.block.reportTrust"),
            })}
          </p>
        </div>
      )}

      {/* Evidence proof */}
      <div data-testid="performance-evidence-block">
        <label className="mb-1 flex items-center gap-1 text-sm font-medium text-foreground">
          {t("proof.title")}
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
              {evidenceFileName || t("proof.chooseFile")}
            </span>
          </span>
          <span className="shrink-0 text-xs text-muted-foreground">
            {evidenceStatusLabel}
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

      {/* Platform-specific note */}
      <div className="flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2.5 ring-1 ring-ring/[0.04]">
        <Info className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/70" />
        <p className="text-xs leading-relaxed text-muted-foreground">{note}</p>
      </div>

      <div className="space-y-2">
        <div>
          <p className="text-sm font-medium text-foreground">
            {t("metrics.title")}
          </p>
          <p className="text-xs text-muted-foreground">
            {t("metrics.detail")}
          </p>
        </div>

        {evidenceUpload && (
          <div
            data-testid="performance-ai-confirmation"
            className="rounded-lg border border-border bg-muted/35 px-3 py-2.5"
          >
            <p className="text-xs font-semibold text-foreground">
              {hasAiSuggestions
                ? t("metrics.confirmation.aiTitle")
                : t("metrics.confirmation.manualTitle")}
            </p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
              {hasAiSuggestions
                ? t("metrics.confirmation.aiDetail")
                : t("metrics.confirmation.manualDetail")}
            </p>
          </div>
        )}

        {metricGroups.map((group) => (
          <div
            key={group.platform}
            data-testid="performance-metric-group"
            className="space-y-2"
          >
            {metricGroups.length > 1 && (
              <p className="text-xs font-semibold text-foreground">
                {group.platformLabel?.trim() || getReportingPlatformLabel(group.platform)}
              </p>
            )}
            <div
              data-testid="performance-metric-grid"
              className="grid grid-cols-2 gap-2 sm:grid-cols-4"
            >
              {group.metrics.map((metric) => {
                const field = { ...metric, platform: group.platform };
                const valueKey = getMetricInputKey(field.platform, field.key);
                const metricSource = metricSourceByKey[valueKey];
                const inputClassName =
                  field.type === "text"
                    ? "h-10 min-w-0 flex-1 border-0 bg-transparent px-0 text-start text-sm font-medium leading-snug text-foreground shadow-none placeholder:text-muted-foreground/35 focus:outline-none focus:ring-0"
                    : "h-10 min-w-0 flex-1 border-0 bg-transparent px-0 text-end text-lg font-semibold leading-none tabular-nums text-foreground shadow-none [appearance:textfield] placeholder:text-muted-foreground/35 focus:outline-none focus:ring-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

                return (
                  <label
                    key={valueKey}
                    data-testid="performance-metric-input-card"
                    className="grid min-h-[104px] grid-rows-[auto_1fr] gap-2 rounded-lg border border-border bg-card p-2.5 shadow-sm"
                  >
                    <span className="flex min-h-8 items-start justify-between gap-1 text-xs font-medium leading-tight text-muted-foreground">
                      <span>{field.label}</span>
                      <span className="flex shrink-0 items-center gap-1">
                        {metricSource && hasConfirmedValues && (
                          <span
                            data-testid="performance-metric-source"
                            className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground ring-1 ring-border/60"
                          >
                            {metricSource.source === "ai"
                              ? t("metrics.source.ai")
                              : t("metrics.source.manual")}
                          </span>
                        )}
                        {field.required && (
                          <span aria-hidden="true" className="text-red-500">
                            *
                          </span>
                        )}
                      </span>
                    </span>
                    <span
                      data-testid="performance-metric-input-control"
                      className="flex h-11 min-w-0 items-center rounded-lg border border-border bg-background px-2.5 shadow-sm transition focus-within:border-slate-900 focus-within:ring-2 focus-within:ring-ring"
                    >
                      <input
                        type="text"
                        inputMode={field.type === "text" ? "text" : "decimal"}
                        pattern={
                          field.type === "text" ? undefined : "[0-9]*[.]?[0-9]*"
                        }
                        aria-label={field.label}
                        placeholder={field.type === "text" ? "" : "0"}
                        value={values[valueKey] || ""}
                        onChange={(e) => updateValue(field, e.target.value)}
                        className={inputClassName}
                      />
                      {field.type === "percentage" && (
                        <span className="ps-1 text-sm font-semibold text-muted-foreground">
                          %
                        </span>
                      )}
                      {field.key === "avg_watch_time_seconds" && (
                        <span className="ps-1 text-sm font-semibold text-muted-foreground">
                          s
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
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
        {isPending
          ? t("action.submitting")
          : isCorrectionResubmission
            ? t("action.resubmitCorrection")
            : t("action.submitReport", { report: measurementLabel })}
      </Button>
    </div>
  );
}
