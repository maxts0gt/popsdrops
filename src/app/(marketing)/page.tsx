"use client";

import { ArrowRight, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { useTranslation } from "@/lib/i18n";

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const } },
};

const sectionFade = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" } as const,
  transition: { duration: 0.5 },
};

export default function LandingPage() {
  const { t, isRTL } = useTranslation("marketing.landing");

  return (
    <div className="bg-white">
      {/* ============================================================
        * HERO — Tight, commanding, no wasted space
        * ============================================================ */}
      <section className="relative flex min-h-[80vh] items-center justify-center overflow-hidden bg-slate-950">
        {/* Atmospheric gradient orbs */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -top-[40%] start-[10%] h-[80vh] w-[80vh] rounded-full bg-teal-500/[0.07] blur-[120px]" />
          <div className="absolute -bottom-[20%] end-[5%] h-[60vh] w-[60vh] rounded-full bg-amber-500/[0.05] blur-[100px]" />
          <div className="absolute top-[20%] end-[20%] h-[40vh] w-[40vh] rounded-full bg-slate-500/[0.08] blur-[80px]" />
        </div>

        {/* Subtle grid pattern */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: "64px 64px",
          }}
        />

        {/* Bottom fade */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-slate-950 to-transparent" />

        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="relative z-10 mx-auto max-w-7xl px-6 pb-16 pt-32 text-center"
        >
          <motion.h1
            variants={fadeUp}
            className="whitespace-pre-line text-4xl font-extrabold leading-[1.06] tracking-tight text-white sm:text-6xl lg:text-7xl"
          >
            {t("headline")}
          </motion.h1>

          <motion.p
            variants={fadeUp}
            className="mx-auto mt-6 max-w-md text-base leading-relaxed text-slate-400 sm:text-lg"
          >
            {t("subheadline")}
          </motion.p>

          <motion.div
            variants={fadeUp}
            className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center"
          >
            <a
              href="/request-invite"
              className="group relative inline-flex items-center gap-2.5 rounded-xl bg-white px-8 py-4 text-sm font-semibold text-slate-900 shadow-2xl shadow-white/10 transition-all hover:scale-[1.02] hover:shadow-white/20"
            >
              {t("cta")}
              <ArrowRight className={`h-4 w-4 transition-transform group-hover:translate-x-0.5 ${isRTL ? "rotate-180 group-hover:-translate-x-0.5" : ""}`} />
            </a>
            <a href="/login" className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-300">
              {t("cta.login")}
            </a>
          </motion.div>

          {/* Trust markers — more visible */}
          <motion.div
            variants={fadeUp}
            className="mt-16 flex flex-wrap items-center justify-center gap-x-6 gap-y-2"
          >
            {["trust.platforms", "trust.languages", "trust.market", "trust.ai"].map((key, i) => (
              <span key={key} className="flex items-center gap-2 text-xs font-medium tracking-wide text-slate-500">
                {i > 0 && <span className="hidden text-slate-700/40 sm:inline">·</span>}
                {t(key)}
              </span>
            ))}
          </motion.div>
        </motion.div>
      </section>

      {/* ============================================================
        * HOW IT WORKS — 4 steps, clean, confidence-building
        * ============================================================ */}
      <section className="relative py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <motion.div {...sectionFade} className="mb-16 text-center">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{t("section.how.label")}</span>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {t("section.how.title")}
            </h2>
          </motion.div>

          <div className="mx-auto grid max-w-4xl gap-px overflow-hidden rounded-2xl border border-slate-200 bg-slate-200 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { step: "01", titleKey: "how.step1.title", descKey: "how.step1.desc" },
              { step: "02", titleKey: "how.step2.title", descKey: "how.step2.desc" },
              { step: "03", titleKey: "how.step3.title", descKey: "how.step3.desc" },
              { step: "04", titleKey: "how.step4.title", descKey: "how.step4.desc" },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.08 }}
                className="bg-white p-6 sm:p-7"
              >
                <span className="text-xs font-bold text-slate-300">{item.step}</span>
                <h3 className="mt-3 text-base font-bold text-slate-900">{t(item.titleKey)}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">{t(item.descKey)}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================
        * REPORT PREVIEW — Proof section
        * ============================================================ */}
      <section className="relative bg-slate-50/50 py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <motion.div {...sectionFade} className="mb-12 text-center">
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{t("section.report.label")}</span>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {t("section.report.title")}
            </h2>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.97 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] as const }}
            className="mx-auto max-w-5xl"
          >
            <div className="rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_60px_-12px_rgba(0,0,0,0.08)] ring-1 ring-slate-900/[0.03]">
              {/* Window chrome */}
              <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5">
                <div className="flex gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-red-400/50" />
                  <div className="h-2.5 w-2.5 rounded-full bg-amber-400/50" />
                  <div className="h-2.5 w-2.5 rounded-full bg-emerald-400/50" />
                </div>
                <div className="ms-3 flex gap-1 text-[10px] font-medium">
                  <div className="rounded-md bg-slate-900 px-3 py-1 text-white">{t("report.tab.report")}</div>
                  <div className="rounded-md px-3 py-1 text-slate-400">{t("report.tab.creators")}</div>
                  <div className="rounded-md px-3 py-1 text-slate-400">{t("report.tab.content")}</div>
                </div>
              </div>

              <div className="p-6 sm:p-8">
                {/* Report header */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{t("report.title")}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">{t("report.subtitle")}</p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-semibold text-emerald-600 ring-1 ring-emerald-100">
                    {t("report.status")}
                  </span>
                </div>

                {/* Metrics */}
                <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
                  {[
                    { key: "report.metric.reach", value: "2.1M" },
                    { key: "report.metric.engagements", value: "184K" },
                    { key: "report.metric.engRate", value: "8.7%" },
                    { key: "report.metric.cpe", value: "$0.12" },
                    { key: "report.metric.spend", value: "$4,200" },
                  ].map((m, i) => (
                    <motion.div
                      key={m.key}
                      initial={{ opacity: 0, y: 12 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: 0.1 + i * 0.05 }}
                      className="rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3"
                    >
                      <p className="text-[9px] font-semibold uppercase tracking-wider text-slate-400">{t(m.key)}</p>
                      <p className="mt-1 text-xl font-bold text-slate-900">{m.value}</p>
                    </motion.div>
                  ))}
                </div>

                {/* Creator performance table */}
                <div className="mt-6 hidden sm:block">
                  <div className="grid grid-cols-12 gap-2 border-b border-slate-100 pb-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    <div className="col-span-3">{t("report.col.creator")}</div>
                    <div className="col-span-2">{t("report.col.platform")}</div>
                    <div className="col-span-2 text-end">{t("report.col.reach")}</div>
                    <div className="col-span-2 text-end">{t("report.col.engRate")}</div>
                    <div className="col-span-1 text-end">{t("report.col.cpe")}</div>
                    <div className="col-span-2 text-end">{t("report.col.cost")}</div>
                  </div>
                  {[
                    { name: "Yuna Park", market: "South Korea", platform: "Instagram", reach: "520K", er: "9.3%", cpe: "$0.08", cost: "$800" },
                    { name: "Sakura Tanaka", market: "Japan", platform: "TikTok", reach: "680K", er: "11.2%", cpe: "$0.06", cost: "$750" },
                    { name: "Léa Moreau", market: "France", platform: "Instagram", reach: "310K", er: "8.1%", cpe: "$0.14", cost: "$900" },
                    { name: "Nora Al-Rashidi", market: "Saudi Arabia", platform: "Snapchat", reach: "420K", er: "12.4%", cpe: "$0.10", cost: "$850" },
                    { name: "Sofia Reyes", market: "Mexico", platform: "TikTok", reach: "390K", er: "10.7%", cpe: "$0.11", cost: "$700" },
                  ].map((c) => (
                    <div key={c.name} className="grid grid-cols-12 items-center gap-2 border-b border-slate-50 py-3 last:border-0">
                      <div className="col-span-3 flex items-center gap-2.5">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[9px] font-bold text-slate-500">
                          {c.name.split(" ").map(n => n[0]).join("")}
                        </div>
                        <div>
                          <p className="text-xs font-medium text-slate-700">{c.name}</p>
                          <p className="text-[9px] text-slate-400">{c.market}</p>
                        </div>
                      </div>
                      <div className="col-span-2 text-xs text-slate-500">{c.platform}</div>
                      <div className="col-span-2 text-end text-xs text-slate-700">{c.reach}</div>
                      <div className="col-span-2 text-end text-xs font-semibold text-slate-900">{c.er}</div>
                      <div className="col-span-1 text-end text-xs text-slate-500">{c.cpe}</div>
                      <div className="col-span-2 text-end text-xs font-medium text-slate-700">{c.cost}</div>
                    </div>
                  ))}
                </div>

                {/* AI recommendation */}
                <div className="mt-6 flex items-start gap-3 rounded-xl border border-slate-100 bg-gradient-to-r from-slate-50 to-transparent px-5 py-4">
                  <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-900">
                    <Sparkles className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{t("report.ai.label")}</p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">
                      {t("report.ai.text")}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ============================================================
        * TWO PATHS — Elevated cards
        * ============================================================ */}
      <section className="relative py-20 sm:py-28">
        <div className="mx-auto max-w-3xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.5 }}
            className="grid gap-4 sm:grid-cols-2"
          >
            <a
              href="/for-brands"
              className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-7 transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg"
            >
              <div className="pointer-events-none absolute -end-8 -top-8 h-24 w-24 rounded-full bg-slate-100/50 transition-transform group-hover:scale-150" />
              <div className="relative">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
                  </svg>
                </div>
                <p className="text-lg font-bold text-slate-900">{t("cta.brands")}</p>
                <p className="mt-1 text-sm text-slate-500">{t("cta.brands.desc")}</p>
                <div className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                  <span>{t("cta.learnMore")}</span>
                  <ArrowRight className={`h-3.5 w-3.5 transition-transform group-hover:translate-x-1 ${isRTL ? "rotate-180 group-hover:-translate-x-1" : ""}`} />
                </div>
              </div>
            </a>
            <a
              href="/for-creators"
              className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-7 transition-all hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-lg"
            >
              <div className="pointer-events-none absolute -end-8 -top-8 h-24 w-24 rounded-full bg-slate-100/50 transition-transform group-hover:scale-150" />
              <div className="relative">
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
                  </svg>
                </div>
                <p className="text-lg font-bold text-slate-900">{t("cta.creators")}</p>
                <p className="mt-1 text-sm text-slate-500">{t("cta.creators.desc")}</p>
                <div className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                  <span>{t("cta.learnMore")}</span>
                  <ArrowRight className={`h-3.5 w-3.5 transition-transform group-hover:translate-x-1 ${isRTL ? "rotate-180 group-hover:-translate-x-1" : ""}`} />
                </div>
              </div>
            </a>
          </motion.div>
        </div>
      </section>

      {/* ============================================================
        * FINAL CTA — Strong close
        * ============================================================ */}
      <section className="relative border-t border-slate-100 bg-slate-50/50 py-20 sm:py-28">
        <div className="mx-auto max-w-md px-6 text-center">
          <motion.div {...sectionFade}>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {t("final.title")}
            </h2>
            <div className="mt-8">
              <a
                href="/request-invite"
                className="group inline-flex items-center gap-2 rounded-xl bg-slate-900 px-8 py-4 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition-all hover:bg-slate-800 hover:shadow-xl hover:shadow-slate-900/25"
              >
                {t("final.cta")}
                <ArrowRight className={`h-4 w-4 transition-transform group-hover:translate-x-0.5 ${isRTL ? "rotate-180 group-hover:-translate-x-0.5" : ""}`} />
              </a>
            </div>
            <p className="mt-4">
              <a href="/login" className="text-sm text-slate-400 transition-colors hover:text-slate-600">
                {t("final.login")}
              </a>
            </p>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
