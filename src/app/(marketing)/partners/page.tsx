"use client";

import { ArrowRight } from "lucide-react";
import { motion } from "motion/react";
import { useTranslation } from "@/lib/i18n";

export default function PartnersPage() {
  const { t } = useTranslation("marketing.partners");

  const chips = [
    t("chip.research"),
    t("chip.vetting"),
    t("chip.intro"),
    t("chip.deal"),
  ];

  return (
    <div className="bg-white">
      {/* HERO */}
      <section className="pt-28 pb-12 sm:pt-36 sm:pb-16">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-3xl font-extrabold leading-[1.1] tracking-tight text-slate-900 sm:text-4xl lg:text-5xl"
          >
            {t("headline")}
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mx-auto mt-4 max-w-lg text-base text-slate-500"
          >
            {t("subheadline")}
          </motion.p>
        </div>
      </section>

      {/* HOW IT WORKS — minimal */}
      <section className="pb-12">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-2 px-6"
        >
          {chips.map((item) => (
            <span
              key={item}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700"
            >
              {item}
            </span>
          ))}
        </motion.div>
      </section>

      {/* TWO PATHS */}
      <section className="py-12">
        <div className="mx-auto max-w-3xl px-6">
          <div className="grid gap-6 sm:grid-cols-2">
            {/* Brand side */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45 }}
              className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t("brands.label")}</p>
              <h2 className="mt-3 text-xl font-bold text-slate-900">
                {t("brands.title")}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                {t("brands.desc")}
              </p>
              <div className="mt-6 space-y-2 text-sm text-slate-600">
                {[t("brands.step1"), t("brands.step2"), t("brands.step3")].map((step) => (
                  <div key={step} className="flex items-start gap-2">
                    <span className="mt-0.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
                    <span>{step}</span>
                  </div>
                ))}
              </div>
              <a
                href="mailto:partners@popsdrops.com?subject=Brand%20partnership%20inquiry"
                className="group mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800"
              >
                {t("brands.cta")}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </a>
            </motion.div>

            {/* Partner side */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: 0.1 }}
              className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8"
            >
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t("distributors.label")}</p>
              <h2 className="mt-3 text-xl font-bold text-slate-900">
                {t("distributors.title")}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">
                {t("distributors.desc")}
              </p>
              <div className="mt-6 space-y-2 text-sm text-slate-600">
                {[t("distributors.step1"), t("distributors.step2"), t("distributors.step3")].map((step) => (
                  <div key={step} className="flex items-start gap-2">
                    <span className="mt-0.5 block h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
                    <span>{step}</span>
                  </div>
                ))}
              </div>
              <a
                href="mailto:partners@popsdrops.com?subject=Distributor%20partnership%20inquiry"
                className="group mt-6 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50"
              >
                {t("distributors.cta")}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </a>
            </motion.div>
          </div>
        </div>
      </section>

      {/* COMMISSION — transparent */}
      <section className="py-12">
        <div className="mx-auto max-w-xl px-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{t("commission.label")}</p>
          <p className="mt-3 text-sm leading-relaxed text-slate-500">
            {t("commission.desc")}
          </p>
        </div>
      </section>
    </div>
  );
}
