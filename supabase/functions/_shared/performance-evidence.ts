export type ExpectedEvidenceMetric = {
  metricKey: string;
  metricLabel: string;
};

export type ParsedEvidenceMetricPayload = {
  metricValues: Array<{
    metricKey: string;
    metricLabel: string;
    metricValue?: number;
    metricText?: string;
    confidence?: number;
  }>;
  confidenceSummary: Record<string, unknown>;
};

function normalizeMetricName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function parseMetricNumber(value: string) {
  const normalized = value.trim().replace(/,/g, "").replace(/%$/, "");
  if (normalized === "") return undefined;

  const multiplier = /k$/i.test(normalized)
    ? 1000
    : /m$/i.test(normalized)
      ? 1000000
      : 1;
  const numericText = normalized.replace(/[km]$/i, "");
  const parsed = Number(numericText);
  return Number.isFinite(parsed) ? parsed * multiplier : undefined;
}

export function parseStructuredCsvMetricPayload(
  csvText: string,
  expectedMetrics: ExpectedEvidenceMetric[],
): ParsedEvidenceMetricPayload {
  const lines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return {
      metricValues: [],
      confidenceSummary: {
        overall: "low",
        method: "structured_csv",
        note: "CSV did not contain enough rows.",
      },
    };
  }

  const headers = parseCsvLine(lines[0]).map(normalizeMetricName);
  const metricIndex = headers.findIndex((header) =>
    ["metric", "metric_key", "metric_label", "label", "name"].includes(header),
  );
  const valueIndex = headers.findIndex((header) =>
    ["value", "metric_value", "metric_text"].includes(header),
  );

  if (metricIndex < 0 || valueIndex < 0) {
    return {
      metricValues: [],
      confidenceSummary: {
        overall: "low",
        method: "structured_csv",
        note: "CSV did not include metric and value columns.",
      },
    };
  }

  const expectedByName = new Map<string, ExpectedEvidenceMetric>();
  for (const metric of expectedMetrics) {
    expectedByName.set(normalizeMetricName(metric.metricKey), metric);
    expectedByName.set(normalizeMetricName(metric.metricLabel), metric);
  }

  const metricValues = lines.slice(1).flatMap((line) => {
    const columns = parseCsvLine(line);
    const rawMetric = columns[metricIndex]?.trim();
    const rawValue = columns[valueIndex]?.trim();
    if (!rawMetric || !rawValue) return [];

    const expectedMetric = expectedByName.get(normalizeMetricName(rawMetric));
    if (expectedMetrics.length > 0 && !expectedMetric) return [];

    const metricKey = expectedMetric?.metricKey ?? normalizeMetricName(rawMetric);
    const metricLabel = expectedMetric?.metricLabel ?? rawMetric;
    const metricValue = parseMetricNumber(rawValue);

    return [
      {
        metricKey,
        metricLabel,
        metricValue,
        metricText: metricValue == null ? rawValue : undefined,
        confidence: 1,
      },
    ];
  });

  return {
    metricValues,
    confidenceSummary: {
      overall: metricValues.length > 0 ? 1 : "low",
      method: "structured_csv",
    },
  };
}
