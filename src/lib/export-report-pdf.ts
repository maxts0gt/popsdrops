import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  buildCsvContent,
  buildHtmlDocument,
  buildJsonContent,
  buildReportHeroMetrics,
  getReportDisplayTitle,
  getReportTrustDecision,
  normalizeReportExportData,
  buildReportFilename,
  type ReportExportData,
  type ReportExportMetric,
  type ReportExportSection,
  type ReportHeroMetric,
} from "./reporting/report-export";

export type {
  ReportExportBlock,
  ReportExportComposition,
  ReportExportCreator,
  ReportExportData,
  ReportExportMetric,
  ReportExportMetricPoint,
  ReportExportSection,
  ReportExportTrustItem,
} from "./reporting/report-export";

type PdfColor = readonly [number, number, number];
type PptxSlide = {
  addImage: (options: Record<string, unknown>) => unknown;
  addText: (text: string, options?: Record<string, unknown>) => unknown;
  addShape: (shapeName: string, options?: Record<string, unknown>) => unknown;
  addTable: (rows: string[][], options?: Record<string, unknown>) => unknown;
};
type PptxDeck = {
  addSlide: () => unknown;
};
type PdfRenderContext = {
  doc: jsPDF;
  data: ReportExportData;
  margin: number;
  contentWidth: number;
};
export interface ClientExportHeroMeta {
  generatedDate: string;
  reportWindow: string;
  reportTitle: string;
  heroMetrics: ReportHeroMetric[];
}

export interface ClientExportMetricRecipe {
  kind: "snapshot" | "trend";
  readDate: string;
  value: string;
  label: string;
  detail: string;
  decisionUse: string;
}

export interface ClientExportCardItem {
  label: string;
  value: string;
  detail: string;
}

export interface ClientExportCompositionSummary extends ClientExportCardItem {
  line: string;
}

interface ReportCampaignImage {
  dataUrl: string;
  format: "JPEG" | "PNG" | "WEBP";
  height: number;
  width: number;
}

interface ReportImageBox {
  boxHeight: number;
  boxWidth: number;
  boxX: number;
  boxY: number;
  sourceHeight: number;
  sourceWidth: number;
}

interface ReportImagePlacement {
  h: number;
  w: number;
  x: number;
  y: number;
}

const slate900 = [15, 23, 42] as const;
const slate700 = [51, 65, 85] as const;
const slate500 = [100, 116, 139] as const;
const slate200 = [226, 232, 240] as const;
const slate100 = [241, 245, 249] as const;
const white = [255, 255, 255] as const;
const deckFontFace = "Arial";
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

function formatDateParts(year: number, month: number, day: number): string {
  return `${year}/${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}`;
}

function formatClientExportDate(value: string): string {
  const trimmed = value.trim();
  const structured = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(trimmed);
  if (structured) {
    return formatDateParts(
      Number(structured[1]),
      Number(structured[2]),
      Number(structured[3]),
    );
  }

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return value;

  return formatDateParts(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
  );
}

function formatClientExportDateText(value: string): string {
  const parts = value
    .split(/\s+(?:to|~|-)\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 2) {
    return `${formatClientExportDate(parts[0])} - ${formatClientExportDate(parts[1])}`;
  }

  return formatClientExportDate(value);
}

function formatClientExportCardValue(value: string): string {
  if (!/\b\d{4}\b/.test(value)) return value;

  return formatClientExportDateText(value);
}

function formatGeneratedDate(value: string): string {
  return formatClientExportDate(value);
}

function formatPdfPointDate(value: string): string {
  return formatClientExportDate(value);
}

export function fitReportImageToBox({
  boxHeight,
  boxWidth,
  boxX,
  boxY,
  sourceHeight,
  sourceWidth,
}: ReportImageBox): ReportImagePlacement {
  if (
    sourceWidth <= 0 ||
    sourceHeight <= 0 ||
    boxWidth <= 0 ||
    boxHeight <= 0
  ) {
    return { h: boxHeight, w: boxWidth, x: boxX, y: boxY };
  }

  const scale = Math.min(boxWidth / sourceWidth, boxHeight / sourceHeight);
  const w = sourceWidth * scale;
  const h = sourceHeight * scale;

  return {
    h,
    w,
    x: boxX + (boxWidth - w) / 2,
    y: boxY + (boxHeight - h) / 2,
  };
}

function getReportImageFormat(mimeType: string): ReportCampaignImage["format"] {
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "JPEG";
  if (mimeType.includes("webp")) return "WEBP";
  return "PNG";
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error("Unable to read image."));
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }

      reject(new Error("Unable to read image as a data URL."));
    };
    reader.readAsDataURL(blob);
  });
}

function readImageSize(dataUrl: string): Promise<{ height: number; width: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onerror = () => reject(new Error("Unable to inspect campaign image."));
    image.onload = () => {
      resolve({
        height: image.naturalHeight || image.height,
        width: image.naturalWidth || image.width,
      });
    };
    image.src = dataUrl;
  });
}

async function loadReportCampaignImage(
  url: string | null | undefined,
): Promise<ReportCampaignImage | null> {
  if (!url || typeof fetch === "undefined") return null;

  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const blob = await response.blob();
    if (blob.type && !blob.type.startsWith("image/")) return null;

    const dataUrl = await blobToDataUrl(blob);
    const size = await readImageSize(dataUrl);

    return {
      dataUrl,
      format: getReportImageFormat(blob.type || dataUrl.slice(0, 48)),
      height: size.height,
      width: size.width,
    };
  } catch {
    return null;
  }
}

export function buildClientExportHeroMeta(data: ReportExportData): ClientExportHeroMeta {
  data = normalizeReportExportData(data);

  return {
    generatedDate: formatGeneratedDate(data.generatedAt),
    reportWindow: formatClientExportDateText(data.dateRange),
    reportTitle: getReportDisplayTitle(data),
    heroMetrics: buildReportHeroMetrics(data),
  };
}

export function buildClientExportCampaignVisualCaption(data: ReportExportData): string {
  return data.campaignImageAlt?.trim() || "Private campaign image";
}

export function buildClientExportCompositionSummary(
  data: ReportExportData,
): ClientExportCompositionSummary | null {
  data = normalizeReportExportData(data);
  if (!data.composition) return null;

  return {
    label: "Report plan",
    value: data.composition.presetTitle,
    detail: data.composition.presetDetail || "Team-selected export context.",
    line: `Report plan / ${data.composition.presetTitle}`,
  };
}

export function buildClientExportTrustItems(data: ReportExportData): ClientExportCardItem[] {
  data = normalizeReportExportData(data);

  return data.trust.map((item) => ({
    label: item.label,
    value: formatClientExportCardValue(item.value),
    detail: item.detail,
  }));
}

