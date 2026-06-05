import type { ReportExportData, ReportExportSection } from "./report-export";

export const REPORT_BUILDER_BLOCKS = [
  {
    id: "report_framing",
    title: "Report framing",
    detail: "Optional preset, chart mode, and executive question context.",
    executivePurpose:
      "Include the report setup context only when the audience needs to see why this export was shaped this way.",
    titleKey: "builder.block.framing.title",
    detailKey: "builder.block.framing.detail",
    defaultSelected: false,
    required: false,
  },
  {
    id: "executive_summary",
    title: "Executive summary",
    detail: "Top KPIs for leadership.",
    executivePurpose:
      "Start with the leadership readout: outcome, spend, and confidence at a glance.",
    titleKey: "builder.block.executive.title",
    detailKey: "builder.block.executive.detail",
    defaultSelected: true,
    required: false,
  },
  {
    id: "channel_story",
    title: "Channel story",
    detail: "Platform-native performance charts.",
    executivePurpose:
      "Explain performance by platform without mixing metrics that each network defines differently.",
    titleKey: "builder.block.channel.title",
    detailKey: "builder.block.channel.detail",
    defaultSelected: true,
    required: false,
  },
  {
    id: "proof_sources",
    title: "Proof sources",
    detail: "Supporting channels kept separate from totals.",
    executivePurpose:
      "Keep non-primary evidence visible while protecting campaign totals from unsupported comparisons.",
    titleKey: "builder.block.proofSources.title",
    detailKey: "builder.block.proofSources.detail",
    defaultSelected: false,
    required: false,
  },
  {
    id: "report_trust",
    title: "Report trust",
    detail: "Evidence coverage, review state, and data source.",
    executivePurpose:
      "Show legal, finance, and leadership how each number was evidenced and reviewed.",
    titleKey: "builder.block.trust.title",
    detailKey: "builder.block.trust.detail",
    defaultSelected: true,
    required: true,
  },
  {
    id: "creator_table",
    title: "Creator table",
    detail: "Creator-level performance and spend.",
    executivePurpose:
      "Give operators the creator-level detail behind the executive narrative.",
    titleKey: "builder.block.creators.title",
    detailKey: "builder.block.creators.detail",
    defaultSelected: true,
    required: false,
  },
  {
    id: "recommendations",
    title: "Recommendations",
    detail: "Data-earned next actions.",
    executivePurpose:
      "Close with data-earned actions the brand can decide on next.",
    titleKey: "builder.block.recommendations.title",
    detailKey: "builder.block.recommendations.detail",
    defaultSelected: true,
    required: false,
  },
] as const;

export type ReportBuilderBlock = (typeof REPORT_BUILDER_BLOCKS)[number];
export type ReportBuilderBlockId = ReportBuilderBlock["id"];

export const REPORT_BUILDER_DEFAULT_BLOCK_IDS = REPORT_BUILDER_BLOCKS
  .filter((block) => block.defaultSelected)
  .map((block) => block.id);

export const REPORT_BUILDER_CHART_MODES = [
  {
    id: "trend",
    title: "Trend view",
    detail: "Time-based growth and pacing.",
    layoutTitle: "Timeline readout",
    layoutDetail:
      "Lead with movement over time, pacing, and the final decision signal.",
    titleKey: "builder.chartMode.trend.title",
    detailKey: "builder.chartMode.trend.detail",
    layoutTitleKey: "builder.chartMode.trend.layoutTitle",
    layoutDetailKey: "builder.chartMode.trend.layoutDetail",
  },
  {
    id: "comparison",
    title: "Comparison view",
    detail: "Side-by-side channel and creator contrast.",
    layoutTitle: "Ranked comparison",
    layoutDetail:
      "Lead with creator and channel contrast before detail rows.",
    titleKey: "builder.chartMode.comparison.title",
    detailKey: "builder.chartMode.comparison.detail",
    layoutTitleKey: "builder.chartMode.comparison.layoutTitle",
    layoutDetailKey: "builder.chartMode.comparison.layoutDetail",
  },
  {
    id: "proof",
    title: "Proof view",
    detail: "Evidence coverage and source confidence first.",
    layoutTitle: "Evidence audit",
    layoutDetail:
      "Lead with source coverage, review state, and missing proof before performance detail.",
    titleKey: "builder.chartMode.proof.title",
    detailKey: "builder.chartMode.proof.detail",
    layoutTitleKey: "builder.chartMode.proof.layoutTitle",
    layoutDetailKey: "builder.chartMode.proof.layoutDetail",
  },
] as const;

