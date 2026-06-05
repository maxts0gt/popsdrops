import { describe, expect, it } from "vitest";

import {
  getCreatorReportGoalContext,
  getReportGoalContext,
} from "./creator-report-goal-context";

describe("creator report goal context", () => {
  it("turns a leadership report plan into creator-facing proof context", () => {
    expect(
      getCreatorReportGoalContext({
        report_preset_id: "leadership",
        report_chart_mode_id: "trend",
        report_block_ids: [
          "executive_summary",
          "channel_story",
          "report_trust",
          "recommendations",
        ],
      }),
    ).toEqual({
      blockIds: [
        "executive_summary",
        "channel_story",
        "report_trust",
        "recommendations",
      ],
      blockLabelKeys: [
        "reportGoal.block.executiveSummary",
        "reportGoal.block.channelStory",
        "reportGoal.block.reportTrust",
        "reportGoal.block.recommendations",
      ],
      chartModeId: "trend",
      presetId: "leadership",
      titleKey: "reportGoal.preset.leadership",
    });
  });

  it("falls back to the standard creator-performance report goal", () => {
    expect(getCreatorReportGoalContext(null)).toMatchObject({
      chartModeId: "comparison",
      presetId: "creator_performance",
      titleKey: "reportGoal.preset.creatorPerformance",
    });
  });

  it("exposes the same report context for brand proof-review surfaces", () => {
    expect(getReportGoalContext({ report_preset_id: "proof_audit" })).toMatchObject({
      blockIds: ["proof_sources", "report_trust", "creator_table"],
      chartModeId: "proof",
      presetId: "proof_audit",
      titleKey: "reportGoal.preset.proofAudit",
    });
  });
});