export function buildClientExportMetricRecipe(
  metric: ReportExportMetric,
): ClientExportMetricRecipe {
  const first = metric.points[0];
  const last = metric.points[metric.points.length - 1];
  const readDate = first && last && first.date !== last.date
    ? `${formatPdfPointDate(first.date)} - ${formatPdfPointDate(last.date)}`
    : first
      ? formatPdfPointDate(first.date)
      : "No read date";

  if (metric.points.length < 2) {
    return {
      kind: "snapshot",
      readDate,
      value: metric.value,
      label: metric.label,
      detail: metric.detail,
      decisionUse:
        "One verified read; use a snapshot until there is enough history for a trend.",
    };
  }

  return {
    kind: "trend",
    readDate,
    value: metric.value,
    label: metric.label,
    detail: metric.detail,
    decisionUse: "Trend recipe: compare first and latest reads before deciding.",
  };
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

function isReportBlockIncluded(data: ReportExportData, blockId: string): boolean {
  if (!data.blocks?.length) return true;

  return data.blocks.some((block) => block.id === blockId);
}

function getReportBlockTitle(
  data: ReportExportData,
  blockId: string,
  fallback: string,
): string {
  const title = data.blocks
    ?.find((block) => block.id === blockId)
    ?.title
    ?.trim();

  return title || fallback;
}

function getReportArtifactBlockIds(data: ReportExportData): string[] {
  if (data.blocks?.length) {
    return data.blocks.map((block) => block.id);
  }

  return [
    "executive_summary",
    "channel_story",
    "proof_sources",
    "report_trust",
    "recommendations",
    "creator_table",
  ];
}

function getSectionsBySourceGroup(
  data: ReportExportData,
  sourceGroup: ReportExportSection["sourceGroup"],
): ReportExportSection[] {
  return data.sections.filter((section) =>
    sourceGroup === "proof_source"
      ? section.sourceGroup === "proof_source"
      : section.sourceGroup !== "proof_source",
  );
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
    fontFace: deckFontFace,
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
    fontFace: deckFontFace,
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
      fontFace: deckFontFace,
      fontSize: 9,
      margin: 0,
      fit: "shrink",
    });
  }
}

function addDeckFooter(slide: PptxSlide, data: ReportExportData): void {
  const heroMeta = buildClientExportHeroMeta(data);
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
    fontFace: deckFontFace,
    fontSize: 6.5,
    margin: 0,
  });
  addDeckText(slide, heroMeta.reportWindow, {
    x: 9.2,
    y: 7.18,
    w: 3.55,
    h: 0.18,
    color: deckColors.slate500,
    fontFace: deckFontFace,
    fontSize: 6.5,
    margin: 0,
    align: "right",
  });
}

export function buildClientExportEvidenceTrail(data: ReportExportData): string {
  data = normalizeReportExportData(data);

  const evidence = data.trust.find((item) =>
    item.key === "evidence_backed_reads" ||
    item.label.toLowerCase().includes("evidence"),
  ) ?? data.trust.find((item) =>
    item.label.toLowerCase().includes("proof"),
  );
  const source = data.trust.find((item) =>
    item.key === "data_source" ||
    item.label.toLowerCase().includes("source"),
  ) ?? data.trust.find((item) =>
    item.label.toLowerCase().includes("origin"),
  );
  const evidenceLine = evidence
    ? `${evidence.label}: ${formatClientExportCardValue(evidence.value)}`
    : "Evidence-backed reads: not reviewed";

  const trail = source
    ? `${evidenceLine} / ${formatClientExportCardValue(source.value)}`
    : evidenceLine;

  return data.proofReview ? `${trail} / ${data.proofReview.value}` : trail;
}

function getReportEvidenceTrail(data: ReportExportData): string {
  return buildClientExportEvidenceTrail(data);
}

function getReportDecisionQuestion(data: ReportExportData): string {
  return (
    data.composition?.executiveQuestion ??
    data.composition?.chartLayoutTitle ??
    "Confirm whether the campaign is ready to share."
  );
}

function getReportStoryAction(data: ReportExportData): string {
  const chartModeId = data.composition?.chartModeId;

  if (chartModeId === "proof") {
    return "Resolve missing or unreviewed evidence before leadership sharing.";
  }

  if (chartModeId === "comparison") {
    return "Rebook, correct, or pause creators based on reviewed proof.";
  }

  return "Compare first and latest reads before deciding.";
}

function addDeckDecisionEvidenceActionRail(
  slide: PptxSlide,
  data: ReportExportData,
  decision: string,
  action: string,
  options: { h?: number; y?: number } = {},
): void {
  const y = options.y ?? 5.86;
  const h = options.h ?? 0.78;
  const columns = [
    {
      label: "Decision read",
      value: decision,
    },
    {
      label: "Evidence trail",
      value: getReportEvidenceTrail(data),
    },
    {
      label: "Next action",
      value: action,
    },
    {
      label: "Trust decision",
      value: getReportTrustDecision(data),
    },
  ];
  const gap = 0.18;
  const width = (12.2 - gap * 3) / 4;

  slide.addShape("rect", {
    x: 0.55,
    y,
    w: 12.2,
    h,
    rectRadius: 0.08,
    fill: { color: deckColors.slate100 },
    line: { color: deckColors.slate200, width: 0.45 },
  });

  columns.forEach((column, index) => {
    const x = 0.74 + index * (width + gap);
    addDeckText(slide, column.label, {
      x,
      y: y + 0.13,
      w: width - 0.18,
      h: 0.14,
      color: deckColors.slate500,
      fontFace: deckFontFace,
      fontSize: 5.8,
      bold: true,
      margin: 0,
      fit: "shrink",
    });
    addDeckText(slide, column.value, {
      x,
      y: y + 0.34,
      w: width - 0.18,
      h: Math.max(0.18, h - 0.42),
      color: deckColors.slate700,
      fontFace: deckFontFace,
      fontSize: 6.4,
      bold: index === 0,
      margin: 0,
      fit: "shrink",
    });
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
    fontFace: deckFontFace,
    fontSize: 7.5,
    bold: true,
    margin: 0,
    fit: "shrink",
  });
  addDeckText(slide, value, {
    x: x + 0.14,
    y: y + 0.45,
    w: w - 0.28,
    h: 0.28,
    color: deckColors.slate700,
    fontFace: deckFontFace,
    fontSize: 12,
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
    fontFace: deckFontFace,
    fontSize: 6.8,
    margin: 0,
    fit: "shrink",
  });
}

function addDeckMetricReadout(
  slide: PptxSlide,
  metric: ReportExportMetric,
  x: number,
  y: number,
  w: number,
  h: number,
): void {
  const recipe = buildClientExportMetricRecipe(metric);
  slide.addShape("rect", {
    x,
    y,
    w,
    h,
    rectRadius: 0.08,
    fill: { color: deckColors.white },
    line: { color: deckColors.slate200, width: 0.7 },
  });
  addDeckText(slide, recipe.kind === "snapshot" ? "Snapshot read" : "Trend read", {
    x: x + 0.14,
    y: y + 0.12,
    w: 1.7,
    h: 0.18,
    color: deckColors.slate500,
    fontFace: deckFontFace,
    fontSize: 6.4,
    bold: true,
    margin: 0,
  });
  addDeckText(slide, "Read date", {
    x: x + w - 1.4,
    y: y + 0.12,
    w: 1.22,
    h: 0.18,
    color: deckColors.slate500,
    fontFace: deckFontFace,
    fontSize: 6.4,
    bold: true,
    margin: 0,
    align: "right",
  });
  addDeckText(slide, recipe.value, {
    x: x + 0.14,
    y: y + 0.42,
    w: 1.5,
    h: 0.26,
    color: deckColors.slate700,
    fontFace: deckFontFace,
    fontSize: 11,
    bold: true,
    margin: 0,
    fit: "shrink",
  });
  addDeckText(slide, recipe.readDate, {
    x: x + w - 1.9,
    y: y + 0.42,
    w: 1.72,
    h: 0.22,
    color: deckColors.slate700,
    fontFace: deckFontFace,
    fontSize: 7.2,
    bold: true,
    margin: 0,
    align: "right",
    fit: "shrink",
  });
  slide.addShape("line", {
    x: x + 0.14,
    y: y + 0.82,
    w: w - 0.28,
    h: 0,
    line: { color: deckColors.slate200, width: 0.45 },
  });
  addDeckText(slide, `${recipe.label} / ${recipe.detail}`, {
    x: x + 0.14,
    y: y + 0.96,
    w: w - 0.28,
    h: 0.18,
    color: deckColors.slate500,
    fontFace: deckFontFace,
    fontSize: 6.5,
    bold: true,
    margin: 0,
    fit: "shrink",
  });
  addDeckText(slide, recipe.decisionUse, {
    x: x + 0.14,
    y: y + h - 0.32,
    w: w - 0.28,
    h: 0.18,
    color: deckColors.slate500,
    fontFace: deckFontFace,
    fontSize: 6.3,
    margin: 0,
    fit: "shrink",
  });
}