export type ReportBuilderChartMode = (typeof REPORT_BUILDER_CHART_MODES)[number];
export type ReportBuilderChartModeId = ReportBuilderChartMode["id"];

export const REPORT_BUILDER_PRESETS = [
  {
    id: "leadership",
    title: "Leadership brief",
    detail: "Board-ready summary, channel story, trust, and next actions.",
    bestFor: "Senior launch readouts and market-entry decisions.",
    executiveQuestion:
      "Did this campaign create enough confidence to continue the market launch?",
    titleKey: "builder.preset.leadership.title",
    detailKey: "builder.preset.leadership.detail",
    bestForKey: "builder.preset.leadership.bestFor",
    executiveQuestionKey: "builder.preset.leadership.question",
    chartModeId: "trend",
    blockIds: [
      "executive_summary",
      "channel_story",
      "report_trust",
      "recommendations",
    ],
  },
  {
    id: "proof_audit",
    title: "Proof audit",
    detail: "Evidence, proof sources, and creator rows for legal review.",
    bestFor: "Legal, finance, and regional brand review.",
    executiveQuestion:
      "Can every reported number be traced to trusted evidence and a brand decision?",
    titleKey: "builder.preset.proofAudit.title",
    detailKey: "builder.preset.proofAudit.detail",
    bestForKey: "builder.preset.proofAudit.bestFor",
    executiveQuestionKey: "builder.preset.proofAudit.question",
    chartModeId: "proof",
    blockIds: [
      "proof_sources",
      "report_trust",
      "creator_table",
    ],
  },
  {
    id: "creator_performance",
    title: "Creator performance",
    detail: "Channel story, creator table, and next actions.",
    bestFor: "Creator optimization and repeat-investment decisions.",
    executiveQuestion:
      "Which creators and channels should the brand repeat, increase, or retire?",
    titleKey: "builder.preset.creatorPerformance.title",
    detailKey: "builder.preset.creatorPerformance.detail",
    bestForKey: "builder.preset.creatorPerformance.bestFor",
    executiveQuestionKey: "builder.preset.creatorPerformance.question",
    chartModeId: "comparison",
    blockIds: REPORT_BUILDER_DEFAULT_BLOCK_IDS,
  },
] as const satisfies readonly {
  id: string;
  title: string;
  detail: string;
  bestFor: string;
  executiveQuestion: string;
  titleKey: string;
  detailKey: string;
  bestForKey: string;
  executiveQuestionKey: string;
  chartModeId: ReportBuilderChartModeId;
  blockIds: readonly ReportBuilderBlockId[];
}[];

export type ReportBuilderPreset = (typeof REPORT_BUILDER_PRESETS)[number];
export type ReportBuilderPresetId = ReportBuilderPreset["id"];
export type ReportBuilderPresetSelectionId = ReportBuilderPresetId | "custom";
export type ReportBuilderTemplateReference = {
  id?: string | null;
  name: string;
  description?: string | null;
  presentation?: ReportBuilderPresentation | null;
};

export const REPORT_BUILDER_PRESENTATION_OPTIONS = {
  coverModes: [
    {
      id: "campaign_visual",
      title: "Campaign visual",
      detail: "Lead with the campaign image when available.",
      titleKey: "builder.presentation.cover.campaignVisual",
      detailKey: "builder.presentation.cover.campaignVisual.detail",
    },
    {
      id: "proof_room",
      title: "Proof room",
      detail: "Lead with a restrained proof-room panel.",
      titleKey: "builder.presentation.cover.proofRoom",
      detailKey: "builder.presentation.cover.proofRoom.detail",
    },
  ],
  typographies: [
    {
      id: "quiet",
      title: "Quiet",
      detail: "Smaller, calmer executive type.",
      titleKey: "builder.presentation.typography.quiet",
      detailKey: "builder.presentation.typography.quiet.detail",
    },
    {
      id: "compact",
      title: "Compact",
      detail: "Dense readout type for operator review.",
      titleKey: "builder.presentation.typography.compact",
      detailKey: "builder.presentation.typography.compact.detail",
    },
  ],
  densities: [
    {
      id: "editorial",
      title: "Editorial",
      detail: "More air for leadership review.",
      titleKey: "builder.presentation.density.editorial",
      detailKey: "builder.presentation.density.editorial.detail",
    },
    {
      id: "compact",
      title: "Compact",
      detail: "Tighter for operating review.",
      titleKey: "builder.presentation.density.compact",
      detailKey: "builder.presentation.density.compact.detail",
    },
  ],
} as const;

