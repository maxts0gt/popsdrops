"use client";

import {
  ArrowDown,
  ArrowUp,
  BadgeCheck,
  BarChart3,
  Check,
  FileCheck2,
  FileText,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Table2,
} from "lucide-react";
import {
  REPORT_BUILDER_BLOCKS,
  REPORT_BUILDER_CHART_MODES,
  REPORT_BUILDER_CUSTOM_PRESET,
  REPORT_BUILDER_PRESENTATION_OPTIONS,
  REPORT_BUILDER_PRESETS,
  type ReportBuilderBlockId,
  type ReportBuilderChartMetricKey,
  type ReportBuilderChartModeId,
  type ReportBuilderPresentation,
  type ReportBuilderPresetId,
  type ReportBuilderPresetSelectionId,
} from "@/lib/reporting/report-builder";
import type { ReportCompositionTemplateSummary } from "@/app/actions/report-composition-templates";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ReportTranslation = (key: string, vars?: Record<string, string>) => string;

interface ReportTileOption {
  id: string;
  label: string;
  detail: string;
}

interface ReportBuilderPanelProps {
  activeChartModeId: ReportBuilderChartModeId;
  activeChartMetricKey: ReportBuilderChartMetricKey;
  activePresentation: ReportBuilderPresentation;
  activePresetId: ReportBuilderPresetSelectionId;
  activeTemplateId: string | null;
  campaignTitle: string;
  metricTileOptions: ReportTileOption[];
  nextAction: string;
  onChartModeChange: (chartModeId: ReportBuilderChartModeId) => void;
  onChartMetricChange: (metricKey: ReportBuilderChartMetricKey) => void;
  onPresentationChange: (presentation: ReportBuilderPresentation) => void;
  onPresetSelect: (presetId: ReportBuilderPresetId) => void;
  onMoveBlock: (
    blockId: ReportBuilderBlockId,
    direction: "earlier" | "later",
  ) => void;
  onSaveTemplateClick: () => void;
  onTemplateSelect: (template: ReportCompositionTemplateSummary) => void;
  onToggle: (blockId: ReportBuilderBlockId) => void;
  selectedBlockIds: ReportBuilderBlockId[];
  templates: ReportCompositionTemplateSummary[];
  trustDecision: string;
  trustTileOptions: ReportTileOption[];
  t: ReportTranslation;
}

function getActiveReportTileIds(
  options: ReportTileOption[],
  selectedIds?: readonly string[] | null,
): string[] {
  const optionIds = options.map((option) => option.id);
  if (optionIds.length === 0) return [];

  const selected = new Set(selectedIds ?? []);
  const activeIds = optionIds.filter((id) => selected.has(id));

  return activeIds.length > 0 ? activeIds : optionIds;
}

function getReportBuilderBlockIcon(blockId: ReportBuilderBlockId) {
  switch (blockId) {
    case "report_framing":
      return SlidersHorizontal;
    case "executive_summary":
      return FileText;
    case "channel_story":
      return BarChart3;
    case "proof_sources":
      return FileCheck2;
    case "report_trust":
      return ShieldCheck;
    case "creator_table":
      return Table2;
    case "recommendations":
      return BadgeCheck;
  }
}