function addDeckVisualLedHero(
  slide: PptxSlide,
  data: ReportExportData,
  image: ReportCampaignImage | null,
): void {
  const heroMeta = buildClientExportHeroMeta(data);
  const campaignVisualCaption = buildClientExportCampaignVisualCaption(data);
  const trustDecision = getReportTrustDecision(data);
  addDeckText(slide, "PopsDrops / Global Proof Room", {
    x: 0.55,
    y: 0.26,
    w: 2.8,
    h: 0.16,
    color: deckColors.slate500,
    fontFace: deckFontFace,
    fontSize: 6.6,
    bold: true,
    margin: 0,
  });
  addDeckText(slide, `Generated on ${heroMeta.generatedDate}`, {
    x: 9.9,
    y: 0.26,
    w: 2.85,
    h: 0.16,
    color: deckColors.slate500,
    fontFace: deckFontFace,
    fontSize: 6.2,
    margin: 0,
    align: "right",
  });

  slide.addShape("rect", {
    x: 0.55,
    y: 0.72,
    w: 12.2,
    h: 2.7,
    rectRadius: 0.12,
    fill: { color: deckColors.white },
    line: { color: deckColors.slate200, width: 0.7 },
  });
  const visualW = 4.84;
  const visualH = 2.16;
  const visualX = 7.68;
  const visualY = 0.98;
  slide.addShape("rect", {
    x: visualX,
    y: visualY,
    w: visualW,
    h: visualH,
    rectRadius: 0.12,
    fill: { color: deckColors.slate100 },
    line: { color: deckColors.slate200, width: 0.6 },
  });
  if (image) {
    slide.addShape("rect", {
      x: visualX + 0.22,
      y: visualY + 0.2,
      w: visualW - 0.44,
      h: visualH - 0.48,
      rectRadius: 0.08,
      fill: { color: deckColors.white },
      line: { color: deckColors.slate200, width: 0.5 },
    });
    const placement = fitReportImageToBox({
      boxHeight: visualH - 0.66,
      boxWidth: visualW - 0.62,
      boxX: visualX + 0.31,
      boxY: visualY + 0.29,
      sourceHeight: image.height,
      sourceWidth: image.width,
    });
    slide.addImage({
      data: image.dataUrl,
      x: placement.x,
      y: placement.y,
      w: placement.w,
      h: placement.h,
    });
    addDeckText(slide, campaignVisualCaption, {
      x: visualX + 0.26,
      y: visualY + visualH - 0.22,
      w: visualW - 0.52,
      h: 0.16,
      color: deckColors.slate500,
      fontFace: deckFontFace,
      fontSize: 5.4,
      margin: 0,
      fit: "shrink",
    });
  } else {
    addDeckText(slide, "PopsDrops", {
      x: visualX + 0.28,
      y: visualY + 0.32,
      w: 1.0,
      h: 0.14,
      color: deckColors.slate900,
      fontFace: deckFontFace,
      fontSize: 5.8,
      bold: true,
      margin: 0,
    });
    addDeckText(slide, "Proof-room cover", {
      x: visualX + 0.28,
      y: visualY + 0.5,
      w: 1.65,
      h: 0.12,
      color: deckColors.slate500,
      fontFace: deckFontFace,
      fontSize: 4.7,
      margin: 0,
    });
    addDeckText(slide, campaignVisualCaption, {
      x: visualX + 0.28,
      y: visualY + visualH - 0.42,
      w: 2.45,
      h: 0.16,
      color: deckColors.slate900,
      fontFace: deckFontFace,
      fontSize: 6.6,
      bold: true,
      margin: 0,
      fit: "shrink",
    });
  }

  addDeckText(slide, "GLOBAL PROOF ROOM", {
    x: 0.82,
    y: 1.04,
    w: 2.2,
    h: 0.16,
    color: deckColors.slate500,
    fontFace: deckFontFace,
    fontSize: 6.5,
    bold: true,
    margin: 0,
  });
  addDeckText(slide, getReportDisplayTitle(data), {
    x: 0.82,
    y: 1.36,
    w: 6.45,
    h: 0.42,
    color: deckColors.slate900,
    fontFace: deckFontFace,
    fontSize: 17,
    bold: true,
    margin: 0,
    fit: "shrink",
  });
  addDeckText(slide, `Report window  ${heroMeta.reportWindow}`, {
    x: 0.82,
    y: 1.98,
    w: 3.4,
    h: 0.16,
    color: deckColors.slate700,
    fontFace: deckFontFace,
    fontSize: 6.2,
    bold: true,
    margin: 0,
  });
  slide.addShape("rect", {
    x: 4.48,
    y: 1.88,
    w: 2.55,
    h: 0.34,
    rectRadius: 0.08,
    fill: { color: deckColors.slate100 },
    line: { color: deckColors.slate200, width: 0.45 },
  });
  addDeckText(slide, "Trust decision", {
    x: 4.66,
    y: 1.96,
    w: 0.9,
    h: 0.1,
    color: deckColors.slate500,
    fontFace: deckFontFace,
    fontSize: 4.6,
    bold: true,
    margin: 0,
    fit: "shrink",
  });
  addDeckText(slide, trustDecision, {
    x: 5.55,
    y: 1.94,
    w: 1.28,
    h: 0.13,
    color: deckColors.slate700,
    fontFace: deckFontFace,
    fontSize: 5.3,
    bold: true,
    margin: 0,
    fit: "shrink",
  });
  heroMeta.heroMetrics.forEach((metric, index) => {
    const x = 0.82 + index * 2.45;
    addDeckText(slide, metric.label, {
      x,
      y: 2.64,
      w: 1.6,
      h: 0.12,
      color: deckColors.slate500,
      fontFace: deckFontFace,
      fontSize: 5.8,
      bold: true,
      margin: 0,
      fit: "shrink",
    });
    addDeckText(slide, metric.value, {
      x,
      y: 2.82,
      w: 1.9,
      h: 0.14,
      color: deckColors.slate700,
      fontFace: deckFontFace,
      fontSize: 6.5,
      bold: true,
      margin: 0,
      fit: "shrink",
    });
    if (metric.detail) {
      addDeckText(slide, metric.detail, {
        x,
        y: 3.03,
        w: 1.95,
        h: 0.18,
        color: deckColors.slate500,
        fontFace: deckFontFace,
        fontSize: 5.6,
        margin: 0,
        fit: "shrink",
      });
    }
  });
}