export type ReportBuilderCoverMode =
  (typeof REPORT_BUILDER_PRESENTATION_OPTIONS.coverModes)[number]["id"];
export type ReportBuilderTypography =
  (typeof REPORT_BUILDER_PRESENTATION_OPTIONS.typographies)[number]["id"];
export type ReportBuilderDensity =
  (typeof REPORT_BUILDER_PRESENTATION_OPTIONS.densities)[number]["id"];
export type ReportBuilderChartMetricKey =
  | "views"
  | "engagements"
  | "engagementRate"
  | "cpe";

export type ReportBuilderPresentation = {
  coverMode: ReportBuilderCoverMode;
  typography: ReportBuilderTypography;
  density: ReportBuilderDensity;
  chartMetricKey?: ReportBuilderChartMetricKey | null;
  headline?: string | null;
  executiveQuestion?: string | null;
  kpiIds?: string[] | null;
  trustIds?: string[] | null;
  kpiLabels?: Record<string, string> | null;
  trustLabels?: Record<string, string> | null;
  sectionLabels?: Partial<Record<ReportBuilderBlockId, string>> | null;
};

export const REPORT_BUILDER_DEFAULT_PRESENTATION = {
  coverMode: "campaign_visual",
  typography: "quiet",
  density: "editorial",
} satisfies ReportBuilderPresentation;

export type NormalizedReportCompositionTemplateInput = {
  name: string;
  description: string | null;
  presetId: ReportBuilderPresetSelectionId;
  chartModeId: ReportBuilderChartModeId;
  blockIds: ReportBuilderBlockId[];
  presentation: ReportBuilderPresentation;
};

export type NormalizedReportCompositionSelection = Omit<
  NormalizedReportCompositionTemplateInput,
  "name" | "description"
>;

export const REPORT_BUILDER_DEFAULT_PRESET_ID = "creator_performance" satisfies ReportBuilderPresetId;
export const REPORT_BUILDER_CUSTOM_PRESET = {
  id: "custom",
  title: "Custom report",
  detail: "Manually selected report blocks.",
  bestFor: "A team-defined proof room export.",
  executiveQuestion:
    "What decision can leadership make from the evidence this campaign collected?",
  titleKey: "builder.preset.custom.title",
  detailKey: "builder.preset.custom.detail",
  bestForKey: "builder.preset.custom.bestFor",
  executiveQuestionKey: "builder.preset.custom.question",
} as const;

const reportBuilderBlockIds = new Set<ReportBuilderBlockId>(
  REPORT_BUILDER_BLOCKS.map((block) => block.id),
);
const requiredReportBuilderBlockIds = new Set<ReportBuilderBlockId>(
  REPORT_BUILDER_BLOCKS
    .filter((block) => block.required)
    .map((block) => block.id),
);
const reportBuilderChartModeIds = new Set<ReportBuilderChartModeId>(
  REPORT_BUILDER_CHART_MODES.map((mode) => mode.id),
);
const reportBuilderPresetIds = new Set<ReportBuilderPresetId>(
  REPORT_BUILDER_PRESETS.map((preset) => preset.id),
);
const reportBuilderCoverModes = new Set<ReportBuilderCoverMode>(
  REPORT_BUILDER_PRESENTATION_OPTIONS.coverModes.map((item) => item.id),
);
const reportBuilderTypographies = new Set<ReportBuilderTypography>(
  REPORT_BUILDER_PRESENTATION_OPTIONS.typographies.map((item) => item.id),
);
const reportBuilderDensities = new Set<ReportBuilderDensity>(
  REPORT_BUILDER_PRESENTATION_OPTIONS.densities.map((item) => item.id),
);
const reportBuilderChartMetricKeys = new Set<ReportBuilderChartMetricKey>([
  "views",
  "engagements",
  "engagementRate",
  "cpe",
]);

function isReportBuilderBlockId(value: unknown): value is ReportBuilderBlockId {
  return (
    typeof value === "string" &&
    reportBuilderBlockIds.has(value as ReportBuilderBlockId)
  );
}

function isReportBuilderChartModeId(value: unknown): value is ReportBuilderChartModeId {
  return (
    typeof value === "string" &&
    reportBuilderChartModeIds.has(value as ReportBuilderChartModeId)
  );
}

