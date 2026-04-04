"use client";

import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import { useTranslation } from "@/lib/i18n";
import { getMarketLabel } from "@/lib/constants";
import {
  MARKETING_MOCK_IDENTITIES,
  type MarketingMockIdentityId,
} from "@/lib/marketing/mock-preview";

const fade = {
  initial: { opacity: 0, y: 16 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-40px" } as const,
  transition: { duration: 0.45 },
};

export default function ForBrandsPage() {
  const { t, isRTL, locale } = useTranslation("marketing.forBrands");
  const creatorRows: Array<{
    id: MarketingMockIdentityId;
    platform: string;
    er: string;
    content: string;
    statusKey: string;
    color: string;
  }> = [
    { id: "yp", platform: "Instagram", er: "9.3%", content: "4/4", statusKey: "mock.status.published", color: "text-emerald-500" },
    { id: "st", platform: "TikTok", er: "11.2%", content: "3/3", statusKey: "mock.status.published", color: "text-emerald-500" },
    { id: "lm", platform: "Instagram", er: "8.1%", content: "2/3", statusKey: "mock.status.inReview", color: "text-blue-500" },
    { id: "na", platform: "Snapchat", er: "12.4%", content: "3/3", statusKey: "mock.status.approved", color: "text-slate-600" },
    { id: "sr", platform: "TikTok", er: "10.7%", content: "1/2", statusKey: "mock.status.drafting", color: "text-slate-400" },
  ];

  return (
    <div className="bg-white">
      {/* HERO */}
      <section className="pb-12 pt-28 sm:pb-16 sm:pt-36">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="whitespace-pre-line text-3xl font-extrabold leading-[1.1] tracking-tight text-slate-900 sm:text-4xl lg:text-5xl"
          >
            {t("headline")}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mx-auto mt-4 max-w-md text-base text-slate-500"
          >
            {t("subheadline")}
          </motion.p>
        </div>
      </section>

      {/* FEATURES — title-only chips */}
      <section className="pb-16">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="mx-auto flex max-w-3xl flex-wrap items-center justify-center gap-2 px-6"
        >
          {["feature.vetted", "feature.translate", "feature.match", "feature.review", "feature.report", "feature.byoc"].map((key) => (
            <span
              key={key}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
            >
              {t(key)}
            </span>
          ))}
        </motion.div>
      </section>

      {/* PAIN POINTS — Why cross-border campaigns fail */}
      <section className="border-y border-slate-100 bg-slate-50/50 py-20 sm:py-24">
        <div className="mx-auto max-w-4xl px-6">
          <motion.div {...fade} className="mb-12 text-center">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{t("pain.label")}</span>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{t("pain.title")}</h2>
          </motion.div>

          <div className="grid gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 sm:grid-cols-3">
            {[
              { problemKey: "pain.1.problem", solutionKey: "pain.1.solution" },
              { problemKey: "pain.2.problem", solutionKey: "pain.2.solution" },
              { problemKey: "pain.3.problem", solutionKey: "pain.3.solution" },
            ].map((item, i) => (
              <motion.div
                key={item.problemKey}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="bg-white p-6 sm:p-7"
              >
                <p className="text-sm font-medium text-slate-900">{t(item.problemKey)}</p>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">{t(item.solutionKey)}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* DASHBOARD PREVIEW — the management experience */}
      <section className="py-20 sm:py-24">
        <div className="mx-auto max-w-5xl px-6">
          <motion.div {...fade} className="mb-12 text-center">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{t("dashboard.label")}</span>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{t("dashboard.title")}</h2>
          </motion.div>

          <motion.div {...fade} className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_60px_-12px_rgba(0,0,0,0.08)] ring-1 ring-slate-900/[0.03]">
            {/* Window chrome */}
            <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5">
              <div className="flex gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-red-400/50" />
                <div className="h-2.5 w-2.5 rounded-full bg-amber-400/50" />
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-400/50" />
              </div>
              <div className="ms-3 flex gap-1 text-[10px] font-medium">
                <div className="rounded-md bg-slate-900 px-3 py-1 text-white">{t("mock.tab.overview")}</div>
                <div className="rounded-md px-3 py-1 text-slate-400">{t("mock.tab.creators")}</div>
                <div className="rounded-md px-3 py-1 text-slate-400">{t("mock.tab.content")}</div>
                <div className="rounded-md px-3 py-1 text-slate-400">{t("mock.tab.analytics")}</div>
              </div>
            </div>

            <div className="p-5 sm:p-8">
              {/* Campaign header */}
              <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Skincare Launch — Q2 2026</p>
                  <p className="mt-0.5 text-[11px] text-slate-400">Glow Beauty Co. · 3 markets · 5 platforms</p>
                </div>
                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[10px] font-semibold text-blue-600">
                  {t("mock.status.inProgress")}
                </span>
              </div>

              {/* Metrics */}
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
                {[
                  { label: t("mock.metric.activeCreators"), value: "12", sub: t("mock.metric.activeCreators.sub") },
                  { label: t("mock.metric.contentPieces"), value: "34", sub: t("mock.metric.contentPieces.sub") },
                  { label: t("mock.metric.totalReach"), value: "2.1M", sub: t("mock.metric.totalReach.sub") },
                  { label: t("mock.metric.avgCpe"), value: "$0.12", sub: t("mock.metric.avgCpe.sub") },
                ].map((m) => (
                  <div key={m.label} className="rounded-lg border border-slate-100 bg-white px-3 py-2.5">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">{m.label}</p>
                    <p className="mt-0.5 text-lg font-bold text-slate-900">{m.value}</p>
                    <p className="text-[10px] text-slate-400">{m.sub}</p>
                  </div>
                ))}
              </div>

              {/* Creator table */}
              <div className="mt-4 hidden sm:block">
                <div className="grid grid-cols-12 gap-2 border-b border-slate-100 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  <div className="col-span-4">{t("mock.col.creator")}</div>
                  <div className="col-span-2">{t("mock.col.platform")}</div>
                  <div className="col-span-2 text-end">{t("mock.col.engRate")}</div>
                  <div className="col-span-2 text-end">{t("mock.col.content")}</div>
                  <div className="col-span-2 text-end">{t("mock.col.status")}</div>
                </div>
                {creatorRows.map((c) => {
                  const identity = MARKETING_MOCK_IDENTITIES[c.id];

                  return (
                    <div
                      key={c.id}
                      className="grid grid-cols-12 items-center gap-2 border-b border-slate-50 py-2.5 last:border-0"
                    >
                      <div className="col-span-4 flex items-center gap-2.5">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">
                          {identity.badge}
                        </div>
                        <div>
                          <p className="text-xs font-medium text-slate-700">
                            {identity.label}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {getMarketLabel(identity.marketKey, locale)}
                          </p>
                        </div>
                      </div>
                      <div className="col-span-2 text-xs text-slate-500">
                        {c.platform}
                      </div>
                      <div className="col-span-2 text-end text-xs font-medium text-slate-700">
                        {c.er}
                      </div>
                      <div className="col-span-2 text-end text-xs text-slate-500">
                        {c.content}
                      </div>
                      <div
                        className={`col-span-2 text-end text-[11px] font-medium ${c.color}`}
                      >
                        {t(c.statusKey)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* BOTTOM CTA */}
      <section className="border-t border-slate-100 bg-slate-50/50 py-20">
        <div className="mx-auto max-w-md px-6 text-center">
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">{t("final.title")}</h2>
          <div className="mt-6">
            <a
              href="/request-invite?type=brand"
              className="group inline-flex items-center gap-2 rounded-xl bg-slate-900 px-7 py-3.5 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition-all hover:bg-slate-800 hover:shadow-xl"
            >
              {t("cta")}
              <ArrowRight className={`h-4 w-4 transition-transform group-hover:translate-x-0.5 ${isRTL ? "rotate-180 group-hover:-translate-x-0.5" : ""}`} />
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
