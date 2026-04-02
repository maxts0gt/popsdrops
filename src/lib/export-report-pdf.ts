import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReportData {
  campaignTitle: string;
  dateRange: string;
  kpis: { label: string; value: string }[];
  creators: {
    name: string;
    market: string;
    platform: string;
    views: string;
    engagements: string;
    er: string;
    cpe: string;
    spent: string;
    rating: string;
  }[];
}

// ---------------------------------------------------------------------------
// PDF Generation
// ---------------------------------------------------------------------------

export function exportReportPDF(data: ReportData) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Colors
  const slate900 = [15, 23, 42] as const;
  const slate500 = [100, 116, 139] as const;
  const slate100 = [241, 245, 249] as const;

  // --- Header ---
  doc.setFillColor(...slate900);
  doc.rect(0, 0, pageWidth, 28, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("PopsDrops", 15, 12);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Campaign Report", 15, 19);

  doc.setFontSize(9);
  doc.text(
    `Generated ${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`,
    pageWidth - 15,
    12,
    { align: "right" }
  );

  // --- Campaign Title ---
  let y = 38;
  doc.setTextColor(...slate900);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(data.campaignTitle, 15, y);

  y += 6;
  doc.setTextColor(...slate500);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(data.dateRange, 15, y);

  // --- KPI cards ---
  y += 10;
  const kpiCount = data.kpis.length;
  const cardWidth = (pageWidth - 30 - (kpiCount - 1) * 4) / kpiCount;

  for (let i = 0; i < kpiCount; i++) {
    const x = 15 + i * (cardWidth + 4);
    const kpi = data.kpis[i];

    // Card background
    doc.setFillColor(...slate100);
    doc.roundedRect(x, y, cardWidth, 22, 2, 2, "F");

    // Value
    doc.setTextColor(...slate900);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(kpi.value, x + cardWidth / 2, y + 10, { align: "center" });

    // Label
    doc.setTextColor(...slate500);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.text(kpi.label, x + cardWidth / 2, y + 17, { align: "center" });
  }

  // --- Creator Performance Table ---
  y += 32;
  doc.setTextColor(...slate900);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Creator Performance", 15, y);
  y += 4;

  autoTable(doc, {
    startY: y,
    margin: { left: 15, right: 15 },
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

  // --- Footer ---
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const h = doc.internal.pageSize.getHeight();
    doc.setTextColor(...slate500);
    doc.setFontSize(7);
    doc.text(
      `PopsDrops Campaign Report — ${data.campaignTitle} — Page ${i} of ${pageCount}`,
      pageWidth / 2,
      h - 8,
      { align: "center" }
    );
  }

  // Save
  const safeName = data.campaignTitle
    .replace(/[^a-z0-9]+/gi, "-")
    .toLowerCase();
  doc.save(`popsdrops-report-${safeName}.pdf`);
}
