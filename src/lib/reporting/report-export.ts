export interface ReportExportMetricPoint {
  date: string;
  label: string;
  value: number;
}

export interface ReportExportMetric {
  key?: string;
  label: string;
  value: string;
  detail: string;
  points: ReportExportMetricPoint[];
}

export interface ReportExportSection {
  title: string;
  detail: string;
  metrics: ReportExportMetric[];
}

export interface ReportExportTrustItem {
  label: string;
  value: string;
  detail: string;
}

export interface ReportExportCreator {
  name: string;
  market: string;
  platform: string;
  views: string;
  engagements: string;
  er: string;
  cpe: string;
  spent: string;
  rating: string;
}

export interface ReportExportData {
  campaignTitle: string;
  dateRange: string;
  generatedAt: string;
  kpis: Array<{ label: string; value: string; detail?: string }>;
  trust: ReportExportTrustItem[];
  sections: ReportExportSection[];
  creators: ReportExportCreator[];
}

export function buildSafeExportName(title: string): string {
  return title
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase() || "campaign";
}

export function buildReportFilename(title: string, extension: string): string {
  return `popsdrops-report-${buildSafeExportName(title)}.${extension}`;
}

export function buildJsonContent(data: ReportExportData): string {
  return JSON.stringify(data, null, 2);
}

