function formatDateParts(year: number, month: number, day: number): string {
  return `${year}/${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}`;
}

export function formatReportCompactDate(dateStr: string | null): string {
  if (!dateStr) return "-";

  const trimmed = dateStr.trim();
  const structured = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(trimmed);

  if (structured) {
    return formatDateParts(
      Number(structured[1]),
      Number(structured[2]),
      Number(structured[3]),
    );
  }

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return "-";

  return formatDateParts(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate(),
  );
}

export function formatReportCompactDateRange({
  end,
  pendingLabel,
  start,
}: {
  end: string | null;
  pendingLabel: string;
  start: string | null;
}): string {
  const startLabel = start ? formatReportCompactDate(start) : null;
  const endLabel = end ? formatReportCompactDate(end) : null;
  const hasStart = Boolean(startLabel && startLabel !== "-");
  const hasEnd = Boolean(endLabel && endLabel !== "-");

  if (hasStart && hasEnd) {
    return `${startLabel} - ${endLabel}`;
  }

  if (hasStart) return startLabel!;
  if (hasEnd) return endLabel!;
  return pendingLabel;
}