export function ReportBuilderPanel({
  activeChartModeId,
  activeChartMetricKey,
  activePresentation,
  activePresetId,
  activeTemplateId,
  campaignTitle,
  metricTileOptions,
  nextAction,
  onChartModeChange,
  onChartMetricChange,
  onMoveBlock,
  onPresentationChange,
  onPresetSelect,
  onSaveTemplateClick,
  onTemplateSelect,
  onToggle,
  selectedBlockIds,
  templates,
  trustDecision,
  trustTileOptions,
  t,
}: ReportBuilderPanelProps) {
  const orderedSelectedBlocks = selectedBlockIds
    .map((blockId) => REPORT_BUILDER_BLOCKS.find((block) => block.id === blockId))
    .filter((block): block is (typeof REPORT_BUILDER_BLOCKS)[number] => Boolean(block));
  const activeTemplate = templates.find((template) => template.id === activeTemplateId);
  const activePreset = REPORT_BUILDER_PRESETS.find(
    (preset) => preset.id === activePresetId,
  );
  const activeChartMode = REPORT_BUILDER_CHART_MODES.find(
    (mode) => mode.id === activeChartModeId,
  );
  const activeDefaultHeadline = t("titleForCampaign", { title: campaignTitle });
  const activeDefaultExecutiveQuestion = activePreset
    ? t(activePreset.executiveQuestionKey)
    : t(REPORT_BUILDER_CUSTOM_PRESET.executiveQuestionKey);
  const activeDisplayTitle =
    activePresentation.headline?.trim() || activeDefaultHeadline;
  const activeExecutiveQuestion =
    activePresentation.executiveQuestion?.trim() || activeDefaultExecutiveQuestion;
  const activeChartModeTitle = activeChartMode
    ? t(activeChartMode.titleKey)
    : t("builder.chartMode.comparison.title");
  const activeChartLayoutTitle = activeChartMode
    ? t(activeChartMode.layoutTitleKey)
    : t("builder.chartMode.comparison.layoutTitle");
  const activePresentationLabel = [
    activePresentation.coverMode === "proof_room"
      ? t("builder.presentation.cover.proofRoom")
      : t("builder.presentation.cover.campaignVisual"),
    activePresentation.typography === "compact"
      ? t("builder.presentation.typography.compact")
      : t("builder.presentation.typography.quiet"),
    activePresentation.density === "compact"
      ? t("builder.presentation.density.compact")
      : t("builder.presentation.density.editorial"),
  ].join(" / ");
  const activeMetricTileIds = getActiveReportTileIds(
    metricTileOptions,
    activePresentation.kpiIds,
  );
  const activeTrustTileIds = getActiveReportTileIds(
    trustTileOptions,
    activePresentation.trustIds,
  );
  const visibleTemplates = [
    ...(activeTemplate ? [activeTemplate] : []),
    ...templates
      .filter((template) => template.id !== activeTemplateId)
      .slice(0, activeTemplate ? 2 : 3),
  ];
  const hiddenTemplateCount = Math.max(templates.length - visibleTemplates.length, 0);
  const getBlockLabel = (block: (typeof REPORT_BUILDER_BLOCKS)[number]) =>
    activePresentation.sectionLabels?.[block.id]?.trim() || t(block.titleKey);
  const setPresentationValue = <Key extends keyof ReportBuilderPresentation>(
    field: Key,
    value: ReportBuilderPresentation[Key],
  ) => {
    onPresentationChange({
      ...activePresentation,
      chartMetricKey: activePresentation.chartMetricKey ?? activeChartMetricKey,
      [field]: value,
    });
  };
  const setSectionLabel = (blockId: ReportBuilderBlockId, value: string) => {
    const nextLabels = { ...(activePresentation.sectionLabels ?? {}) };
    const label = value.trim().slice(0, 80);

    if (label) {
      nextLabels[blockId] = label;
    } else {
      delete nextLabels[blockId];
    }

    setPresentationValue(
      "sectionLabels",
      Object.keys(nextLabels).length > 0 ? nextLabels : null,
    );
  };
  const setTileLabel = (
    field: "kpiLabels" | "trustLabels",
    tileId: string,
    value: string,
  ) => {
    const nextLabels = { ...(activePresentation[field] ?? {}) };
    const label = value.trim().slice(0, 80);

    if (label) {
      nextLabels[tileId] = label;
    } else {
      delete nextLabels[tileId];
    }

    setPresentationValue(
      field,
      Object.keys(nextLabels).length > 0 ? nextLabels : null,
    );
  };
  const toggleTileSelection = (
    field: "kpiIds" | "trustIds",
    optionId: string,
    options: ReportTileOption[],
  ) => {
    const activeIds = getActiveReportTileIds(options, activePresentation[field]);
    const active = new Set(activeIds);

    if (active.has(optionId)) {
      if (active.size <= 1) return;
      active.delete(optionId);
    } else {
      active.add(optionId);
    }

    setPresentationValue(
      field,
      options
        .map((option) => option.id)
        .filter((id) => active.has(id)),
    );
  };
  const activeMetricTileOptions = metricTileOptions.filter((option) =>
    activeMetricTileIds.includes(option.id),
  );
  const chartMetricOptions = metricTileOptions.filter(
    (option): option is ReportTileOption & { id: ReportBuilderChartMetricKey } =>
      option.id === "views" ||
      option.id === "engagements" ||
      option.id === "engagementRate" ||
      option.id === "cpe",
  );
  const activeTrustTileOptions = trustTileOptions.filter((option) =>
    activeTrustTileIds.includes(option.id),
  );
  const activeChartMetricLabel =
    chartMetricOptions.find((option) => option.id === activeChartMetricKey)?.label ??
    activeMetricTileOptions[0]?.label ??
    t("kpi.views");
  const activeBlockSequence = orderedSelectedBlocks
    .map((block) => getBlockLabel(block))
    .join(" / ");
  const activeTrustTileLabels = activeTrustTileOptions.map(
    (option) => activePresentation.trustLabels?.[option.id]?.trim() || option.label,
  );
  const readerPromiseItems = [
    {
      key: "story",
      label: t("builder.promise.story"),
      value: activeExecutiveQuestion,
      detail: activeDisplayTitle,
    },
    {
      key: "proof",
      label: t("builder.promise.proof"),
      value: trustDecision,
      detail:
        activeTrustTileLabels.length > 0
          ? activeTrustTileLabels.join(" / ")
          : t("builder.chartStory.noProofSources"),
    },
    {
      key: "artifact",
      label: t("builder.promise.artifact"),
      value: activePresentationLabel,
      detail: `${activeChartLayoutTitle} / ${t("builder.selected", {
        count: String(selectedBlockIds.length),
      })}`,
    },
  ] as const;
  const builderDecisionRecipeItems = [
    {
      key: "question",
      label: t("builder.output.recipeQuestion"),
      value: activeExecutiveQuestion,
      detail: activeDisplayTitle,
    },
    {
      key: "visual-job",
      label: t("builder.output.recipeVisualJob"),
      value: activeChartLayoutTitle,
      detail: `${activeChartModeTitle} / ${activeChartMetricLabel}`,
    },
    {
      key: "evidence-gate",
      label: t("builder.output.recipeEvidenceGate"),
      value: trustDecision,
      detail:
        activeTrustTileLabels.length > 0
          ? activeTrustTileLabels.join(" / ")
          : t("builder.chartStory.noProofSources"),
    },
    {
      key: "next-action",
      label: t("builder.output.recipeNextAction"),
      value: nextAction,
      detail: t("builder.output.recipeDetail"),
    },
  ] as const;
  const builderContractItems: Array<{
    detail?: string;
    key: string;
    label: string;
    value: string;
  }> = [
    {
      key: "lead-metric",
      label: t("builder.chartStory.selectedMetric"),
      value: activeChartMetricLabel,
    },
    {
      key: "trust-gate",
      label: t("builder.output.trustDecision"),
      value: trustDecision,
    },
    {
      key: "block-sequence",
      label: t("builder.output.blocks"),
      value: activeBlockSequence,
    },
    {
      key: "leadership-handoff",
      label: t("builder.story.handoff"),
      value: trustDecision,
      detail: t("builder.story.handoffDetail"),
    },
  ];

  return (
    <section
      data-testid="report-builder"
      className="mb-8 rounded-xl border border-border/70 bg-white p-4 shadow-sm sm:p-5"
      aria-label={t("builder.title")}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-foreground">
            {t("builder.title")}
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            {t("builder.detail")}
          </p>
        </div>
        <button
          type="button"
          data-testid="report-builder-save-template"
          onClick={onSaveTemplateClick}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-muted"
        >
          <Save className="size-3.5" />
          {t("builder.saveTemplate")}
        </button>
      </div>

      <div
        data-testid="report-builder-reader-promise"
        className="mt-4 overflow-hidden rounded-xl border-y border-slate-200 bg-slate-50/70"
      >
        <div className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-normal text-slate-500">
              {t("builder.promise.title")}
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              {t("builder.promise.detail")}
            </p>
          </div>
          <span className="text-[11px] font-medium text-slate-500">
            {t("builder.story.outputPreview")}
          </span>
        </div>
        <div className="grid border-t border-slate-200 md:grid-cols-3">
          {readerPromiseItems.map((item) => (
            <article
              key={item.key}
              data-testid="report-builder-reader-promise-item"
              data-promise-item={item.key}
              className="min-w-0 border-t border-slate-200 px-4 py-3 first:border-t-0 md:border-s md:border-t-0 md:first:border-s-0"
            >
              <p className="text-[11px] font-semibold uppercase tracking-normal text-slate-500">
                {item.label}
              </p>
              <p className="mt-1 line-clamp-2 text-sm font-medium leading-5 text-slate-900">
                {item.value}
              </p>
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                {item.detail}
              </p>
            </article>
          ))}
        </div>
      </div>

      <div
        data-testid="report-builder-layout"
        className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)] lg:items-start"
      >
        <div data-testid="report-builder-control-panel" className="min-w-0 space-y-5">
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-sm font-medium text-foreground">
                  {t("builder.story.controlTitle")}
                </h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {t("builder.detail")}
                </p>
              </div>
              <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {t("builder.selected", { count: String(selectedBlockIds.length) })}
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <h4 className="text-[11px] font-semibold uppercase tracking-normal text-muted-foreground">
                {t("builder.templates.title")}
              </h4>
              {hiddenTemplateCount > 0 && (
                <span
                  data-testid="report-builder-template-more"
                  className="text-[11px] font-medium text-muted-foreground"
                >
                  {t("builder.templates.moreSaved", {
                    count: String(hiddenTemplateCount),
                  })}
                </span>
              )}
            </div>
            {templates.length > 0 ? (
              <div
                data-testid="report-builder-template-strip"
                className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3"
              >
                {visibleTemplates.map((template) => {
                  const selected = activeTemplateId === template.id;

                  return (
                    <button
                      key={template.id}
                      type="button"
                      aria-pressed={selected}
                      data-testid="report-builder-template"
                      data-template-id={template.id}
                      onClick={() => onTemplateSelect(template)}
                      className={`min-w-0 min-h-[72px] rounded-lg border p-3 text-start transition ${
                        selected
                          ? "border-slate-900 bg-white text-foreground shadow-sm"
                          : "border-slate-200 bg-white/80 text-muted-foreground hover:border-slate-300 hover:text-foreground"
                      }`}
                    >
                      <span className="flex items-start justify-between gap-3">
                        <span className="min-w-0 truncate text-sm font-medium text-foreground">
                          {template.name}
                        </span>
                        {template.isDefault && (
                          <span className="rounded-full border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                            {t("builder.templates.default")}
                          </span>
                        )}
                      </span>
                      <span className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                        {template.description || t("builder.templates.savedShape")}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="mt-2 rounded-lg border border-dashed border-border bg-white px-3 py-3 text-xs leading-5 text-muted-foreground">
                {t("builder.templates.empty")}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
                {t("builder.presets.title")}
              </h3>
              <span className="text-xs font-medium text-muted-foreground">
                {activePresetId === "custom"
                  ? t("builder.preset.custom.title")
                  : t("builder.preset.active")}
              </span>
            </div>
            <div className="mt-2 grid gap-2 lg:grid-cols-3">
              {REPORT_BUILDER_PRESETS.map((preset) => {
                const selected = activePresetId === preset.id;

                return (
                  <button
                    key={preset.id}
                    type="button"
                    aria-pressed={selected}
                    data-testid="report-builder-preset"
                    data-preset-id={preset.id}
                    onClick={() => onPresetSelect(preset.id)}
                    className={`min-w-0 min-h-[78px] rounded-lg border p-3 text-start transition ${
                      selected
                        ? "border-slate-900 bg-slate-50 text-foreground shadow-sm"
                        : "border-border bg-white text-muted-foreground hover:border-slate-300 hover:text-foreground"
                    }`}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="text-sm font-medium text-foreground">
                        {t(preset.titleKey)}
                      </span>
                      {selected && (
                        <Check className="mt-0.5 size-4 shrink-0 text-slate-900" />
                      )}
                    </span>
                    <span className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                      {t(preset.detailKey)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div
            data-testid="report-builder-framing"
            className="rounded-xl border border-slate-200 bg-white p-3"
          >
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
                {t("builder.framing.title")}
              </h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {t("builder.framing.detail")}
              </p>
            </div>
            <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
              <div className="space-y-2">
                <Label
                  htmlFor="report-builder-headline"
                  className="text-[11px] font-semibold uppercase tracking-normal text-muted-foreground"
                >
                  {t("builder.framing.headline")}
                </Label>
                <Input
                  id="report-builder-headline"
                  data-testid="report-builder-headline"
                  value={activePresentation.headline ?? ""}
                  maxLength={120}
                  placeholder={activeDefaultHeadline}
                  onChange={(event) =>
                    setPresentationValue("headline", event.target.value)
                  }
                  className="h-10 text-sm"
                />
                <p className="text-xs leading-5 text-muted-foreground">
                  {t("builder.framing.headlineDetail")}
                </p>
              </div>
              <div className="space-y-2">
                <Label
                  htmlFor="report-builder-executive-question"
                  className="text-[11px] font-semibold uppercase tracking-normal text-muted-foreground"
                >
                  {t("builder.framing.question")}
                </Label>
                <Textarea
                  id="report-builder-executive-question"
                  data-testid="report-builder-executive-question"
                  value={activePresentation.executiveQuestion ?? ""}
                  maxLength={220}
                  rows={3}
                  placeholder={activeDefaultExecutiveQuestion}
                  onChange={(event) =>
                    setPresentationValue("executiveQuestion", event.target.value)
                  }
                  className="min-h-[80px] text-sm leading-5"
                />
                <p className="text-xs leading-5 text-muted-foreground">
                  {t("builder.framing.questionDetail")}
                </p>
              </div>
            </div>
          </div>

          <div
            data-testid="report-builder-section-labels"
            className="rounded-xl border border-slate-200 bg-white p-3"
          >
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
                {t("builder.sectionLabels.title")}
              </h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {t("builder.sectionLabels.detail")}
              </p>
            </div>
            <div className="mt-3 grid gap-2 lg:grid-cols-2">
              {orderedSelectedBlocks.map((block) => (
                <div key={block.id} className="space-y-1.5">
                  <Label
                    htmlFor={`report-builder-section-label-${block.id}`}
                    className="text-[11px] font-semibold uppercase tracking-normal text-muted-foreground"
                  >
                    {t(block.titleKey)}
                  </Label>
                  <Input
                    id={`report-builder-section-label-${block.id}`}
                    data-testid="report-builder-section-label"
                    data-block-id={block.id}
                    value={activePresentation.sectionLabels?.[block.id] ?? ""}
                    maxLength={80}
                    placeholder={t("builder.sectionLabels.placeholder")}
                    onChange={(event) => setSectionLabel(block.id, event.target.value)}
                    className="h-9 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          <div
            data-testid="report-builder-tile-controls"
            className="rounded-xl border border-slate-200 bg-white p-3"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
                  {t("builder.tiles.title")}
                </h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {t("builder.tiles.detail")}
                </p>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                {t("builder.tiles.selected", {
                  selected: String(activeMetricTileIds.length + activeTrustTileIds.length),
                  total: String(metricTileOptions.length + trustTileOptions.length),
                })}
              </span>
            </div>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-[11px] font-semibold uppercase tracking-normal text-muted-foreground">
                    {t("builder.tiles.kpis")}
                  </p>
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {t("builder.tiles.selected", {
                      selected: String(activeMetricTileIds.length),
                      total: String(metricTileOptions.length),
                    })}
                  </span>
                </div>
                <div className="grid gap-2">
                  {metricTileOptions.map((option) => {
                    const selected = activeMetricTileIds.includes(option.id);

                    return (
                      <button
                        key={option.id}
                        type="button"
                        aria-pressed={selected}
                        data-testid="report-builder-kpi-tile"
                        data-tile-id={option.id}
                        disabled={selected && activeMetricTileIds.length <= 1}
                        onClick={() =>
                          toggleTileSelection("kpiIds", option.id, metricTileOptions)
                        }
                        className={`min-w-0 rounded-lg border p-3 text-start transition ${
                          selected
                            ? "border-slate-900 bg-slate-50 text-foreground shadow-sm"
                            : "border-border bg-white text-muted-foreground hover:border-slate-300 hover:text-foreground"
                        } disabled:cursor-not-allowed disabled:opacity-60`}
                      >
                        <span className="flex items-start justify-between gap-3">
                          <span className="text-sm font-medium text-foreground">
                            {option.label}
                          </span>
                          {selected && (
                            <Check className="mt-0.5 size-4 shrink-0 text-slate-900" />
                          )}
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                          {option.detail}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div
                  data-testid="report-builder-kpi-tile-labels"
                  className="mt-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-normal text-muted-foreground">
                    {t("builder.tiles.labels")}
                  </p>
                  <div className="mt-2 grid gap-2">
                    {activeMetricTileOptions.map((option) => (
                      <div key={option.id} className="space-y-1.5">
                        <Label
                          htmlFor={`report-builder-kpi-tile-label-${option.id}`}
                          className="text-[11px] font-semibold uppercase tracking-normal text-muted-foreground"
                        >
                          {option.label}
                        </Label>
                        <Input
                          id={`report-builder-kpi-tile-label-${option.id}`}
                          data-testid="report-builder-kpi-tile-label"
                          data-tile-id={option.id}
                          value={activePresentation.kpiLabels?.[option.id] ?? ""}
                          maxLength={80}
                          placeholder={t("builder.tiles.labelPlaceholder")}
                          onChange={(event) =>
                            setTileLabel("kpiLabels", option.id, event.target.value)
                          }
                          className="h-9 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-[11px] font-semibold uppercase tracking-normal text-muted-foreground">
                    {t("builder.tiles.proof")}
                  </p>
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {t("builder.tiles.selected", {
                      selected: String(activeTrustTileIds.length),
                      total: String(trustTileOptions.length),
                    })}
                  </span>
                </div>
                <div className="grid gap-2">
                  {trustTileOptions.map((option) => {
                    const selected = activeTrustTileIds.includes(option.id);

                    return (
                      <button
                        key={option.id}
                        type="button"
                        aria-pressed={selected}
                        data-testid="report-builder-trust-tile"
                        data-tile-id={option.id}
                        disabled={selected && activeTrustTileIds.length <= 1}
                        onClick={() =>
                          toggleTileSelection("trustIds", option.id, trustTileOptions)
                        }
                        className={`min-w-0 rounded-lg border p-3 text-start transition ${
                          selected
                            ? "border-slate-900 bg-slate-50 text-foreground shadow-sm"
                            : "border-border bg-white text-muted-foreground hover:border-slate-300 hover:text-foreground"
                        } disabled:cursor-not-allowed disabled:opacity-60`}
                      >
                        <span className="flex items-start justify-between gap-3">
                          <span className="text-sm font-medium text-foreground">
                            {option.label}
                          </span>
                          {selected && (
                            <Check className="mt-0.5 size-4 shrink-0 text-slate-900" />
                          )}
                        </span>
                        <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                          {option.detail}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div
                  data-testid="report-builder-trust-tile-labels"
                  className="mt-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-normal text-muted-foreground">
                    {t("builder.tiles.labels")}
                  </p>
                  <div className="mt-2 grid gap-2">
                    {activeTrustTileOptions.map((option) => (
                      <div key={option.id} className="space-y-1.5">
                        <Label
                          htmlFor={`report-builder-trust-tile-label-${option.id}`}
                          className="text-[11px] font-semibold uppercase tracking-normal text-muted-foreground"
                        >
                          {option.label}
                        </Label>
                        <Input
                          id={`report-builder-trust-tile-label-${option.id}`}
                          data-testid="report-builder-trust-tile-label"
                          data-tile-id={option.id}
                          value={activePresentation.trustLabels?.[option.id] ?? ""}
                          maxLength={80}
                          placeholder={t("builder.tiles.labelPlaceholder")}
                          onChange={(event) =>
                            setTileLabel("trustLabels", option.id, event.target.value)
                          }
                          className="h-9 text-sm"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <h3 className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
              {t("builder.chartMode.title")}
            </h3>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              {REPORT_BUILDER_CHART_MODES.map((mode) => {
                const selected = activeChartModeId === mode.id;

                return (
                  <button
                    key={mode.id}
                    type="button"
                    aria-pressed={selected}
                    data-testid="report-builder-chart-mode"
                    data-chart-mode={mode.id}
                    onClick={() => onChartModeChange(mode.id)}
                    className={`min-w-0 rounded-lg border p-3 text-start transition ${
                      selected
                        ? "border-slate-900 bg-slate-50 text-foreground shadow-sm"
                        : "border-border bg-white text-muted-foreground hover:border-slate-300 hover:text-foreground"
                    }`}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="text-sm font-medium text-foreground">
                        {t(mode.titleKey)}
                      </span>
                      {selected && <Check className="size-4 shrink-0 text-slate-900" />}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                      {t(mode.detailKey)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div
            data-testid="report-builder-chart-focus"
            className="rounded-xl border border-slate-200 bg-white p-3"
          >
            <h3 className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
              {t("builder.chartStory.selectedMetric")}
            </h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {t("builder.story.detail")}
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {chartMetricOptions.map((option) => {
                const selected = activeChartMetricKey === option.id;

                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={selected}
                    data-testid="report-builder-chart-focus-option"
                    data-chart-metric={option.id}
                    onClick={() => onChartMetricChange(option.id)}
                    className={`min-w-0 rounded-lg border p-3 text-start transition ${
                      selected
                        ? "border-slate-900 bg-slate-50 text-foreground shadow-sm"
                        : "border-border bg-white text-muted-foreground hover:border-slate-300 hover:text-foreground"
                    }`}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <span className="text-sm font-medium text-foreground">
                        {option.label}
                      </span>
                      {selected && <Check className="size-4 shrink-0 text-slate-900" />}
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                      {option.detail}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div
            data-testid="report-builder-presentation"
            className="rounded-xl border border-slate-200 bg-slate-50/70 p-3"
          >
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
                {t("builder.presentation.title")}
              </h3>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                {t("builder.presentation.detail")}
              </p>
            </div>
            <div className="mt-3 grid gap-3 lg:grid-cols-3">
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-normal text-muted-foreground">
                  {t("builder.presentation.cover")}
                </p>
                <div
                  data-testid="report-builder-presentation-segmented"
                  className="grid grid-cols-2 overflow-hidden rounded-lg border border-slate-200 bg-white"
                >
                  {REPORT_BUILDER_PRESENTATION_OPTIONS.coverModes.map((option) => {
                    const selected = activePresentation.coverMode === option.id;

                    return (
                      <button
                        key={option.id}
                        type="button"
                        aria-pressed={selected}
                        data-testid="report-builder-presentation-option"
                        data-presentation-field="coverMode"
                        data-presentation-value={option.id}
                        onClick={() => setPresentationValue("coverMode", option.id)}
                        title={t(option.detailKey)}
                        className={`min-h-[44px] px-3 py-2 min-w-0 text-start text-sm font-medium transition ${
                          selected
                            ? "bg-slate-900 text-white"
                            : "border-s border-slate-200 bg-white text-muted-foreground hover:bg-slate-50 hover:text-foreground first:border-s-0"
                        }`}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate">
                            {t(option.titleKey)}
                          </span>
                          {selected && (
                            <Check className="size-4 shrink-0" />
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-normal text-muted-foreground">
                  {t("builder.presentation.typography")}
                </p>
                <div
                  data-testid="report-builder-presentation-segmented"
                  className="grid grid-cols-2 overflow-hidden rounded-lg border border-slate-200 bg-white"
                >
                  {REPORT_BUILDER_PRESENTATION_OPTIONS.typographies.map((option) => {
                    const selected = activePresentation.typography === option.id;

                    return (
                      <button
                        key={option.id}
                        type="button"
                        aria-pressed={selected}
                        data-testid="report-builder-presentation-option"
                        data-presentation-field="typography"
                        data-presentation-value={option.id}
                        onClick={() => setPresentationValue("typography", option.id)}
                        title={t(option.detailKey)}
                        className={`min-h-[44px] px-3 py-2 min-w-0 text-start text-sm font-medium transition ${
                          selected
                            ? "bg-slate-900 text-white"
                            : "border-s border-slate-200 bg-white text-muted-foreground hover:bg-slate-50 hover:text-foreground first:border-s-0"
                        }`}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate">
                            {t(option.titleKey)}
                          </span>
                          {selected && (
                            <Check className="size-4 shrink-0" />
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-normal text-muted-foreground">
                  {t("builder.presentation.density")}
                </p>
                <div
                  data-testid="report-builder-presentation-segmented"
                  className="grid grid-cols-2 overflow-hidden rounded-lg border border-slate-200 bg-white"
                >
                  {REPORT_BUILDER_PRESENTATION_OPTIONS.densities.map((option) => {
                    const selected = activePresentation.density === option.id;

                    return (
                      <button
                        key={option.id}
                        type="button"
                        aria-pressed={selected}
                        data-testid="report-builder-presentation-option"
                        data-presentation-field="density"
                        data-presentation-value={option.id}
                        onClick={() => setPresentationValue("density", option.id)}
                        title={t(option.detailKey)}
                        className={`min-h-[44px] px-3 py-2 min-w-0 text-start text-sm font-medium transition ${
                          selected
                            ? "bg-slate-900 text-white"
                            : "border-s border-slate-200 bg-white text-muted-foreground hover:bg-slate-50 hover:text-foreground first:border-s-0"
                        }`}
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate">
                            {t(option.titleKey)}
                          </span>
                          {selected && (
                            <Check className="size-4 shrink-0" />
                          )}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <h3 className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
              {t("builder.blocks.title")}
            </h3>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {REPORT_BUILDER_BLOCKS.map((block) => {
                const selected = selectedBlockIds.includes(block.id);
                const Icon = getReportBuilderBlockIcon(block.id);

                return (
                  <button
                    key={block.id}
                    type="button"
                    aria-pressed={selected}
                    data-testid="report-builder-block"
                    data-block-id={block.id}
                    disabled={block.required}
                    onClick={() => onToggle(block.id)}
                    className={`group flex min-w-0 min-h-[86px] items-start gap-3 rounded-lg border p-3 text-start transition ${
                      selected
                        ? "border-slate-900 bg-slate-50 text-foreground"
                        : "border-border bg-white text-muted-foreground hover:border-slate-300 hover:text-foreground"
                    } ${block.required ? "cursor-default" : ""}`}
                  >
                    <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-white text-foreground">
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium text-foreground">
                          {t(block.titleKey)}
                        </span>
                        {selected && <Check className="size-4 shrink-0 text-slate-900" />}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                        {t(block.detailKey)}
                      </span>
                      {block.required && (
                        <span className="mt-2 inline-flex rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                          {t("builder.required")}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <aside
          data-testid="report-builder-preview-panel"
          className="min-w-0 space-y-4 lg:sticky lg:top-4"
        >
          <div
            data-testid="report-builder-story-strip"
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex flex-col gap-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-normal text-muted-foreground">
                  {t("builder.story.title")}
                </p>
                <h3 className="mt-1 text-base font-medium leading-snug text-foreground">
                  {t("builder.story.previewTitle")}
                </h3>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                  {t("builder.story.detail")}
                </p>
              </div>
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                <BadgeCheck className="size-3.5" />
                {t("builder.story.outputPreview")}
              </span>
            </div>
            <div className="mt-4 space-y-3">
              <article
                data-testid="report-builder-story-step"
                data-story-step="decision"
                className="grid grid-cols-[28px_minmax(0,1fr)] gap-3"
              >
                <span className="flex size-7 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-[11px] font-medium text-slate-600">
                  1
                </span>
                <span className="min-w-0 border-b border-slate-100 pb-3">
                  <span className="text-[11px] font-semibold uppercase tracking-normal text-slate-500">
                    {t("builder.story.decision")}
                  </span>
                  <span className="mt-1 block truncate text-sm font-medium text-foreground">
                    {activeDisplayTitle}
                  </span>
                  <span className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                    {activeExecutiveQuestion}
                  </span>
                </span>
              </article>
              <article
                data-testid="report-builder-story-step"
                data-story-step="evidence"
                className="grid grid-cols-[28px_minmax(0,1fr)] gap-3"
              >
                <span className="flex size-7 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-[11px] font-medium text-slate-600">
                  2
                </span>
                <span className="min-w-0 border-b border-slate-100 pb-3">
                  <span className="text-[11px] font-semibold uppercase tracking-normal text-slate-500">
                    {t("builder.story.evidence")}
                  </span>
                  <span className="mt-1 block truncate text-sm font-medium text-foreground">
                    {activeChartLayoutTitle}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    {activeChartModeTitle}
                  </span>
                </span>
              </article>
              <article
                data-testid="report-builder-story-step"
                data-story-step="presentation"
                className="grid grid-cols-[28px_minmax(0,1fr)] gap-3"
              >
                <span className="flex size-7 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-[11px] font-medium text-slate-600">
                  3
                </span>
                <span className="min-w-0 border-b border-slate-100 pb-3">
                  <span className="text-[11px] font-semibold uppercase tracking-normal text-slate-500">
                    {t("builder.story.presentation")}
                  </span>
                  <span className="mt-1 line-clamp-2 text-sm font-medium leading-snug text-foreground">
                    {activePresentationLabel}
                  </span>
                </span>
              </article>
              <article
                data-testid="report-builder-story-step"
                data-story-step="order"
                className="grid grid-cols-[28px_minmax(0,1fr)] gap-3"
              >
                <span className="flex size-7 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-[11px] font-medium text-slate-600">
                  4
                </span>
                <span className="min-w-0">
                  <span className="text-[11px] font-semibold uppercase tracking-normal text-slate-500">
                    {t("builder.story.order")}
                  </span>
                  <span className="mt-1 block truncate text-sm font-medium text-foreground">
                    {t("builder.selected", { count: String(selectedBlockIds.length) })}
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    {t("builder.story.trustLocked")}
                  </span>
                </span>
              </article>
            </div>
            <div
              data-testid="report-builder-decision-recipe"
              className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3"
            >
              <div className="flex flex-col gap-1">
                <p className="text-[11px] font-semibold uppercase tracking-normal text-slate-500">
                  {t("builder.output.recipe")}
                </p>
                <p className="text-xs leading-5 text-slate-500">
                  {t("builder.output.recipeDetail")}
                </p>
              </div>
              <div className="mt-3 grid gap-2">
                {builderDecisionRecipeItems.map((item) => (
                  <article
                    key={item.key}
                    data-testid="report-builder-decision-recipe-item"
                    data-recipe-step={item.key}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2"
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-normal text-slate-500">
                      {item.label}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm font-medium leading-snug text-slate-900">
                      {item.value}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">
                      {item.detail}
                    </p>
                  </article>
                ))}
              </div>
            </div>
            <div
              data-testid="report-builder-export-contract"
              className="mt-4 grid gap-2 border-t border-slate-100 pt-3"
            >
              {builderContractItems.map((item) => (
                <article
                  key={item.key}
                  data-testid="report-builder-contract-item"
                  data-contract-item={item.key}
                  className="rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2"
                >
                  <p className="text-[11px] font-semibold uppercase tracking-normal text-slate-500">
                    {item.label}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm font-medium leading-snug text-slate-900">
                    {item.value}
                  </p>
                  {item.detail ? (
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {item.detail}
                    </p>
                  ) : null}
                </article>
              ))}
            </div>
          </div>

          <div
            data-testid="report-builder-block-order"
            className="rounded-xl border border-slate-200 bg-slate-50/70 p-3"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">
                  {t("builder.order.title")}
                </h4>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {t("builder.order.detail")}
                </p>
              </div>
              <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {t("builder.selected", { count: String(selectedBlockIds.length) })}
              </span>
            </div>
            <div className="mt-3 grid gap-2">
              {orderedSelectedBlocks.map((block, index) => (
                <div
                  key={block.id}
                  data-testid="report-builder-block-order-item"
                  data-block-id={block.id}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2"
                >
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-[11px] font-medium text-slate-600">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-medium text-foreground">
                    {getBlockLabel(block)}
                  </span>
                  <button
                    type="button"
                    data-testid="report-builder-block-move-earlier"
                    data-block-id={block.id}
                    aria-label={t("builder.order.moveEarlier", {
                      block: getBlockLabel(block),
                    })}
                    title={t("builder.order.moveEarlier", {
                      block: getBlockLabel(block),
                    })}
                    disabled={index === 0}
                    onClick={() => onMoveBlock(block.id, "earlier")}
                    className="inline-flex size-7 items-center justify-center rounded-md border border-slate-200 text-muted-foreground transition hover:bg-slate-50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ArrowUp className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    data-testid="report-builder-block-move-later"
                    data-block-id={block.id}
                    aria-label={t("builder.order.moveLater", {
                      block: getBlockLabel(block),
                    })}
                    title={t("builder.order.moveLater", {
                      block: getBlockLabel(block),
                    })}
                    disabled={index === orderedSelectedBlocks.length - 1}
                    onClick={() => onMoveBlock(block.id, "later")}
                    className="inline-flex size-7 items-center justify-center rounded-md border border-slate-200 text-muted-foreground transition hover:bg-slate-50 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <ArrowDown className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs font-medium text-muted-foreground">
            {t("builder.exportFollows")}
          </p>
        </aside>
      </div>
    </section>
  );
}
