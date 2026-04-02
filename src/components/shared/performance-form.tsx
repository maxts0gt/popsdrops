"use client";

import { useState, useTransition } from "react";
import { Info, Upload, CheckCircle2, AlertCircle } from "lucide-react";
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

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PerformanceFormProps {
  submissionId: string;
  platform: Platform;
  measurementType: "initial_48h" | "final_7d" | "extended_30d";
  onSuccess?: () => void;
}

const MEASUREMENT_LABELS: Record<string, string> = {
  initial_48h: "48-Hour Report",
  final_7d: "7-Day Report",
  extended_30d: "30-Day Report",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PerformanceForm({
  submissionId,
  platform,
  measurementType,
  onSuccess,
}: PerformanceFormProps) {
  const metrics = PLATFORM_METRICS[platform];
  const note = PLATFORM_METRIC_NOTES[platform];
  const Icon = PlatformIcon[platform];

  const [values, setValues] = useState<Record<string, string>>({});
  const [screenshotUrl, setScreenshotUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

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

    // Validate screenshot proof
    if (!screenshotUrl.trim()) {
      setError("Screenshot proof of analytics is required");
      return;
    }

    // Build the payload
    const payload: Record<string, unknown> = {
      submission_id: submissionId,
      measurement_type: measurementType,
      screenshot_url: screenshotUrl.trim(),
    };

    for (const field of metrics) {
      const val = parseMetricValue(field, values[field.key] || "");
      if (val !== undefined) {
        payload[field.key] = val;
      }
    }

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

  if (success) {
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
            {PLATFORM_LABELS[platform]} — {MEASUREMENT_LABELS[measurementType]}
          </p>
          <p className="text-xs text-muted-foreground">
            Enter metrics from your {PLATFORM_LABELS[platform]} analytics
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

      {/* Screenshot proof */}
      <div>
        <label className="mb-1 flex items-center gap-1 text-sm font-medium text-foreground">
          Analytics Screenshot
          <span className="text-xs text-red-400">*</span>
        </label>
        <p className="mb-2 text-xs text-muted-foreground">
          Paste a link to a screenshot of your {PLATFORM_LABELS[platform]} analytics dashboard
          showing these metrics. This verifies your reported numbers.
        </p>
        <input
          type="url"
          placeholder="https://..."
          value={screenshotUrl}
          onChange={(e) => setScreenshotUrl(e.target.value)}
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/70 focus:border-slate-400 focus:outline-none focus:ring-1 focus:ring-slate-400"
        />
        <p className="mt-1 text-[11px] text-muted-foreground/70">
          Upload your screenshot to any image host and paste the URL. Supabase Storage upload coming soon.
        </p>
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
        disabled={isPending}
        className="w-full"
      >
        {isPending ? "Submitting..." : `Submit ${MEASUREMENT_LABELS[measurementType]}`}
      </Button>
    </div>
  );
}