function addDeckCoverDecisionPanel(slide: PptxSlide, data: ReportExportData): void {
  if (!data.composition) return;

  const composition = data.composition;
  const compositionSummary = buildClientExportCompositionSummary(data);
  const layoutLine = composition.chartLayoutTitle
    ? `${composition.chartModeTitle} / ${composition.chartLayoutTitle}`
    : composition.chartModeTitle;
  const planLine = compositionSummary?.line ?? "Report plan";

  slide.addShape("rect", {
    x: 0.55,
    y: 3.22,
    w: 7.55,
    h: 1.34,
    rectRadius: 0.1,
    fill: { color: deckColors.slate100 },
    line: { color: deckColors.slate200, width: 0.55 },
  });
  addDeckText(slide, "Executive decision", {
    x: 0.82,
    y: 3.42,
    w: 2.1,
    h: 0.16,
    color: deckColors.slate500,
    fontFace: deckFontFace,
    fontSize: 6.4,
    bold: true,
    margin: 0,
  });
  addDeckText(slide, composition.executiveQuestion ?? composition.bestFor ?? planLine, {
    x: 0.82,
    y: 3.66,
    w: 6.92,
    h: 0.34,
    color: deckColors.slate900,
    fontFace: deckFontFace,
    fontSize: 10.4,
    bold: true,
    margin: 0,
    fit: "shrink",
  });
  addDeckText(slide, planLine, {
    x: 0.82,
    y: 4.12,
    w: 3.25,
    h: 0.16,
    color: deckColors.slate700,
    fontFace: deckFontFace,
    fontSize: 6.7,
    bold: true,
    margin: 0,
    fit: "shrink",
  });
  addDeckText(slide, layoutLine, {
    x: 4.62,
    y: 4.12,
    w: 3.12,
    h: 0.16,
    color: deckColors.slate700,
    fontFace: deckFontFace,
    fontSize: 6.7,
    bold: true,
    margin: 0,
    align: "right",
    fit: "shrink",
  });
}

function addDeckCoverRecommendations(slide: PptxSlide, data: ReportExportData): void {
  const recommendations = data.recommendations.slice(0, 3);
  if (!recommendations.length) return;

  slide.addShape("rect", {
    x: 8.32,
    y: 3.22,
    w: 4.43,
    h: 1.34,
    rectRadius: 0.1,
    fill: { color: deckColors.white },
    line: { color: deckColors.slate200, width: 0.55 },
  });
  addDeckText(slide, "Topline proof", {
    x: 8.56,
    y: 3.42,
    w: 1.72,
    h: 0.16,
    color: deckColors.slate500,
    fontFace: deckFontFace,
    fontSize: 6.4,
    bold: true,
    margin: 0,
  });

  recommendations.forEach((item, index) => {
    const y = 3.68 + index * 0.27;
    addDeckText(slide, String(index + 1).padStart(2, "0"), {
      x: 8.56,
      y,
      w: 0.26,
      h: 0.13,
      color: deckColors.slate500,
      fontFace: deckFontFace,
      fontSize: 5.8,
      bold: true,
      margin: 0,
      fit: "shrink",
    });
    addDeckText(slide, `${item.title}: ${item.value}`, {
      x: 8.9,
      y,
      w: 1.92,
      h: 0.13,
      color: deckColors.slate900,
      fontFace: deckFontFace,
      fontSize: 6.4,
      bold: true,
      margin: 0,
      fit: "shrink",
    });
    addDeckText(slide, item.detail, {
      x: 10.92,
      y,
      w: 1.56,
      h: 0.13,
      color: deckColors.slate500,
      fontFace: deckFontFace,
      fontSize: 5.8,
      margin: 0,
      align: "right",
      fit: "shrink",
    });
  });
}

