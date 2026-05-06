import { describe, expect, it } from "vitest";

import {
  buildMetricValueRows,
  mapMetricValuesToLegacyPerformanceColumns,
} from "./metric-values";

describe("reporting metric values", () => {
  it("maps common metric values into legacy report columns", () => {
    expect(
      mapMetricValuesToLegacyPerformanceColumns([
        { metricKey: "views", metricValue: 1200 },
        { metricKey: "likes", metricValue: 80 },
        { metricKey: "comments", metricValue: 12 },
        { metricKey: "shares", metricValue: 4 },
        { metricKey: "favorites", metricValue: 9 },
        { metricKey: "avg_watch_time_seconds", metricValue: 7.2 },
      ]),
    ).toEqual({
      views: 1200,
      likes: 80,
      comments: 12,
      shares: 4,
      saves: 9,
      avg_watch_time_seconds: 7.2,
    });
  });

  it("builds sparse metric rows with creator manual source", () => {
    const rows = buildMetricValueRows({
      performanceId: "performance-1",
      reportTaskId: "task-1",
      platform: "x",
      metricValues: [
        { metricKey: "impressions", metricLabel: "Impressions", metricValue: 15000 },
        { metricKey: "bookmarks", metricLabel: "Bookmarks", metricValue: 35 },
      ],
      sourceType: "creator_manual",
      confirmedByCreator: false,
    });

    expect(rows).toEqual([
      {
        performance_id: "performance-1",
        report_task_id: "task-1",
        platform: "x",
        metric_key: "impressions",
        metric_label: "Impressions",
        metric_value: 15000,
        metric_text: null,
        source_type: "creator_manual",
        confirmed_by_creator: false,
        confirmed_at: null,
      },
      {
        performance_id: "performance-1",
        report_task_id: "task-1",
        platform: "x",
        metric_key: "bookmarks",
        metric_label: "Bookmarks",
        metric_value: 35,
        metric_text: null,
        source_type: "creator_manual",
        confirmed_by_creator: false,
        confirmed_at: null,
      },
    ]);
  });
});