function isReportBuilderPresetId(value: unknown): value is ReportBuilderPresetId {
  return (
    typeof value === "string" &&
    reportBuilderPresetIds.has(value as ReportBuilderPresetId)
  );
}

function isReportBuilderCoverMode(value: unknown): value is ReportBuilderCoverMode {
  return (
    typeof value === "string" &&
    reportBuilderCoverModes.has(value as ReportBuilderCoverMode)
  );
}

function isReportBuilderTypography(value: unknown): value is ReportBuilderTypography {
  return (
    typeof value === "string" &&
    reportBuilderTypographies.has(value as ReportBuilderTypography)
  );
}

function isReportBuilderDensity(value: unknown): value is ReportBuilderDensity {
  return (
    typeof value === "string" &&
    reportBuilderDensities.has(value as ReportBuilderDensity)
  );
}

function isReportBuilderChartMetricKey(
  value: unknown,
): value is ReportBuilderChartMetricKey {
  return (
    typeof value === "string" &&
    reportBuilderChartMetricKeys.has(value as ReportBuilderChartMetricKey)
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  return value as Record<string, unknown>;
}

function normalizeReportPresentationText(
  value: unknown,
  maxLength: number,
): string | null {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  return trimmed.slice(0, maxLength);
}

function normalizeReportPresentationIds(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;

  const seen = new Set<string>();
  const selected: string[] = [];

  for (const item of value) {
    if (typeof item !== "string") continue;

    const id = item.trim().slice(0, 80);
    if (!id || seen.has(id)) continue;

    seen.add(id);
    selected.push(id);

    if (selected.length >= 24) break;
  }

  return selected.length > 0 ? selected : null;
}

function normalizeReportSectionLabels(
  value: unknown,
): Partial<Record<ReportBuilderBlockId, string>> | null {
  const record = asRecord(value);
  const labels: Partial<Record<ReportBuilderBlockId, string>> = {};

  for (const block of REPORT_BUILDER_BLOCKS) {
    const label = normalizeReportPresentationText(record[block.id], 80);
    if (!label) continue;

    labels[block.id] = label;
  }

  return Object.keys(labels).length > 0 ? labels : null;
}

function normalizeReportTileLabels(value: unknown): Record<string, string> | null {
  const record = asRecord(value);
  const labels: Record<string, string> = {};

  for (const [rawKey, rawLabel] of Object.entries(record)) {
    const key = normalizeReportPresentationText(rawKey, 80);
    const label = normalizeReportPresentationText(rawLabel, 80);

    if (!key || !label || labels[key]) continue;

    labels[key] = label;

    if (Object.keys(labels).length >= 48) break;
  }

  return Object.keys(labels).length > 0 ? labels : null;
}

export function isReportBuilderPresetSelectionId(
  value: unknown,
): value is ReportBuilderPresetSelectionId {
  return value === "custom" || isReportBuilderPresetId(value);
}

export function normalizeReportBuilderSelection(
  blockIds: readonly unknown[] | null | undefined,
): ReportBuilderBlockId[] {
  const seen = new Set<ReportBuilderBlockId>();
  const selected: ReportBuilderBlockId[] = [];
  const inputBlockIds = blockIds?.length
    ? blockIds
    : REPORT_BUILDER_DEFAULT_BLOCK_IDS;

  for (const blockId of inputBlockIds) {
    if (!isReportBuilderBlockId(blockId) || seen.has(blockId)) continue;

    seen.add(blockId);
    selected.push(blockId);
  }

  for (const requiredId of requiredReportBuilderBlockIds) {
    if (seen.has(requiredId)) continue;

    seen.add(requiredId);
    selected.push(requiredId);
  }

  return selected;
}

function getReportBuilderStoryBlockId(
  chartModeId: ReportBuilderChartModeId,
): ReportBuilderBlockId {
  return chartModeId === "proof" ? "proof_sources" : "channel_story";
}

function ensureReportBuilderStoryBlockSelection(
  blockIds: readonly unknown[] | null | undefined,
  chartModeId: ReportBuilderChartModeId,
): ReportBuilderBlockId[] {
  const selected = normalizeReportBuilderSelection(blockIds);
  const storyBlockId = getReportBuilderStoryBlockId(chartModeId);

  if (selected.includes(storyBlockId)) return selected;

  const trustIndex = selected.indexOf("report_trust");
  if (trustIndex >= 0) {
    return [
      ...selected.slice(0, trustIndex),
      storyBlockId,
      ...selected.slice(trustIndex),
    ];
  }

  return [...selected, storyBlockId];
}

export function normalizeReportBuilderPresentation(
  input?: unknown,
): ReportBuilderPresentation {
  const record = asRecord(input);
  const headline = normalizeReportPresentationText(record.headline, 120);
  const executiveQuestion = normalizeReportPresentationText(
    record.executiveQuestion,
    220,
  );
  const kpiIds = normalizeReportPresentationIds(record.kpiIds);
  const trustIds = normalizeReportPresentationIds(record.trustIds);
  const kpiLabels = normalizeReportTileLabels(record.kpiLabels);
  const trustLabels = normalizeReportTileLabels(record.trustLabels);
  const sectionLabels = normalizeReportSectionLabels(record.sectionLabels);

  return {
    coverMode: isReportBuilderCoverMode(record.coverMode)
      ? record.coverMode
      : REPORT_BUILDER_DEFAULT_PRESENTATION.coverMode,
    typography: isReportBuilderTypography(record.typography)
      ? record.typography
      : REPORT_BUILDER_DEFAULT_PRESENTATION.typography,
    density: isReportBuilderDensity(record.density)
      ? record.density
      : REPORT_BUILDER_DEFAULT_PRESENTATION.density,
    ...(isReportBuilderChartMetricKey(record.chartMetricKey)
      ? { chartMetricKey: record.chartMetricKey }
      : {}),
    ...(headline ? { headline } : {}),
    ...(executiveQuestion ? { executiveQuestion } : {}),
    ...(kpiIds ? { kpiIds } : {}),
    ...(trustIds ? { trustIds } : {}),
    ...(kpiLabels ? { kpiLabels } : {}),
    ...(trustLabels ? { trustLabels } : {}),
    ...(sectionLabels ? { sectionLabels } : {}),
  };
}

export function getReportBuilderPreset(
  presetId: unknown,
): ReportBuilderPreset | null {
  if (!isReportBuilderPresetId(presetId)) return null;

  return REPORT_BUILDER_PRESETS.find((preset) => preset.id === presetId) ?? null;
}

export function getReportBuilderChartMode(
  chartModeId: unknown,
): ReportBuilderChartMode {
  if (isReportBuilderChartModeId(chartModeId)) {
    const chartMode = REPORT_BUILDER_CHART_MODES.find(
      (mode) => mode.id === chartModeId,
    );
    if (chartMode) return chartMode;
  }

  return REPORT_BUILDER_CHART_MODES.find((mode) => mode.id === "comparison") ??
    REPORT_BUILDER_CHART_MODES[0];
}

export function getReportBuilderPresetBlockIds(
  presetId: unknown,
): ReportBuilderBlockId[] {
  const preset = getReportBuilderPreset(presetId);

  return normalizeReportBuilderSelection(
    preset?.blockIds ?? REPORT_BUILDER_DEFAULT_BLOCK_IDS,
  );
}

export function normalizeReportCompositionTemplateInput(input: {
  name: unknown;
  description?: unknown;
  presetId?: unknown;
  chartModeId?: unknown;
  blockIds?: readonly unknown[] | null;
  presentation?: unknown;
}): NormalizedReportCompositionTemplateInput {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (name.length < 2) {
    throw new Error("Template name is required.");
  }

  if (name.length > 80) {
    throw new Error("Template name must be 80 characters or fewer.");
  }

  const description =
    typeof input.description === "string" && input.description.trim()
      ? input.description.trim().slice(0, 160)
      : null;
  const presetId = isReportBuilderPresetSelectionId(input.presetId)
    ? input.presetId
    : "custom";
  const preset = getReportBuilderPreset(presetId);
  const chartMode = getReportBuilderChartMode(
    input.chartModeId ?? preset?.chartModeId,
  );
  const blockIds = ensureReportBuilderStoryBlockSelection(
    input.blockIds ?? preset?.blockIds ?? REPORT_BUILDER_DEFAULT_BLOCK_IDS,
    chartMode.id,
  );

  return {
    name,
    description,
    presetId,
    chartModeId: chartMode.id,
    blockIds,
    presentation: normalizeReportBuilderPresentation(input.presentation),
  };
}

export function normalizeReportCompositionSelection(input: {
  presetId?: unknown;
  chartModeId?: unknown;
  blockIds?: readonly unknown[] | null;
  presentation?: unknown;
}): NormalizedReportCompositionSelection {
  const presetId = isReportBuilderPresetSelectionId(input.presetId)
    ? input.presetId
    : REPORT_BUILDER_DEFAULT_PRESET_ID;
  const preset = getReportBuilderPreset(presetId);
  const chartMode = getReportBuilderChartMode(
    input.chartModeId ?? preset?.chartModeId,
  );

  return {
    presetId,
    chartModeId: chartMode.id,
    blockIds: ensureReportBuilderStoryBlockSelection(
      input.blockIds ?? preset?.blockIds ?? REPORT_BUILDER_DEFAULT_BLOCK_IDS,
      chartMode.id,
    ),
    presentation: normalizeReportBuilderPresentation(input.presentation),
  };
}

export function isReportBuilderBlockSelected(
  blockIds: readonly ReportBuilderBlockId[],
  blockId: ReportBuilderBlockId,
) {
  return blockIds.includes(blockId);
}

export function moveReportBuilderBlockSelection(
  blockIds: readonly unknown[] | null | undefined,
  blockId: ReportBuilderBlockId,
  direction: "earlier" | "later",
): ReportBuilderBlockId[] {
  const normalized = normalizeReportBuilderSelection(blockIds);
  const currentIndex = normalized.indexOf(blockId);
  const nextIndex = direction === "earlier" ? currentIndex - 1 : currentIndex + 1;

  if (
    currentIndex === -1 ||
    nextIndex < 0 ||
    nextIndex >= normalized.length
  ) {
    return normalized;
  }

  const next = [...normalized];
  [next[currentIndex], next[nextIndex]] = [next[nextIndex], next[currentIndex]];

  return next;
}

function isCampaignChannelSection(section: ReportExportSection) {
  return section.sourceGroup !== "proof_source";
}

function isProofSourceSection(section: ReportExportSection) {
  return section.sourceGroup === "proof_source";
}

export function buildReportExportDataForBlocks(
  data: ReportExportData,
  blockIds: readonly unknown[] | null | undefined,
): ReportExportData {
  const selected = normalizeReportBuilderSelection(blockIds);
  const selectedSet = new Set<ReportBuilderBlockId>(selected);
  const blockById = new Map(
    REPORT_BUILDER_BLOCKS.map((block) => [block.id, block]),
  );
  const selectedBlocks = selected
    .map((blockId) => blockById.get(blockId))
    .filter((block): block is ReportBuilderBlock => Boolean(block))
    .map((block) => ({
      id: block.id,
      title: block.title,
      detail: block.detail,
      executivePurpose: block.executivePurpose,
    }));

  return {
    ...data,
    blocks: selectedBlocks,
    kpis: selectedSet.has("executive_summary") ? data.kpis : [],
    trust: selectedSet.has("report_trust") ? data.trust : [],
    recommendations: selectedSet.has("recommendations") ? data.recommendations : [],
    sections: data.sections.filter((section) => {
      if (isCampaignChannelSection(section)) {
        return selectedSet.has("channel_story");
      }

      if (isProofSourceSection(section)) {
        return selectedSet.has("proof_sources");
      }

      return false;
    }),
    creators: selectedSet.has("creator_table") ? data.creators : [],
  };
}

function filterReportSummaryItemsByIds<
  Item extends { key?: string | null; label: string },
>(items: Item[], ids?: readonly string[] | null): Item[] {
  const normalizedIds = normalizeReportPresentationIds(ids);
  if (!normalizedIds) return items;

  const selectedIds = new Set(normalizedIds);
  const filtered = items.filter((item) =>
    typeof item.key === "string" && selectedIds.has(item.key),
  );

  return filtered.length > 0 ? filtered : items;
}

function getReportSummaryItemId(item: { key?: string | null; label: string }): string {
  return typeof item.key === "string" && item.key.trim() ? item.key.trim() : item.label;
}

function applyReportSummaryItemLabels<
  Item extends { key?: string | null; label: string },
>(items: Item[], labels?: Record<string, string> | null): Item[] {
  if (!labels) return items;

  return items.map((item) => {
    const label = labels[getReportSummaryItemId(item)]?.trim();
    return label ? { ...item, label } : item;
  });
}

function pickReportSummaryItemLabels(
  items: Array<{ key?: string | null; label: string }>,
  labels?: Record<string, string> | null,
): Record<string, string> | null {
  if (!labels) return null;

  const picked: Record<string, string> = {};

  for (const item of items) {
    const id = getReportSummaryItemId(item);
    const label = labels[id]?.trim();
    if (!label) continue;

    picked[id] = label;
  }

  return Object.keys(picked).length > 0 ? picked : null;
}

function buildReportCompositionPresentation(
  presentation: ReportBuilderPresentation,
  kpis: ReportExportData["kpis"],
  trust: ReportExportData["trust"],
): ReportBuilderPresentation {
  const basePresentation = { ...presentation };
  delete basePresentation.kpiLabels;
  delete basePresentation.trustLabels;
  const kpiLabels = pickReportSummaryItemLabels(kpis, presentation.kpiLabels);
  const trustLabels = pickReportSummaryItemLabels(trust, presentation.trustLabels);

  return {
    ...basePresentation,
    ...(kpiLabels ? { kpiLabels } : {}),
    ...(trustLabels ? { trustLabels } : {}),
  };
}

function applyReportBlockLabels(
  blocks: ReportExportData["blocks"],
  labels?: Partial<Record<ReportBuilderBlockId, string>> | null,
): ReportExportData["blocks"] {
  if (!blocks?.length || !labels) return blocks;

  return blocks.map((block) => {
    if (!isReportBuilderBlockId(block.id)) return block;

    const title = labels[block.id];
    return title ? { ...block, title } : block;
  });
}

export function buildReportCompositionExportData(
  data: ReportExportData,
  {
    blockIds,
    chartModeId,
    presetId,
    presentation,
    template,
  }: {
    blockIds?: readonly unknown[] | null;
    chartModeId?: unknown;
    presetId?: ReportBuilderPresetSelectionId | null;
    presentation?: unknown;
    template?: ReportBuilderTemplateReference | null;
} = {},
): ReportExportData {
  const preset = getReportBuilderPreset(presetId);
  const chartMode = getReportBuilderChartMode(chartModeId ?? preset?.chartModeId);
  const selectedBlockIds = ensureReportBuilderStoryBlockSelection(
    blockIds ?? preset?.blockIds ?? REPORT_BUILDER_DEFAULT_BLOCK_IDS,
    chartMode.id,
  );
  const filtered = buildReportExportDataForBlocks(data, selectedBlockIds);
  const normalizedPresentation = normalizeReportBuilderPresentation(
    presentation ?? template?.presentation,
  );
  const executiveQuestion =
    normalizedPresentation.executiveQuestion ??
    preset?.executiveQuestion ??
    REPORT_BUILDER_CUSTOM_PRESET.executiveQuestion;
  const kpis = applyReportSummaryItemLabels(
    filterReportSummaryItemsByIds(
      filtered.kpis,
      normalizedPresentation.kpiIds,
    ),
    normalizedPresentation.kpiLabels,
  );
  const trust = applyReportSummaryItemLabels(
    filterReportSummaryItemsByIds(
      filtered.trust,
      normalizedPresentation.trustIds,
    ),
    normalizedPresentation.trustLabels,
  );
  const blocks = applyReportBlockLabels(
    filtered.blocks,
    normalizedPresentation.sectionLabels,
  );
  const compositionPresentation = buildReportCompositionPresentation(
    normalizedPresentation,
    kpis,
    trust,
  );

  return {
    ...filtered,
    blocks,
    kpis,
    trust,
    composition: {
      ...(normalizedPresentation.headline
        ? { reportTitle: normalizedPresentation.headline }
        : {}),
      presetId: preset?.id ?? "custom",
      presetTitle: preset?.title ?? REPORT_BUILDER_CUSTOM_PRESET.title,
      presetDetail: preset?.detail ?? REPORT_BUILDER_CUSTOM_PRESET.detail,
      bestFor: preset?.bestFor ?? REPORT_BUILDER_CUSTOM_PRESET.bestFor,
      executiveQuestion,
      chartModeId: chartMode.id,
      chartModeTitle: chartMode.title,
      chartModeDetail: chartMode.detail,
      chartLayoutTitle: chartMode.layoutTitle,
      chartLayoutDetail: chartMode.layoutDetail,
      presentation: compositionPresentation,
      ...(template
        ? {
            templateId: template.id ?? null,
            templateName: template.name,
            templateDescription: template.description ?? null,
          }
        : {}),
    },
  };
}
