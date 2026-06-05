"use client";

import { Save, ShieldCheck } from "lucide-react";
import type {
  ReportLeadershipHandoff,
  ReportLeadershipProofBasisKey,
} from "@/lib/reporting/report-export";

type ReportTranslation = (key: string, vars?: Record<string, string>) => string;

interface ReportOutputContractPanelProps {
  bestFor: string;
  blocks: string[];
  chart: string;
  chartMetric: string;
  chartLayoutDetail: string;
  chartLayoutTitle: string;
  chartModeId: string;
  decisionRead: string;
  evidenceTrail: string;
  executiveQuestion: string;
  leadershipHandoff: ReportLeadershipHandoff;
  metricTiles: string;
  nextAction: string;
  onSaveCampaignShape: () => void;
  presentation: string;
  readinessDecision: string;
  saveCampaignShapeError: string | null;
  saveCampaignShapeSaved: boolean;
  saveCampaignShapeSaving: boolean;
  shape: string;
  trustTiles: string;
  t: ReportTranslation;
}

function splitReportLabelList(labelList: string) {
  return labelList
    .split(" / ")
    .map((label) => label.trim())
    .filter(Boolean);
}

const proofBasisLabelKeys: Record<ReportLeadershipProofBasisKey, string> = {
  included: "evidence.summary.included",
  "needs-review": "evidence.summary.review",
  corrections: "evidence.summary.corrections",
  "missing-proof": "evidence.summary.missing",
};

