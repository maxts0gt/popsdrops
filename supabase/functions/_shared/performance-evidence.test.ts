import { describe, expect, it } from "vitest";
import { parseStructuredCsvMetricPayload } from "./performance-evidence.ts";

describe("performance evidence parsing", () => {
  it("extracts expected metrics from a metric-value CSV without Gemini", () => {
    const parsed = parseStructuredCsvMetricPayload(
      [
        "metric,value",
        "views,12000",
        "likes,900",
        "comments,33",
        "shares,12",
      ].join("\n"),
      [
        { metricKey: "views", metricLabel: "Views" },
        { metricKey: "likes", metricLabel: "Likes" },
        { metricKey: "comments", metricLabel: "Comments" },
      ],
    );

    expect(parsed.metricValues).toEqual([
      {
        metricKey: "views",
        metricLabel: "Views",
        metricValue: 12000,
        confidence: 1,
      },
      {
        metricKey: "likes",
        metricLabel: "Likes",
        metricValue: 900,
        confidence: 1,
      },
      {
        metricKey: "comments",
        metricLabel: "Comments",
        metricValue: 33,
        confidence: 1,
      },
    ]);
    expect(parsed.confidenceSummary).toMatchObject({
      overall: 1,
      method: "structured_csv",
    });
  });
});
