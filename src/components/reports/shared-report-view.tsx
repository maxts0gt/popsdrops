"use client";

import { useMemo, useState } from "react";
import {
  BadgeCheck,
  CalendarDays,
  FileCheck2,
  ShieldCheck,
} from "lucide-react";
import type {
  ReportExportData,
  ReportExportMetric,
  ReportExportMetricPoint,
} from "@/lib/reporting/report-export";
import { useI18n, useTranslation } from "@/lib/i18n";

interface SharedReportViewProps {
  data: ReportExportData;
}

interface HoveredPoint extends ReportExportMetricPoint {
  x: number;
  y: number;
  metricLabel: string;
}

function axisValue(metric: ReportExportMetric, value: number): string {
  const sample = metric.points.find((point) => point.label)?.label ?? metric.value;

  if (sample.includes("$")) {
    return `$${value.toLocaleString("en-US", {
      maximumFractionDigits: value < 10 ? 2 : 0,
    })}`;
  }

  if (sample.includes("%")) {
    return `${value.toFixed(1)}%`;
  }

  if (sample.includes("K") && value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }

  return value.toLocaleString("en-US", { maximumFractionDigits: 1 });
}

function chartDate(value: string): string {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return value;

  return `${String(date.getUTCMonth() + 1).padStart(2, "0")}/${String(
    date.getUTCDate(),
  ).padStart(2, "0")}`;
}