export function ReportOutputContractPanel({
  bestFor,
  blocks,
  chart,
  chartMetric,
  chartLayoutDetail,
  chartLayoutTitle,
  chartModeId,
  decisionRead,
  evidenceTrail,
  executiveQuestion,
  leadershipHandoff,
  metricTiles,
  nextAction,
  onSaveCampaignShape,
  presentation,
  readinessDecision,
  saveCampaignShapeError,
  saveCampaignShapeSaved,
  saveCampaignShapeSaving,
  shape,
  trustTiles,
  t,
}: ReportOutputContractPanelProps) {
  const metricTileList = splitReportLabelList(metricTiles);
  const trustTileList = splitReportLabelList(trustTiles);

  return (
    <section
      data-testid="report-output-contract"
      className="mb-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
      aria-label={t("builder.output.title")}
    >
      <div
        data-testid="report-output-summary"
        className="flex flex-col gap-4 border-b border-slate-200 pb-4 lg:flex-row lg:items-start lg:justify-between"
      >
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-normal text-slate-600">
            <ShieldCheck className="size-3.5" />
            {t("builder.output.readiness")}
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {t("builder.output.detail")}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end">
          <button
            type="button"
            data-testid="report-builder-save-campaign-shape"
            onClick={onSaveCampaignShape}
            disabled={saveCampaignShapeSaving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save className="size-3.5" />
            {saveCampaignShapeSaving
              ? t("builder.saveCampaign.saving")
              : t("builder.saveCampaign")}
          </button>
          {saveCampaignShapeSaved && (
            <span className="text-xs font-semibold text-emerald-700">
              {t("builder.saveCampaign.savedInline")}
            </span>
          )}
          {saveCampaignShapeError && (
            <span className="text-xs font-semibold text-destructive">
              {saveCampaignShapeError}
            </span>
          )}
        </div>
      </div>
      <article
        data-testid="report-output-executive-read"
        data-executive-read-state={readinessDecision === "Ready for leadership sharing." ? "ready" : "hold"}
        data-leadership-handoff-state={leadershipHandoff.state}
        className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-[0_16px_40px_-34px_rgba(15,23,42,0.45)]"
      >
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-normal text-slate-500">
              {t("builder.output.readiness")}
            </p>
            <p className="mt-2 text-sm font-semibold leading-5 text-slate-800">
              {readinessDecision}
            </p>
            <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500">
              {decisionRead}
            </p>
          </div>
          <div
            data-testid="report-output-next-action-note"
            className="min-w-0 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 lg:max-w-xs"
          >
            <p className="text-[10px] font-semibold uppercase tracking-normal text-slate-500">
              {t("builder.output.recipeNextAction")}
            </p>
            <p className="mt-1 text-xs font-medium leading-5 text-slate-700">
              {nextAction}
            </p>
          </div>
        </div>
      </article>
      <div
        data-testid="report-output-proof-basis"
        className="mt-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3"
        aria-label={t("evidence.command.countsLabel")}
      >
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-normal text-slate-500">
            {t("evidence.command.countsLabel")}
          </p>
          <p className="text-xs font-medium leading-5 text-slate-500">
            {leadershipHandoff.label}
          </p>
        </div>
        <dl className="mt-3 grid gap-2 sm:grid-cols-4">
          {leadershipHandoff.proofBasis.map((item) => (
            <div
              key={item.key}
              data-testid="report-output-proof-basis-item"
              data-proof-basis-key={item.key}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2"
            >
              <dt className="text-[10px] font-semibold uppercase tracking-normal text-slate-500">
                {t(proofBasisLabelKeys[item.key])}
              </dt>
              <dd className="mt-1 font-mono text-sm font-semibold tabular-nums text-slate-900">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <div
        data-testid="report-output-spine"
        className="mt-4 min-w-0 space-y-3 text-sm"
      >
        <div
          data-testid="report-output-readiness-rail"
          className="grid overflow-hidden rounded-xl border border-slate-200 bg-slate-50/70 lg:grid-cols-4"
        >
          <article
            data-testid="report-output-readiness-step"
            data-readiness-step="decision"
            className="min-w-0 border-b border-slate-200 bg-white/70 p-3 lg:border-b-0 lg:border-e"
          >
            <p className="text-[10px] font-semibold uppercase tracking-normal text-slate-500">
              {t("builder.output.decision")}
            </p>
            <p className="mt-2 text-sm font-medium leading-5 text-slate-800">
              {executiveQuestion}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{bestFor}</p>
          </article>
          <article
            data-testid="report-output-readiness-step"
            data-readiness-step="evidence"
            className="min-w-0 border-b border-slate-200 bg-white/70 p-3 lg:border-b-0 lg:border-e"
          >
            <p className="text-[10px] font-semibold uppercase tracking-normal text-slate-500">
              {t("builder.output.evidence")}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {trustTileList.map((label) => (
                <span
                  key={label}
                  data-testid="report-output-tile-chip"
                  className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium leading-5 text-slate-700"
                >
                  {label}
                </span>
              ))}
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">
              {t("builder.output.kpiConfigured", {
                count: String(metricTileList.length),
              })}
            </p>
          </article>
          <article
            data-testid="report-output-readiness-step"
            data-readiness-step="trust-decision"
            className="min-w-0 border-b border-slate-200 bg-white/70 p-3 lg:border-b-0 lg:border-e"
          >
            <p className="text-[10px] font-semibold uppercase tracking-normal text-slate-500">
              {t("builder.output.trustDecision")}
            </p>
            <p className="mt-2 text-sm font-medium leading-5 text-slate-800">
              {readinessDecision}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {t("builder.output.trustDecisionDetail")}
            </p>
          </article>
          <article
            data-testid="report-output-readiness-step"
            data-readiness-step="export"
            className="min-w-0 bg-white/70 p-3"
          >
            <p className="text-[10px] font-semibold uppercase tracking-normal text-slate-500">
              {t("builder.output.exportShape")}
            </p>
            <p className="mt-2 text-sm font-medium leading-5 text-slate-800">
              {shape} · {chart}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {presentation} · {chartLayoutTitle}
            </p>
          </article>
        </div>
        <div
          data-testid="report-output-decision-recipe"
          data-chart-mode={chartModeId}
          className="rounded-xl border border-slate-200 bg-white"
        >
          <div className="border-b border-slate-200 px-3 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-normal text-muted-foreground">
              {t("builder.output.recipe")}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              {t("builder.output.recipeDetail")}
            </p>
          </div>
          <div className="grid divide-y divide-slate-200 lg:grid-cols-4 lg:divide-x lg:divide-y-0">
            <article
              data-testid="report-output-decision-recipe-item"
              data-recipe-step="question"
              className="min-w-0 p-3"
            >
              <p className="text-[10px] font-semibold uppercase tracking-normal text-muted-foreground">
                {t("builder.output.recipeQuestion")}
              </p>
              <strong className="mt-2 block text-sm font-medium leading-5 text-slate-800">
                {decisionRead}
              </strong>
            </article>
            <article
              data-testid="report-output-decision-recipe-item"
              data-recipe-step="visual-job"
              className="min-w-0 p-3"
            >
              <p className="text-[10px] font-semibold uppercase tracking-normal text-muted-foreground">
                {t("builder.output.recipeVisualJob")}
              </p>
              <strong className="mt-2 block text-sm font-medium leading-5 text-slate-800">
                {chartLayoutTitle}
              </strong>
              <span className="mt-1 block text-xs leading-5 text-slate-500">
                {chart} / {chartMetric}
              </span>
            </article>
            <article
              data-testid="report-output-decision-recipe-item"
              data-recipe-step="evidence-gate"
              className="min-w-0 p-3"
            >
              <p className="text-[10px] font-semibold uppercase tracking-normal text-muted-foreground">
                {t("builder.output.recipeEvidenceGate")}
              </p>
              <strong className="mt-2 block text-sm font-medium leading-5 text-slate-800">
                {readinessDecision}
              </strong>
              <span className="mt-1 block text-xs leading-5 text-slate-500">
                {evidenceTrail}
              </span>
            </article>
            <article
              data-testid="report-output-decision-recipe-item"
              data-recipe-step="next-action"
              className="min-w-0 p-3"
            >
              <p className="text-[10px] font-semibold uppercase tracking-normal text-muted-foreground">
                {t("builder.output.recipeNextAction")}
              </p>
              <strong className="mt-2 block text-sm font-medium leading-5 text-slate-800">
                {nextAction}
              </strong>
            </article>
          </div>
        </div>
        <div
          data-testid="report-output-details-ledger"
          className="rounded-xl border border-slate-200 bg-slate-50/70"
        >
          <dl className="divide-y divide-slate-200">
            <div
              data-testid="report-output-chart-layout"
              className="grid gap-1 px-3 py-2.5 sm:grid-cols-[150px_minmax(0,1fr)]"
            >
              <dt className="text-[10px] font-semibold uppercase tracking-normal text-muted-foreground">
                {t("builder.output.chartLayout")}
              </dt>
              <dd>
                <p className="text-sm font-medium text-slate-800">
                  {chartLayoutTitle}
                </p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {chartLayoutDetail}
                </p>
              </dd>
            </div>
            <div
              data-testid="report-output-executive-question"
              className="grid gap-1 px-3 py-2.5 sm:grid-cols-[150px_minmax(0,1fr)]"
            >
              <dt className="text-[10px] font-semibold uppercase tracking-normal text-muted-foreground">
                {t("builder.output.executiveQuestion")}
              </dt>
              <dd className="text-sm font-medium leading-5 text-slate-800">
                {executiveQuestion}
              </dd>
            </div>
            <div className="grid gap-3 px-3 py-2.5 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-normal text-muted-foreground">
                  {t("builder.output.shape")}
                </dt>
                <dd className="mt-1 text-xs font-medium text-slate-700">
                  {shape}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-normal text-muted-foreground">
                  {t("builder.output.chart")}
                </dt>
                <dd className="mt-1 text-xs font-medium text-slate-700">
                  {chart}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-normal text-muted-foreground">
                  {t("builder.chartStory.selectedMetric")}
                </dt>
                <dd className="mt-1 text-xs font-medium text-slate-700">
                  {chartMetric}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-normal text-muted-foreground">
                  {t("builder.output.kpiTiles")}
                </dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  {metricTileList.map((label) => (
                    <span
                      key={label}
                      data-testid="report-output-tile-chip"
                      className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium leading-5 text-slate-700"
                    >
                      {label}
                    </span>
                  ))}
                </dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-normal text-muted-foreground">
                  {t("builder.output.proofTiles")}
                </dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  {trustTileList.map((label) => (
                    <span
                      key={label}
                      data-testid="report-output-tile-chip"
                      className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium leading-5 text-slate-700"
                    >
                      {label}
                    </span>
                  ))}
                </dd>
              </div>
              <div className="sm:col-span-2 lg:col-span-5">
                <dt className="text-[10px] font-semibold uppercase tracking-normal text-muted-foreground">
                  {t("builder.output.bestFor")}
                </dt>
                <dd className="mt-1 text-xs font-medium text-slate-700">
                  {bestFor}
                </dd>
              </div>
            </div>
          </dl>
          <div className="border-t border-slate-200 px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-normal text-muted-foreground">
              {t("builder.output.blocks")}
            </p>
            <ol
              data-testid="report-output-block-order"
              className="mt-2 grid gap-1.5 sm:grid-cols-2"
            >
              {blocks.map((block, index) => (
                <li
                  key={`${index}:${block}`}
                  data-testid="report-output-block-order-item"
                  className="flex min-w-0 items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-700"
                >
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[10px] font-semibold text-white">
                    {index + 1}
                  </span>
                  <span className="min-w-0 truncate">{block}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