function addDeckCoverEditorialMetricStrip(slide: PptxSlide, data: ReportExportData): void {
  const kpis = data.kpis.slice(0, 4);
  if (!kpis.length) return;

  const gap = 0.22;
  const cardWidth = (12.2 - gap * 3) / 4;
  kpis.forEach((kpi, index) => {
    const x = 0.55 + index * (cardWidth + gap);
    const y = 4.98;
    slide.addShape("line", {
      x,
      y,
      w: cardWidth,
      h: 0,
      line: { color: deckColors.slate200, width: 0.55 },
    });
    addDeckText(slide, kpi.label, {
      x,
      y: y + 0.18,
      w: cardWidth,
      h: 0.16,
      color: deckColors.slate500,
      fontFace: deckFontFace,
      fontSize: 6.7,
      bold: true,
      margin: 0,
      fit: "shrink",
    });
    addDeckText(slide, kpi.value, {
      x,
      y: y + 0.48,
      w: cardWidth,
      h: 0.24,
      color: deckColors.slate700,
      fontFace: deckFontFace,
      fontSize: 10.8,
      bold: true,
      margin: 0,
      fit: "shrink",
    });
    addDeckText(slide, kpi.detail ?? "", {
      x,
      y: y + 0.82,
      w: cardWidth,
      h: 0.15,
      color: deckColors.slate500,
      fontFace: deckFontFace,
      fontSize: 6.2,
      margin: 0,
      fit: "shrink",
    });
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
    fontFace: deckFontFace,
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
    fontFace: deckFontFace,
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
    fontFace: deckFontFace,
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
      fontFace: deckFontFace,
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

function renderReportPdfMetricReadout({
  doc,
  recipe,
  x,
  y,
  width,
  height,
}: {
  doc: jsPDF;
  recipe: ClientExportMetricRecipe;
  x: number;
  y: number;
  width: number;
  height: number;
}): void {
  setDrawColor(doc, slate200);
  doc.roundedRect(x, y, width, height, 2, 2, "S");
  setTextColor(doc, slate500);
  doc.setFontSize(6.3);
  doc.setFont("helvetica", "bold");
  doc.text(recipe.kind === "snapshot" ? "Snapshot read" : "Trend read", x + 4, y + 6);
  doc.text("Read date", x + width - 4, y + 6, { align: "right" });

  setTextColor(doc, slate700);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(recipe.value, x + 4, y + 14, { maxWidth: width / 2 - 6 });

  setTextColor(doc, slate700);
  doc.setFontSize(7.2);
  doc.setFont("helvetica", "bold");
  doc.text(recipe.readDate, x + width - 4, y + 14, { align: "right" });

  setDrawColor(doc, slate200);
  doc.setLineWidth(0.15);
  doc.line(x + 4, y + 18, x + width - 4, y + 18);

  setTextColor(doc, slate500);
  doc.setFontSize(6.7);
  doc.setFont("helvetica", "normal");
  doc.text(`${recipe.label} / ${recipe.detail}`, x + 4, y + 23, {
    maxWidth: width - 8,
  });
  doc.text(recipe.decisionUse, x + 4, y + height - 4, {
    maxWidth: width - 8,
  });
}

function renderReportPdfHero(
  { doc, data, margin, contentWidth }: PdfRenderContext,
  pageWidth: number,
  image: ReportCampaignImage | null,
): number {
  const heroMeta = buildClientExportHeroMeta(data);
  const campaignVisualCaption = buildClientExportCampaignVisualCaption(data);
  const trustDecision = getReportTrustDecision(data);

  setTextColor(doc, slate500);
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  doc.text("PopsDrops / Global Proof Room", margin, 12);

  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.text(`Generated on ${heroMeta.generatedDate}`, pageWidth - margin, 12, {
    align: "right",
  });

  const panelY = 18;
  const panelHeight = 70;
  setDrawColor(doc, slate200);
  doc.roundedRect(margin, panelY, contentWidth, panelHeight, 3, 3, "S");

  const visualWidth = 112;
  const visualX = margin + contentWidth - visualWidth;
  const visualY = panelY + 7;
  const visualHeight = panelHeight - 14;
  setFillColor(doc, slate100);
  setDrawColor(doc, slate200);
  doc.roundedRect(visualX + 7, visualY, visualWidth - 14, visualHeight, 2.5, 2.5, "FD");
  if (image) {
    const imageBox = {
      h: visualHeight - 8,
      w: visualWidth - 24,
      x: visualX + 12,
      y: visualY + 4,
    };
    setFillColor(doc, white);
    doc.roundedRect(imageBox.x, imageBox.y, imageBox.w, imageBox.h, 2, 2, "F");
    setDrawColor(doc, slate200);
    doc.roundedRect(imageBox.x, imageBox.y, imageBox.w, imageBox.h, 2, 2, "S");
    const placement = fitReportImageToBox({
      boxHeight: imageBox.h - 5,
      boxWidth: imageBox.w - 5,
      boxX: imageBox.x + 2.5,
      boxY: imageBox.y + 2.5,
      sourceHeight: image.height,
      sourceWidth: image.width,
    });
    doc.addImage(image.dataUrl, image.format, placement.x, placement.y, placement.w, placement.h);
    setTextColor(doc, slate500);
    doc.setFontSize(5.8);
    doc.setFont("helvetica", "normal");
    doc.text(campaignVisualCaption, visualX + 12, visualY + visualHeight - 2.2, {
      maxWidth: visualWidth - 24,
    });
  } else {
    setTextColor(doc, slate900);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text("PopsDrops", visualX + 13, visualY + 13);
    doc.setFontSize(5.5);
    doc.setFont("helvetica", "normal");
    doc.text("Proof-room cover", visualX + 13, visualY + 18);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(campaignVisualCaption, visualX + 13, visualY + visualHeight - 9, {
      maxWidth: visualWidth - 28,
    });
  }

  setTextColor(doc, slate500);
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "bold");
  doc.text("GLOBAL PROOF ROOM", margin + 7, panelY + 12);

  setTextColor(doc, slate900);
  doc.setFontSize(17);
  doc.setFont("helvetica", "bold");
  doc.text(getReportDisplayTitle(data), margin + 7, panelY + 26, {
    maxWidth: contentWidth - visualWidth - 20,
  });

  setDrawColor(doc, slate200);
  doc.roundedRect(margin + 7, panelY + 34, 68, 8, 4, 4, "S");
  setTextColor(doc, slate500);
  doc.setFontSize(6);
  doc.setFont("helvetica", "bold");
  doc.text("Report window", margin + 11, panelY + 39.2);
  setTextColor(doc, slate700);
  doc.text(heroMeta.reportWindow, margin + 41, panelY + 39.2);

  const trustX = margin + 82;
  const trustW = Math.max(42, visualX - trustX - 7);
  setFillColor(doc, slate100);
  setDrawColor(doc, slate200);
  doc.roundedRect(trustX, panelY + 34, trustW, 8, 4, 4, "FD");
  setTextColor(doc, slate500);
  doc.setFontSize(5.6);
  doc.setFont("helvetica", "bold");
  doc.text("Trust decision", trustX + 4, panelY + 39.2);
  setTextColor(doc, slate700);
  doc.text(trustDecision, trustX + 27, panelY + 39.2, {
    maxWidth: trustW - 31,
  });

  const metaY = panelY + 57;
  heroMeta.heroMetrics.forEach((metric, index) => {
    const x = margin + 7 + index * 46;
    if (index > 0) {
      setDrawColor(doc, slate200);
      doc.line(x - 6, metaY - 5, x - 6, metaY + 5);
    }
    setTextColor(doc, slate500);
    doc.setFontSize(6);
    doc.setFont("helvetica", "bold");
    doc.text(metric.label, x, metaY - 1, { maxWidth: 34 });
    setTextColor(doc, slate700);
    doc.setFontSize(7);
    doc.text(metric.value, x, metaY + 4, { maxWidth: 36 });
    if (metric.detail) {
      setTextColor(doc, slate500);
      doc.setFontSize(5.5);
      doc.text(metric.detail, x, metaY + 9, { maxWidth: 36 });
    }
  });

  return panelY + panelHeight + 12;
}

function renderReportPdfDecisionEvidenceActionRail(
  context: PdfRenderContext,
  y: number,
  decision: string,
  action: string,
): number {
  const { doc, data, margin, contentWidth } = context;
  const railHeight = 19;
  const columns = [
    ["Decision read", decision],
    ["Evidence trail", getReportEvidenceTrail(data)],
    ["Next action", action],
    ["Trust decision", getReportTrustDecision(data)],
  ];
  const columnWidth = contentWidth / columns.length;

  y = addPageIfNeeded(doc, y, railHeight + 8);
  setFillColor(doc, slate100);
  setDrawColor(doc, slate200);
  doc.roundedRect(margin, y, contentWidth, railHeight, 2, 2, "FD");

  columns.forEach(([label, value], index) => {
    const x = margin + index * columnWidth;
    if (index > 0) {
      setDrawColor(doc, slate200);
      doc.line(x, y + 2, x, y + railHeight - 2);
    }

    setTextColor(doc, slate500);
    doc.setFontSize(5.7);
    doc.setFont("helvetica", "bold");
    doc.text(label, x + 4, y + 5);

    setTextColor(doc, slate700);
    doc.setFontSize(6.2);
    doc.setFont("helvetica", "normal");
    doc.text(value, x + 4, y + 10, { maxWidth: columnWidth - 8 });
  });

  return y + railHeight + 8;
}

function renderReportPdfExecutiveQuestionPanel(
  { doc, data, margin, contentWidth }: PdfRenderContext,
  y: number,
): number {
  if (!data.composition?.executiveQuestion) return y;

  const panelHeight = data.composition.bestFor ? 22 : 17;
  y = addPageIfNeeded(doc, y, panelHeight + 7);
  setDrawColor(doc, slate200);
  doc.roundedRect(margin, y, contentWidth, panelHeight, 2, 2, "S");

  setTextColor(doc, slate500);
  doc.setFontSize(6.2);
  doc.setFont("helvetica", "bold");
  doc.text("Executive question", margin + 4, y + 5);

  setTextColor(doc, slate700);
  doc.setFontSize(8.2);
  doc.setFont("helvetica", "normal");
  doc.text(data.composition.executiveQuestion, margin + 4, y + 10.5, {
    maxWidth: contentWidth - 8,
  });

  if (data.composition.bestFor) {
    setTextColor(doc, slate500);
    doc.setFontSize(6.2);
    doc.setFont("helvetica", "normal");
    doc.text(data.composition.bestFor, margin + 4, y + 17, {
      maxWidth: contentWidth - 8,
    });
  }

  return y + panelHeight + 7;
}

function renderReportPdfFraming(
  { doc, data, margin, contentWidth }: PdfRenderContext,
  y: number,
): number {
  if (!data.composition && !data.blocks?.length) return y;

  if (data.composition) {
    const compositionSummary = buildClientExportCompositionSummary(data);
    const compositionItems = [
      ...(compositionSummary ? [compositionSummary] : []),
      {
        label: "Chart mode",
        value: data.composition.chartModeTitle,
        detail: data.composition.chartModeDetail,
      },
      ...(data.composition.chartLayoutTitle
        ? [{
            label: "Chart layout",
            value: data.composition.chartLayoutTitle,
            detail: data.composition.chartLayoutDetail ?? "",
          }]
        : []),
    ];
    const cardWidth =
      (contentWidth - 4 * Math.max(0, compositionItems.length - 1)) /
      compositionItems.length;

    y = addPageIfNeeded(doc, y, 26);
    compositionItems.forEach((item, index) => {
      const x = margin + index * (cardWidth + 4);
      setDrawColor(doc, slate200);
      doc.roundedRect(x, y, cardWidth, 18, 2, 2, "S");
      setTextColor(doc, slate500);
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "normal");
      doc.text(item.label, x + 4, y + 5);
      setTextColor(doc, slate900);
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "bold");
      doc.text(item.value, x + 4, y + 10, { maxWidth: cardWidth - 8 });
      setTextColor(doc, slate500);
      doc.setFontSize(6.2);
      doc.setFont("helvetica", "normal");
      doc.text(item.detail, x + 4, y + 15, { maxWidth: cardWidth - 8 });
    });
    y += 26;

    if (data.composition.executiveQuestion) {
      y = addPageIfNeeded(doc, y, 24);
      setDrawColor(doc, slate200);
      doc.roundedRect(margin, y, contentWidth, 18, 2, 2, "S");
      setTextColor(doc, slate500);
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "normal");
      doc.text("Executive question", margin + 4, y + 5);
      setTextColor(doc, slate900);
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.text(data.composition.executiveQuestion, margin + 4, y + 10, {
        maxWidth: contentWidth - 8,
      });
      if (data.composition.bestFor) {
        setTextColor(doc, slate500);
        doc.setFontSize(6.2);
        doc.setFont("helvetica", "normal");
        doc.text(data.composition.bestFor, margin + 4, y + 15, {
          maxWidth: contentWidth - 8,
        });
      }
      y += 24;
    }
  }

  if (data.blocks?.length) {
    const visibleBlocks = data.blocks.filter((block) => block.id !== "report_framing");
    if (!visibleBlocks.length) return y;

    y = addPageIfNeeded(doc, y, Math.ceil(Math.min(visibleBlocks.length, 6) / 3) * 24 + 8);
    setTextColor(doc, slate900);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("Report blocks", margin, y);
    y += 4;

    const blockWidth = (contentWidth - 8) / 3;
    visibleBlocks.slice(0, 6).forEach((block, index) => {
      const column = index % 3;
      const row = Math.floor(index / 3);
      const x = margin + column * (blockWidth + 4);
      const blockY = y + row * 24;

      setDrawColor(doc, slate200);
      doc.roundedRect(x, blockY, blockWidth, 20, 2, 2, "S");
      setTextColor(doc, slate900);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "bold");
      doc.text(block.title, x + 4, blockY + 5);
      setTextColor(doc, slate500);
      doc.setFontSize(6.5);
      doc.setFont("helvetica", "normal");
      doc.text(block.detail, x + 4, blockY + 10, { maxWidth: blockWidth - 8 });
      if (block.executivePurpose) {
        setTextColor(doc, slate700);
        doc.setFontSize(5.8);
        doc.setFont("helvetica", "normal");
        doc.text(`Purpose: ${block.executivePurpose}`, x + 4, blockY + 16, {
          maxWidth: blockWidth - 8,
        });
      }
    });

    y += Math.ceil(Math.min(visibleBlocks.length, 6) / 3) * 24 + 4;
  }

  return y;
}

