import { describe, expect, it } from "vitest";

import {
  buildCsvContent,
  buildHtmlDocument,
  buildJsonContent,
  buildSafeExportName,
  type ReportExportData,
} from "./report-export";

const exportData: ReportExportData = {
  campaignTitle: "Spring Launch / Seoul",
  dateRange: "May 7, 2026 to May 15, 2026",
  generatedAt: "2026-05-06T00:00:00.000Z",
  kpis: [
    { label: "Views", value: "47.4K", detail: "2 channels" },
    { label: "Engagement Rate", value: "13.1%", detail: "All Channels" },
  ],
  trust: [
    { label: "Evidence-backed reads", value: "6/6", detail: "Native analytics screenshots" },
  ],
  sections: [
    {
      title: "All Channels",
      detail: "Compared by channel.",
      metrics: [
        {
          label: "Views",
          value: "47.4K",
          detail: "2 channels",
          points: [
            { date: "2026-05-09", value: 22000, label: "22.0K" },
            { date: "2026-05-18", value: 47400, label: "47.4K" },
          ],
        },
      ],
    },
  ],
  creators: [
    {
      name: "Ava Kim",
      market: "South Korea",
      platform: "TikTok",
      views: "30.6K",
      engagements: "3.5K",
      er: "11.4%",
      cpe: "$0.43",
      spent: "$1,500",
      rating: "-",
    },
  ],
};

describe("report export helpers", () => {
  it("builds stable export file names", () => {
    expect(buildSafeExportName(exportData.campaignTitle)).toBe("spring-launch-seoul");
  });

  it("builds JSON with sectioned report data", () => {
    const json = JSON.parse(buildJsonContent(exportData)) as ReportExportData;

    expect(json.campaignTitle).toBe("Spring Launch / Seoul");
    expect(json.sections[0].metrics[0].points[1].label).toBe("47.4K");
  });

  it("builds CSV from creator performance rows", () => {
    const csv = buildCsvContent(exportData);

    expect(csv).toContain("Creator,Market,Platform,Views,Engagements,ER,CPE,Spent,Rating");
    expect(csv).toContain('Ava Kim,South Korea,TikTok,30.6K,3.5K,11.4%,$0.43,"$1,500",-');
  });

  it("builds a standalone HTML report with inline charts", () => {
    const html = buildHtmlDocument(exportData);

    expect(html).toContain("<!doctype html>");
    expect(html).toContain("Spring Launch / Seoul Report");
    expect(html).toContain("Evidence-backed reads");
    expect(html).toContain("<svg");
    expect(html).toContain("Ava Kim");
    expect(html).not.toContain("<link");
    expect(html).not.toContain("/_next");
    expect(html).not.toContain("http://localhost");
  });
});
