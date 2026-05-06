import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  buildCsvContent,
  buildHtmlDocument,
  buildJsonContent,
  buildReportFilename,
  type ReportExportData,
  type ReportExportMetric,
  type ReportExportSection,
} from "@/lib/reporting/report-export";

export type {
  ReportExportCreator,
  ReportExportData,
  ReportExportMetric,
  ReportExportMetricPoint,
  ReportExportSection,
  ReportExportTrustItem,
} from "@/lib/reporting/report-export";

type PdfColor = readonly [number, number, number];
type PptxSlide = {
  addText: (text: string, options?: Record<string, unknown>) => unknown;
  addShape: (shapeName: string, options?: Record<string, unknown>) => unknown;
  addTable: (rows: string[][], options?: Record<string, unknown>) => unknown;
};

const slate900 = [15, 23, 42] as const;
const slate700 = [51, 65, 85] as const;
const slate500 = [100, 116, 139] as const;
const slate200 = [226, 232, 240] as const;
const slate100 = [241, 245, 249] as const;
const deckColors = {
  slate900: "0F172A",
  slate700: "334155",
  slate500: "64748B",
  slate200: "E2E8F0",
  slate100: "F1F5F9",
  white: "FFFFFF",
  teal: "0D9488",
} as const;

function downloadBlob(filename: string, contents: BlobPart[], mimeType: string): void {
  const blob = new Blob(contents, { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function formatGeneratedDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatPdfPointDate(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;

  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  return `${month}/${day}`;
}

function addPageIfNeeded(doc: jsPDF, y: number, neededHeight: number): number {
  const pageHeight = doc.internal.pageSize.getHeight();

  if (y + neededHeight <= pageHeight - 14) {
    return y;
  }

  doc.addPage();
  return 18;
}

function sectionClaim(section: ReportExportSection): string {
  const metric = section.metrics[0];
  if (!metric) return section.detail;

  const points = metric.points;
  if (points.length < 2) return `${metric.label}: ${metric.value}`;

  return `${metric.label}: ${points[0].label} to ${points[points.length - 1].label}`;
}

function setTextColor(doc: jsPDF, color: PdfColor): void {
  doc.setTextColor(color[0], color[1], color[2]);
}

function setFillColor(doc: jsPDF, color: PdfColor): void {
  doc.setFillColor(color[0], color[1], color[2]);
}

function setDrawColor(doc: jsPDF, color: PdfColor): void {
  doc.setDrawColor(color[0], color[1], color[2]);
}

function addDeckText(
  slide: PptxSlide,
  text: string,
  options: Record<string, unknown>,
): void {
  slide.addText(text, options);
}

function addDeckSectionHeader(
  slide: PptxSlide,
  eyebrow: string,
  title: string,
  subtitle?: string,
): void {
  addDeckText(slide, eyebrow, {
    x: 0.55,
    y: 0.38,
    w: 4.5,
    h: 0.22,
    color: deckColors.slate500,
    fontFace: "Inter",
    fontSize: 8,
    bold: true,
    margin: 0,
  });
  addDeckText(slide, title, {
    x: 0.55,
    y: 0.68,
    w: 8.8,
    h: 0.45,
    color: deckColors.slate900,
    fontFace: "Inter",
    fontSize: 18,
    bold: true,
    margin: 0,
    fit: "shrink",
  });
  if (subtitle) {
    addDeckText(slide, subtitle, {
      x: 0.55,
      y: 1.2,
      w: 8.2,
      h: 0.3,
      color: deckColors.slate500,
      fontFace: "Inter",
      fontSize: 9,
      margin: 0,
      fit: "shrink",
    });
  }
}

function addDeckFooter(slide: PptxSlide, data: ReportExportData): void {
  slide.addShape("line", {
    x: 0.55,
    y: 7.08,
    w: 12.2,
    h: 0,
    line: { color: deckColors.slate200, width: 0.5 },
  });
  addDeckText(slide, "PopsDrops Campaign Report", {
    x: 0.55,
    y: 7.18,
    w: 3.4,
    h: 0.18,
    color: deckColors.slate500,
    fontFace: "Inter",
    fontSize: 6.5,
    margin: 0,
  });
  addDeckText(slide, data.dateRange, {
    x: 9.2,
    y: 7.18,
    w: 3.55,
    h: 0.18,
    color: deckColors.slate500,
    fontFace: "Inter",
    fontSize: 6.5,
    margin: 0,
    align: "right",
  });
}

function addDeckMetricCard(
  slide: PptxSlide,
  label: string,
  value: string,
  detail: string,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  slide.addShape("rect", {
    x,
    y,
    w,
    h,
    rectRadius: 0.08,
    fill: { color: deckColors.white },
    line: { color: deckColors.slate200, width: 0.7 },
  });
  addDeckText(slide, label, {
    x: x + 0.14,
    y: y + 0.12,
    w: w - 0.28,
    h: 0.25,
    color: deckColors.slate500,
    fontFace: "Inter",
    fontSize: 7.5,
    bold: true,
    margin: 0,
    fit: "shrink",
  });
  addDeckText(slide, value, {
    x: x + 0.14,
    y: y + 0.43,
    w: w - 0.28,
    h: 0.34,
    color: deckColors.slate900,
    fontFace: "Inter",
    fontSize: 17,
    bold: true,
    margin: 0,
    fit: "shrink",
  });
  addDeckText(slide, detail, {
    x: x + 0.14,
    y: y + h - 0.28,
    w: w - 0.28,
    h: 0.18,
    color: deckColors.slate500,
    fontFace: "Inter",
    fontSize: 6.8,
    margin: 0,
    fit: "shrink",
  });
}

function addDeckLineChart(
  slide: PptxSlide,
  metric: ReportExportMetric,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): void {
  slide.addShape("rect", {
    x,
    y,
    w,
    h,
    rectRadius: 0.08,
    fill: { color: deckColors.white },
    line: { color: deckColors.slate200, width: 0.7 },
  });
  addDeckText(slide, metric.label, {
    x: x + 0.18,
    y: y + 0.12,
    w: w - 1.45,
    h: 0.25,
    color: deckColors.slate700,
    fontFace: "Inter",
    fontSize: 8,
    bold: true,
    margin: 0,
  });
  addDeckText(slide, metric.value, {
    x: x + w - 1.22,
    y: y + 0.1,
    w: 1.02,
    h: 0.25,
    color: deckColors.slate900,
    fontFace: "Inter",
    fontSize: 8.5,
    bold: true,
    margin: 0,
    align: "right",
    fit: "shrink",
  });

  const chartX = x + 0.28;
  const chartY = y + 0.55;
  const chartW = w - 0.56;
  const chartH = h - 0.92;
  slide.addShape("line", {
    x: chartX,
    y: chartY + chartH,
    w: chartW,
    h: 0,
    line: { color: deckColors.slate200, width: 0.45 },
  });
  slide.addShape("line", {
    x: chartX,
    y: chartY + chartH / 2,
    w: chartW,
    h: 0,
    line: { color: deckColors.slate200, width: 0.35, transparency: 35 },
  });

  const points = metric.points;
  if (points.length === 0) return;

  const values = points.map((point) => point.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);
  const positioned = points.map((point, index) => ({
    point,
    x: points.length === 1 ? chartX + chartW / 2 : chartX + (index / (points.length - 1)) * chartW,
    y: chartY + chartH - ((point.value - min) / range) * (chartH - 0.12) - 0.06,
  }));

  positioned.forEach((point, index) => {
    if (index === 0) return;
    const previous = positioned[index - 1];
    slide.addShape("line", {
      x: previous.x,
      y: previous.y,
      w: point.x - previous.x,
      h: point.y - previous.y,
      line: { color, width: 1.15 },
    });
  });

  positioned.forEach((point, index) => {
    const size = index === positioned.length - 1 ? 0.09 : 0.07;
    slide.addShape("ellipse", {
      x: point.x - size / 2,
      y: point.y - size / 2,
      w: size,
      h: size,
      fill: { color: deckColors.white },
      line: { color, width: 0.8 },
    });
  });

  const first = positioned[0];
  const last = positioned[positioned.length - 1];
  addDeckText(slide, formatPdfPointDate(first.point.date), {
    x: chartX - 0.16,
    y: chartY + chartH + 0.1,
    w: 0.55,
    h: 0.14,
    color: deckColors.slate500,
    fontFace: "Inter",
    fontSize: 5.8,
    margin: 0,
  });
  if (first.point.date !== last.point.date) {
    addDeckText(slide, formatPdfPointDate(last.point.date), {
      x: chartX + chartW - 0.38,
      y: chartY + chartH + 0.1,
      w: 0.55,
      h: 0.14,
      color: deckColors.slate500,
      fontFace: "Inter",
      fontSize: 5.8,
      margin: 0,
      align: "right",
    });
  }
}

function drawLineChart({
  doc,
  metric,
  x,
  y,
  width,
  height,
  color,
}: {
  doc: jsPDF;
  metric: ReportExportMetric;
  x: number;
  y: number;
  width: number;
  height: number;
  color: PdfColor;
}): void {
  setDrawColor(doc, slate200);
  doc.setLineWidth(0.2);
  doc.line(x, y + height, x + width, y + height);
  doc.line(x, y + height / 2, x + width, y + height / 2);

  const points = metric.points;
  if (points.length === 0) {
    setTextColor(doc, slate500);
    doc.setFontSize(7);
    doc.text("No reads", x + width / 2, y + height / 2, { align: "center" });
    return;
  }

  const values = points.map((point) => point.value);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(max - min, 1);
  const positioned = points.map((point, index) => ({
    point,
    x: points.length === 1 ? x + width / 2 : x + (index / (points.length - 1)) * width,
    y: y + height - ((point.value - min) / range) * (height - 4) - 2,
  }));

  setDrawColor(doc, color);
  doc.setLineWidth(0.7);
  positioned.forEach((point, index) => {
    if (index === 0) return;
    const previous = positioned[index - 1];
    doc.line(previous.x, previous.y, point.x, point.y);
  });

  setFillColor(doc, [255, 255, 255] as const);
  positioned.forEach((point, index) => {
    setDrawColor(doc, color);
    doc.circle(point.x, point.y, index === positioned.length - 1 ? 1.6 : 1.2, "FD");
  });

  const first = positioned[0];
  const last = positioned[positioned.length - 1];
  setTextColor(doc, slate500);
  doc.setFontSize(6.5);
  doc.text(formatPdfPointDate(first.point.date), first.x, y + height + 5, {
    align: "center",
  });
  if (last.point.date !== first.point.date) {
    doc.text(formatPdfPointDate(last.point.date), last.x, y + height + 5, {
      align: "center",
    });
  }
}

export function exportReportPDF(data: ReportExportData): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;

  setFillColor(doc, slate900);
  doc.rect(0, 0, pageWidth, 28, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("PopsDrops", margin, 12);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Campaign Report", margin, 19);

  doc.setFontSize(9);
  doc.text(`Generated ${formatGeneratedDate(data.generatedAt)}`, pageWidth - margin, 12, {
    align: "right",
  });

  let y = 38;
  setTextColor(doc, slate900);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(data.campaignTitle, margin, y);

  y += 6;
  setTextColor(doc, slate500);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(data.dateRange, margin, y);

  y += 10;
  const kpiCount = data.kpis.length;
  const cardWidth = (contentWidth - (kpiCount - 1) * 4) / kpiCount;

  for (let i = 0; i < kpiCount; i++) {
    const x = margin + i * (cardWidth + 4);
    const kpi = data.kpis[i];

    setFillColor(doc, slate100);
    doc.roundedRect(x, y, cardWidth, 24, 2, 2, "F");

    setTextColor(doc, slate900);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(kpi.value, x + 4, y + 11);

    setTextColor(doc, slate500);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(kpi.label, x + 4, y + 18);
  }

  y += 34;

  if (data.trust.length > 0) {
    const trustWidth = (contentWidth - (data.trust.length - 1) * 4) / data.trust.length;
    data.trust.forEach((item, index) => {
      const x = margin + index * (trustWidth + 4);
      setDrawColor(doc, slate200);
      doc.roundedRect(x, y, trustWidth, 22, 2, 2, "S");
      setTextColor(doc, slate500);
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "normal");
      doc.text(item.label, x + 4, y + 6);
      setTextColor(doc, slate900);
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text(item.value, x + 4, y + 13);
      setTextColor(doc, slate500);
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "normal");
      doc.text(item.detail, x + 4, y + 19, { maxWidth: trustWidth - 8 });
    });
    y += 34;
  }

  data.sections.forEach((section) => {
    const rows = Math.ceil(section.metrics.length / 2);
    const sectionHeight = 14 + rows * 38;
    y = addPageIfNeeded(doc, y, sectionHeight);

    setTextColor(doc, slate900);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(section.title, margin, y);
    setTextColor(doc, slate500);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(section.detail, margin, y + 5);

    const chartWidth = (contentWidth - 8) / 2;
    section.metrics.forEach((metric, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = margin + column * (chartWidth + 8);
      const metricY = y + 12 + row * 38;

      setDrawColor(doc, slate200);
      doc.roundedRect(x, metricY, chartWidth, 32, 2, 2, "S");
      setTextColor(doc, slate700);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");
      doc.text(metric.label, x + 4, metricY + 6);
      setTextColor(doc, slate900);
      doc.setFontSize(9);
      doc.text(metric.value, x + chartWidth - 4, metricY + 6, { align: "right" });
      drawLineChart({
        doc,
        metric,
        x: x + 5,
        y: metricY + 11,
        width: chartWidth - 10,
        height: 15,
        color: column === 0 ? slate900 : [13, 148, 136],
      });
    });

    y += sectionHeight + 6;
  });

  y = addPageIfNeeded(doc, y, 52);
  setTextColor(doc, slate900);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Creator Performance", margin, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [
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
    ],
    body: data.creators.map((c) => [
      c.name,
      c.market,
      c.platform,
      c.views,
      c.engagements,
      c.er,
      c.cpe,
      c.spent,
      c.rating,
    ]),
    styles: {
      fontSize: 8,
      cellPadding: 3,
      textColor: slate900 as [number, number, number],
    },
    headStyles: {
      fillColor: slate900 as [number, number, number],
      textColor: [255, 255, 255],
      fontStyle: "bold",
      fontSize: 7,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    theme: "grid",
    tableLineColor: [226, 232, 240],
    tableLineWidth: 0.1,
  });

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    setTextColor(doc, slate500);
    doc.setFontSize(7);
    doc.text(
      `PopsDrops Campaign Report - ${data.campaignTitle} - Page ${i} of ${pageCount}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: "center" }
    );
  }

  doc.save(buildReportFilename(data.campaignTitle, "pdf"));
}

export function exportReportJSON(data: ReportExportData): void {
  downloadBlob(
    buildReportFilename(data.campaignTitle, "json"),
    [buildJsonContent(data)],
    "application/json;charset=utf-8",
  );
}

export function exportReportCSV(data: ReportExportData): void {
  downloadBlob(
    buildReportFilename(data.campaignTitle, "csv"),
    [buildCsvContent(data)],
    "text/csv;charset=utf-8",
  );
}

export function exportReportHTML(data: ReportExportData): void {
  downloadBlob(
    buildReportFilename(data.campaignTitle, "html"),
    [buildHtmlDocument(data)],
    "text/html;charset=utf-8",
  );
}

export async function exportReportPPTX(data: ReportExportData): Promise<void> {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const pptx = new PptxGenJS();

  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "PopsDrops";
  pptx.company = "Tengri Vertex, LLC";
  pptx.subject = "Campaign Report";
  pptx.title = `${data.campaignTitle} Report`;
  pptx.theme = {
    headFontFace: "Inter",
    bodyFontFace: "Inter",
  };

  const cover = pptx.addSlide() as unknown as PptxSlide;
  cover.addShape("rect", {
    x: 0,
    y: 0,
    w: 13.333,
    h: 7.5,
    fill: { color: deckColors.slate900 },
    line: { color: deckColors.slate900 },
  });
  addDeckText(cover, "PopsDrops", {
    x: 0.65,
    y: 0.58,
    w: 2.2,
    h: 0.28,
    color: deckColors.white,
    fontFace: "Inter",
    fontSize: 12,
    bold: true,
    margin: 0,
  });
  addDeckText(cover, "Campaign report", {
    x: 0.65,
    y: 2.15,
    w: 3.2,
    h: 0.28,
    color: deckColors.slate200,
    fontFace: "Inter",
    fontSize: 12,
    margin: 0,
  });
  addDeckText(cover, data.campaignTitle, {
    x: 0.65,
    y: 2.55,
    w: 8.8,
    h: 0.78,
    color: deckColors.white,
    fontFace: "Inter",
    fontSize: 28,
    bold: true,
    margin: 0,
    fit: "shrink",
  });
  addDeckText(cover, data.dateRange, {
    x: 0.65,
    y: 3.45,
    w: 4.8,
    h: 0.28,
    color: deckColors.slate200,
    fontFace: "Inter",
    fontSize: 11,
    margin: 0,
  });
  addDeckText(cover, `Generated ${formatGeneratedDate(data.generatedAt)}`, {
    x: 9.1,
    y: 6.83,
    w: 3.55,
    h: 0.2,
    color: deckColors.slate200,
    fontFace: "Inter",
    fontSize: 8,
    margin: 0,
    align: "right",
  });

  const overview = pptx.addSlide() as unknown as PptxSlide;
  addDeckSectionHeader(overview, "Overview", "Performance summary", data.dateRange);
  data.kpis.slice(0, 5).forEach((kpi, index) => {
    addDeckMetricCard(
      overview,
      kpi.label,
      kpi.value,
      kpi.detail || "",
      0.55 + index * 2.48,
      1.72,
      2.28,
      1.18,
    );
  });
  data.trust.slice(0, 4).forEach((item, index) => {
    addDeckMetricCard(
      overview,
      item.label,
      item.value,
      item.detail,
      0.55 + index * 3.08,
      3.36,
      2.88,
      1.14,
    );
  });
  addDeckText(overview, "How to read this deck", {
    x: 0.55,
    y: 5.18,
    w: 2.4,
    h: 0.24,
    color: deckColors.slate900,
    fontFace: "Inter",
    fontSize: 10,
    bold: true,
    margin: 0,
  });
  addDeckText(
    overview,
    "Each section keeps channel metrics together and uses CPE as the cross-channel equalizer.",
    {
      x: 0.55,
      y: 5.52,
      w: 8.6,
      h: 0.34,
      color: deckColors.slate500,
      fontFace: "Inter",
      fontSize: 9,
      margin: 0,
      fit: "shrink",
    },
  );
  addDeckFooter(overview, data);

  data.sections.forEach((section, sectionIndex) => {
    const slide = pptx.addSlide() as unknown as PptxSlide;
    addDeckSectionHeader(
      slide,
      section.title,
      sectionClaim(section),
      section.detail,
    );

    section.metrics.slice(0, 4).forEach((metric, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      addDeckLineChart(
        slide,
        metric,
        0.55 + column * 6.25,
        1.72 + row * 2.28,
        5.9,
        1.72,
        index % 2 === 0 || sectionIndex === 0 ? deckColors.slate900 : deckColors.teal,
      );
    });
    addDeckFooter(slide, data);
  });

  const creatorChunks = data.creators.length > 0
    ? Array.from({ length: Math.ceil(data.creators.length / 8) }, (_, index) =>
        data.creators.slice(index * 8, index * 8 + 8),
      )
    : [[]];
  creatorChunks.forEach((chunk, index) => {
    const slide = pptx.addSlide() as unknown as PptxSlide;
    addDeckSectionHeader(
      slide,
      "Creator performance",
      index === 0 ? "Creator-level evidence" : "Creator-level evidence continued",
      "Rows preserve source platform and creator economics.",
    );
    const tableRows = [
      ["Creator", "Market", "Platform", "Views", "Eng.", "ER", "CPE", "Spent", "Rating"],
      ...chunk.map((creator) => [
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
    slide.addTable(tableRows, {
      x: 0.55,
      y: 1.62,
      w: 12.2,
      h: 4.75,
      fontFace: "Inter",
      fontSize: 7.2,
      color: deckColors.slate900,
      margin: 0.06,
      border: { color: deckColors.slate200, width: 0.5 },
      fill: { color: deckColors.white },
      valign: "mid",
      fit: "shrink",
    });
    addDeckFooter(slide, data);
  });

  await pptx.writeFile({
    fileName: buildReportFilename(data.campaignTitle, "pptx"),
    compression: true,
  });
}