function renderReportPdfExecutiveSummary(
  { doc, data, margin, contentWidth }: PdfRenderContext,
  y: number,
): number {
  if (data.kpis.length === 0) return y;

  return renderReportPdfEditorialMetricStrip(
    { doc, data, margin, contentWidth },
    y,
    data.kpis.map((kpi) => ({
      detail: kpi.detail ?? "",
      label: kpi.label,
      value: kpi.value,
    })),
  );
}

function renderReportPdfEditorialMetricStrip(
  { doc, margin, contentWidth }: PdfRenderContext,
  y: number,
  items: ClientExportCardItem[],
): number {
  if (!items.length) return y;

  y = addPageIfNeeded(doc, y, 30);
  const gap = 5;
  const itemWidth = (contentWidth - gap * (items.length - 1)) / items.length;

  items.forEach((item, index) => {
    const x = margin + index * (itemWidth + gap);
    setDrawColor(doc, slate200);
    doc.setLineWidth(0.16);
    doc.line(x, y, x + itemWidth, y);

    setTextColor(doc, slate500);
    doc.setFontSize(6.4);
    doc.setFont("helvetica", "bold");
    doc.text(item.label, x, y + 5.8, { maxWidth: itemWidth });

    setTextColor(doc, slate700);
    doc.setFontSize(9.2);
    doc.setFont("helvetica", "bold");
    doc.text(item.value, x, y + 13, { maxWidth: itemWidth });

    setTextColor(doc, slate500);
    doc.setFontSize(6.2);
    doc.setFont("helvetica", "normal");
    doc.text(item.detail, x, y + 20, { maxWidth: itemWidth });
  });

  return y + 30;
}

function renderReportPdfTrust(
  { doc, data, margin, contentWidth }: PdfRenderContext,
  y: number,
): number {
  if (data.trust.length === 0) return y;

  return renderReportPdfEditorialMetricStrip(
    { doc, data, margin, contentWidth },
    y,
    buildClientExportTrustItems(data),
  );
}

function renderReportPdfRecommendations(
  { doc, data, margin, contentWidth }: PdfRenderContext,
  y: number,
): number {
  if (data.recommendations?.length) {
    const rowHeight = 14;
    y = addPageIfNeeded(doc, y, 10 + data.recommendations.length * rowHeight);
    setTextColor(doc, slate900);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(getReportBlockTitle(data, "recommendations", "Recommendations"), margin, y);
    y += 5;

    data.recommendations.forEach((item, index) => {
      const rowY = y + index * rowHeight;
      setDrawColor(doc, slate200);
      doc.roundedRect(margin, rowY, contentWidth, rowHeight, 2, 2, "S");
      setTextColor(doc, slate500);
      doc.setFontSize(6.2);
      doc.setFont("helvetica", "bold");
      doc.text(String(index + 1).padStart(2, "0"), margin + 4, rowY + 5.2);
      doc.text(item.title, margin + 16, rowY + 5.2);
      setTextColor(doc, slate900);
      doc.setFontSize(8.3);
      doc.setFont("helvetica", "bold");
      doc.text(item.value, margin + 16, rowY + 10, { maxWidth: contentWidth / 2 });
      setTextColor(doc, slate500);
      doc.setFontSize(6.3);
      doc.setFont("helvetica", "normal");
      doc.text(item.detail, margin + contentWidth - 80, rowY + 9, {
        maxWidth: 74,
      });
    });
    return y + data.recommendations.length * rowHeight + 8;
  }

  return y;
}