function escapeCsvCell(value: string): string {
  if (!/[",\n\r]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

export function buildCsvContent(data: ReportExportData): string {
  const rows = [
    [
      "Creator",
      "Market",
      "Platform",
      "Views",
      "Engagements",
      "ER",
      "CPE",
      "Spent",
      "Rating",
    ],
    ...data.creators.map((creator) => [
      creator.name,
      creator.market,
      creator.platform,
      creator.views,
      creator.engagements,
      creator.er,
      creator.cpe,
      creator.spent,
      creator.rating,
    ]),
  ];

  return rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatHtmlGeneratedDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatHtmlPointDate(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;

  return `${String(date.getUTCMonth() + 1).padStart(2, "0")}/${String(
    date.getUTCDate(),
  ).padStart(2, "0")}`;
}

function formatHtmlAxisValue(metric: ReportExportMetric, value: number): string {
  const sampleLabel = metric.points.find((point) => point.label)?.label ?? metric.value;

  if (sampleLabel.includes("$")) {
    return `$${value.toLocaleString("en-US", {
      maximumFractionDigits: value < 10 ? 2 : 0,
    })}`;
  }

  if (sampleLabel.includes("%")) {
    return `${value.toFixed(1)}%`;
  }

  if (sampleLabel.includes("K") && value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }

  return value.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

function buildHtmlMetricCard(metric: { label: string; value: string; detail?: string }): string {
  return `<article class="metric-card">
    <p>${escapeHtml(metric.label)}</p>
    <strong>${escapeHtml(metric.value)}</strong>
    ${metric.detail ? `<span>${escapeHtml(metric.detail)}</span>` : ""}
  </article>`;
}

function buildHtmlLineChart(metric: ReportExportMetric): string {
  const points = metric.points;
  if (points.length === 0) {
    return `<div class="chart-empty">No chart data yet.</div>`;
  }

  const width = 760;
  const height = 300;
  const left = 58;
  const right = 34;
  const top = 28;
  const bottom = 58;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const maxValue = Math.max(...points.map((point) => point.value), 1);
  const midValue = maxValue / 2;

  const positions = points.map((point, index) => {
    const x = points.length === 1
      ? left + chartWidth / 2
      : left + (index / (points.length - 1)) * chartWidth;
    const y = top + chartHeight - (point.value / maxValue) * chartHeight;

    return { point, x, y };
  });
  const linePath = positions
    .map((position, index) => `${index === 0 ? "M" : "L"} ${position.x.toFixed(1)} ${position.y.toFixed(1)}`)
    .join(" ");
  const areaPath = `${linePath} L ${positions[positions.length - 1].x.toFixed(1)} ${top + chartHeight} L ${positions[0].x.toFixed(1)} ${top + chartHeight} Z`;
  const circles = positions
    .map(
      ({ point, x, y }) => `<g>
        <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4.5" />
        <title>${escapeHtml(`${metric.label}: ${point.label} on ${formatHtmlPointDate(point.date)}`)}</title>
      </g>`,
    )
    .join("");
  const xLabels = positions
    .map(
      ({ point, x }) => `<text x="${x.toFixed(1)}" y="${height - 22}" text-anchor="middle">${escapeHtml(
        formatHtmlPointDate(point.date),
      )}</text>`,
    )
    .join("");

  return `<svg class="chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(metric.label)} chart">
    <defs>
      <linearGradient id="chart-fill-${escapeHtml(metric.key ?? metric.label).replace(/[^a-z0-9]+/gi, "-")}" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="#0f172a" stop-opacity="0.12" />
        <stop offset="100%" stop-color="#0f172a" stop-opacity="0" />
      </linearGradient>
    </defs>
    <line class="grid-line" x1="${left}" y1="${top}" x2="${width - right}" y2="${top}" />
    <line class="grid-line" x1="${left}" y1="${top + chartHeight / 2}" x2="${width - right}" y2="${top + chartHeight / 2}" />
    <line class="axis-line" x1="${left}" y1="${top + chartHeight}" x2="${width - right}" y2="${top + chartHeight}" />
    <text class="axis-label" x="${left - 14}" y="${top + 4}" text-anchor="end">${escapeHtml(formatHtmlAxisValue(metric, maxValue))}</text>
    <text class="axis-label" x="${left - 14}" y="${top + chartHeight / 2 + 4}" text-anchor="end">${escapeHtml(formatHtmlAxisValue(metric, midValue))}</text>
    <text class="axis-label" x="${left - 14}" y="${top + chartHeight + 4}" text-anchor="end">0</text>
    <path class="chart-area" d="${areaPath}" fill="url(#chart-fill-${escapeHtml(metric.key ?? metric.label).replace(/[^a-z0-9]+/gi, "-")})" />
    <path class="chart-line" d="${linePath}" />
    <g class="chart-points">${circles}</g>
    <g class="chart-dates">${xLabels}</g>
  </svg>`;
}

function buildHtmlSection(section: ReportExportSection): string {
  return `<section class="report-section">
    <div class="section-head">
      <div>
        <p>${escapeHtml(section.title)}</p>
        <h2>${escapeHtml(section.detail || section.title)}</h2>
      </div>
    </div>
    <div class="chart-grid">
      ${section.metrics
        .map(
          (metric) => `<article class="chart-card">
            <div class="chart-card-head">
              <div>
                <p>${escapeHtml(metric.label)}</p>
                <strong>${escapeHtml(metric.value)}</strong>
              </div>
              <span>${escapeHtml(metric.detail)}</span>
            </div>
            ${buildHtmlLineChart(metric)}
          </article>`,
        )
        .join("")}
    </div>
  </section>`;
}

function buildHtmlCreatorRows(data: ReportExportData): string {
  if (data.creators.length === 0) {
    return `<tr><td colspan="9">No creator rows yet.</td></tr>`;
  }

  return data.creators
    .map(
      (creator) => `<tr>
        <td>${escapeHtml(creator.name)}</td>
        <td>${escapeHtml(creator.market)}</td>
        <td>${escapeHtml(creator.platform)}</td>
        <td>${escapeHtml(creator.views)}</td>
        <td>${escapeHtml(creator.engagements)}</td>
        <td>${escapeHtml(creator.er)}</td>
        <td>${escapeHtml(creator.cpe)}</td>
        <td>${escapeHtml(creator.spent)}</td>
        <td>${escapeHtml(creator.rating)}</td>
      </tr>`,
    )
    .join("");
}

export function buildHtmlDocument(data: ReportExportData): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(data.campaignTitle)} Report</title>
    <style>
      :root {
        color-scheme: light;
        --ink: #0f172a;
        --muted: #64748b;
        --line: #e2e8f0;
        --soft: #f8fafc;
        --card: #ffffff;
        --teal: #0d9488;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        background: var(--soft);
        color: var(--ink);
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      .topbar {
        background: var(--ink);
        color: #fff;
        padding: 30px 40px;
      }
      .topbar-inner {
        align-items: start;
        display: flex;
        justify-content: space-between;
        gap: 24px;
        margin: 0 auto;
        max-width: 1180px;
      }
      .brand { font-size: 30px; font-weight: 700; letter-spacing: 0; }
      .generated { color: #e2e8f0; font-size: 14px; margin-top: 7px; text-align: end; }
      main { margin: 0 auto; max-width: 1180px; padding: 34px 32px 56px; }
      h1 { font-size: 30px; line-height: 1.15; margin: 0; }
      .date-range { color: var(--muted); font-size: 15px; margin: 8px 0 26px; }
      .metric-grid, .trust-grid {
        display: grid;
        gap: 14px;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      }
      .metric-card, .trust-card, .chart-card, .creator-table {
        background: var(--card);
        border: 1px solid var(--line);
        border-radius: 16px;
      }
      .metric-card { min-height: 118px; padding: 18px; }
      .metric-card p, .trust-card p, .chart-card-head p, .section-head p {
        color: var(--muted);
        font-size: 12px;
        font-weight: 650;
        margin: 0;
      }
      .metric-card strong {
        display: block;
        font-size: 26px;
        line-height: 1;
        margin-top: 24px;
      }
      .metric-card span, .trust-card span, .chart-card-head span {
        color: var(--muted);
        display: block;
        font-size: 12px;
        margin-top: 10px;
      }
      .trust-grid { margin-top: 18px; }
      .trust-card { padding: 16px; }
      .trust-card strong {
        display: block;
        font-size: 20px;
        margin-top: 14px;
      }
      .report-section { margin-top: 28px; }
      .section-head {
        align-items: end;
        display: flex;
        justify-content: space-between;
        margin-bottom: 12px;
      }
      .section-head h2 {
        font-size: 19px;
        line-height: 1.2;
        margin: 6px 0 0;
      }
      .chart-grid {
        display: grid;
        gap: 14px;
        grid-template-columns: repeat(auto-fit, minmax(420px, 1fr));
      }
      .chart-card { overflow: hidden; padding: 18px; }
      .chart-card-head {
        align-items: start;
        display: flex;
        justify-content: space-between;
        gap: 18px;
      }
      .chart-card-head strong {
        display: block;
        font-size: 24px;
        margin-top: 8px;
      }
      .chart-svg { display: block; height: auto; margin-top: 10px; width: 100%; }
      .grid-line { stroke: #e8edf3; stroke-width: 1; }
      .axis-line { stroke: #d5dde8; stroke-width: 1; }
      .axis-label, .chart-dates text {
        fill: var(--muted);
        font-size: 12px;
        font-weight: 600;
      }
      .chart-line {
        fill: none;
        stroke: var(--ink);
        stroke-linecap: round;
        stroke-linejoin: round;
        stroke-width: 3;
      }
      .chart-points circle {
        fill: #fff;
        stroke: var(--ink);
        stroke-width: 3;
      }
      .chart-empty {
        align-items: center;
        color: var(--muted);
        display: flex;
        min-height: 180px;
      }
      .creator-table { margin-top: 28px; overflow: hidden; }
      .creator-table h2 { font-size: 18px; margin: 18px 18px 0; }
      table { border-collapse: collapse; width: 100%; }
      th, td {
        border-top: 1px solid var(--line);
        font-size: 13px;
        padding: 13px 16px;
        text-align: start;
      }
      th {
        color: var(--muted);
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
      }
      @media (max-width: 720px) {
        .topbar { padding: 24px; }
        .topbar-inner { display: block; }
        .generated { text-align: start; }
        main { padding: 24px 18px 40px; }
        .chart-grid { grid-template-columns: 1fr; }
        table { min-width: 760px; }
        .creator-table { overflow-x: auto; }
      }
    </style>
  </head>
  <body>
    <header class="topbar">
      <div class="topbar-inner">
        <div>
          <div class="brand">PopsDrops</div>
          <div>Campaign Report</div>
        </div>
        <div class="generated">Generated ${escapeHtml(formatHtmlGeneratedDate(data.generatedAt))}</div>
      </div>
    </header>
    <main>
      <h1>${escapeHtml(data.campaignTitle)} Report</h1>
      <p class="date-range">${escapeHtml(data.dateRange)}</p>
      <section class="metric-grid">${data.kpis.map(buildHtmlMetricCard).join("")}</section>
      <section class="trust-grid">
        ${data.trust
          .map(
            (item) => `<article class="trust-card">
              <p>${escapeHtml(item.label)}</p>
              <strong>${escapeHtml(item.value)}</strong>
              <span>${escapeHtml(item.detail)}</span>
            </article>`,
          )
          .join("")}
      </section>
      ${data.sections.map(buildHtmlSection).join("")}
      <section class="creator-table">
        <h2>Creator Performance</h2>
        <table>
          <thead>
            <tr>
              <th>Creator</th>
              <th>Market</th>
              <th>Platform</th>
              <th>Views</th>
              <th>Engagements</th>
              <th>ER</th>
              <th>CPE</th>
              <th>Spent</th>
              <th>Rating</th>
            </tr>
          </thead>
          <tbody>${buildHtmlCreatorRows(data)}</tbody>
        </table>
      </section>
    </main>
  </body>
</html>`;
}