function ReportLineChart({ metric }: { metric: ReportExportMetric }) {
  const { t } = useTranslation("brand.report");
  const [hoveredPoint, setHoveredPoint] = useState<HoveredPoint | null>(null);
  const width = 760;
  const height = 300;
  const left = 58;
  const right = 36;
  const top = 26;
  const bottom = 58;
  const chartWidth = width - left - right;
  const chartHeight = height - top - bottom;
  const maxValue = Math.max(...metric.points.map((point) => point.value), 1);
  const midValue = maxValue / 2;
  const positioned = metric.points.map((point, index) => {
    const x = metric.points.length === 1
      ? left + chartWidth / 2
      : left + (index / (metric.points.length - 1)) * chartWidth;
    const y = top + chartHeight - (point.value / maxValue) * chartHeight;

    return { ...point, x, y };
  });
  const linePath = positioned
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");
  const areaPath = positioned.length > 0
    ? `${linePath} L ${positioned[positioned.length - 1].x} ${top + chartHeight} L ${positioned[0].x} ${top + chartHeight} Z`
    : "";

  if (metric.points.length === 0) {
    return (
      <div className="flex min-h-64 items-center justify-center text-sm text-slate-500">
        {t("share.noChartData")}
      </div>
    );
  }

  return (
    <div className="relative">
      <svg
        className="h-auto w-full"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${metric.label} chart`}
      >
        <line x1={left} x2={width - right} y1={top} y2={top} stroke="#e8edf3" />
        <line
          x1={left}
          x2={width - right}
          y1={top + chartHeight / 2}
          y2={top + chartHeight / 2}
          stroke="#e8edf3"
        />
        <line
          x1={left}
          x2={width - right}
          y1={top + chartHeight}
          y2={top + chartHeight}
          stroke="#d5dde8"
        />
        <text x={left - 14} y={top + 4} textAnchor="end" className="fill-slate-500 text-[12px] font-semibold">
          {axisValue(metric, maxValue)}
        </text>
        <text x={left - 14} y={top + chartHeight / 2 + 4} textAnchor="end" className="fill-slate-500 text-[12px] font-semibold">
          {axisValue(metric, midValue)}
        </text>
        <text x={left - 14} y={top + chartHeight + 4} textAnchor="end" className="fill-slate-500 text-[12px] font-semibold">
          0
        </text>
        <path d={areaPath} fill="#0f172a" opacity="0.06" />
        <path
          d={linePath}
          fill="none"
          stroke="#0f172a"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="3"
        />
        {positioned.map((point) => (
          <circle
            key={`${point.date}-${point.label}`}
            data-testid="shared-report-point"
            cx={point.x}
            cy={point.y}
            r="5"
            fill="#fff"
            stroke="#0f172a"
            strokeWidth="3"
            tabIndex={0}
            onBlur={() => setHoveredPoint(null)}
            onFocus={() => setHoveredPoint({ ...point, metricLabel: metric.label })}
            onMouseEnter={() => setHoveredPoint({ ...point, metricLabel: metric.label })}
            onMouseLeave={() => setHoveredPoint(null)}
          />
        ))}
        {positioned.map((point) => (
          <text
            key={`${point.date}-label`}
            x={point.x}
            y={height - 22}
            textAnchor="middle"
            className="fill-slate-500 text-[12px] font-semibold"
          >
            {chartDate(point.date)}
          </text>
        ))}
      </svg>
      {hoveredPoint && (
        <div
          data-testid="shared-report-tooltip"
          className="pointer-events-none absolute rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm"
          style={{
            left: `${(hoveredPoint.x / width) * 100}%`,
            top: `${(hoveredPoint.y / height) * 100}%`,
            transform: "translate(-50%, -110%)",
          }}
        >
          <p className="font-semibold text-slate-900">{hoveredPoint.metricLabel}</p>
          <p className="text-slate-600">
            {hoveredPoint.label} · {chartDate(hoveredPoint.date)}
          </p>
        </div>
      )}
    </div>
  );
}

export function SharedReportView({ data }: SharedReportViewProps) {
  const { t } = useTranslation("brand.report");
  const { locale } = useI18n();
  const [selectedSectionIndex, setSelectedSectionIndex] = useState(0);
  const [selectedMetricKey, setSelectedMetricKey] = useState(
    data.sections[0]?.metrics[0]?.key ?? data.sections[0]?.metrics[0]?.label ?? "",
  );
  const selectedSection = data.sections[selectedSectionIndex] ?? data.sections[0];
  const selectedMetric = useMemo(() => {
    return (
      selectedSection?.metrics.find(
        (metric) => (metric.key ?? metric.label) === selectedMetricKey,
      ) ??
      selectedSection?.metrics[0] ??
      null
    );
  }, [selectedMetricKey, selectedSection]);
  const trustIcons = [FileCheck2, ShieldCheck, CalendarDays, BadgeCheck];

  return (
    <main
      data-testid="shared-report-view"
      className="min-h-svh bg-slate-50 text-slate-900"
    >
      <header className="bg-slate-950 text-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-5 px-5 py-8 sm:flex-row sm:items-start sm:justify-between sm:px-8">
          <div>
            <p className="text-2xl font-semibold">PopsDrops</p>
            <p className="mt-1 text-sm text-slate-300">{t("share.sharedEyebrow")}</p>
          </div>
          <p className="text-sm text-slate-300">
            {t("share.generated", {
              date: new Date(data.generatedAt).toLocaleDateString(locale, {
                month: "short",
                day: "numeric",
                year: "numeric",
              }),
            })}
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
        <div className="mb-7">
          <h1 className="text-3xl font-semibold leading-tight">
            {t("titleForCampaign", { title: data.campaignTitle })}
          </h1>
          <p className="mt-2 text-sm text-slate-600">{data.dateRange}</p>
        </div>

        <section className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {data.kpis.map((metric) => (
            <article
              key={metric.label}
              className="grid min-h-28 grid-rows-[2rem_auto_1fr] rounded-xl border border-slate-200 bg-white p-4"
            >
              <p className="text-xs font-semibold text-slate-500">{metric.label}</p>
              <p className="self-end text-2xl font-semibold">{metric.value}</p>
              <p className="self-end text-xs text-slate-600">{metric.detail}</p>
            </article>
          ))}
        </section>

        <section className="mb-8 grid grid-cols-1 overflow-hidden rounded-xl border border-slate-200 bg-white sm:grid-cols-2 lg:grid-cols-4">
          {data.trust.map((item, index) => {
            const Icon = trustIcons[index] ?? BadgeCheck;

            return (
              <article
                key={item.label}
                className="border-b border-slate-200 p-4 last:border-b-0 sm:border-e sm:last:border-e-0 lg:border-b-0"
              >
                <div className="mb-3 flex items-center gap-2 text-slate-500">
                  <Icon className="size-4" />
                  <p className="truncate text-xs font-medium">{item.label}</p>
                </div>
                <p className="truncate text-lg font-semibold">{item.value}</p>
                <p className="mt-1 truncate text-xs text-slate-500">{item.detail}</p>
              </article>
            );
          })}
        </section>

        <section className="mb-8 rounded-xl border border-slate-200 bg-white">
          <div className="flex flex-col gap-4 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap gap-2">
                {data.sections.map((section, index) => (
                  <button
                    key={section.title}
                    type="button"
                    onClick={() => {
                      setSelectedSectionIndex(index);
                      setSelectedMetricKey(section.metrics[0]?.key ?? section.metrics[0]?.label ?? "");
                    }}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium ${
                      selectedSectionIndex === index
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-600"
                    }`}
                  >
                    {section.title}
                  </button>
                ))}
              </div>
              <h2 className="mt-4 text-lg font-semibold">{selectedSection?.detail}</h2>
            </div>
            <div className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-slate-50 p-1">
              {selectedSection?.metrics.map((metric) => (
                <button
                  key={metric.key ?? metric.label}
                  type="button"
                  onClick={() => setSelectedMetricKey(metric.key ?? metric.label)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium ${
                    (metric.key ?? metric.label) === selectedMetricKey
                      ? "bg-slate-900 text-white"
                      : "text-slate-600"
                  }`}
                >
                  {metric.label}
                </button>
              ))}
            </div>
          </div>
          {selectedMetric && (
            <div className="p-5">
              <div className="mb-3 flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-500">
                    {selectedSection?.title}
                  </p>
                  <p className="mt-1 text-2xl font-semibold">{selectedMetric.value}</p>
                </div>
                <p className="text-sm text-slate-500">{selectedMetric.detail}</p>
              </div>
              <ReportLineChart metric={selectedMetric} />
            </div>
          )}
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-semibold">{t("section.creatorPerformance")}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-start text-xs font-semibold uppercase text-slate-500">
                  <th className="px-5 py-3 text-start">{t("table.creator")}</th>
                  <th className="px-5 py-3 text-start">{t("table.market")}</th>
                  <th className="px-5 py-3 text-start">{t("table.platform")}</th>
                  <th className="px-5 py-3 text-end">{t("table.views")}</th>
                  <th className="px-5 py-3 text-end">{t("table.engagements")}</th>
                  <th className="px-5 py-3 text-end">{t("table.er")}</th>
                  <th className="px-5 py-3 text-end">{t("table.cpe")}</th>
                  <th className="px-5 py-3 text-end">{t("table.spent")}</th>
                  <th className="px-5 py-3 text-end">{t("table.rating")}</th>
                </tr>
              </thead>
              <tbody>
                {data.creators.map((creator) => (
                  <tr key={`${creator.name}-${creator.platform}`} className="border-b border-slate-100 last:border-b-0">
                    <td className="px-5 py-3 font-medium">{creator.name}</td>
                    <td className="px-5 py-3">{creator.market}</td>
                    <td className="px-5 py-3">{creator.platform}</td>
                    <td className="px-5 py-3 text-end">{creator.views}</td>
                    <td className="px-5 py-3 text-end">{creator.engagements}</td>
                    <td className="px-5 py-3 text-end">{creator.er}</td>
                    <td className="px-5 py-3 text-end">{creator.cpe}</td>
                    <td className="px-5 py-3 text-end">{creator.spent}</td>
                    <td className="px-5 py-3 text-end">{creator.rating}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