function renderReportPdfSections(
  { doc, data, margin, contentWidth }: PdfRenderContext,
  y: number,
  sourceGroup: ReportExportSection["sourceGroup"],
): number {
  const sections = getSectionsBySourceGroup(data, sourceGroup);

  for (const section of sections) {
    const isProofSourceSection = section.sourceGroup === "proof_source";
    const rows = Math.ceil(section.metrics.length / 2);
    const sectionHeight = 14 + rows * 34;
    y = addPageIfNeeded(doc, y, sectionHeight);

    setTextColor(doc, slate900);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(section.title, margin, y);
    setTextColor(doc, slate500);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(section.detail, margin, y + 5);
    if (isProofSourceSection) {
      doc.text("Proof source", margin, y + 10);
    }

    const chartWidth = (contentWidth - 8) / 2;
    section.metrics.forEach((metric, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const x = margin + column * (chartWidth + 8);
      const metricY = y + (isProofSourceSection ? 16 : 12) + row * 34;
      const recipe = buildClientExportMetricRecipe(metric);

      if (recipe.kind === "snapshot") {
        renderReportPdfMetricReadout({
          doc,
          recipe,
          x,
          y: metricY,
          width: chartWidth,
          height: 28,
        });
        return;
      }

      setDrawColor(doc, slate200);
      doc.roundedRect(x, metricY, chartWidth, 28, 2, 2, "S");
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
        height: 11,
        color: column === 0 ? slate900 : [13, 148, 136],
      });
    });

    y += sectionHeight + 6;
  }

  return y;
}

function renderReportPdfCreatorTable(
  { doc, data, margin }: PdfRenderContext,
  y: number,
): number {
  if (!isReportBlockIncluded(data, "creator_table")) return y;

  y = addPageIfNeeded(doc, y, 52);
  setTextColor(doc, slate500);
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "bold");
  doc.text("Creator-level evidence", margin, y);
  setTextColor(doc, slate900);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(getReportBlockTitle(data, "creator_table", "Creator Performance"), margin, y + 5);
  setTextColor(doc, slate500);
  doc.setFontSize(6.5);
  doc.text("Exact rows for operator follow-up", margin + 170, y + 5);
  y += 9;

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

  return y;
}

function renderReportPdfBlock(
  context: PdfRenderContext,
  y: number,
  blockId: string,
): number {
  switch (blockId) {
    case "report_framing":
      return renderReportPdfFraming(context, y);
    case "executive_summary":
      return renderReportPdfExecutiveSummary(context, y);
    case "channel_story":
      return renderReportPdfSections(context, y, "campaign_channel");
    case "proof_sources":
      return renderReportPdfSections(context, y, "proof_source");
    case "report_trust":
      return renderReportPdfTrust(context, y);
    case "recommendations":
      return renderReportPdfRecommendations(context, y);
    case "creator_table":
      return renderReportPdfCreatorTable(context, y);
    default:
      return y;
  }
}

