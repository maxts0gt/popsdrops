import {
  normalizeReportCompositionSelection,
  type ReportBuilderBlockId,
  type ReportBuilderChartModeId,
  type ReportBuilderPresetSelectionId,
} from "./report-builder";

export type ReportGoalPlan = {
  report_preset_id?: unknown;
  report_chart_mode_id?: unknown;
  report_block_ids?: readonly unknown[] | null;
} | null;

export type ReportGoalContext = {
  presetId: ReportBuilderPresetSelectionId;
  chartModeId: ReportBuilderChartModeId;
  blockIds: ReportBuilderBlockId[];
  titleKey: string;
  blockLabelKeys: string[];
};

export type CreatorReportGoalPlan = ReportGoalPlan;
export type CreatorReportGoalContext = ReportGoalContext;

const PRESET_TITLE_KEYS: Record<ReportBuilderPresetSelectionId, string> = {
  custom: "reportGoal.preset.custom",
  leadership: "reportGoal.preset.leadership",
  proof_audit: "reportGoal.preset.proofAudit",
  creator_performance: "reportGoal.preset.creatorPerformance",
};

const BLOCK_LABEL_KEYS: Record<ReportBuilderBlockId, string> = {
  report_framing: "reportGoal.block.reportFraming",
  executive_summary: "reportGoal.block.executiveSummary",
  channel_story: "reportGoal.block.channelStory",
  proof_sources: "reportGoal.block.proofSources",
  report_trust: "reportGoal.block.reportTrust",
  creator_table: "reportGoal.block.creatorTable",
  recommendations: "reportGoal.block.recommendations",
};

export function getReportGoalContext(plan: ReportGoalPlan): ReportGoalContext {
  const normalized = normalizeReportCompositionSelection({
    presetId: plan?.report_preset_id,
    chartModeId: plan?.report_chart_mode_id,
    blockIds: plan?.report_block_ids,
  });

  return {
    presetId: normalized.presetId,
    chartModeId: normalized.chartModeId,
    blockIds: normalized.blockIds,
    titleKey: PRESET_TITLE_KEYS[normalized.presetId],
    blockLabelKeys: normalized.blockIds.map((blockId) => BLOCK_LABEL_KEYS[blockId]),
  };
}

export function getCreatorReportGoalContext(
  plan: CreatorReportGoalPlan,
): CreatorReportGoalContext {
  return getReportGoalContext(plan);
}