export async function exportReportPDF(data: ReportExportData): Promise<void> {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  const context = { doc, data, margin, contentWidth };
  const image = await loadReportCampaignImage(data.campaignImageUrl);
  let y = renderReportPdfHero(context, pageWidth, image);
  y = renderReportPdfExecutiveQuestionPanel(context, y);
  y = renderReportPdfDecisionEvidenceActionRail(context, y, getReportDecisionQuestion(data), getReportStoryAction(data));
  const seen = new Set<string>();
  for (const blockId of getReportArtifactBlockIds(data)) {
    if (seen.has(blockId)) continue;
    seen.add(blockId);
    y = renderReportPdfBlock(context, y, blockId);
  }

  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    setTextColor(doc, slate500);
    doc.setFontSize(7);
    doc.text(
      `PopsDrops Campaign Report - ${getReportDisplayTitle(data)} - Page ${i} of ${pageCount}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: "center" },
    );
  }

  doc.save(buildReportFilename(getReportDisplayTitle(data), "pdf"));
}

export function exportReportJSON(data: ReportExportData): void {
  downloadBlob(
    buildReportFilename(getReportDisplayTitle(data), "json"),
    [buildJsonContent(data)],
    "application/json;charset=utf-8",
  );
}

export function exportReportCSV(data: ReportExportData): void {
  downloadBlob(
    buildReportFilename(getReportDisplayTitle(data), "csv"),
    [buildCsvContent(data)],
    "text/csv;charset=utf-8",
  );
}

export function exportReportHTML(data: ReportExportData): void {
  downloadBlob(
    buildReportFilename(getReportDisplayTitle(data), "html"),
    [buildHtmlDocument(data)],
    "text/html;charset=utf-8",
  );
}

function renderReportDeckFraming(deck: PptxDeck, data: ReportExportData): void {
  if (!data.composition && !data.blocks?.length) return;

  const slide = deck.addSlide() as unknown as PptxSlide;
  addDeckSectionHeader(
    slide,
    "Report framing",
    data.composition?.presetTitle ?? "Selected report plan",
    data.composition?.presetDetail ?? "Team-selected export context.",
  );

  if (data.composition) {
    const rows = [
      ["Preset", data.composition.presetTitle, data.composition.presetDetail],
      ["Chart mode", data.composition.chartModeTitle, data.composition.chartModeDetail],
      ["Chart layout", data.composition.chartLayoutTitle, data.composition.chartLayoutDetail],
      ...(data.composition.executiveQuestion
        ? [["Executive question", data.composition.executiveQuestion, data.composition.bestFor ?? ""]]
        : []),
    ];
    slide.addTable(rows, {
      x: 0.55,
      y: 1.65,
      w: 12.2,
      h: 1.8,
      fontFace: deckFontFace,
      fontSize: 8,
      color: deckColors.slate900,
      margin: 0.08,
      border: { color: deckColors.slate200, width: 0.5 },
      fill: { color: deckColors.white },
      fit: "shrink",
    });
  }

  if (data.blocks?.length) {
    addDeckText(slide, "Block order", {
      x: 0.55,
      y: 3.85,
      w: 1.6,
      h: 0.22,
      color: deckColors.slate900,
      fontFace: deckFontFace,
      fontSize: 9,
      bold: true,
      margin: 0,
    });
    data.blocks
      .filter((block) => block.id !== "report_framing")
      .slice(0, 6)
      .forEach((block, index) => {
        const column = index % 3;
        const row = Math.floor(index / 3);
        addDeckMetricCard(
          slide,
          `${index + 1}. ${block.title}`,
          block.executivePurpose ?? block.detail,
          block.detail,
          0.55 + column * 4.15,
          4.22 + row * 1.02,
          3.8,
          0.82,
        );
      });
  }

  addDeckDecisionEvidenceActionRail(
    slide,
    data,
    data.composition?.executiveQuestion ?? "Confirm the report plan before sharing.",
    "Use this plan for exports, shared links, and leadership review.",
    { h: 0.58, y: 6.24 },
  );
  addDeckFooter(slide, data);
}

function renderReportDeckExecutiveSummary(deck: PptxDeck, data: ReportExportData): void {
  if (!data.kpis.length) return;

  const slide = deck.addSlide() as unknown as PptxSlide;
  const heroMeta = buildClientExportHeroMeta(data);
  addDeckSectionHeader(
    slide,
    getReportBlockTitle(data, "executive_summary", "Executive summary"),
    "Performance summary",
    heroMeta.reportWindow,
  );
  data.kpis.slice(0, 5).forEach((kpi, index) => {
    addDeckMetricCard(
      slide,
      kpi.label,
      kpi.value,
      kpi.detail || "",
      0.55 + index * 2.48,
      1.72,
      2.28,
      1.18,
    );
  });
  addDeckText(
    slide,
    "Metrics are kept platform-native; CPE is the cross-channel equalizer.",
    {
      x: 0.55,
      y: 3.35,
      w: 7.8,
      h: 0.3,
      color: deckColors.slate500,
      fontFace: deckFontFace,
      fontSize: 9,
      margin: 0,
      fit: "shrink",
    },
  );
  addDeckDecisionEvidenceActionRail(
    slide,
    data,
    "Read outcome, spend, and confidence before approving next market action.",
    "Repeat what worked, request corrections, or pause spend.",
  );
  addDeckFooter(slide, data);
}

function renderReportDeckTrust(deck: PptxDeck, data: ReportExportData): void {
  if (!data.trust.length) return;

  const slide = deck.addSlide() as unknown as PptxSlide;
  addDeckSectionHeader(
    slide,
    getReportBlockTitle(data, "report_trust", "Report trust"),
    "Evidence and review state",
    "How leadership, legal, and finance can trust the numbers.",
  );
  buildClientExportTrustItems(data).slice(0, 5).forEach((item, index) => {
    addDeckMetricCard(
      slide,
      item.label,
      item.value,
      item.detail,
      0.55 + index * 2.48,
      1.72,
      2.28,
      1.14,
    );
  });
  addDeckDecisionEvidenceActionRail(
    slide,
    data,
    "Use evidence coverage to decide whether the report is leadership-ready.",
    "Verify gaps before sharing outside the campaign team.",
  );
  addDeckFooter(slide, data);
}

function renderReportDeckRecommendations(deck: PptxDeck, data: ReportExportData): void {
  if (!data.recommendations?.length) return;

  const slide = deck.addSlide() as unknown as PptxSlide;
  const recommendationLine = data.recommendations
    .slice(0, 3)
    .map((item) => `${item.title}: ${item.value} (${item.detail})`)
    .join("   ");

  addDeckSectionHeader(
    slide,
    getReportBlockTitle(data, "recommendations", "Recommendations"),
    "Data-earned next actions",
    recommendationLine,
  );
  data.recommendations.slice(0, 3).forEach((item, index) => {
    addDeckMetricCard(
      slide,
      item.title,
      item.value,
      item.detail,
      0.55 + index * 4.15,
      1.82,
      3.8,
      1.35,
    );
  });
  addDeckDecisionEvidenceActionRail(
    slide,
    data,
    "Prioritize the actions most supported by reviewed proof.",
    "Assign the follow-up owner before the next campaign window.",
  );
  addDeckFooter(slide, data);
}

function renderReportDeckSections(
  deck: PptxDeck,
  data: ReportExportData,
  sourceGroup: ReportExportSection["sourceGroup"],
): void {
  const sections = getSectionsBySourceGroup(data, sourceGroup);

  for (const [sectionIndex, section] of sections.entries()) {
    const isProofSourceSection = section.sourceGroup === "proof_source";
    const slide = deck.addSlide() as unknown as PptxSlide;
    addDeckSectionHeader(
      slide,
      section.title,
      isProofSourceSection ? "Proof source" : sectionClaim(section),
      section.detail,
    );

    section.metrics.slice(0, 4).forEach((metric, index) => {
      const column = index % 2;
      const row = Math.floor(index / 2);
      const recipe = buildClientExportMetricRecipe(metric);
      if (recipe.kind === "snapshot") {
        addDeckMetricReadout(
          slide,
          metric,
          0.55 + column * 6.25,
          1.72 + row * 2.08,
          5.9,
          1.48,
        );
        return;
      }

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
    addDeckDecisionEvidenceActionRail(
      slide,
      data,
      isProofSourceSection ? "Confirm proof-source readiness before trusting the read." : sectionClaim(section),
      isProofSourceSection
        ? "Resolve missing or unreviewed evidence before leadership sharing."
        : "Compare first and latest reads before deciding.",
      { y: 5.92 },
    );
    addDeckFooter(slide, data);
  }
}

function renderReportDeckCreatorTable(deck: PptxDeck, data: ReportExportData): void {
  const creatorChunks = data.creators.length > 0
    ? Array.from({ length: Math.ceil(data.creators.length / 8) }, (_, index) =>
        data.creators.slice(index * 8, index * 8 + 8),
      )
    : [[]];
  creatorChunks.forEach((chunk, index) => {
    const slide = deck.addSlide() as unknown as PptxSlide;
    addDeckSectionHeader(
      slide,
      getReportBlockTitle(data, "creator_table", "Creator performance"),
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
      h: 4.18,
      fontFace: deckFontFace,
      fontSize: 6.9,
      color: deckColors.slate900,
      margin: 0.06,
      border: { color: deckColors.slate200, width: 0.5 },
      fill: { color: deckColors.white },
      valign: "mid",
      fit: "shrink",
    });
    addDeckDecisionEvidenceActionRail(
      slide,
      data,
      "Use creator rows for payment, repeat-work, and exception follow-up.",
      "Pay, rebook, or request correction based on reviewed evidence.",
      { h: 0.58, y: 6.24 },
    );
    addDeckFooter(slide, data);
  });
}

function renderReportDeckBlock(
  deck: PptxDeck,
  data: ReportExportData,
  blockId: string,
): void {
  switch (blockId) {
    case "report_framing":
      renderReportDeckFraming(deck, data);
      return;
    case "executive_summary":
      renderReportDeckExecutiveSummary(deck, data);
      return;
    case "channel_story":
      renderReportDeckSections(deck, data, "campaign_channel");
      return;
    case "proof_sources":
      renderReportDeckSections(deck, data, "proof_source");
      return;
    case "report_trust":
      renderReportDeckTrust(deck, data);
      return;
    case "recommendations":
      renderReportDeckRecommendations(deck, data);
      return;
    case "creator_table":
      renderReportDeckCreatorTable(deck, data);
      return;
    default:
      return;
  }
}

export async function exportReportPPTX(data: ReportExportData): Promise<void> {
  const { default: PptxGenJS } = await import("pptxgenjs");
  const pptx = new PptxGenJS();
  const image = await loadReportCampaignImage(data.campaignImageUrl);

  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "PopsDrops";
  pptx.company = "Tengri Vertex, LLC";
  pptx.subject = "Campaign Report";
  pptx.title = getReportDisplayTitle(data);
  pptx.theme = {
    headFontFace: deckFontFace,
    bodyFontFace: deckFontFace,
  };

  const cover = pptx.addSlide() as unknown as PptxSlide;
  addDeckVisualLedHero(cover, data, image);
  addDeckCoverDecisionPanel(cover, data);
  addDeckCoverRecommendations(cover, data);
  addDeckCoverEditorialMetricStrip(cover, data);
  addDeckFooter(cover, data);

  const seen = new Set<string>();
  for (const blockId of getReportArtifactBlockIds(data)) {
    if (seen.has(blockId)) continue;
    seen.add(blockId);
    renderReportDeckBlock(pptx, data, blockId);
  }

  await pptx.writeFile({
    fileName: buildReportFilename(getReportDisplayTitle(data), "pptx"),
    compression: true,
  });
}
